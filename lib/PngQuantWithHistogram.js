/*global setImmediate:true*/
// node 0.8 compat
if (typeof setImmediate === 'undefined') {
    setImmediate = process.nextTick;
}

var Stream = require('stream'),
    util = require('util'),
    PngQuant = require('pngquant'),
    histogram;

try {
    histogram = require('histogram');
} catch (err) {}

function PngQuantWithHistogram() {
    // Fall back to quanting to 256 colors. If you don't want this behavior, check PngQuantWithHistogram.histogramAvailable
    if (!histogram) {
        return new PngQuant([256]);
    }

    Stream.call(this);
    this.bufferedChunks = [];
}

PngQuantWithHistogram.histogramAvailable = !!histogram;

util.inherits(PngQuantWithHistogram, Stream);

PngQuantWithHistogram.prototype.write = function (chunk) {
    this.bufferedChunks.push(chunk);
};

PngQuantWithHistogram.prototype.end = function (chunk) {
    if (chunk) {
        this.write(chunk);
    }
    var rawSrc = Buffer.concat(this.bufferedChunks);
    this.bufferedChunks = null;
    histogram(rawSrc, function (err, data) {
        if (err) {
            err.message = 'histogram: ' + err.message;
            return this.emit('error', err);
        }
        if (data.colors.rgba < 256) {
            // The image has fewer than 256 colors, run rawSrc through a PngQuant filter and proxy its events:
            this.pngQuant = new PngQuant([data.colors.rgba < 2 ? 2 : data.colors.rgba]);
            this.__defineGetter__('commandLine', function () {
                return this.pngQuant.commandLine;
            }.bind(this));
            ['data', 'end', 'error'].forEach(function (eventName) {
                this.pngQuant.on(eventName, function () { // ...
                    this.emit.apply(this, eventName.concat(arguments));
                }.bind(this));
            }.bind(this));
            this.pngQuant.end(rawSrc);
        } else {
            // The image has too many colors. Emit all the buffered chunks at once when we aren't paused:
            var hasEnded = false,
                emitRawSrcAndEnd = function () {
                    hasEnded = true;
                    this.emit('data', rawSrc);
                    this.emit('end');
                }.bind(this);

            if (this.isPaused) {
                this.resume = function () {
                    setImmediate(function () {
                        if (!this.isPaused && !hasEnded) {
                            emitRawSrcAndEnd();
                        }
                    });
                }.bind(this);
            } else {
                emitRawSrcAndEnd();
            }
        }
    }.bind(this));

};

PngQuantWithHistogram.prototype.pause = function () {
    this.isPaused = true;
    if (this.pngQuant) {
        this.pngQuant.pause();
    }
};

PngQuantWithHistogram.prototype.resume = function () {
    this.isPaused = false;
    if (this.pngQuant) {
        this.pngQuant.resume();
    }
};

module.exports = PngQuantWithHistogram;
