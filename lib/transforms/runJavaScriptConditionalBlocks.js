var vm = require('vm'),
    _ = require('underscore'),
    uglifyJs = require('uglify-js-papandreou'),
    bootstrapper = require('../bootstrapper'),
    i18nTools = require('../i18nTools');

module.exports = function (queryObj, environment, removeAfter) {
    if (!environment) {
        throw new Error("transforms.runJavaScriptConditionalBlocks: no 'environment' option provided");
    }
    return function runJavaScriptConditionalBlocks(assetGraph) {
        assetGraph.findAssets(_.extend({type: 'Html'}, queryObj)).forEach(function (htmlAsset) {
            var context = bootstrapper.createContext(htmlAsset, assetGraph);

            assetGraph.collectAssetsPostOrder(htmlAsset, {type: ['HtmlScript', 'JavaScriptInclude']}).filter(function (asset) {
                return asset.type === 'JavaScript';
            }).forEach(function (javaScript) {
                // Loop through top-level statements:
                var topLevelStatements = javaScript.parseTree[1];
                for (var i = 0 ; i < topLevelStatements.length ; i += 1) {
                    var node = topLevelStatements[i];
                    if (node[0] === 'if' && ((node[1][0] === 'name' && node[1][1] === environment)) ||
                                             (node[1][0] === 'dot' && node[1][1][0] === 'name' && node[1][1][1] === 'window' && node[1][2] === environment)) {

                        var fileName = javaScript.url || assetGraph.findRelations({to: javaScript})[0].baseAsset.url;
                        new vm.Script(uglifyJs.uglify.gen_code(node[2]), fileName).runInContext(context);
                        if (removeAfter) {
                            javaScript.parseTree[1].splice(i, 1);
                            i -= 1;
                        }
                    }
                }
            });
        });
    };
};
