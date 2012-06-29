var childProcess = require('child_process'),
    _ = require('underscore'),
    seq = require('seq'),
    pipeImageThroughChildProcessAndBuffer = require('../util/pipeImageThroughChildProcessAndBuffer'),
    childProcess = require('child_process'),
    progs = {
        pngquant: true,
        pngcrush: true,
        optipng: true
    };

module.exports = function (queryObj) {
    return function optimizePngs(assetGraph, cb) {
        seq(Object.keys(progs))
            .parEach(function (prog) {
                var callback = this;
                childProcess.execFile(prog, function (err) {
                    if (err && err.code === 127) {
                        assetGraph.emit('error', new Error('optimizePngs: ' + prog + ' not installed. Install it to get smaller pngs'));
                        progs[prog] = false;
                    }
                    callback();
                });
            })
            .set(assetGraph.findAssets(_.extend({type: 'Png'}, queryObj)))
            .parEach(function (pngAsset) {
                if (!progs.pngquant) {
                    return this();
                }

                pngAsset.getHistogram(function (err, histogram) {
                    if (err) {
                        err.message = 'histogram - ' + pngAsset.url + ': ' + err.message;
                        assetGraph.emit('error', err);
                        return this();
                    }
                    if (histogram.colors.rgba <= 256) {
                        pipeImageThroughChildProcessAndBuffer.pngquant(String(histogram.colors.rgba < 2 ? 2 : histogram.colors.rgba))(pngAsset.rawSrc, function (err, optimizedSrc) {
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
