var _ = require('underscore'),
    uglifyAst = require('assetgraph/lib/util/uglifyAst'),
    urlTools = require('assetgraph/lib/util/urlTools'),
    oneBootstrapper = require('../util/oneBootstrapper'),
    i18nTools = require('../util/i18nTools');

module.exports = function (queryObj) {
    if (!queryObj) {
        throw new Error("transforms.injectOneBootstrapper: The 'queryObj' parameter is required.");
    }
    return function injectOneBootstrapper(assetGraph) {
        assetGraph.findAssets(queryObj).forEach(function (initialAsset) {
            var bootstrapAsset = new assetGraph.constructor.assets.JavaScript({parseTree: oneBootstrapper.createAst(initialAsset, assetGraph)});
            bootstrapAsset.url = urlTools.resolveUrl(assetGraph.root, "oneBootstrapper.js"); // Just so assetGraph.inlineAsset won't refuse
            assetGraph.addAsset(bootstrapAsset);
            if (initialAsset.type === 'Html') {
                var htmlScript = new assetGraph.constructor.relations.HtmlScript({
                    from: initialAsset,
                    to: bootstrapAsset
                });
                assetGraph.attachAndAddRelation(htmlScript, 'first');
                htmlScript.node.setAttribute('id', 'oneBootstrapper');
                assetGraph.inlineRelation(htmlScript, this);
            } else { // initialAsset.type === 'JavaScript'
                assetGraph.attachAndAddRelation(new assetGraph.constructor.relations.JavaScriptOneInclude({
                    from: initialAsset,
                    to: bootstrapAsset
                }), 'first');
            }
        });
    };
};
