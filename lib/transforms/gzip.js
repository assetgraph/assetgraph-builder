var async = require('async'),
    _ = require('underscore'),
    AssetGraph = require('../AssetGraph');

var compress;

try {
    compress = require('node-zopfli');
} catch (e) {
    console.warn('node-zopfli is not available, using less efficient zlib compression');
    compress = require('zlib');
}

module.exports = function (queryObj) {
    return function gzip(assetGraph, cb) {
        async.eachLimit(assetGraph.findAssets(_.extend({isInline: false}, queryObj)), 4, function (asset, cb) {

            // http://webmasters.stackexchange.com/questions/31750/what-is-recommended-minimum-object-size-for-gzip-performance-benefits
            if (asset.rawSrc.length <= 860) {
                return cb();
            }

            compress.gzip(asset.rawSrc, function (err, gzippedRawSrc) {
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
