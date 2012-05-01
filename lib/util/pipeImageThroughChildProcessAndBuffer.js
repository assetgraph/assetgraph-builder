var childProcess = require('child_process'),
    fs = require('fs'),
    temp = require('temp'),
    passError = require('assetgraph/lib/util/passError');

require('bufferjs');

function pipeImageThroughChildProcessAndBuffer(command, switches, src, cb) {
    var optimizerProcess = childProcess.spawn(command, switches),
        buffers = [];
    optimizerProcess.stdout.on('data', function (buffer) {
        buffers.push(buffer);
    }).on('end', function () {
        if (buffers.length) {
            cb(null, Buffer.concat(buffers));
        } else {
            cb(new Error('transforms.postProcessCssImages: Error executing "' + [command].concat(switches).join(" ") + '", please make sure ' + command + ' is installed'));
        }
    }).on('error', function (err) {
        cb(new Error('transforms.postProcessCssImages: Error executing "' + [command].concat(switches).join(" ") + '": ' + err.message + ', please make sure ' + command + ' is installed'));
    });
    optimizerProcess.stdin.end(src);
};

module.exports = pipeImageThroughChildProcessAndBuffer;

pipeImageThroughChildProcessAndBuffer.pngquant = function (argStr) {
    var numColors = 256,
        switches = [];
    if (argStr) {
        argStr.split(/\s+/).forEach(function (arg) {
            if (/^\d+$/.test(arg)) {
                numColors = parseInt(arg, 10);
            } else if (/^-(?:nofs|nofloyd|ordered)$/.test(arg)) {
                switches.push(arg);
            } else {
                throw new Error("transforms.postProcessCssImages: Invalid pngquant args: " + args);
            }
        });
    }
    switches.unshift(numColors);
    return function (src, cb) {
        pipeImageThroughChildProcessAndBuffer('pngquant', switches, src, cb);
    };
};

pipeImageThroughChildProcessAndBuffer.optipng = function (argStr) {
    var commandFragments = ['optipng'];
    if (argStr) {
        if (/^\s*-o\d\s*$/.test(argStr)) {
            commandFragments.push(argStr);
        }
    }
    return function (src, cb) {
        var tmpFileName = temp.path({suffix: '.png'});
        fs.writeFile(tmpFileName, src, null, passError(cb, function () {
            childProcess.exec(commandFragments.join(" ") + " " + tmpFileName, passError(cb, function () {
                fs.readFile(tmpFileName, null, function (err, processedSrc) {
                    fs.unlink(tmpFileName);
                    if (err) {
                        return cb(err);
                    }
                    cb(null, processedSrc);
                });
            }));
        }));
    };
};

pipeImageThroughChildProcessAndBuffer.pngcrush = function (argStr) {
    var commandFragments = ['pngcrush', '-nofilecheck'];
    if (argStr) {
        argStr.split(/\s+/).forEach(function (arg) {
            if (/^[\w\d\-\.]+$/.test(arg)) {
                commandFragments.push(arg);
            }
        });
    }
    return function (src, cb) {
        var tmpFileName1 = temp.path({suffix: '.png'}),
            tmpFileName2 = temp.path({suffix: '.png'});
        fs.writeFile(tmpFileName1, src, null, passError(cb, function () {
            childProcess.exec(commandFragments.join(" ") + " " + tmpFileName1 + " " + tmpFileName2, passError(cb, function () {
                fs.readFile(tmpFileName2, null, function (err, processedSrc) {
                    fs.unlink(tmpFileName1);
                    fs.unlink(tmpFileName2);
                    if (err) {
                        return cb(err);
                    }
                    cb(null, processedSrc);
                });
            }));
        }));
    };
};
