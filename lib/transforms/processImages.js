const promiseMap = require('p-map');
const _ = require('lodash');
const urlTools = require('urltools');
const PngCrush = require('pngcrush');
const PngQuant = require('pngquant');
const OptiPng = require('optipng');
const JpegTran = require('jpegtran');

module.exports = (queryObj, options) => {
  options = options || {};

  return async function processImages(assetGraph) {
    const impro = require('impro');

    await promiseMap(
      assetGraph.findAssets(
        _.extend({ isImage: true, isInline: false }, queryObj)
      ),
      async (imageAsset) => {
        const matchQueryString = imageAsset.url.match(/\?([^#]*)/);
        let autoLossless = options.autoLossless;
        let targetContentType = imageAsset.contentType;
        let dpr = imageAsset.devicePixelRatio || 1; // Svg assets as images might not have a dpr
        let usedQueryString;
        let leftOverQueryString;
        let operations = [];
        let operationNames = [];

        if (matchQueryString) {
          const parsedResult = impro.queryString.parseLegacyQueryString(
            matchQueryString[1],
            impro
          );

          operations = parsedResult.operations;
          operationNames = operations.map((op) => op.name);

          // Pick out any device pixel ratio setter
          const leftOverQueryStringFragments = parsedResult.leftover
            .split('&')
            .filter((keyValuePair) => {
              if (/^dpr=\d+(?:[.,]\d+)?$/.test(keyValuePair)) {
                dpr = parseFloat(keyValuePair.split('=')[1]);
                return false;
              } else if (/^auto(?:=|$)/.test(keyValuePair)) {
                if (keyValuePair === 'auto') {
                  autoLossless = true;
                } else {
                  const matchValue = keyValuePair.match(/^auto=(.*)$/);
                  if (matchValue) {
                    const value = matchValue[1];
                    if (/^(?:true|on|yes|1)$/.test(value)) {
                      autoLossless = true;
                    } else if (/^(?:false|off|no|0)$/.test(value)) {
                      autoLossless = false;
                    } else {
                      return true;
                    }
                  } else {
                    return true;
                  }
                }
                return false;
              } else {
                return true;
              }
            });
          usedQueryString = parsedResult.consumed
            .split('&')
            .join('-')
            .replace(/[^a-z0-9.\-=,]/gi, '-');
          leftOverQueryString = leftOverQueryStringFragments.join('&');
        }

        // Keep track of whether this image had explicit build instructions so we can emit errors if one of the filters fails (as opposed to warnings):
        const hasNonAutoLosslessFilters = operations.length > 0;

        const pipeline = impro.createPipeline(
          {
            svgAssetPath: urlTools.fileUrlToFsPath(assetGraph.root),
          },
          operations
        );

        // Add automatic filters if the Content-Type is correct, the relevant binary is available,
        // it's not explicitly turned off for this image via the auto=false parameter,
        // and the operation hasn't already been specificied explicitly in the query string:

        let automaticFiltersApplied = true;
        if (targetContentType === 'image/png') {
          if (
            (options.pngquant || autoLossless) &&
            operationNames.indexOf('pngquant') === -1
          ) {
            // --quality 100-100 means return the input image if it cannot be losslessly converted to 256 colors:
            pipeline.addStream(new PngQuant(['--quality', '100-100', '256']));
          }
          if (
            (options.optipng || autoLossless) &&
            operationNames.indexOf('optipng') === -1
          ) {
            pipeline.addStream(new OptiPng());
          }
          if (
            (options.pngcrush || autoLossless) &&
            operationNames.indexOf('pngcrush') === -1
          ) {
            pipeline.addStream(new PngCrush(['-rem', 'alla', '-noreduce']));
          }
        } else if (
          targetContentType === 'image/jpeg' &&
          (options.jpegtran || autoLossless) &&
          operationNames.indexOf('jpegtran') === -1
        ) {
          pipeline.addStream(new JpegTran(['-optimize']));
        } else {
          automaticFiltersApplied = false;
        }

        const newUrl = imageAsset.url.replace(
          /\/([^./]*)([^?/]*)\?[^#]*/,
          '/$1' +
            (usedQueryString
              ? '.' + usedQueryString.replace(/['`=<>]/g, '')
              : '') +
            '$2' +
            (leftOverQueryString ? '?' + leftOverQueryString : '')
        );

        if (operations.length > 0 || automaticFiltersApplied) {
          // force operation enumeration so the final output type becomes known
          pipeline.flush();

          targetContentType = pipeline.targetContentType;

          await new Promise((resolve, reject) => {
            const chunks = [];
            pipeline
              .on('data', (chunk) => chunks.push(chunk))
              .on('error', (err) => {
                err.message =
                  imageAsset.urlOrDescription +
                  ': Error executing ' +
                  err.message;
                if (hasNonAutoLosslessFilters) {
                  assetGraph.warn(err);
                }
                reject(err);
              })
              .on('end', () => {
                try {
                  const rawSrc = Buffer.concat(chunks);
                  if (
                    targetContentType &&
                    targetContentType !== imageAsset.contentType
                  ) {
                    const processedImageAsset = imageAsset.replaceWith({
                      type:
                        assetGraph.typeByContentType[targetContentType] ||
                        'Image',
                      contentType: targetContentType,
                      devicePixelRatio: dpr,
                      rawSrc,
                    });
                    processedImageAsset.url = newUrl;
                    processedImageAsset.extension =
                      processedImageAsset.defaultExtension;
                  } else {
                    imageAsset.rawSrc = rawSrc;
                    imageAsset.url = newUrl;
                    imageAsset.devicePixelRatio = dpr;
                  }
                  resolve();
                } catch (err) {
                  reject(err);
                }
              });

            pipeline.end(imageAsset.rawSrc);
          });
        } else {
          imageAsset.url = newUrl;
          imageAsset.devicePixelRatio = dpr;
        }
      },
      { concurrency: 10 }
    );
  };
};
