var _ = require('underscore'),
    query = require('assetgraph').query,
    uglifyJs = require('uglify-js'),
    i18nTools = require('../util/i18nTools');

module.exports = function (queryObj, localeIds) {
    return function cloneForEachLocale(assetGraph) {
        assetGraph.findAssets(_.extend({type: 'Html'}, queryObj)).forEach(function (originalHtmlAsset) {
            var nonInlineJavaScriptsToCloneById = {},
                nonInlineTemplatesToCloneById = {};

            // First note which JavaScript assets need to be cloned for each locale:
            assetGraph.findRelations({type: ['HtmlScript', 'HtmlRequireJsMain'], from: originalHtmlAsset, node: {id: query.not('oneBootstrapper')}, to: {isInline: false}}).forEach(function (htmlScript) {
                var doClone = htmlScript.node.hasAttribute('localize');

                if (!doClone) {
                    // Check if the JavaScript asset has relations to a template that needs localization:
                    assetGraph.findRelations({from: htmlScript.to, to: {isInline: false, type: 'KnockoutJsTemplate'}}).forEach(function (templateRelation) {
                        i18nTools.eachI18nTagInHtmlDocument(templateRelation.to.parseTree, function () {
                            nonInlineTemplatesToCloneById[templateRelation.to.id] = templateRelation.to;
                            doClone = true;
                            return false;
                        });
                    });
                }

                if (!doClone) {
                    // Also clone the JavaScript if it contains at least one one.tr/one.trPattern expression
                    i18nTools.eachOneTrInAst(htmlScript.to.parseTree, function () {
                        doClone = true;
                        return false;
                    });
                }
                if (doClone) {
                    nonInlineJavaScriptsToCloneById[htmlScript.to.id] = htmlScript.to;
                }
            });
            var localeIdsByMissingKey = {};
            localeIds.forEach(function (localeId) {
                var localizedHtml = originalHtmlAsset.clone(),
                    allKeysForLocale = i18nTools.extractAllKeysForLocale(assetGraph, localeId);
                localizedHtml.url = originalHtmlAsset.url; // Avoidable if asset.clone() is changed to duplicate the original url.
                localizedHtml.extension = '.' + localeId + localizedHtml.extension;

                localizedHtml.parseTree.documentElement.setAttribute('lang', localeId);

                i18nTools.eachI18nTagInHtmlDocument(localizedHtml.parseTree,
                                                    i18nTools.createI18nTagReplacer(allKeysForLocale, localeId, localeIdsByMissingKey));
                localizedHtml.markDirty();

                assetGraph.findRelations({type: ['HtmlScript', 'HtmlRequireJsMain'], from: localizedHtml, node: {id: query.not('oneBootstrapper')}}).forEach(function (htmlScript) {
                    if (htmlScript.to.id in nonInlineJavaScriptsToCloneById) {
                        var hasAmdRelations = assetGraph.findRelations({from: htmlScript.to, type: ['JavaScriptAmdDefine', 'JavaScriptAmdRequire']}).length > 0;
                        htmlScript.to.clone(htmlScript);
                        if (!hasAmdRelations) {
                            assetGraph.findRelations({from: htmlScript.to, type: ['JavaScriptAmdDefine', 'JavaScriptAmdRequire']}).forEach(function (relation) {
                                assetGraph.removeRelation(relation);
                            });
                        }
                    }
                    i18nTools.eachOneTrInAst(htmlScript.to.parseTree,
                                             i18nTools.createOneTrReplacer(allKeysForLocale, localeId, localeIdsByMissingKey));

                    if (htmlScript.node.hasAttribute('localize')) {
                        htmlScript.to.parseTree = uglifyJs.uglify.ast_squeeze(uglifyJs.uglify.ast_mangle(htmlScript.to.parseTree, {defines: {LOCALEID: ['string', localeId]}}));
                        htmlScript.node.removeAttribute('localize');
                    }

                    assetGraph.findRelations({from: htmlScript.to, type: 'JavaScriptOneGetText', to: {isInline: false, type: 'KnockoutJsTemplate'}}).forEach(function (templateRelation) {
                        if (templateRelation.to.id in nonInlineTemplatesToCloneById) {
                            templateRelation.to.clone(templateRelation);
                            i18nTools.eachI18nTagInHtmlDocument(templateRelation.to.parseTree,
                                                                i18nTools.createI18nTagReplacer(allKeysForLocale, localeId));
                            templateRelation.to.markDirty();
                        }
                    });

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

            // Remove orphaned JavaScript and templates:
            _.values(nonInlineJavaScriptsToCloneById).concat(_.values(nonInlineTemplatesToCloneById)).forEach(function (asset) {
                if (assetGraph.findRelations({to: asset}).length === 0) {
                    assetGraph.removeAsset(asset);
                }
            });

            var missingKeys = Object.keys(localeIdsByMissingKey);
            if (missingKeys.length) {
                console.warn('The following keys were missing:\n  ' + missingKeys.map(function (missingKey) {
                    return missingKey + ' (' + localeIdsByMissingKey[missingKey].join(',') + ')';
                }).join('\n  '));
            }
        });
    };
};
