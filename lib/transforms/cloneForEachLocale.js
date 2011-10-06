var _ = require('underscore'),
    query = require('assetgraph').query,
    i18nTools = require('../util/i18nTools');

module.exports = function (queryObj, localeIds) {
    return function cloneForEachLocale(assetGraph) {
        assetGraph.findAssets(_.extend({type: 'Html'}, queryObj)).forEach(function (originalHtmlAsset) {
            var nonInlineJavaScriptsToCloneById = {};

            // First note which JavaScript assets need to be cloned for each locale:
            assetGraph.findRelations({type: 'HtmlScript', from: originalHtmlAsset, node: {id: query.not('oneBootstrapper')}, to: {isInline: false}}).forEach(function (htmlScript) {
                // Only clone the JavaScript if it contains at least one one.tr/one.trPattern expression
                i18nTools.eachOneTrInAst(htmlScript.to.parseTree, function () {
                    nonInlineJavaScriptsToCloneById[htmlScript.to.id] = htmlScript.to;
                    return false;
                });
            });
            localeIds.forEach(function (localeId) {
                var localizedHtml = originalHtmlAsset.clone();
                localizedHtml.url = originalHtmlAsset.url.replace(/(?:\.html)?$/, '.' + localeId + '.html');

                localizedHtml.parseTree.documentElement.setAttribute('lang', localeId);
                localizedHtml.markDirty();

                assetGraph.findRelations({type: 'HtmlScript', from: localizedHtml, node: {id: query.not('oneBootstrapper')}}).forEach(function (htmlScript) {
                    if (htmlScript.to.id in nonInlineJavaScriptsToCloneById) {
                        htmlScript.to.clone(htmlScript);
                    }
                    i18nTools.eachOneTrInAst(htmlScript.to.parseTree,
                                             i18nTools.createOneTrReplacer(i18nTools.extractAllReachableKeysForLocale(assetGraph, localeId, localizedHtml), localeId));
                    htmlScript.to.markDirty();
                });
                assetGraph.findRelations({type: 'HtmlCacheManifest', from: localizedHtml}).forEach(function (htmlCacheManifest) {
                    htmlCacheManifest.to.clone(htmlCacheManifest);
                    htmlCacheManifest.to.url = originalHtmlAsset.url.replace(/(?:\.html)?$/, '.' + localeId + '.html');
                });
            });
            assetGraph.findRelations({type: 'HtmlCacheManifest', from: originalHtmlAsset}).forEach(function (htmlCacheManifest) {
                assetGraph.removeAsset(htmlCacheManifest.to);
            });
            assetGraph.removeAsset(originalHtmlAsset);
            _.values(nonInlineJavaScriptsToCloneById).forEach(function (javaScript) {
                if (assetGraph.findRelations({to: javaScript}).length === 0) {
                    assetGraph.removeAsset(javaScript);
                }
            });
        });
    };
};
