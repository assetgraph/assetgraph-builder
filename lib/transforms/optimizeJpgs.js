var childProcess = require('child_process'),
    _ = require('underscore'),
    seq = require('seq'),
    pipeImageThroughChildProcessAndBuffer = require('../pipeImageThroughChildProcessAndBuffer'),
    jpegtran = true;

module.exports = function (queryObj) {
    return function optimizeJpgs(assetGraph, cb) {
        childProcess.execFile('jpegtran', ['--'], function (err) {
            if (err && err.code === 127) {
                assetGraph.emit('warn', new Error('optimizeJpgs: jpegtran not installed. Install it to get smaller jpgs'));
                return cb();
            }
            seq(assetGraph.findAssets(_.extend({type: 'Jpeg'}, queryObj)))
                .parEach(function (jpgAsset) {
                    pipeImageThroughChildProcessAndBuffer('jpegtran', ['-optimize'], jpgAsset.rawSrc, function (err, optimizedSrc) {
                        if (err) {
                            err.message = 'jpegtran - ' + jpgAsset.url + ': ' + err.message;
                            assetGraph.emit('error', err);
                            return this();
                        }
                        jpgAsset.rawSrc = optimizedSrc;
                        this();
                    }.bind(this));
                })
                .seq(function () {
                    cb();
                })
                .catch(cb);
        });
    };
};
