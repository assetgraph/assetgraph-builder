var _ = require('underscore'),
    uglifyAst = require('uglifyast'),
    urlTools = require('assetgraph/lib/util/urlTools'),
    oneBootstrapper = require('../oneBootstrapper'),
    i18nTools = require('../i18nTools');

module.exports = function (queryObj, options) {
    if (!queryObj) {
        throw new Error("transforms.injectOneBootstrapper: The 'queryObj' parameter is required.");
    }
    return function injectOneBootstrapper(assetGraph) {
        assetGraph.findAssets(queryObj).forEach(function (initialAsset) {
            var bootstrapAsset = new assetGraph.constructor.assets.JavaScript({
                parseTree: oneBootstrapper.createAst(initialAsset, assetGraph, options)
            });
            assetGraph.addAsset(bootstrapAsset);
            if (initialAsset.type === 'Html') {
                new assetGraph.constructor.relations.HtmlScript({to: bootstrapAsset})
                    .attach(initialAsset, 'first')
                    .inline()
                    .node.setAttribute('id', 'oneBootstrapper');
            } else { // initialAsset.type === 'JavaScript'
                new assetGraph.constructor.relations.JavaScriptOneInclude({to: bootstrapAsset}).attach(initialAsset, 'first');
            }
        });
    };
};
