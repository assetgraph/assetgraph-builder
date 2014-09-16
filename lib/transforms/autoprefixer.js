/**
 * autoprefixer transform
 *
 * - Runs autoprefixer with the supplied options on each css asset
 */

var loadAndInstantiateAutoprefixer = require('../loadAndInstantiateAutoprefixer');

module.exports = function (options) {
    return function autoprefixer(assetGraph) {
        var cssAssets = assetGraph.findAssets({type: 'Css'});

        if (cssAssets.length > 0) {
            // See https://github.com/ai/autoprefixer#browsers
            var browsers = typeof options === 'string' ? options.split(/,\s*/) : options,
                autoprefix = loadAndInstantiateAutoprefixer(browsers, 'autoprefixer transform: Found ' + cssAssets.length + ' css asset(s), but no autoprefixer module is available. Please use npm to install autoprefixer in your project so the autoprefixer transform can require it.');

            cssAssets.forEach(function (cssAsset) {
                cssAsset.text = autoprefix.process(cssAsset.text).css;
            });
        }
    };
};
