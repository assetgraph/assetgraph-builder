var util = require('util'),
    _ = require('underscore'),
    query = require('assetgraph').query,
    uglifyJs = require('uglify-js'),
    i18nTools = require('../util/i18nTools');

module.exports = function (queryObj, options) {
    var localeIds = options.localeIds,
        defaultLocaleId = options.defaultLocaleId || 'en',
        quiet = options.quiet || false;

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
                        if (!doClone) {
                            assetGraph.findRelations({from: templateRelation.to, type: 'HtmlDataBindAttribute'}).forEach(function (htmlDataBindAttributeRelation) {
                                i18nTools.eachOneTrInAst(htmlDataBindAttributeRelation.to.parseTree, function () {
                                    nonInlineTemplatesToCloneById[templateRelation.to.id] = templateRelation.to;
                                    doClone = true;
                                    return false;
                                });
                            });
                        }
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
            var localeIdsByMissingKey = {},
                defaultValueMismatchesByKey = {};
            localeIds.forEach(function (localeId) {
                var localizedHtml = originalHtmlAsset.clone(),
                    allKeysForLocale = i18nTools.extractAllKeysForLocale(assetGraph, localeId),
                    oneTrReplacer = i18nTools.createOneTrReplacer({
                        allKeysForLocale: allKeysForLocale,
                        localeId: localeId,
                        defaultLocaleId: defaultLocaleId,
                        localeIdsByMissingKey: localeIdsByMissingKey,
                        defaultValueMismatchesByKey: defaultValueMismatchesByKey
                    }),
                    i18nTagReplacer = i18nTools.createI18nTagReplacer({
                        allKeysForLocale: allKeysForLocale,
                        localeId: localeId,
                        defaultLocaleId: defaultLocaleId,
                        localeIdsByMissingKey: localeIdsByMissingKey,
                        defaultValueMismatchesByKey: defaultValueMismatchesByKey
                    });

                localizedHtml.url = originalHtmlAsset.url; // Avoidable if asset.clone() is changed to duplicate the original url.
                localizedHtml.extension = '.' + localeId + localizedHtml.extension;

                localizedHtml.parseTree.documentElement.setAttribute('lang', localeId);

                i18nTools.eachI18nTagInHtmlDocument(localizedHtml.parseTree, i18nTagReplacer);

                localizedHtml.markDirty();

                assetGraph.findRelations({type: ['HtmlScript', 'HtmlDataBindAttribute', 'HtmlRequireJsMain'], from: localizedHtml, node: {id: query.not('oneBootstrapper')}}).forEach(function (htmlScript) {
                    if (htmlScript.to.id in nonInlineJavaScriptsToCloneById) {
                        var hasAmdRelations = assetGraph.findRelations({from: htmlScript.to, type: ['JavaScriptAmdDefine', 'JavaScriptAmdRequire']}).length > 0;
                        htmlScript.to.clone(htmlScript);
                        if (!hasAmdRelations) {
                            assetGraph.findRelations({from: htmlScript.to, type: ['JavaScriptAmdDefine', 'JavaScriptAmdRequire']}).forEach(function (relation) {
                                assetGraph.removeRelation(relation);
                            });
                        }
                    }
                    i18nTools.eachOneTrInAst(htmlScript.to.parseTree, oneTrReplacer);

                    if (htmlScript.node.hasAttribute('localize')) {
                        htmlScript.to.parseTree = uglifyJs.uglify.ast_squeeze(uglifyJs.uglify.ast_mangle(htmlScript.to.parseTree, {defines: {LOCALEID: ['string', localeId]}}));
                        htmlScript.node.removeAttribute('localize');
                    }

                    assetGraph.findRelations({from: htmlScript.to, type: 'JavaScriptOneGetText', to: {isInline: false, type: 'KnockoutJsTemplate'}}).forEach(function (templateRelation) {
                        if (templateRelation.to.id in nonInlineTemplatesToCloneById) {
                            templateRelation.to.clone(templateRelation);
                            i18nTools.eachI18nTagInHtmlDocument(templateRelation.to.parseTree, i18nTagReplacer);
                            assetGraph.findRelations({type: 'HtmlDataBindAttribute', from: templateRelation.to}).forEach(function (htmlDataBindAttributeRelation) {
                                i18nTools.eachOneTrInAst(htmlDataBindAttributeRelation.to.parseTree, oneTrReplacer);
                                htmlDataBindAttributeRelation.to.markDirty(); // FIXME: Not necessary if no replacements were performed
                            });
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
                assetGraph._localeIdsByMissingKey = localeIdsByMissingKey; // So they can be inspected by unit tests
                if (!quiet) {
                    console.warn('The following keys were missing:\n  ' + missingKeys.map(function (missingKey) {
                        return missingKey + ' (' + localeIdsByMissingKey[missingKey].join(',') + ')';
                    }).join('\n  '));
                }
            }

            var defaultValueMismatchKeys = Object.keys(defaultValueMismatchesByKey);
            if (defaultValueMismatchKeys.length) {
                assetGraph._defaultValueMismatchesByKey = defaultValueMismatchesByKey; // So they can be inspected by unit tests
                if (!quiet) {
                    console.warn('The following keys had mismatching default and ' + defaultLocaleId + ' values:\n  ' + defaultValueMismatchKeys.map(function (defaultValueMismatchKey) {
                        return defaultValueMismatchKey + ':\n    ' + defaultValueMismatchesByKey[defaultValueMismatchKey].map(function (defaultValueMismatch) {
                            return 'default value: ' + util.inspect(defaultValueMismatch.defaultValue) + ', ' + defaultLocaleId + ' value: ' + util.inspect(defaultValueMismatch.value);
                        }).join('\n    ');
                    }).join('\n  '));
                }
            }
        });
    };
};
