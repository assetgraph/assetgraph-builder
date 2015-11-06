/**
 * autoprefixer transform
 *
 * - Runs autoprefixer with the supplied options on each css asset
 */

var semver = require('semver');

module.exports = function (browsers) {
    return function autoprefixer_(assetGraph) {
        var cssAssets = assetGraph.findAssets({type: 'Css'});

        if (cssAssets.length > 0) {
            var autoprefixerVersionStr;
            try {
                autoprefixerVersionStr = require('autoprefixer/package.json').version;
            } catch (e) {
                e.message = 'autoprefixer transform: Found ' + cssAssets.length + ' css asset(s) while --browsers option is active, ' +
                    'but no autoprefixer module is available. Please use npm to install autoprefixer in your project so ' +
                    'the autoprefixer transform can require it.\n' +
                    e.message;
                throw e;
            }

            var autoprefixer;
            if (semver.satisfies(autoprefixerVersionStr, '>= 3.0.0')) {
                autoprefixer = require('autoprefixer')(browsers ? {browsers: browsers} : {});
            } else {
                autoprefixer = require('autoprefixer')(browsers);
            }

            var isAtLeastVersion5 = semver.satisfies(autoprefixerVersionStr, '>= 5.0.0');
            var postcss;
            if (isAtLeastVersion5) {
                try {
                    postcss = require('postcss');
                } catch (e) {
                    postcss = require('autoprefixer/node_modules/postcss');
                }
            }

            cssAssets.forEach(function (cssAsset) {
                try {
                    if (isAtLeastVersion5) {
                        var existingSourceMap = cssAsset.sourceMap;
                        if (!existingSourceMap.mappings) {
                            existingSourceMap = undefined;
                        }

                        var result = postcss([autoprefixer]).process(cssAsset.text, { map: existingSourceMap && { prev: existingSourceMap, inline: false, annotation: false } }).stringify();
                        cssAsset.text = result.toString();
                        if (result.map) {
                            cssAsset.sourceMap = result.map.toJSON();
                        }
                    } else {
                        cssAsset.text = autoprefixer.process(cssAsset.text).css;
                    }
                } catch (err) {
                    err.asset = cssAsset;

                    assetGraph.emit('warn', err);
                }
            });
        }
    };
};
