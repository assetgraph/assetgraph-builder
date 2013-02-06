var util = require('util'),
    _ = require('underscore'),
    uglifyJs = require('uglify-js-papandreou'),
    uglifyAst = require('uglifyast'),
    i18nTools = require('../i18nTools'),
    htmlLangCssSelectorRegExp = /^(html\[\s*lang\s*(?:=|\|=|~=)\s*(|'|").*?\1\s*\])(.*)$/i;

function assetNeedsLocalization(asset, assetGraph) {
    var needsLocalization = false;
    if (asset.type === 'JavaScript') {
        if (asset.incomingRelations.every(function (incomingRelation) {
            return incomingRelation.type !== 'HtmlScript' || incomingRelation.node.id !== 'bootstrapper';
        })) {
            var q = [asset.parseTree];
            while (!needsLocalization && q.length > 0) {
                var node = q.pop();

                if ((node[0] === 'name' && (node[1] === 'LOCALEID' || node[1] === 'SUPPORTEDLOCALEIDS' || node[1] === 'DEFAULTLOCALEID')) ||
                    (node[0] === 'call' && node[1][0] === 'name' && (node[1][1] === 'TR' || node[1][1] === 'TRPAT'))) {

                    needsLocalization = true;
                } else {
                    // Don't dive into the LVALUE in assignments:
                    for (var i = (node[0] === 'assign' ? 3 : 0) ; i < node.length ; i += 1) {
                        if (Array.isArray(node[i])) {
                            q.push(node[i]);
                        }
                    }
                }
            }
        }
    } else if (asset.isHtml) {
        i18nTools.eachI18nTagInHtmlDocument(asset.parseTree, function () {
            needsLocalization = true;
            return false;
        });
    } else if (asset.type === 'Css') {
        asset.eachRuleInParseTree(function (cssRule, parentRuleOrStylesheet) {
            if (cssRule.type === 1) { // cssom.CSSRule.STYLE_RULE
                if (htmlLangCssSelectorRegExp.test(cssRule.selectorText)) {
                    needsLocalization = true;
                    return false;
                }
            }
        });
    }
    return needsLocalization;
}

function isBootstrapperRelation(relation) {
    return relation.type === 'HtmlScript' && relation.node && relation.node.getAttribute('id') === 'bootstrapper';
}

function followRelationFn(relation) {
    return relation.type !== 'HtmlAnchor' && !isBootstrapperRelation(relation);
}

module.exports = function (queryObj, options) {
    var localeIds = options.localeIds.map(i18nTools.normalizeLocaleId),
        defaultLocaleId = i18nTools.normalizeLocaleId(options.defaultLocaleId || 'en'),
        infoObject = options.infoObject || {};

    return function cloneForEachLocale(assetGraph) {
        var assetNeedsLocalizationById = {};
        assetGraph.findAssets(_.extend({type: 'Html'}, queryObj)).forEach(function (originalHtmlAsset) {
            var assetToLocalizeById = {},
                assetsToLocalize = [];
            assetGraph.eachAssetPostOrder(originalHtmlAsset, followRelationFn, function (asset) {
                if (asset.isLoaded && (assetNeedsLocalization(asset) || assetGraph.findRelations({from: asset}).some(function (outgoingRelation) {return outgoingRelation.to.id in assetToLocalizeById;}))) {
                    assetToLocalizeById[asset.id] = asset;
                    assetsToLocalize.push(asset);
                }
            });

            var nonInlineAssetsToLocalizePreOrder = [];
            assetGraph.eachAssetPreOrder(originalHtmlAsset, followRelationFn, function (asset) {
                if (!asset.isInline && asset.id in assetToLocalizeById) {
                    nonInlineAssetsToLocalizePreOrder.push(asset);
                }
            });

            localeIds.forEach(function (localeId) {
                var allKeysForLocale = i18nTools.extractAllKeysForLocale(assetGraph, localeId),
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
                    }),
                    globalValueByName = {LOCALEID: localeId, SUPPORTEDLOCALEIDS: localeIds, DEFAULTLOCALEID: defaultLocaleId};

                ['localeCookieName'].forEach(function (optionName) {
                    if (options[optionName]) {
                        globalValueByName[optionName.toUpperCase()] = options[optionName];
                    }
                });

                var localizedAssets = [];

                function localizeAsset(asset) {
                    if (asset.type === 'JavaScript') {
                        if (asset.incomingRelations.every(isBootstrapperRelation)) {
                            return;
                        }
                        i18nTools.eachTrInAst(asset.parseTree, trReplacer);

                        var ifAndParentNodesToOptimize = [],
                            walker = uglifyJs.uglify.ast_walker();
                        walker.with_walkers({
                            name: function (name) {
                                if (Object.prototype.hasOwnProperty.call(globalValueByName, name)) {
                                    var stack = walker.stack(),
                                        node = stack[stack.length - 1];
                                    if (stack[stack.length - 2][0] !== 'assign') {
                                        Array.prototype.splice.apply(node, [0, node.length].concat(uglifyAst.objToAst(globalValueByName[node[1]])));
                                        for (var i = stack.length - 2 ; i >= 0 ; i -= 1) {
                                            var parentNode = stack[i];
                                            if (parentNode[0] === 'if') {
                                                ifAndParentNodesToOptimize.push([parentNode, stack[i - 1]]);
                                            } else if (parentNode[0] !== 'binary' && parentNode[0] !== 'unary-prefix' && parentNode[0] !== 'unary-postfix') {
                                                break;
                                            }
                                        }
                                    }
                                }
                            }
                        }, function () {
                            walker.walk(asset.parseTree);
                        });
                        // Poor man's optimization: Replace if(false) with the else part and if(true) with the then part.
                        ifAndParentNodesToOptimize.forEach(function (ifAndParentNode) {
                            var ifNode = ifAndParentNode[0],
                                parentNode = ifAndParentNode[1],
                                statementArray = parentNode[0] === 'toplevel' && parentNode[1];
                            if (statementArray) {
                                var indexInStatementArray = statementArray.indexOf(ifNode);
                                if (indexInStatementArray !== -1) {
                                    var foldedAst = uglifyAst.foldConstant(ifNode[1]);
                                    if (foldedAst[0] === 'unary-prefix' && foldedAst[1] === '!' && foldedAst[2][0] === 'num') {
                                        var statementAsts = foldedAst[2][1] ? (ifNode[3] ? [ifNode[3]] : []) : (ifNode[2] ? [ifNode[2]] : []);
                                        if (statementAsts.length === 1 && statementAsts[0][0] === 'block') {
                                            statementAsts = statementAsts[0][1];
                                        }
                                        Array.prototype.splice.apply(statementArray, [indexInStatementArray, 1].concat(statementAsts));
                                    }
                                }
                            }
                        });
                        asset.markDirty();
                    } else if (asset.isHtml) {
                        var document = asset.parseTree;
                        i18nTools.eachI18nTagInHtmlDocument(document, i18nTagReplacer);
                        if (document.documentElement) {
                            document.documentElement.setAttribute('lang', localeId);
                        }
                        asset.markDirty();
                    } else if (asset.type === 'Css') {
                        var cssRules = [];
                        asset.eachRuleInParseTree(function (cssRule) {
                            if (cssRule.type === 1) { // cssom.CSSRule.STYLE_RULE
                                cssRules.push(cssRule);
                            }
                        });
                        // Traverse the rules in reverse so the indices aren't screwed up by deleting rules underway:
                        cssRules.reverse().forEach(function (cssRule) {
                            var matchSelectorText = cssRule.selectorText.match(htmlLangCssSelectorRegExp);
                            if (matchSelectorText) {
                                if (localizedAssets[0].parseTree.querySelectorAll(matchSelectorText[1]).length > 0) {
                                    cssRule.selectorText = 'html' + matchSelectorText[3];
                                } else {
                                    assetGraph.findRelations({from: asset}).forEach(function (outgoingRelation) {
                                        if (outgoingRelation.cssRule !== cssRule) {
                                            return;
                                        }
                                        if (outgoingRelation.to.isInline) {
                                            assetGraph.removeAsset(outgoingRelation.to);
                                        }
                                        // FIXME: Find out why outgoingRelation isn't in the graph when outgoingRelation.to is an inline image!
                                        if (outgoingRelation.assetGraph) {
                                            assetGraph.removeRelation(outgoingRelation);
                                        }
                                    });
                                    var containingCssRules = (cssRule.parentRule || cssRule.parentStyleSheet).cssRules;
                                    containingCssRules.splice(containingCssRules.indexOf(cssRule), 1);
                                }
                            }
                        });
                        asset.markDirty();
                    }
                }

                // asset.clone adds the asset to the graph and populates the relations. Since the localization
                // could introduce or remove relations, it needs to happen before the population.
                // The 'addAsset' event is emitted right before the population takes place, so that does the job.
                // (Would of course be cleaner if asset.clone was split up or supported a hook at this point).
                assetGraph.on('addAsset', localizeAsset);

                nonInlineAssetsToLocalizePreOrder.forEach(function (asset) {
                    var incomingRelationsFromLocalizedAssets = assetGraph.findRelations({to: asset, from: {nonInlineAncestor: localizedAssets}}),
                        targetUrl = asset.url.replace(/(\.\w+)?$/, '.' + localeId + '$1'),
                        existingLocalizedAsset = assetGraph.findAssets({url: targetUrl})[0];

                    if (existingLocalizedAsset) {
                        incomingRelationsFromLocalizedAssets.forEach(function (incomingRelation) {
                            incomingRelation.to = existingLocalizedAsset;
                            incomingRelation.refreshHref();
                        });
                    } else {
                        var localizedAsset = asset.clone(incomingRelationsFromLocalizedAssets);
                        localizedAsset.url = targetUrl;
                        localizedAssets.push(localizedAsset);
                    }
                });

                assetGraph.removeListener('addAsset', localizeAsset);
            });

            // Remove orphaned JavaScript and templates:

            nonInlineAssetsToLocalizePreOrder.forEach(function (asset) {
                if (asset.assetGraph && (asset === originalHtmlAsset || (!asset.isInline && assetGraph.findRelations({to: asset}).length === 0))) {
                    assetGraph.removeAsset(asset);
                }
            });
        });
    };
};
