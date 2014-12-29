var childProcess = require('child_process'),
    async = require('async'),
    _ = require('underscore'),
    urlTools = require('urltools'),
    getFiltersAndTargetContentTypeFromQueryString = require('express-processimage/lib/getFiltersAndTargetContentTypeFromQueryString'),
    PngCrush = require('pngcrush'),
    PngQuantWithHistogram = require('../PngQuantWithHistogram'),
    OptiPng = require('optipng'),
    JpegTran = require('jpegtran');

module.exports = function (queryObj, options) {
    options = options || {};
    var isAvailableByBinaryName = {
        jpegtran: true,
        pngcrush: true,
        pngquant: true,
        optipng: true,
        gm: true
    };
    return function processImages(assetGraph, cb) {
        async.each(Object.keys(isAvailableByBinaryName), function (binaryName, cb) {
            if (binaryName === 'jpegtran' || binaryName === 'optipng') {
                ({jpegtran: JpegTran, optipng: OptiPng})[binaryName].getBinaryPath(function (err, binaryPath) {
                    if (err) {
                        assetGraph.emit('warn', new Error('processImages: ' + binaryName + ' not installed. Install it to get smaller ' + (binaryName === 'jpegtran' ? 'jpgs' : 'pngs')));
                        isAvailableByBinaryName[binaryName] = false;
                    }
                    cb();
                });
            } else {
                childProcess.execFile(binaryName, function (err) {
                    if (err && (err.code === 127 || err.code === 'ENOENT')) {
                        if (binaryName !== 'gm' && binaryName !== 'inkscape') {
                            assetGraph.emit('warn', new Error('processImages: ' + binaryName + ' not installed. Install it to get smaller pngs'));
                        }
                        isAvailableByBinaryName[binaryName] = false;
                    }
                    cb();
                });
            }
        }, function () {
            async.eachLimit(assetGraph.findAssets(_.extend({isImage: true, isInline: false}, queryObj)), 10, function (imageAsset, cb) {
                var filters = [],
                    operationNames = [],
                    targetContentType = imageAsset.contentType,
                    matchQueryString = imageAsset.url.match(/\?([^#]*)/),
                    usedQueryString,
                    leftOverQueryString;

                if (matchQueryString) {
                    var filtersAndTargetContentType = getFiltersAndTargetContentTypeFromQueryString(matchQueryString[1], urlTools.fileUrlToFsPath(assetGraph.root), urlTools.fileUrlToFsPath(imageAsset.nonInlineAncestor.url));
                    if (filtersAndTargetContentType.filters.length > 0) {
                        Array.prototype.push.apply(filters, filtersAndTargetContentType.filters);
                        Array.prototype.push.apply(operationNames, filtersAndTargetContentType.operationNames);

                        if (filtersAndTargetContentType.targetContentType) {
                            targetContentType = filtersAndTargetContentType.targetContentType;
                        }

                        usedQueryString = filtersAndTargetContentType.usedQueryStringFragments.join('-').replace(/[^a-z0-9\.\-=,]/gi, '-');
                        leftOverQueryString = filtersAndTargetContentType.leftOverQueryStringFragments ?
                            filtersAndTargetContentType.leftOverQueryStringFragments.join('&') :
                            '';
                    }
                }

                // Keep track of whether this image had explicit build instructions so we can emit errors if one of the filters fails (as opposed to warnings):
                var hasNonAutoLosslessFilters = filters.length > 0;

                // Add automatic filters if the Content-Type is correct, the relevant binary is available,
                // and the operation hasn't already been specificied explicitly in the query string:

                if (targetContentType === 'image/png') {
                    if ((options.pngquant || options.autoLossless) && isAvailableByBinaryName.pngquant && PngQuantWithHistogram.histogramIsAvailable && operationNames.indexOf('pngquant') === -1) {
                        filters.push(new PngQuantWithHistogram());
                    }
                    if ((options.pngcrush || options.autoLossless) && isAvailableByBinaryName.pngcrush && operationNames.indexOf('pngcrush') === -1) {
                        filters.push(new PngCrush(['-rem', 'alla']));
                    }
                    if ((options.optipng || options.autoLossless) && isAvailableByBinaryName.optipng && operationNames.indexOf('optipng') === -1) {
                        filters.push(new OptiPng());
                    }
                } else if (targetContentType === 'image/jpeg' && isAvailableByBinaryName.jpegtran && (options.jpegtran || options.autoLossless) && operationNames.indexOf('jpegtran') === -1) {
                    filters.push(new JpegTran(['-optimize']));
                }

                if (!isAvailableByBinaryName.gm) {
                    for (var i = 0 ; i < filters.length ; i += 1) {
                        var filter = filters[i];
                        if (filter.operationName === 'gm') {
                            assetGraph.emit('warn', new Error('processImages: ' + imageAsset.url + '\nPlease install graphicsmagick to apply the following filters: ' + filter.usedQueryStringFragments.join(', ')));
                            filters.splice(i, 1);
                            i -= 1;
                        }
                    }
                }
                if (filters.length > 0) {
                    var callbackCalled = false;
                    filters.forEach(function (filter, i) {
                        if (i < filters.length - 1) {
                            filters[i].pipe(filters[i + 1]);
                        }
                        filter.on('error', function (err) {
                            var filterNameOrDescription;
                            if (filter.operationName) {
                                filterNameOrDescription = 'GraphicsMagick ' + filter.operationName;
                            } else {
                                filterNameOrDescription = filter.commandLine || (filter.constructor && filter.constructor.name) || 'unknown operation';
                            }
                            err.message = imageAsset.urlOrDescription + ': Error executing ' + filterNameOrDescription + ': ' + err.message;
                            assetGraph.emit(hasNonAutoLosslessFilters ? 'error' : 'warn', err);
                            if (!callbackCalled) {
                                callbackCalled = true;
                                cb();
                            }
                        });
                    });
                    var chunks = [];
                    filters[filters.length - 1]
                        .on('data', function (chunk) {
                            chunks.push(chunk);
                        })
                        .on('end', function () {
                            if (callbackCalled) {
                                // An error occurred in one of the filters
                                return;
                            }
                            callbackCalled = true;
                            var rawSrc = Buffer.concat(chunks),
                                newUrl = imageAsset.url.replace(/\/([^\.\/]*)([^\?\/]*)\?[^#]*/, '/$1.' + usedQueryString + '$2' + (leftOverQueryString ? '?' + leftOverQueryString : ''));
                            if (targetContentType && targetContentType !== imageAsset.contentType) {
                                var replacementImageAsset = assetGraph.createAsset({
                                    contentType: targetContentType,
                                    type: assetGraph.typeByContentType[targetContentType] || 'Image',
                                    url: newUrl,
                                    rawSrc: rawSrc
                                });
                                imageAsset.replaceWith(replacementImageAsset);
                                replacementImageAsset.extension = replacementImageAsset.defaultExtension;
                            } else {
                                imageAsset.rawSrc = rawSrc;
                                imageAsset.url = newUrl;
                            }
                            cb();
                        });

                    filters[0].end(imageAsset.rawSrc);
                } else {
                    cb();
                }
            }, cb);
        });
    };
};
