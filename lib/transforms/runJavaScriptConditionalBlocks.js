var vm = require('vm'),
    _ = require('lodash'),
    AssetGraph = require('../AssetGraph'),
    uglifyJs = AssetGraph.JavaScript.uglifyJs,
    bootstrapper = require('../bootstrapper');

module.exports = function (queryObj, environment, removeAfter) {
    if (!environment) {
        throw new Error('transforms.runJavaScriptConditionalBlocks: no \'environment\' option provided');
    }
    return function runJavaScriptConditionalBlocks(assetGraph) {
        assetGraph.findAssets(_.extend({type: 'Html'}, queryObj)).forEach(function (htmlAsset) {
            var contextProperties = {console: console};
            contextProperties[environment] = true;
            var context = bootstrapper.createContext(htmlAsset, assetGraph, contextProperties);

            assetGraph.collectAssetsPostOrder(htmlAsset, {type: ['HtmlScript', 'HtmlRequireJsMain', 'JavaScriptAmdRequire', 'JavaScriptAmdDefine', 'JavaScriptShimRequire', 'JavaScriptRequireJsCommonJsCompatibilityRequire', 'JavaScriptInclude']}).filter(function (asset) {
                return asset.isLoaded && asset.type === 'JavaScript';
            }).forEach(function (javaScript) {
                // Loop through top-level statements:
                var topLevelStatements = javaScript.parseTree.body;
                for (var i = 0 ; i < topLevelStatements.length ; i += 1) {
                    var node = topLevelStatements[i];
                    if (node instanceof uglifyJs.AST_If &&
                        ((node.condition instanceof uglifyJs.AST_SymbolRef && node.condition.name === environment) ||
                         (node.condition instanceof uglifyJs.AST_Dot && node.condition.property === environment &&
                          node.condition.expression instanceof uglifyJs.AST_SymbolRef &&
                          node.condition.expression.name === 'window'))) {

                        var fileName = javaScript.url || assetGraph.findRelations({to: javaScript})[0].baseAsset.url;
                        new vm.Script(node.body.print_to_string(), fileName).runInContext(context);
                        if (removeAfter) {
                            javaScript.parseTree.body.splice(i, 1);
                            i -= 1;
                        }
                    }
                }
            });
        });
    };
};
