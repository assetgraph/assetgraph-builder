var urlTools = require('urltools');

module.exports = function (options) {
    options = options || {};

    var bundleStrategyName = options.sharedBundles ? 'sharedBundles' : 'oneBundlePerIncludingAsset',
        inlineByRelationType = options.inlineByRelationType || {HtmlScript: 4096, HtmlStyle: 4096};

    return function buildProduction(assetGraph, cb) {
        var query = assetGraph.query,
            followRelationsQueryObj = query.or({
                to: {type: 'I18n'}
            },
            {
                type: query.not(['JavaScriptInclude', 'JavaScriptExtJsRequire', 'JavaScriptCommonJsRequire', 'HtmlAnchor', 'SvgAnchor', 'JavaScriptSourceMappingUrl', 'JavaScriptSourceUrl']),
                to: {url: query.not(/^https?:/)}
            });

        assetGraph
            .populate({from: {type: 'Html'}, followRelations: {type: 'HtmlScript', to: {url: /^file:/}}})
            .assumeRequireJsConfigHasBeenFound()
            .populate({followRelations: followRelationsQueryObj})
            .fixBaseAssetsOfUnresolvedOutgoingRelationsFromHtmlFragments({isInitial: true})
            .assumeThatAllHtmlFragmentAssetsWithoutIncomingRelationsAreNotTemplates()
            .populate({followRelations: followRelationsQueryObj, startAssets: {type: 'Html'}})
            // Remove bootstrapper scripts injected by buildDevelopment:
            .removeRelations({type: 'HtmlScript', node: {id: 'bootstrapper'}, from: {type: 'Html'}}, {detach: true, removeOrphan: true})
            .addDataVersionAttributeToHtmlElement({type: 'Html', isInitial: true}, options.version)
            .replaceDartWithJavaScript()
            .populate({followRelations: followRelationsQueryObj, startAssets: {type: 'JavaScript', url: /\.dart\.js$/}})
            .if(options.localeIds)
                .checkLanguageKeys({
                    supportedLocaleIds: options.localeIds,
                    defaultLocaleId: options.defaultLocaleId,
                    ignoreMessageTypes: 'unused'
                })
            .endif()
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
            .removeRelations({type: 'JavaScriptInclude', to: {type: ['Css', 'JavaScript', 'Html', 'Less']}}, {detach: true, unresolved: true})
            .externalizeRelations({from: {type: query.not('Htc')}, type: ['HtmlStyle', 'HtmlScript'], to: {isLoaded: true}, node: function (node) {return !node.hasAttribute('nobundle');}})
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
            .minifySvgAssetsWithSvgo({isLoaded: true})
            .inlineKnockoutJsTemplates()
            .liftUpJavaScriptRequireJsCommonJsCompatibilityRequire()
            .flattenRequireJs({type: 'Html', isFragment: false})
            // Remove orphan assets, except I18n which might originally have been referenced from the no longer existing bootstrapper:
            .removeUnreferencedAssets({type: query.not('I18n'), isInitial: query.not(true)})
            .convertCssImportsToHtmlStyles()
            .removeDuplicateHtmlStyles({type: 'Html', isInitial: true})
            .mergeIdenticalAssets({isLoaded: true, isInline: false, type: ['JavaScript', 'Css']})
            .if(options.autoprefix)
                .autoprefixer(options.autoprefix)
            .endif()
            .bundleRelations({type: 'HtmlStyle', to: {type: 'Css', isLoaded: true}, node: function (node) {return !node.hasAttribute('nobundle');}}, {strategyName: bundleStrategyName})
            .splitCssIfIeLimitIsReached()
            .replaceRequireJsWithAlmond()
            .bundleRelations({type: 'HtmlScript', to: {type: 'JavaScript', isLoaded: true}, node: function (node) {return !node.hasAttribute('nobundle');}}, {strategyName: bundleStrategyName})
            .mergeIdenticalAssets({isLoaded: true, isInline: false, type: ['JavaScript', 'Css']}) // The bundling might produce several identical files, especially the 'oneBundlePerIncludingAsset' strategy.
            .queue(function ngmin(assetGraph) {
                var annotate,
                    angular = assetGraph.findAssets({
                        type: 'Html',
                        isInline: false,
                        isFragment: false
                    }).some(function (asset) {
                        var document = asset.parseTree;

                        return document.body && (document.querySelector('[ng-app]') || document.querySelector('[class~="ng-app:"]'));
                    });

                if (angular) {
                    annotate = require('ngmin').annotate;

                    assetGraph.findAssets({
                        type: 'JavaScript'
                    }).forEach(function (asset) {
                        asset.text = annotate(asset.text);
                    });
                }

                return assetGraph;
            })
            .removeNobundleAttribute({type: ['HtmlScript', 'HtmlStyle']})
            .if(inlineByRelationType.CssImage && !options.noInlineCssImagesWithLegacyFallback)
                .inlineCssImagesWithLegacyFallback({type: 'Html', isInline: false, isFragment: false}, inlineByRelationType.CssImage)
            .endif()
            .minifyAssets({isLoaded: true})
            .if(options.addInitialHtmlExtension)
                .queue(function addInitialHtmlExtension() {
                    assetGraph.findAssets({isInitial: true, type: 'Html'}).forEach(function (asset) {
                        asset.fileName = asset.fileName.replace(/(?=\.|$)/, '.' + String(options.addInitialHtmlExtension).replace(/^\./, ''));
                    });
                })
            .endif()
            .if(options.localeIds)
                .cloneForEachLocale({type: 'Html', isInitial: true}, {
                    localeIds: options.localeIds,
                    supportedLocaleIds: options.localeIds,
                    localeCookieName: options.localeCookieName,
                    defaultLocaleId: options.defaultLocaleId
                })
                .runJavaScriptConditionalBlocks({isInitial: true}, 'LOCALIZE', true)
                .removeRelations({type: query.not('JavaScriptGetText'), to: {type: 'I18n'}}, {detach: true})
                .removeUnreferencedAssets({type: 'I18n'})
            .endif()
            .if(options.defines)
                .replaceSymbolsInJavaScript({type: 'JavaScript', isLoaded: true}, options.defines)
            .endif()
            .if(!options.noCompress)
                .compressJavaScript({type: 'JavaScript', isLoaded: true}, 'uglifyJs', {mangleOptions: {except: options.reservedNames || []}})
            .endif()
            .removeEmptyJavaScripts()
            .removeEmptyStylesheets()
            .queue(function inlineRelations(assetGraph) {
                return assetGraph.findRelations({
                    to: {isLoaded: true, isInline: false},
                    from: {isInline: false} // Excludes relations occurring in conditional comments
                }).filter(function (relation) {
                    if (relation.type === 'CssImage' && !options.noInlineCssImagesWithLegacyFallback) {
                        return false; // Already handled by the inlineCssImagesWithLegacyFallback transform above
                    }
                    var sizeThreshold = inlineByRelationType[relation.type],
                        isStarRule = false;
                    if (typeof sizeThreshold === 'undefined') {
                        sizeThreshold = inlineByRelationType['*'];
                        isStarRule = true;
                    }
                    if (typeof sizeThreshold !== 'undefined' && sizeThreshold === true || relation.to.lastKnownByteLength < sizeThreshold) {
                        if (isStarRule) {
                            // Some relation types don't support inlining, and the inline method will be missing or throw an exception.
                            // Wrap it in a try...catch so the * rule means "all relation types that support inlining".
                            try {
                                relation.inline();
                            } catch (e) {}
                        } else {
                            relation.inline();
                        }
                    }
                });
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
            .duplicateFavicon()
            .setAsyncOrDeferOnHtmlScripts({to: {isInline: false, url: /^file:/}}, options.asyncScripts, options.deferScripts)
            .omitFunctionCall({type: ['JavaScriptGetStaticUrl', 'JavaScriptTrHtml'], to: {isLoaded: true}})
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
            .if(options.canonicalUrl)
                // Maybe this should be the effect of updating assetGraph.root?
                .moveAssets({isLoaded: true, isInline: false}, function (asset, assetGraph) {
                    if (asset.url.indexOf(assetGraph.root) === 0) {
                        return assetGraph.resolveUrl(options.canonicalUrl, urlTools.buildRelativeUrl(assetGraph.root, asset.url));
                    }
                })
                .updateRelations({type: 'RssChannelLink'}, {hrefType: 'absolute'})
            .endif()
            .moveAssetsInOrder({isLoaded: true, isInline: false, type: query.not(['CacheManifest', 'Rss']), fileName: query.not(['.htaccess', 'humans.txt', 'robots.txt', 'favicon.ico'])}, function (asset, assetGraph) {
                // Don't rename Html assets that are linked to:
                if (asset.type === 'Html' && asset.incomingRelations.some(function (incomingRelation) {
                    return incomingRelation.type === 'HtmlAnchor';
                })) {
                    return;
                }
                if (!asset.isInitial || (asset.type === 'Html' && asset.isFragment)) {
                    var targetUrl = (options.canonicalUrl || '/') + 'static/';
                    // Conservatively assume that all GETSTATICURL relations pointing at non-images are intended to be fetched via XHR
                    // and thus cannot be put on a CDN because of same origin restrictions:
                    if (options.cdnRoot && asset.type !== 'Htc' && asset.extension !== '.jar' && (asset.type !== 'Html' || options.cdnHtml) && (asset.isImage || assetGraph.findRelations({to: asset, type: 'StaticUrlMapEntry'}).length === 0) || (options.cdnRoot && options.cdnFlash && asset.type === 'Flash')) {
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
                    return targetUrl + asset.fileName.split('.').shift() + '.' + asset.md5Hex.substr(0, 10) + asset.extension + asset.url.replace(/^[^#\?]*(?:)/, ''); // Preserve query string and fragment identifier
                }
            })
            .if(options.gzip)
                .gzip({isInline: false, isText: true, isLoaded: true, url: query.not(/\.t?gz([\?#]|$)/)})
            .endif()
            .run(cb);
    };
};
