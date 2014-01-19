/**
 * autoprefixer transform
 *
 * - Runs autoprefixer with the supplied options on each css asset
 * - Removes all references to prefixfree
 */

var autoprefix = require('autoprefixer');

module.exports = function (options) {
    options = options || {};

    // See https://github.com/ai/autoprefixer#browsers
    var browsers = options.browsers;

    return function autoprefixer(assetGraph) {
        assetGraph.findAssets({type: 'Css'}).forEach(function (cssAsset) {
            cssAsset.text = autoprefix(browsers).process(cssAsset.text).css;
        });

        assetGraph.findRelations({
            to: {
                fileName: /prefixfree(\.min)?\.js/
            }
        }).forEach(function (relation) {
            relation.remove();
        });
    };
};
