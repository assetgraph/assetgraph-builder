module.exports = function (options) {
    options = options || {};

    return function buildProduction(assetGraph, cb) {
        var query = assetGraph.query,
            followRelationsQueryObj = query.or({
                to: {type: 'I18n'}
            },
            {
                type: query.not(['JavaScriptInclude', 'JavaScriptExtJsRequire', 'JavaScriptCommonJsRequire', 'HtmlAnchor']),
                to: query.and({url: query.not(/^https?:/)}, {url: query.not(options.blacklistUrlRegExp)})
            });

        assetGraph
            .populate({from: {type: 'Html'}, followRelations: {type: 'HtmlScript'}})
            .queue(function (assetGraph) {
                // Assume that if there is a require.js config, it was in one of the top-level scripts:
                // This is only possible if the preventPopulationOfJavaScriptAssetsUntilConfigHasBeenFound option
                // for the registerRequireJsConfig transform is active.
                assetGraph.findAssets({type: 'JavaScript', keepUnpopulated: true}).forEach(function (javaScriptAsset) {
                    javaScriptAsset.keepUnpopulated = false;
                    javaScriptAsset.populate();
                });
                assetGraph.requireJsConfig.preventPopulationOfJavaScriptAssetsUntilConfigHasBeenFound = false;
            })
            .populate({followRelations: followRelationsQueryObj})
            .queue(function fixBaseAssetsOfUnresolvedOutgoingRelationsFromHtmlFragments(assetGraph) {
                assetGraph.findRelations({from: {type: 'Html', isFragment: true, isInitial: true}}, true).forEach(function (relation) {
                    if (relation._baseAssetPath === null) {
                        delete relation._baseAssetPath;
                    }
                });
            })
            .populate({followRelations: followRelationsQueryObj, startAssets: {type: 'Html', isFragment: true, isInitial: true}})
            // Remove bootstrapper scripts injected by buildDevelopment:
            .removeRelations({type: 'HtmlScript', node: {id: 'bootstrapper'}, from: {type: 'Html'}}, {detach: true, removeOrphan: true})
            .if(options.version)
                .addContentVersionMetaElement({type: 'Html', isInitial: true}, options.version, true)
            .endif()
            .if(options.less)
                // Replace Less assets with their Css counterparts:
                .compileLessToCss({type: 'Less', isLoaded: true})

                // Remove the in-browser less compiler and its incoming relations,
                // even if it's included from a CDN and thus hasn't been populated:
                .removeRelations({to: {url: /\/less(?:-\d+\.\d+\.\d+)?(?:\.min)?\.js$/}}, {unresolved: true, detach: true, removeOrphan: true})

                // Find and populate CssImage relations from the compiled Less assets:
                .populate({from: {type: 'Css'}, followRelations: followRelationsQueryObj})
            .endif()
            .removeRelations({type: 'JavaScriptInclude', to: {type: ['Css', 'JavaScript']}}, {detach: true, unresolved: true})
            .externalizeRelations({from: {type: query.not('Htc')}, type: ['HtmlStyle', 'HtmlScript'], node: function (node) {return !node.hasAttribute('nobundle');}})
            .mergeIdenticalAssets(query.or({isImage: true}, {isLoaded: true, type: ['JavaScript', 'Css']}))
            // First execute explicit instructions in the query strings for images that are to be sprited:
            .processImages({isImage: true, isLoaded: true, url: /\?(?:|.*&)sprite(?:[&=#]|$)/})
            .spriteBackgroundImages()
            // Execute explicit and automatic optimizations for all images, including the generated sprite images:
            .processImages({isImage: true, isLoaded: true}, {pngcrush: options.pngcrush, optipng: options.optipng, pngquant: options.pngquant, jpegtran: options.jpegtran})
            .inlineKnockoutJsTemplates()
            .bundleRequireJs({type: 'Html', isFragment: false})
            .convertHtmlRequireJsMainToHtmlScript()
            .convertCssImportsToHtmlStyles()
            // https://github.com/One-com/assetgraph/issues/82
            .queue(function removeDuplicateHtmlStyles(assetGraph) {
                assetGraph.findAssets({type: 'Html', isInitial: true}).forEach(function (htmlAsset) {
                    var seenCssAssetsById = {};
                    assetGraph.findRelations({from: htmlAsset, type: 'HtmlStyle'}).forEach(function (htmlStyle) {
                        if (seenCssAssetsById[htmlStyle.to.id]) {
                            htmlStyle.detach();
                        } else {
                            seenCssAssetsById[htmlStyle.to.id] = true;
                        }
                    });
                });
            })
            .bundleRelations({type: 'HtmlStyle', to: {type: 'Css', isLoaded: true}, node: function (node) {return !node.hasAttribute('nobundle');}})
            .bundleRelations({type: 'HtmlScript', to: {type: 'JavaScript', isLoaded: true}, node: function (node) {return !node.hasAttribute('nobundle');}})
            .removeNobundleAttribute({type: ['HtmlScript', 'HtmlStyle']})
            .inlineCssImagesWithLegacyFallback({type: 'Html', isInline: false, isFragment: false}, options.inlineSize)
            .if(options.mangleTopLevel)
                .pullGlobalsIntoVariables({type: 'JavaScript', isLoaded: true})
            .endif()
            .minifyAssets({isLoaded: true})
            .if(options.localeIds)
                .cloneForEachLocale({type: 'Html', isInitial: true}, {
                    localeIds: options.localeIds,
                    supportedLocaleIds: options.localeIds,
                    localeCookieName: options.localeCookieName,
                    infoObject: options.localizationInfoObject,
                    defaultLocaleId: options.defaultLocaleId
                })
                .runJavaScriptConditionalBlocks({isInitial: true}, 'LOCALIZE', true)
            .endif()
            .removeAssets({type: 'I18n'}, true)
            .removeAssets({isLoaded: true, isEmpty: true, type: ['Css', 'JavaScript']}, true)
            .compressJavaScript({type: 'JavaScript', isLoaded: true}, 'uglifyJs', {toplevel: options.mangleTopLevel, defines: options.defines})
            .inlineRelations({
                type: ['HtmlStyle', 'HtmlScript'],
                from: {isInline: false}, // Excludes relations occurring in conditional comments
                to: function (asset) {return asset.isLoaded && asset.isAsset && asset.rawSrc.length < 4096;}
            })
            .if(options.prettyPrint)
                .prettyPrintAssets(function (asset) {
                    return asset.isLoaded && asset.type === 'JavaScript' && (!asset.isInline || asset.incomingRelations.every(function (incomingRelation) {
                        return incomingRelation.type === 'HtmlScript';
                    }));
                })
                .prettyPrintAssets({type: 'Css', isLoaded: true})
            .endif()
            .inlineAngularJsTemplates()
            .setAsyncOrDeferOnHtmlScripts({to: {isInline: false, url: /^file:/}}, options.asyncScripts, options.deferScripts)
            .omitFunctionCall({type: ['JavaScriptGetStaticUrl', 'JavaScriptTrHtml']})
            .inlineRelations({type: ['JavaScriptGetText', 'JavaScriptTrHtml']})
            .if(options.manifest)
                .addCacheManifest({isInitial: true})
                .if(options.localeIds && options.negotiateManifest)
                    .queue(function stripLocaleIdFromHtmlCacheManifestRelations(assetGraph) {
                        // This would be much less fragile if an asset could have a canonical url as well as an url (under consideration):
                        assetGraph.findRelations({type: 'HtmlCacheManifest'}).forEach(function (htmlCacheManifest) {
                            htmlCacheManifest.href = htmlCacheManifest.href.replace(/\.\w+\.appcache$/, '.appcache');
                        });
                    })
                .endif()
            .endif()
            .moveAssetsInOrder({isLoaded: true, isInline: false, type: query.not('CacheManifest')}, function (asset, assetGraph) {
                if (!asset.isInitial || (asset.type === 'Html' && asset.isFragment)) {
                    var targetUrl = "/static/";
                    // Conservatively assume that all GETSTATICURL relations pointing at non-images are intended to be fetched via XHR
                    // and thus cannot be put on a CDN because of same origin restrictions:
                    if (options.cdnRoot && asset.type !== 'Htc' && (asset.isImage || assetGraph.findRelations({to: asset, type: 'StaticUrlMapEntry'}).length === 0) || (options.cdnFlash && asset.type === 'Flash')) {
                        targetUrl = options.cdnRoot;
                        if (/^\/\//.test(options.cdnRoot)) {
                            assetGraph.findRelations({to: asset}).forEach(function (incomingRelation) {
                                incomingRelation.hrefType = 'protocolRelative';
                            });
                        }
                    }
                    return targetUrl + asset.md5Hex.substr(0, 10) + asset.extension + asset.url.replace(/^[^#\?]*(?:)/, ''); // Preserve query string and fragment identifier
                }
            })
            .run(cb);
    };
};
