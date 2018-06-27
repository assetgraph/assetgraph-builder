const Promise = require('bluebird');
const childProcess = require('child_process');
const _ = require('lodash');
const urlTools = require('urltools');
const PngCrush = require('pngcrush');
const PngQuantWithHistogram = require('../PngQuantWithHistogram');
const PngQuant = require('pngquant');
const OptiPng = require('optipng');
const JpegTran = require('jpegtran');

module.exports = (queryObj, options) => {
  options = options || {};
  const isAvailableByBinaryName = {
    jpegtran: true,
    pngcrush: true,
    pngquant: true,
    optipng: true,
    gm: true
  };
  return async function processImages(assetGraph) {
    const getFilterInfosAndTargetContentTypeFromQueryString = require('express-processimage/lib/getFilterInfosAndTargetContentTypeFromQueryString');

    await Promise.map(
      Object.keys(isAvailableByBinaryName),
      async binaryName => {
        if (
          binaryName === 'jpegtran' ||
          binaryName === 'optipng' ||
          binaryName === 'pngcrush' ||
          binaryName === 'pngquant'
        ) {
          try {
            await Promise.fromNode(cb =>
              ({
                jpegtran: JpegTran,
                optipng: OptiPng,
                pngcrush: PngCrush,
                pngquant: PngQuant
              }[binaryName].getBinaryPath(cb))
            );
          } catch (err) {
            assetGraph.warn(
              new Error(
                'processImages: ' +
                  binaryName +
                  ' not installed. Install it to get smaller ' +
                  (binaryName === 'jpegtran' ? 'jpgs' : 'pngs')
              )
            );
            isAvailableByBinaryName[binaryName] = false;
          }
        } else {
          try {
            await Promise.fromNode(cb => childProcess.execFile(binaryName, cb));
          } catch (err) {
            if (err.code === 127 || err.code === 'ENOENT') {
              if (binaryName !== 'gm' && binaryName !== 'inkscape') {
                assetGraph.warn(
                  new Error(
                    'processImages: ' +
                      binaryName +
                      ' not installed. Install it to get smaller pngs'
                  )
                );
              }
              isAvailableByBinaryName[binaryName] = false;
            }
          }
        }
      }
    );

    await Promise.map(
      assetGraph.findAssets(
        _.extend({ isImage: true, isInline: false }, queryObj)
      ),
      async imageAsset => {
        const filters = [];
        const operationNames = [];
        const matchQueryString = imageAsset.url.match(/\?([^#]*)/);
        let autoLossless = options.autoLossless;
        let targetContentType = imageAsset.contentType;
        let dpr = imageAsset.devicePixelRatio || 1; // Svg assets as images might not have a dpr
        let usedQueryString;
        let leftOverQueryString;

        if (matchQueryString) {
          const filterInfosAndTargetContentType = getFilterInfosAndTargetContentTypeFromQueryString(
            matchQueryString[1],
            {
              rootPath: urlTools.fileUrlToFsPath(assetGraph.root),
              sourceFilePath: urlTools.fileUrlToFsPath(
                imageAsset.nonInlineAncestor.url
              ),
              sourceMetadata: {
                contentType: imageAsset.contentType
              }
            }
          );

          // Pick out any device pixel ratio setter
          const leftOverQueryStringFragments = filterInfosAndTargetContentType.leftOverQueryStringFragments.filter(
            keyValuePair => {
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
            }
          );
          usedQueryString = filterInfosAndTargetContentType.usedQueryStringFragments
            .join('-')
            .replace(/[^a-z0-9.\-=,]/gi, '-');
          leftOverQueryString = leftOverQueryStringFragments.join('&');

          if (filterInfosAndTargetContentType.filterInfos.length > 0) {
            for (const filterInfo of filterInfosAndTargetContentType.filterInfos) {
              const filter = filterInfo.create();
              if (Array.isArray(filter)) {
                filters.push(...filter);
              } else {
                filters.push(filter);
              }
            }
            operationNames.push(
              ...filterInfosAndTargetContentType.operationNames
            );

            if (filterInfosAndTargetContentType.targetContentType) {
              targetContentType =
                filterInfosAndTargetContentType.targetContentType;
            }
          }
        }

        // Keep track of whether this image had explicit build instructions so we can emit errors if one of the filters fails (as opposed to warnings):
        let hasNonAutoLosslessFilters = filters.length > 0;

        // Add automatic filters if the Content-Type is correct, the relevant binary is available,
        // it's not explicitly turned off for this image via the auto=false parameter,
        // and the operation hasn't already been specificied explicitly in the query string:

        if (targetContentType === 'image/png') {
          if (
            (options.pngquant || autoLossless) &&
            isAvailableByBinaryName.pngquant &&
            PngQuantWithHistogram.histogramIsAvailable &&
            operationNames.indexOf('pngquant') === -1
          ) {
            filters.push(new PngQuantWithHistogram());
          }
          if (
            (options.pngcrush || autoLossless) &&
            isAvailableByBinaryName.pngcrush &&
            operationNames.indexOf('pngcrush') === -1
          ) {
            filters.push(new PngCrush(['-rem', 'alla']));
          }
          if (
            (options.optipng || autoLossless) &&
            isAvailableByBinaryName.optipng &&
            operationNames.indexOf('optipng') === -1
          ) {
            filters.push(new OptiPng());
          }
        } else if (
          targetContentType === 'image/jpeg' &&
          isAvailableByBinaryName.jpegtran &&
          (options.jpegtran || autoLossless) &&
          operationNames.indexOf('jpegtran') === -1
        ) {
          filters.push(new JpegTran(['-optimize']));
        }

        if (!isAvailableByBinaryName.gm) {
          for (let i = 0; i < filters.length; i += 1) {
            const filter = filters[i];
            if (filter.operationName === 'gm') {
              assetGraph.warn(
                new Error(
                  `processImages: ${
                    imageAsset.url
                  }\nPlease install graphicsmagick to apply the following filters: ${filter.usedQueryStringFragments.join(
                    ', '
                  )}`
                )
              );
              filters.splice(i, 1);
              i -= 1;
            }
          }
        }

        let newUrl = imageAsset.url.replace(
          /\/([^./]*)([^?/]*)\?[^#]*/,
          '/$1' +
            (usedQueryString
              ? '.' + usedQueryString.replace(/['`=<>]/g, '')
              : '') +
            '$2' +
            (leftOverQueryString ? '?' + leftOverQueryString : '')
        );
        if (filters.length > 0) {
          await new Promise((resolve, reject) => {
            for (const [i, filter] of filters.entries()) {
              if (i < filters.length - 1) {
                filters[i].pipe(filters[i + 1]);
              }
              filter.on('error', err => {
                let filterNameOrDescription;
                if (filter.operationName) {
                  filterNameOrDescription =
                    'GraphicsMagick ' + filter.operationName;
                } else {
                  filterNameOrDescription =
                    filter.commandLine ||
                    (filter.constructor && filter.constructor.name) ||
                    'unknown operation';
                }
                err.message =
                  imageAsset.urlOrDescription +
                  ': Error executing ' +
                  filterNameOrDescription +
                  ': ' +
                  err.message;
                console.log(assetGraph.warn, assetGraph.error);
                if (hasNonAutoLosslessFilters) {
                  assetGraph.warn(err);
                }
                reject(err);
              });
            }
            const chunks = [];
            filters[filters.length - 1]
              .on('data', chunk => chunks.push(chunk))
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
                      rawSrc
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

            filters[0].end(imageAsset.rawSrc);
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
