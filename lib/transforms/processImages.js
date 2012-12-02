var seq = require('seq'),
    _ = require('underscore'),
    getFiltersAndTargetContentTypeFromQueryString = require('express-processimage/lib/getFiltersAndTargetContentTypeFromQueryString');

require('bufferjs');

module.exports = function (queryObj) {
    return function processImages(assetGraph, cb) {
        seq(assetGraph.findAssets(_.extend({isImage: true, isInline: false, url: /\?/}, queryObj)))
            .parEach(10, function (imageAsset) {
                var callback = this,
                    filtersAndTargetContentType = getFiltersAndTargetContentTypeFromQueryString(imageAsset.url.match(/\?(.*)$/)[1]);

                if (filtersAndTargetContentType && filtersAndTargetContentType.filters.length > 0) {
                    var filters = filtersAndTargetContentType.filters,
                        usedQueryString = filtersAndTargetContentType.usedQueryStringFragments.join('-').replace(/[^a-z0-9\.\-]/g, '-'),
                        leftOverQueryString = filtersAndTargetContentType.leftOverQueryStringFragments ?
                            filtersAndTargetContentType.leftOverQueryStringFragments.join('&') :
                            '';

                    for (var i = 0 ; i < filters.length - 1 ; i += 1) {
                        filters[i].pipe(filters[i + 1]);
                    }
                    var chunks = [];
                    filters[filters.length - 1].on('data', function (chunk) {
                        chunks.push(chunk);
                    }).on('end', function () {
                        var rawSrc = Buffer.concat(chunks);
                        if (filtersAndTargetContentType.targetContentType && filtersAndTargetContentType.targetContentType !== imageAsset.contentType) {
                            var replacementImageAsset = assetGraph.constructor.assets.create({
                                contentType: filtersAndTargetContentType.targetContentType,
                                url: imageAsset.url
                            });
                            imageAsset.replaceWith(replacementImageAsset);
                            replacementImageAsset.extension = replacementImageAsset.defaultExtension;
                            replacementImageAsset.url = replacementImageAsset.url.replace(/\?.*$/, leftOverQueryString ? '?' + leftOverQueryString : '');
                        } else {
                            imageAsset.rawSrc = rawSrc;
                            imageAsset.url = imageAsset.url.replace(/\/([^\.]*)([^\?]*)\?.*$/, "/$1." + usedQueryString + "$2" + (leftOverQueryString ? '?' + leftOverQueryString : ''));
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
