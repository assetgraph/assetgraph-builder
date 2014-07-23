/**
 * autoprefixer transform
 *
 * - Runs autoprefixer with the supplied options on each css asset
 */

module.exports = function (options) {
    return function autoprefixer(assetGraph) {
        var cssAssets = assetGraph.findAssets({type: 'Css'});

        if (cssAssets.length > 0) {
            // See https://github.com/ai/autoprefixer#browsers
            var autoprefixer;
            if (typeof options === 'function') {
                autoprefixer = options;
            } else {
                var browsers = typeof options === 'string' ? options.split(/,\s*/) : options;
                try {
                    autoprefixer = require('autoprefixer')(browsers);
                } catch (e) {
                    assetGraph.emit('warn', new Error('autoprefixer transform: Found ' + cssAssets.length + ' css asset(s), but no autoprefixer module is available. Please use npm to install autoprefixer in your project so the autoprefixer transform can require it.'));
                    return;
                }
            }

            cssAssets.forEach(function (cssAsset) {
                cssAsset.text = autoprefixer.process(cssAsset.text).css;
            });
        }
    };
};
