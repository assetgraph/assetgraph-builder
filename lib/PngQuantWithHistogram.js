const Stream = require('stream');
const PngQuant = require('pngquant');
const histogram = require('histogram');

class PngQuantWithHistogram extends Stream {
  constructor() {
    super();

    this.writable = true;
    this.bufferedChunks = [];
  }

  write(chunk) {
    this.bufferedChunks.push(chunk);
  }

  end(chunk) {
    if (chunk) {
      this.write(chunk);
    }
    var rawSrc = Buffer.concat(this.bufferedChunks);

    if (rawSrc.length === 0) {
      const err = new Error('PngQuantWithHistogram stream ended with no data');

      return this.emit('error', err);
    }

    this.bufferedChunks = null;

    histogram(rawSrc, (err, data) => {
      if (err) {
        err.message = 'histogram: ' + err.message;
        return this.emit('error', err);
      }

      if (data.colors.rgba < 256) {
        // The image has fewer than 256 colors, run rawSrc through a PngQuant filter and proxy its events:
        this.pngQuant = new PngQuant([
          data.colors.rgba < 2 ? 2 : data.colors.rgba
        ]);
        this.__defineGetter__('commandLine', () => this.pngQuant.commandLine);
        for (const eventName of ['data', 'end', 'error']) {
          this.pngQuant.on(eventName, (...args) => {
            this.emit(eventName, ...args);
          });
        }
        this.pngQuant.end(rawSrc);
      } else {
        // The image has too many colors. Emit all the buffered chunks at once when we aren't paused:
        let hasEnded = false;
        const emitRawSrcAndEnd = () => {
          hasEnded = true;
          this.emit('data', rawSrc);
          this.emit('end');
        };

        if (this.isPaused) {
          this.resume = function() {
            setImmediate(function() {
              if (!this.isPaused && !hasEnded) {
                emitRawSrcAndEnd();
              }
            });
          };
        } else {
          emitRawSrcAndEnd();
        }
      }
    });
  }

  pause() {
    this.isPaused = true;
    if (this.pngQuant) {
      this.pngQuant.pause();
    }
  }

  resume() {
    this.isPaused = false;
    if (this.pngQuant) {
      this.pngQuant.resume();
    }
  }
}

module.exports = PngQuantWithHistogram;
