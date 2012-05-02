var childProcess = require('child_process'),
    _ = require('underscore'),
    passError = require('assetgraph/lib/util/passError'),
    seq = require('seq'),
    pipeImageThroughChildProcessAndBuffer = require('../util/pipeImageThroughChildProcessAndBuffer');

module.exports = function (queryObj) {
    return function optimizePngs(assetGraph, cb) {
        seq(assetGraph.findAssets(_.extend({type: 'Png'}, queryObj)))
            .parEach(function (pngAsset) {
                var pngtopnmProcess = childProcess.spawn('pngtopnm'),
                    ppmhistProcess = childProcess.spawn('ppmhist', ['-noheader']),
                    numColors = 0;
                ppmhistProcess.stdout.on('data', function (chunk) {
                    numColors += (chunk.toString('ascii').match(/\n/g) || []).length;
                }).on('end', function () {
                    if (numColors < 256) {
                        pipeImageThroughChildProcessAndBuffer.pngquant(String(numColors < 2 ? 2 : numColors))(pngAsset.rawSrc, passError(this, function (optimizedSrc) {
                            pngAsset.rawSrc = optimizedSrc;
                            this();
                        }.bind(this)));
                    } else {
                        this();
                    }
                }.bind(this)).on('error', this);
                pngtopnmProcess.stdout.pipe(ppmhistProcess.stdin);
                pngtopnmProcess.stdin.end(pngAsset.rawSrc);
            })
            .parEach(function (pngAsset) {
                pipeImageThroughChildProcessAndBuffer.pngcrush("-rem alla")(pngAsset.rawSrc, passError(this, function (optimizedSrc) {
                    pngAsset.rawSrc = optimizedSrc;
                    this();
                }.bind(this)));
            })
            .parEach(function (pngAsset) {
                pipeImageThroughChildProcessAndBuffer.optipng()(pngAsset.rawSrc, passError(this, function (optimizedSrc) {
                    pngAsset.rawSrc = optimizedSrc;
                    this();
                }.bind(this)));
            })
            .seq(function () {
                cb();
            })
            .catch(cb);
    };
};
