var childProcess = require('child_process'),
    async = require('async'),
    _ = require('lodash'),
    urlTools = require('urltools'),
    getFilterInfosAndTargetContentTypeFromQueryString = require('express-processimage/lib/getFilterInfosAndTargetContentTypeFromQueryString'),
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
                    leftOverQueryString,
                    dpr = imageAsset.devicePixelRatio || 1, // Svg assets as images might not have a dpr
                    autoLossless = options.autoLossless;

                if (matchQueryString) {
                    var filterInfosAndTargetContentType = getFilterInfosAndTargetContentTypeFromQueryString(matchQueryString[1], {rootPath: urlTools.fileUrlToFsPath(assetGraph.root), sourceFilePath: urlTools.fileUrlToFsPath(imageAsset.nonInlineAncestor.url)});

                    // Pick out any device pixel ratio setter
                    var leftOverQueryStringFragments = filterInfosAndTargetContentType.leftOverQueryStringFragments.filter(function (keyValuePair) {
                        if (/^dpr=\d+(?:[\.,]\d+)?$/.test(keyValuePair)) {
                            dpr = keyValuePair.split('=')[1];
                            return false;
                        } else if (/^auto(?:=|$)/.test(keyValuePair)) {
                            if (keyValuePair === 'auto') {
                                autoLossless = true;
                            } else {
                                var matchValue = keyValuePair.match(/^auto=(.*)$/);
                                if (matchValue) {
                                    var value = matchValue[1];
                                    if (/^(?:true|on|yes|1)$/.test(value)) {
                                        autoLossless = true;
                                    } else if (/^(?:false|off|no|0)$/.test(value)) {
                                        autoLossless = false;
                                    } else {
                                        return true;
                                    }
                                } else {
                                    return true;
                                }
                            }
                            return false;
                        } else {
                            return true;
                        }
                    });

                    usedQueryString = filterInfosAndTargetContentType.usedQueryStringFragments.join('-').replace(/[^a-z0-9\.\-=,]/gi, '-');
                    leftOverQueryString = leftOverQueryStringFragments.join('&');

                    if (filterInfosAndTargetContentType.filterInfos.length > 0) {
                        Array.prototype.push.apply(filters, filterInfosAndTargetContentType.filterInfos.map(function (filterInfo) {
                            return filterInfo.create();
                        }));
                        Array.prototype.push.apply(operationNames, filterInfosAndTargetContentType.operationNames);

                        if (filterInfosAndTargetContentType.targetContentType) {
                            targetContentType = filterInfosAndTargetContentType.targetContentType;
                        }
                    }
                }

                // Keep track of whether this image had explicit build instructions so we can emit errors if one of the filters fails (as opposed to warnings):
                var hasNonAutoLosslessFilters = filters.length > 0;

                // Add automatic filters if the Content-Type is correct, the relevant binary is available,
                // it's not explicitly turned off for this image via the auto=false parameter,
                // and the operation hasn't already been specificied explicitly in the query string:

                if (targetContentType === 'image/png') {
                    if ((options.pngquant || autoLossless) && isAvailableByBinaryName.pngquant && PngQuantWithHistogram.histogramIsAvailable && operationNames.indexOf('pngquant') === -1) {
                        filters.push(new PngQuantWithHistogram());
                    }
                    if ((options.pngcrush || autoLossless) && isAvailableByBinaryName.pngcrush && operationNames.indexOf('pngcrush') === -1) {
                        filters.push(new PngCrush(['-rem', 'alla']));
                    }
                    if ((options.optipng || autoLossless) && isAvailableByBinaryName.optipng && operationNames.indexOf('optipng') === -1) {
                        filters.push(new OptiPng());
                    }
                } else if (targetContentType === 'image/jpeg' && isAvailableByBinaryName.jpegtran && (options.jpegtran || autoLossless) && operationNames.indexOf('jpegtran') === -1) {
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

                var newUrl = imageAsset.url.replace(/\/([^\.\/]*)([^\?\/]*)\?[^#]*/, '/$1' + (usedQueryString ? '.' + usedQueryString : '') + '$2' + (leftOverQueryString ? '?' + leftOverQueryString : ''));

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
                            var rawSrc = Buffer.concat(chunks);
                            if (targetContentType && targetContentType !== imageAsset.contentType) {
                                var replacementImageAsset = assetGraph.createAsset({
                                    contentType: targetContentType,
                                    type: assetGraph.typeByContentType[targetContentType] || 'Image',
                                    url: newUrl,
                                    rawSrc: rawSrc,
                                    devicePixelRatio: dpr
                                });
                                imageAsset.replaceWith(replacementImageAsset);
                                replacementImageAsset.extension = replacementImageAsset.defaultExtension;
                            } else {
                                imageAsset.rawSrc = rawSrc;
                                imageAsset.url = newUrl;
                                imageAsset.devicePixelRatio = dpr;
                            }
                            cb();
                        });

                    filters[0].end(imageAsset.rawSrc);
                } else {
                    imageAsset.url = newUrl;
                    imageAsset.devicePixelRatio = dpr;
                    cb();
                }
            }, cb);
        });
    };
};
