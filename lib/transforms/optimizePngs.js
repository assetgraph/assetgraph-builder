var childProcess = require('child_process'),
    _ = require('underscore'),
    seq = require('seq'),
    pipeImageThroughChildProcessAndBuffer = require('../pipeImageThroughChildProcessAndBuffer'),
    histogram,
    progs = {
        pngquant: true,
        pngcrush: true,
        optipng: true
    };

try {
    histogram = require('histogram');
} catch (err) {}

module.exports = function (queryObj) {
    return function optimizePngs(assetGraph, cb) {
        if (!histogram) {
            assetGraph.emit('error', new Error('optimizePngs: histogram not available, skipping quantization of png images.'));
        }

        Object.keys(progs).forEach(function (prog) {
            childProcess.execFile(prog, function (err) {
                if (err && err.code === 127) {
                    assetGraph.emit('error', new Error('optimizePngs: ' + prog + ' not installed. Install it to get smaller pngs'));
                    progs[prog] = false;
                }
            });
        });

        //TODO: Detect available system png optimization tools
        seq(assetGraph.findAssets(_.extend({type: 'Png'}, queryObj)))
            .parEach(function (pngAsset) {
                if (!histogram || !progs.pngquant) {
                    return this();
                }

                histogram(pngAsset.rawSrc, function (err, data) {
                    if (err) {
                        err.message = 'histogram - ' + pngAsset.url + ': ' + err.message;
                        assetGraph.emit('error', err);
                        return this();
                    }
                    if (data.colors.rgba < 256) {
                        pipeImageThroughChildProcessAndBuffer.pngquant(String(data.colors.rgba < 2 ? 2 : data.colors.rgba))(pngAsset.rawSrc, function (err, optimizedSrc) {
                            if (err) {
                                err.message = 'pngquant - ' + pngAsset.url + ': ' + err.message;
                                assetGraph.emit('error', err);
                                return this();
                            }
                            pngAsset.rawSrc = optimizedSrc;
                        }.bind(this));
                    }
                    this();
                }.bind(this));
            })
            .parEach(function (pngAsset) {
                if (!progs.pngcrush) {
                    return this();
                }

                pipeImageThroughChildProcessAndBuffer.pngcrush("-rem alla")(pngAsset.rawSrc, function (err, optimizedSrc) {
                    if (err) {
                        err.message = 'pngcrush - ' + pngAsset.url + ': ' + err.message;
                        assetGraph.emit('error', err);
                        return this();
                    }
                    pngAsset.rawSrc = optimizedSrc;
                    this();
                }.bind(this));
            })
            .parEach(function (pngAsset) {
                if (!progs.optipng) {
                    return this();
                }

                pipeImageThroughChildProcessAndBuffer.optipng()(pngAsset.rawSrc, function (err, optimizedSrc) {
                    if (err) {
                        err.message = 'optipng - ' + pngAsset.url + ': ' + err.message;
                        assetGraph.emit('error', err);
                        return this();
                    }
                    pngAsset.rawSrc = optimizedSrc;
                    this();
                }.bind(this));
            })
            .seq(function () {
                cb();
            })
            .catch(cb);
    };
};
