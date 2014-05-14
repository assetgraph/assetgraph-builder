/**
 * autoprefixer transform
 *
 * - Runs autoprefixer with the supplied options on each css asset
 * - Removes all references to prefixfree
 */

var autoprefix = require('autoprefixer');

module.exports = function (options) {
    // See https://github.com/ai/autoprefixer#browsers
    var browsers = typeof options === 'string' ? options.split(/,\s*/) : options;

    return function autoprefixer(assetGraph) {
        assetGraph.findAssets({type: 'Css'}).forEach(function (cssAsset) {
            cssAsset.text = autoprefix(browsers).process(cssAsset.text).css;
        });

        assetGraph.findRelations({
            to: {
                fileName: /prefixfree(\.min)?\.js/
            }
        }).forEach(function (relation) {
            relation.detach();
        });
    };
};
