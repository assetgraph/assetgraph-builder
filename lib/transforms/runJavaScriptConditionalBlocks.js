var vm = require('vm'),
    _ = require('lodash'),
    escodegen = require('escodegen'),
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

            assetGraph.collectAssetsPostOrder(htmlAsset, {type: ['HtmlScript', 'JavaScriptInclude']}).filter(function (asset) {
                return asset.isLoaded && asset.type === 'JavaScript';
            }).forEach(function (javaScript) {
                // Loop through top-level statements:
                var topLevelStatements = javaScript.parseTree.body;
                for (var i = 0 ; i < topLevelStatements.length ; i += 1) {
                    var node = topLevelStatements[i];
                    if (node.type === 'IfStatement' &&
                        ((node.test.type === 'Identifier' && node.test.name === environment) ||
                         (node.test.type === 'MemberExpression' && !node.test.computed && node.test.property.name === environment &&
                          node.test.object.type === 'Identifier' &&
                          node.test.object.name === 'window'))) {

                        var fileName = javaScript.url || assetGraph.findRelations({to: javaScript})[0].baseAsset.url;
                        new vm.Script(escodegen.generate(node), fileName).runInContext(context);
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
