var zlib = require('zlib'),
    async = require('async'),
    _ = require('underscore'),
    AssetGraph = require('../AssetGraph');

module.exports = function (queryObj) {
    return function gzip(assetGraph, cb) {
        async.eachLimit(assetGraph.findAssets(_.extend({isInline: false}, queryObj)), 4, function (asset, cb) {

            // http://webmasters.stackexchange.com/questions/31750/what-is-recommended-minimum-object-size-for-gzip-performance-benefits
            if (asset.rawSrc.length <= 860) {
                return cb();
            }

            zlib.gzip(asset.rawSrc, function (err, gzippedRawSrc) {
                if (err) {
                    assetGraph.emit('error', err);
                } else if (gzippedRawSrc.length < asset.rawSrc.length) {
                    assetGraph.addAsset(new AssetGraph.Asset({
                        url: asset.url.replace(/(?=[\?#]|$)/, '.gz'),
                        rawSrc: gzippedRawSrc
                    }));
                }
                cb();
            });
        }, cb);
    };
};
