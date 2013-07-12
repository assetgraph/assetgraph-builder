var _ = require('underscore');

module.exports = function (options) {
    options = options || {};

    var bundleStrategyName = options.sharedBundles ? 'sharedBundles' : 'oneBundlePerIncludingAsset';

    return function buildProduction(assetGraph, cb) {
        var query = assetGraph.query,
            followRelationsQueryObj = query.or({
                to: {type: 'I18n'}
            },
            {
                type: query.not(['JavaScriptInclude', 'JavaScriptExtJsRequire', 'JavaScriptCommonJsRequire', 'HtmlAnchor', 'SvgAnchor']),
                to: query.and({url: query.not(/^https?:/)}, {url: query.not(options.blacklistUrlRegExp)})
            });

        assetGraph
            .populate({from: {type: 'Html'}, followRelations: {type: 'HtmlScript', to: {url: /^file:/}}})
            .assumeRequireJsConfigHasBeenFound()
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
            .addDataVersionAttributeToHtmlElement({type: 'Html', isInitial: true}, options.version)
            .if(options.less)
                // Replace Less assets with their Css counterparts:
                .compileLessToCss({type: 'Less', isLoaded: true})

                // Remove the in-browser less compiler and its incoming relations,
                // even if it's included from a CDN and thus hasn't been populated.
                // FIXME: Turns out there's a bunch of less.js files (eg. in the ACE editor)
                // that we don't want to be remove, so this is probably a bit too magical.
                .removeRelations({type: 'HtmlScript', to: {url: /\/less(?:-\d+\.\d+\.\d+)?(?:\.min)?\.js$/}}, {unresolved: true, detach: true, removeOrphan: true})

                // Find and populate CssImage relations from the compiled Less assets:
                .populate({from: {type: 'Css'}, followRelations: followRelationsQueryObj})
            .endif()
            .if(options.stripDebug)
                .stripDebug({type: 'JavaScript', isLoaded: true})
            .endif()
            .removeRelations({type: 'JavaScriptInclude', to: {type: ['Css', 'JavaScript']}}, {detach: true, unresolved: true})
            .externalizeRelations({from: {type: query.not('Htc')}, type: ['HtmlStyle', 'HtmlScript'], node: function (node) {return !node.hasAttribute('nobundle');}})
            .mergeIdenticalAssets({
                isImage: true,
                isLoaded: true,
                url: /^[^\?]$/ // Skip images with a query string in the url (might contain processImage instructions)
            })
            // First execute explicit instructions in the query strings for images that are to be sprited:
            .processImages({isImage: true, isLoaded: true, url: /\?(?:|.*&)sprite(?:[&=#]|$)/})
            .spriteBackgroundImages()
            // Execute explicit and automatic optimizations for all images, including the generated sprite images:
            .processImages({isImage: true, isLoaded: true}, {autoLossless: options.optimizeImages})
            .inlineKnockoutJsTemplates()
            .liftUpJavaScriptRequireJsCommonJsCompatibilityRequire()
            .flattenRequireJs({type: 'Html', isFragment: false})
            .removeUnreferencedAssets({isInitial: query.not(true)})
            .convertCssImportsToHtmlStyles()
            .removeDuplicateHtmlStyles({type: 'Html', isInitial: true})
            .mergeIdenticalAssets({isLoaded: true, type: ['JavaScript', 'Css']})
            .bundleRelations({type: 'HtmlStyle', to: {type: 'Css', isLoaded: true}, node: function (node) {return !node.hasAttribute('nobundle');}}, {strategyName: bundleStrategyName})
            .splitCssIfIeLimitIsReached()
            .bundleRelations({type: 'HtmlScript', to: {type: 'JavaScript', isLoaded: true}, node: function (node) {return !node.hasAttribute('nobundle');}}, {strategyName: bundleStrategyName})
            .removeNobundleAttribute({type: ['HtmlScript', 'HtmlStyle']})
            .inlineCssImagesWithLegacyFallback({type: 'Html', isInline: false, isFragment: false}, options.inlineSize)
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
            .if(options.noCompress && options.defines)
                .replaceSymbolsInJavaScript({type: 'JavaScript'}, options.defines)
            .endif()
            .if(!options.noCompress)
                .compressJavaScript({type: 'JavaScript', isLoaded: true}, 'uglifyJs', {global_defs: options.defines, mangleOptions: {except: options.reservedNames || []}})
            .endif()
            .inlineRelations({
                type: ['HtmlStyle', 'HtmlScript'],
                from: {isInline: false}, // Excludes relations occurring in conditional comments
                to: function (asset) {return asset.isLoaded && asset.isAsset && !asset.isInline && asset.rawSrc.length < 4096;}
            })
            .if(options.noCompress)
                .prettyPrintAssets({type: 'Css', isLoaded: true})
                .prettyPrintAssets(function (asset) {
                    return asset.isLoaded && asset.type === 'JavaScript' && (!asset.isInline || asset.incomingRelations.every(function (incomingRelation) {
                        return incomingRelation.type === 'HtmlScript';
                    }));
                })
            .endif()
            .inlineAngularJsTemplates()
            .setAsyncOrDeferOnHtmlScripts({to: {isInline: false, url: /^file:/}}, options.asyncScripts, options.deferScripts)
            .omitFunctionCall({type: ['JavaScriptGetStaticUrl', 'JavaScriptTrHtml']})
            .inlineRelations({type: ['JavaScriptGetText', 'JavaScriptTrHtml'], to: {isLoaded: true}})
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

                                // Set crossorigin=anonymous on <script> tags pointing at CDN JavaScript.
                                // See http://blog.errorception.com/2012/12/catching-cross-domain-js-errors.html'
                                if (asset.type === 'JavaScript' && incomingRelation.type === 'HtmlScript') {
                                    incomingRelation.node.setAttribute('crossorigin', 'anonymous');
                                    incomingRelation.from.markDirty();
                                }
                            });
                        }
                    }
                    return targetUrl + asset.md5Hex.substr(0, 10) + asset.extension + asset.url.replace(/^[^#\?]*(?:)/, ''); // Preserve query string and fragment identifier
                }
            })
            .if(options.gzip)
                .gzip({isInline: false, isText: true, isLoaded: true, url: query.not(/\.t?gz([\?#]|$)/)})
            .endif()
            .run(cb);
    };
};
