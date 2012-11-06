var util = require('util'),
    _ = require('underscore'),
    query = require('assetgraph').query,
    uglifyJs = require('uglify-js-papandreou'),
    uglifyAst = require('uglifyast'),
    i18nTools = require('../i18nTools');

function htmlOrKnockoutJsTemplateNeedsLocalization(asset) {
    var needsLocalization = false;
    i18nTools.eachI18nTagInHtmlDocument(asset.parseTree, function () {
        needsLocalization = true;
        return false;
    });
    if (!needsLocalization) {
        asset.assetGraph.findRelations({from: asset, type: 'HtmlDataBindAttribute'}).forEach(function (htmlDataBindAttributeRelation) {
            i18nTools.eachTrInAst(htmlDataBindAttributeRelation.to.parseTree, function () {
                needsLocalization = true;
                return false;
            });
        });
    }
    if (!needsLocalization) {
        asset.assetGraph.findRelations({from: asset, type: 'HtmlInlineScriptTemplate'}).forEach(function (htmlInlineScriptTemplateRelation) {
            if (htmlOrKnockoutJsTemplateNeedsLocalization(htmlInlineScriptTemplateRelation.to)) {
                needsLocalization = true;
            }
        });
    }
    return needsLocalization;
}

module.exports = function (queryObj, options) {
    var localeIds = options.localeIds.map(i18nTools.normalizeLocaleId),
        defaultLocaleId = i18nTools.normalizeLocaleId(options.defaultLocaleId || 'en'),
        quiet = options.quiet || false,
        infoObject = options.infoObject || {};

    return function cloneForEachLocale(assetGraph) {
        assetGraph.findAssets(_.extend({type: 'Html'}, queryObj)).forEach(function (originalHtmlAsset) {
            var nonInlineJavaScriptsToCloneById = {},
                nonInlineTemplatesToCloneById = {};

            // First note which JavaScript assets need to be cloned for each locale:
            assetGraph.findRelations({type: ['HtmlScript', 'HtmlRequireJsMain'], from: originalHtmlAsset, node: {id: query.not('bootstrapper')}}).forEach(function (htmlScript) {
                // Check if the JavaScript has one or more TRHTML expressions:
                var doClone = false;
                assetGraph.findRelations({from: htmlScript.to, type: 'JavaScriptTrHtml'}).forEach(function (javaScriptTrHtml) {
                    doClone = true;
                    if (!javaScriptTrHtml.to.isInline) {
                        nonInlineTemplatesToCloneById[javaScriptTrHtml.to.id] = javaScriptTrHtml.to;
                    }
                });
                if (!doClone) {
                    // Check if the JavaScript asset has relations to a template that needs localization:
                    assetGraph.findRelations({from: htmlScript.to, to: {isInline: false, type: 'KnockoutJsTemplate'}}).forEach(function (templateRelation) {
                        if (htmlOrKnockoutJsTemplateNeedsLocalization(templateRelation.to)) {
                            doClone = true;
                            nonInlineTemplatesToCloneById[templateRelation.to.id] = templateRelation.to;
                        }
                    });
                }

                // Also clone the JavaScript if it's not inline and contains at least one TR or TRPAT expression
                // or it uses LOCALEID, SUPPORTEDLOCALEIDS, or DEFAULTLOCALEID
                if (!doClone && !htmlScript.to.isInline) {
                    var q = [htmlScript.to.parseTree];
                    while (!doClone && q.length) {
                        var node = q.pop();

                        if ((node[0] === 'name' && (node[1] === 'LOCALEID' || node[1] === 'SUPPORTEDLOCALEIDS' || node[1] === 'DEFAULTLOCALEID')) ||
                            (node[0] === 'call' && node[1][0] === 'name' && (node[1][1] === 'TR' || node[1][1] === 'TRPAT'))) {

                            doClone = true;
                        } else {
                            // Don't dive into the LVALUE in assignments:
                            for (var i = (node[0] === 'assign' ? 3 : 0) ; i < node.length ; i += 1) {
                                if (Array.isArray(node[i])) {
                                    q.push(node[i]);
                                }
                            }
                        }
                    }

                    if (!htmlScript.to.isInline) {
                        i18nTools.eachTrInAst(htmlScript.to.parseTree, function () {
                            doClone = true;
                            return false;
                        });
                    }
                }
                if (doClone && !htmlScript.to.isInline) {
                    nonInlineJavaScriptsToCloneById[htmlScript.to.id] = htmlScript.to;
                }
            });
            infoObject.localeIdsByMissingKey = {};
            infoObject.defaultValueMismatchesByKey = {};
            localeIds.forEach(function (localeId) {
                var localizedHtml = originalHtmlAsset.clone(),
                    allKeysForLocale = i18nTools.extractAllKeysForLocale(assetGraph, localeId),
                    trReplacer = i18nTools.createTrReplacer({
                        allKeysForLocale: allKeysForLocale,
                        localeId: localeId,
                        defaultLocaleId: defaultLocaleId,
                        infoObject: infoObject
                    }),
                    i18nTagReplacer = i18nTools.createI18nTagReplacer({
                        allKeysForLocale: allKeysForLocale,
                        localeId: localeId,
                        defaultLocaleId: defaultLocaleId,
                        infoObject: infoObject
                    });

                localizedHtml.url = originalHtmlAsset.url; // Avoidable if asset.clone() is changed to duplicate the original url.
                localizedHtml.extension = '.' + localeId + localizedHtml.extension;

                var document = localizedHtml.parseTree;
                if (document.documentElement) {
                    document.documentElement.setAttribute('lang', localeId);
                }

                i18nTools.eachI18nTagInHtmlDocument(document, i18nTagReplacer);

                localizedHtml.markDirty();

                assetGraph.findRelations({from: localizedHtml, type: 'HtmlInlineScriptTemplate'}).forEach(function (htmlInlineScriptTemplate) {
                    i18nTools.eachI18nTagInHtmlDocument(htmlInlineScriptTemplate.to.parseTree, i18nTagReplacer);
                    htmlInlineScriptTemplate.to.markDirty();
                });

                assetGraph.findRelations({type: ['HtmlScript', 'HtmlDataBindAttribute', 'HtmlRequireJsMain'], from: localizedHtml, node: {id: query.not('bootstrapper')}}).forEach(function (htmlScript) {
                    if (htmlScript.to.id in nonInlineJavaScriptsToCloneById) {
                        var hasAmdRelations = assetGraph.findRelations({from: htmlScript.to, type: ['JavaScriptAmdDefine', 'JavaScriptAmdRequire']}).length > 0;
                        htmlScript.to.clone(htmlScript);
                        if (!hasAmdRelations) {
                            assetGraph.findRelations({from: htmlScript.to, type: ['JavaScriptAmdDefine', 'JavaScriptAmdRequire']}).forEach(function (relation) {
                                assetGraph.removeRelation(relation);
                            });
                        }
                    }
                    i18nTools.eachTrInAst(htmlScript.to.parseTree, trReplacer);

                    var globalValueByName = {LOCALEID: localeId, SUPPORTEDLOCALEIDS: localeIds, DEFAULTLOCALEID: defaultLocaleId};
                    ['localeCookieName'].forEach(function (optionName) {
                        if (options[optionName]) {
                            globalValueByName[optionName.toUpperCase()] = options[optionName];
                        }
                    });

                    var isDirty = false,
                        q = [htmlScript.to.parseTree];
                    while (q.length) {
                        var node = q.pop();

                        if ((node[0] === 'name' && Object.prototype.hasOwnProperty.call(globalValueByName, node[1]))) {
                            Array.prototype.splice.apply(node, [0, node.length].concat(uglifyAst.objToAst(globalValueByName[node[1]])));
                            isDirty = true;
                        } else {
                            // Don't dive into the LVALUE in assignments:
                            for (var i = (node[0] === 'assign' ? 3 : 0) ; i < node.length ; i += 1) {
                                if (Array.isArray(node[i])) {
                                    q.push(node[i]);
                                }
                            }
                        }
                    }
                    if (isDirty) {
                        htmlScript.to.markDirty();
                    }

                    assetGraph.findRelations({from: htmlScript.to, type: 'JavaScriptTrHtml'}).forEach(function (javaScriptTrHtml) {
                        if (javaScriptTrHtml.to.id in nonInlineTemplatesToCloneById) {
                            javaScriptTrHtml.to.clone(javaScriptTrHtml);
                        }
                        i18nTools.eachI18nTagInHtmlDocument(javaScriptTrHtml.to.parseTree, i18nTagReplacer);
                        javaScriptTrHtml.to.markDirty();
                    });

                    assetGraph.findRelations({from: htmlScript.to, type: 'JavaScriptGetText', to: {isInline: false, type: 'KnockoutJsTemplate'}}).forEach(function (templateRelation) {
                        if (templateRelation.to.id in nonInlineTemplatesToCloneById) {
                            templateRelation.to.clone(templateRelation);
                            i18nTools.eachI18nTagInHtmlDocument(templateRelation.to.parseTree, i18nTagReplacer);
                            assetGraph.findRelations({type: 'HtmlDataBindAttribute', from: templateRelation.to}).forEach(function (htmlDataBindAttributeRelation) {
                                i18nTools.eachTrInAst(htmlDataBindAttributeRelation.to.parseTree, trReplacer);
                                htmlDataBindAttributeRelation.to.markDirty(); // FIXME: Not necessary if no replacements were performed
                            });
                            assetGraph.findRelations({type: 'HtmlInlineScriptTemplate', from: templateRelation.to}).forEach(function (htmlInlineScriptTemplateRelation) {
                                i18nTools.eachI18nTagInHtmlDocument(htmlInlineScriptTemplateRelation.to.parseTree, i18nTagReplacer);
                                htmlInlineScriptTemplateRelation.to.markDirty(); // FIXME: Not necessary if no replacements were performed
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

            var missingKeys = Object.keys(infoObject.localeIdsByMissingKey);
            if (missingKeys.length > 0 && !quiet) {
                console.warn('The following keys were missing:\n  ' + missingKeys.map(function (missingKey) {
                    return missingKey + ' (' + infoObject.localeIdsByMissingKey[missingKey].join(',') + ')';
                }).join('\n  '));
            }

            var defaultValueMismatchKeys = Object.keys(infoObject.defaultValueMismatchesByKey);
            if (defaultValueMismatchKeys.length > 0 && !quiet) {
                console.warn('The following keys had mismatching default and/or ' + defaultLocaleId + ' values:\n  ' + defaultValueMismatchKeys.map(function (defaultValueMismatchKey) {
                    return defaultValueMismatchKey + ':\n    ' + util.inspect(infoObject.defaultValueMismatchesByKey[defaultValueMismatchKey]);
                }).join('\n  '));
            }
            var whitespaceWarningKeys = Object.keys(infoObject.whitespaceWarningsByKey);
            if (whitespaceWarningKeys.length > 0 && !quiet) {
                console.warn('The following keys had leading or trailing whitespace:\n  ' + whitespaceWarningKeys.map(function (whitespaceWarningKey) {
                    return whitespaceWarningKey + ':\n    ' + util.inspect(infoObject.whitespaceWarningsByKey[whitespaceWarningKey]);
                }).join('\n  '));
            }
        });
    };
};
