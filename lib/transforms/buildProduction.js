var query = require('assetgraph').query;

module.exports = function (options) {
    options = options || {};

    var followRelationsQueryObj = query.or({to: {type: 'I18n'}},
                                           {type: query.not(['JavaScriptInclude', 'JavaScriptExtJsRequire', 'JavaScriptCommonJsRequire', 'HtmlAnchor']),
                                            to: query.and({url: query.not(/^https?:/)}, {url: query.not(options.blacklistUrlRegExp)})});

    return function buildProduction(assetGraph, cb) {
        assetGraph
            .populate({followRelations: followRelationsQueryObj})
            // Remove bootstrapper scripts injected by buildDevelopment:
            .removeRelations({type: 'HtmlScript', node: {id: 'bootstrapper'}, from: {type: 'Html'}}, {detach: true, removeOrphan: true})
            .if(options.version)
                .addContentVersionMetaElement({type: 'Html'}, options.version, true)
            .endif()
            .if(options.less)
                // Replace Less assets with their Css counterparts:
                .compileLessToCss({type: 'Less'})

                // Remove the in-browser less compiler and its incoming relations,
                // even if it's included from a CDN and thus hasn't been populated:
                .removeRelations({to: {url: /\/less(?:-\d+\.\d+\.\d+)?(?:\.min)?\.js$/}}, {unresolved: true, detach: true, removeOrphan: true})

                // Find and populate CssImage relations from the compiled Less assets:
                .populate({from: {type: 'Css'}})
            .endif()
            .removeRelations({type: 'JavaScriptInclude', to: {type: ['Css', 'JavaScript']}}, {detach: true, unresolved: true})
            .convertCssImportsToHtmlStyles()
            .removeAssets({isEmpty: true, type: ['Css', 'JavaScript']}, true)
            .externalizeRelations({from: {type: query.not('Htc')}, type: ['HtmlStyle', 'HtmlScript'], node: function (node) {return !node.hasAttribute('nobundle');}})
            .mergeIdenticalAssets(query.or({isImage: true}, {type: ['JavaScript', 'Css']}))
            .spriteBackgroundImages()
            .postProcessCssImages()
            .if(options.optimizePngs)
                .optimizePngs()
            .endif()
            .if(options.optimizeJpgs)
                .optimizeJpgs()
            .endif()
            .bundleRequireJs({type: 'Html'})
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
            .bundleRelations({type: 'HtmlStyle', to: {type: 'Css'}, node: function (node) {return !node.hasAttribute('nobundle');}})
            .bundleRelations({type: 'HtmlScript', to: {type: 'JavaScript'}, node: function (node) {return !node.hasAttribute('nobundle');}})
            .removeNobundleAttribute({type: ['HtmlScript', 'HtmlStyle']})
            .inlineCssImagesWithLegacyFallback({type: 'Html', isInline: false}, options.inlineSize)
            .if(options.mangleTopLevel)
                .pullGlobalsIntoVariables({type: 'JavaScript'})
            .endif()
            .minifyAssets()
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
            .if(!options.noCompress)
                .compressJavaScript({type: 'JavaScript'}, 'uglifyJs', {toplevel: options.mangleTopLevel, defines: options.defines})
            .endif()
            .inlineRelations({
                type: ['HtmlStyle', 'HtmlScript'],
                from: {isInline: false}, // Excludes relations occurring in conditional comments
                to: function (asset) {return asset.isAsset && asset.rawSrc.length < 4096;}
            })
            .if(options.noCompress)
                .prettyPrintAssets(function (asset) {
                    return asset.type === 'JavaScript' && (!asset.isInline || asset.incomingRelations.every(function (incomingRelation) {
                        return incomingRelation.type === 'HtmlScript';
                    }));
                })
                .prettyPrintAssets({type: 'Css'})
            .endif()
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
            .moveAssetsInOrder({isInitial: query.not(true), type: query.not('CacheManifest')}, function (asset, assetGraph) {
                var targetUrl = "/static/";
                // Conservatively assume that all GETSTATICURL relations pointing at non-images are intended to be fetched via XHR
                // and thus cannot be put on a CDN because of same origin restrictions:
                if (options.cdnRoot && (asset.isImage || assetGraph.findRelations({to: asset, type: 'StaticUrlMapEntry'}).length === 0)) {
                    targetUrl = options.cdnRoot;
                    if (/^\/\//.test(options.cdnRoot)) {
                        assetGraph.findRelations({to: asset}).forEach(function (incomingRelation) {
                            incomingRelation.hrefType = 'protocolRelative';
                        });
                    }
                }
                return targetUrl + asset.md5Hex.substr(0, 10) + asset.extension + asset.url.replace(/^[^#\?]*(?:)/, ''); // Preserve query string and fragment identifier
            })
            .run(cb);
    };
};
