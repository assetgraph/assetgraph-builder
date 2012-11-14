var util = require('util'),
    _ = require('underscore'),
    query = require('assetgraph').query,
    uglifyJs = require('uglify-js-papandreou'),
    uglifyAst = require('uglifyast'),
    i18nTools = require('../i18nTools');

function assetNeedsLocalization(asset, assetGraph) {
    var needsLocalization = false;
    if (asset.type === 'JavaScript') {
        if (asset.incomingRelations.every(function (incomingRelation) {return incomingRelation.type !== 'HtmlScript' || incomingRelation.node.id !== 'bootstrapper';})) {
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
    } else if (asset.type === 'Html' || asset.type === 'KnockoutJsTemplate') {
        i18nTools.eachI18nTagInHtmlDocument(asset.parseTree, function () {
            needsLocalization = true;
            return false;
        });
    }
    return needsLocalization;
}

var doFollowByRelationType = {};

[
    'HtmlScript', 'HtmlRequireJsMain', 'HtmlConditionalComment', 'HtmlInlineScriptTemplate', 'HtmlDataBindAttribute', 'HtmlRequireJsMain',
    'HtmlCacheManifest', 'HtmlCacheManifestEntry',
    'JavaScriptAmdDefine', 'JavaScriptAmdRequire', 'JavaScriptShimRequire', 'JavaScriptInclude', 'JavaScriptTrHtml', 'JavaScriptGetText'
].forEach(function (relationType) {
    doFollowByRelationType[relationType] = true;
});

function isBootstrapperRelation(relation) {
    return relation.type === 'HtmlScript' && relation.node && relation.node.getAttribute('id') === 'bootstrapper';
}

function followRelationFn(relation) {
    return doFollowByRelationType[relation.type] && !isBootstrapperRelation(relation);
}

module.exports = function (queryObj, options) {
    var localeIds = options.localeIds.map(i18nTools.normalizeLocaleId),
        defaultLocaleId = i18nTools.normalizeLocaleId(options.defaultLocaleId || 'en'),
        quiet = options.quiet || false,
        infoObject = options.infoObject || {};

    return function cloneForEachLocale(assetGraph) {
        var assetNeedsLocalizationById = {};
        assetGraph.findAssets(_.extend({type: 'Html'}, queryObj)).forEach(function (originalHtmlAsset) {
            var assetToLocalizeById = {},
                assetsToLocalize = [];
            assetGraph.eachAssetPostOrder(originalHtmlAsset, followRelationFn, function (asset) {
                if (assetNeedsLocalization(asset) || assetGraph.findRelations({from: asset}).some(function (outgoingRelation) {return outgoingRelation.to.id in assetToLocalizeById;})) {
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

                function localizeAsset(asset) {
                    asset.outgoingRelations.forEach(function (outgoingRelation) {
                        if (outgoingRelation.to.isInline && !isBootstrapperRelation(outgoingRelation)) {
                            localizeAsset(outgoingRelation.to);
                        }
                    });
                    if (asset.type === 'JavaScript') {
                        i18nTools.eachTrInAst(asset.parseTree, trReplacer);
                        var q = [asset.parseTree];
                        while (q.length) {
                            var node = q.pop();

                            if ((node[0] === 'name' && Object.prototype.hasOwnProperty.call(globalValueByName, node[1]))) {
                                Array.prototype.splice.apply(node, [0, node.length].concat(uglifyAst.objToAst(globalValueByName[node[1]])));
                            } else {
                                // Don't dive into the LVALUE in assignments:
                                for (var i = (node[0] === 'assign' ? 3 : 0) ; i < node.length ; i += 1) {
                                    if (Array.isArray(node[i])) {
                                        q.push(node[i]);
                                    }
                                }
                            }
                        }
                        asset.markDirty();
                    } else if (asset.type === 'Html' || asset.type === 'KnockoutJsTemplate') {
                        i18nTools.eachI18nTagInHtmlDocument(asset.parseTree, i18nTagReplacer);
                        var document = asset.parseTree;
                        if (document.documentElement) {
                            document.documentElement.setAttribute('lang', localeId);
                        }
                        asset.markDirty();
                    }
                }

                var localizedAssets = [];
                nonInlineAssetsToLocalizePreOrder.forEach(function (asset) {
                    var incomingRelationsFromLocalizedAssets = assetGraph.findRelations({to: asset, from: {nonInlineAncestor: localizedAssets}}),
                        localizedAsset = asset.clone(incomingRelationsFromLocalizedAssets);
                    localizeAsset(localizedAsset);
                    // Doing this for all assets would be really nice, but it breaks transforms.bundleRequireJs:
                    localizedAsset.url = asset.url.replace(/(\.\w+)?$/, '.' + localeId + '$1');
                    localizedAssets.push(localizedAsset);
                });
            });

            // Remove orphaned JavaScript and templates:

            nonInlineAssetsToLocalizePreOrder.forEach(function (asset) {
                if (asset === originalHtmlAsset || (!asset.isInline && assetGraph.findRelations({to: asset}).length === 0)) {
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
