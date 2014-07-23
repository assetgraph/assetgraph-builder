/**
 * autoprefixer transform
 *
 * - Runs autoprefixer with the supplied options on each css asset
 */

module.exports = function (options) {
    // See https://github.com/ai/autoprefixer#browsers
    var browsers = typeof options === 'string' ? options.split(/,\s*/) : options;

    return function autoprefixer(assetGraph) {
        var autoprefix;
        var cssAssets = assetGraph.findAssets({type: 'Css'});

        if (cssAssets.length > 0) {
            try {
                autoprefix = require('autoprefixer');
            } catch (e) {
                assetGraph.emit('warn', new Error('autoprefixerTransform: Found ' + cssAssets.length + ' css asset(s), but no autoprefixer module is available. Please use npm to install autoprefixer in your project so the autoprefixer transform can require it.'));
                return;
            }

            cssAssets.forEach(function (cssAsset) {
                cssAsset.text = autoprefix(browsers).process(cssAsset.text).css;
            });
        }
    };
};
