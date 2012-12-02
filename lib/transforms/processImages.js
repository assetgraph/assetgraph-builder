var childProcess = require('child_process'),
    seq = require('seq'),
    _ = require('underscore'),
    getFiltersAndTargetContentTypeFromQueryString = require('express-processimage/lib/getFiltersAndTargetContentTypeFromQueryString'),
    PngCrush = require('pngcrush'),
    PngQuantWithHistogram = require('../PngQuantWithHistogram'),
    OptiPng = require('optipng'),
    JpegTran = require('jpegtran');

require('bufferjs');

module.exports = function (queryObj, options) {
    options = options || {};
    var isAvailableByBinaryName = {
        jpegtran: true,
        pngcrush: true,
        pngquant: true,
        optipng: true
    };
    return function processImages(assetGraph, cb) {
        seq(Object.keys(isAvailableByBinaryName))
            .parEach(function (binaryName) {
                var callback = this;
                childProcess.execFile(binaryName, (binaryName === 'jpegtran' ? ['--'] : []), function (err) {
                    if (err && err.code === 127) {
                        assetGraph.emit('warn', new Error('processImages: ' + binaryName + ' not installed. Install it to get smaller ' + (binaryName === 'jpegtran' ? 'jpgs' : 'pngs')));
                        isAvailableByBinaryName[binaryName] = false;
                    }
                    callback();
                });
            })
            .set(assetGraph.findAssets(_.extend({isImage: true, isInline: false}, queryObj)))
            .parEach(10, function (imageAsset) {
                var callback = this,
                    filters = [],
                    operationNames = [],
                    targetContentType = imageAsset.contentType,
                    matchQueryString = imageAsset.url.match(/\?([^#]*)/),
                    usedQueryString,
                    leftOverQueryString;

                if (matchQueryString) {
                    var filtersAndTargetContentType = getFiltersAndTargetContentTypeFromQueryString(matchQueryString[1]);
                    if (filtersAndTargetContentType.filters.length > 0) {
                        Array.prototype.push.apply(filters, filtersAndTargetContentType.filters);
                        Array.prototype.push.apply(operationNames, filtersAndTargetContentType.operationNames);

                        if (filtersAndTargetContentType.targetContentType) {
                            targetContentType = filtersAndTargetContentType.targetContentType;
                        }

                        usedQueryString = filtersAndTargetContentType.usedQueryStringFragments.join('-').replace(/[^a-z0-9\.\-]/g, '-'),
                        leftOverQueryString = filtersAndTargetContentType.leftOverQueryStringFragments ?
                            filtersAndTargetContentType.leftOverQueryStringFragments.join('&') :
                            '';
                    }
                }

                // Add automatic filters if the Content-Type is correct, the relevant binary is available,
                // and the operation hasn't already been specificied explicitly in the query string:
                if (targetContentType === 'image/png') {
                    if (options.pngquant && isAvailableByBinaryName.pngquant && PngQuantWithHistogram.histogramIsAvailable && operationNames.indexOf('pngquant') === -1) {
                        filters.push(new PngQuantWithHistogram());
                    }
                    if (options.pngcrush && isAvailableByBinaryName.pngcrush && operationNames.indexOf('pngcrush') === -1) {
                        filters.push(new PngCrush(['-rem', 'alla']));
                    }
                    if (options.optipng && isAvailableByBinaryName.optipng && operationNames.indexOf('optipng') === -1) {
                        filters.push(new OptiPng());
                    }
                } else if (targetContentType === 'image/jpeg' && isAvailableByBinaryName.jpegtran && options.jpegtran && operationNames.indexOf('jpegtran') === -1) {
                    filters.push(new JpegTran(['-optimize']));
                }

                if (filters.length > 0) {
                    for (var i = 0 ; i < filters.length - 1 ; i += 1) {
                        filters[i].pipe(filters[i + 1]);
                    }
                    var chunks = [];
                    filters[filters.length - 1].on('data', function (chunk) {
                        chunks.push(chunk);
                    }).on('end', function () {
                        var rawSrc = Buffer.concat(chunks);
                        if (targetContentType && targetContentType !== imageAsset.contentType) {
                            var replacementImageAsset = assetGraph.constructor.assets.create({
                                contentType: targetContentType,
                                type: assetGraph.constructor.assets.typeByContentType[targetContentType] || 'Image',
                                url: imageAsset.url,
                                rawSrc: rawSrc
                            });
                            imageAsset.replaceWith(replacementImageAsset);
                            replacementImageAsset.extension = replacementImageAsset.defaultExtension;
                            replacementImageAsset.url = replacementImageAsset.url.replace(/\?[^#]*/, leftOverQueryString ? '?' + leftOverQueryString : '');
                        } else {
                            imageAsset.rawSrc = rawSrc;
                            imageAsset.url = imageAsset.url.replace(/\/([^\.]*)([^\?]*)\?[^#]*/, "/$1." + usedQueryString + "$2" + (leftOverQueryString ? '?' + leftOverQueryString : ''));
                        }
                        callback();
                    });
                    filters[0].end(imageAsset.rawSrc);
                } else {
                    callback();
                }
            })
            .seq(function () {
                cb();
            })
            .catch(cb);
    };
};
