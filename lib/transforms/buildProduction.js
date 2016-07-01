var urlTools = require('urltools'),
    browsersList = require('browserslist');

module.exports = function (options) {
    options = options || {};

    var minify = typeof options.minify === 'undefined' ? true : options.minify;

    // Default to try to support all browsers
    var browsers = {
        has: function () { return true; },
        minimum: function () { return 1; }
    };

    if (options.browsers) {
        browsers = {
            selected: browsersList(options.browsers),
            has: function (browserOrBrowsers) {
                try {
                    return browsersList(browserOrBrowsers).some(function (browser) {
                        return browsers.selected.some(function (selectedBrowser) {
                            return selectedBrowser === browser || selectedBrowser.indexOf(browser + ' ') === 0;
                        });
                    });
                } catch (e) {
                    // Parse error, try to match it as a browser name (any version) so that
                    // browsers.has('ie') does the expected.
                    return browsers.selected.some(function (selectedBrowser) {
                        return selectedBrowser.indexOf(browserOrBrowsers + ' ') === 0;
                    });
                }
            },
            // Find the minimum version of a given browser that is to be supported.
            // For example: browsers.minimum('ie'); // 10
            minimum: function (browser) {
                var minimumVersion = null;
                browsers.selected.forEach(function (selectedBrowser) {
                    if (selectedBrowser.indexOf(browser + ' ') === 0) {
                        var version = parseFloat(selectedBrowser.substr(browser.length + 1));
                        if (minimumVersion === null || version < minimumVersion) {
                            minimumVersion = version;
                        }
                    }
                });
                return minimumVersion;
            }
        };
    }

    var bundleStrategyName = options.sharedBundles ? 'sharedBundles' : 'oneBundlePerIncludingAsset',
        inlineByRelationType = options.inlineByRelationType || {HtmlScript: 4096, HtmlStyle: 4096};

    return function buildProduction(assetGraph, cb) {
        assetGraph.sourceMaps = !!options.sourceMaps;
        var query = assetGraph.query;

        assetGraph.javaScriptSerializationOptions = options.javaScriptSerializationOptions;

        if (!assetGraph.followRelations) {
            var excludeRelationTypes = ['JavaScriptInclude', 'JavaScriptExtJsRequire', 'SvgAnchor', 'SourceMapSource', 'SourceMapFile'];
            if (!options.sourceMaps) {
                excludeRelationTypes.push('JavaScriptSourceMappingUrl', 'JavaScriptSourceUrl', 'CssSourceMappingUrl', 'CssSourceUrl');
            }
            if (options.recursive) {
                assetGraph.followRelations =
                    query.or({
                        to: {type: 'I18n'}
                    }, {
                        type: ['HtmlAnchor', 'HtmlMetaRefresh'],
                        to: /^file:/
                    }, {
                        type: query.not(excludeRelationTypes),
                        to: {url: query.not(/^https?:/)}
                    });
            } else {
                excludeRelationTypes.push('HtmlAnchor', 'HtmlMetaRefresh');
                assetGraph.followRelations =
                    query.or({
                        to: {type: 'I18n'}
                    }, {
                        type: query.not(excludeRelationTypes),
                        to: {url: query.not(/^https?:/)}
                    });
            }
        }

        assetGraph
            .populate({from: {type: 'Html'}, followRelations: {type: 'HtmlScript', to: {url: /^file:/}}})
            .bundleSystemJs({
                polyfill: true // FIXME: Check caniuse Promise vs. window.URL
            })
            .bundleRequireJs()
            .bundleWebpack()
            .populate()
            .populate({startAssets: {type: 'JavaScript'}})
            .if(options.sourceMaps)
                .applySourceMaps()
            .endif()
            .removeRelations({ type: [ 'SourceMapSource', 'SourceMapFile' ] }, { unresolved: true })
            .populate()
            .populate({startAssets: {type: 'Html'}})
            // Remove bootstrapper scripts injected by buildDevelopment:
            .removeRelations({type: 'HtmlScript', node: {id: 'bootstrapper'}, from: {type: 'Html'}}, {detach: true, removeOrphan: true})
            .addDataVersionAttributeToHtmlElement({type: 'Html', isInitial: true}, options.version)
            .if(options.localeIds)
                .checkLanguageKeys({
                    supportedLocaleIds: options.localeIds,
                    defaultLocaleId: options.defaultLocaleId,
                    ignoreMessageTypes: 'unused'
                })
            .endif()
            .if(options.stripDebug)
                .stripDebug({type: 'JavaScript', isLoaded: true})
            .endif()
            .removeRelations({type: 'JavaScriptInclude', to: {type: ['Css', 'JavaScript', 'Html']}}, {detach: true, unresolved: true})
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
            // Remove orphan assets, except I18n which might originally have been referenced from the no longer existing bootstrapper:
            .inlineHtmlTemplates()
            .removeUnreferencedAssets({type: query.not('I18n'), isInitial: query.not(true)})
            .flattenStaticIncludes()
            .convertCssImportsToHtmlStyles()
            .removeDuplicateHtmlStyles({type: 'Html', isInitial: true})
            .mergeIdenticalAssets({isLoaded: true, isInline: false, type: ['JavaScript', 'Css']})
            .if(options.browsers)
                .autoprefixer(options.browsers, { sourceMaps: options.sourceMaps, sourcesContent: options.sourcesContent })
            .endif()
            .bundleRelations({type: 'HtmlStyle', to: {type: 'Css', isLoaded: true}, node: function (node) {return !node.hasAttribute('nobundle');}}, {strategyName: bundleStrategyName})
            .splitCssIfIeLimitIsReached({type: 'Css'}, {minimumIeVersion: browsers.minimum('ie')})
            .bundleRelations({type: 'HtmlScript', to: {type: 'JavaScript', isLoaded: true}, node: function (node) {return !node.hasAttribute('nobundle');}}, {strategyName: bundleStrategyName})
            .bundleRelations({type: 'JavaScriptImportScripts', to: {type: 'JavaScript', isLoaded: true}}, {strategyName: bundleStrategyName})
            .mergeIdenticalAssets({isLoaded: true, isInline: false, type: ['JavaScript', 'Css']}) // The bundling might produce several identical files, especially the 'oneBundlePerIncludingAsset' strategy.
            .if(options.angular)
                .angularAnnotations()
            .endif()
            .removeNobundleAttribute({type: ['HtmlScript', 'HtmlStyle']})
            .if(inlineByRelationType.CssImage)
                .inlineCssImagesWithLegacyFallback({
                    type: 'Html',
                    isInline: false,
                    isFragment: false
                }, {
                    sizeThreshold: typeof inlineByRelationType.CssImage === 'boolean' ? (inlineByRelationType.CssImage ? Infinity : 0) : inlineByRelationType.CssImage,
                    minimumIeVersion: browsers.minimum('ie')
                })
                .mergeIdenticalAssets({isLoaded: true, isInline: false, type: 'Css'})
            .endif()
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
            .if(minify)
                .minifyAssets({isLoaded: true})
            .endif()
            .if(options.defines)
                .replaceSymbolsInJavaScript({type: 'JavaScript', isLoaded: true}, options.defines)
            .endif()
            .if(options.removeDeadIfs)
                .removeDeadIfsInJavaScript({isLoaded: true})
            .endif()
            .if(!options.noCompress)
                .compressJavaScript({type: 'JavaScript', isLoaded: true}, 'uglifyJs', { sourceMaps: options.sourceMaps, mangleOptions: { except: options.reservedNames || [] } })
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
            .if(options.pretty)
                .prettyPrintAssets({type: 'Css', isLoaded: true})
                .prettyPrintAssets(function (asset) {
                    return asset.isLoaded && asset.type === 'JavaScript' && (!asset.isInline || asset.incomingRelations.every(function (incomingRelation) {
                        return incomingRelation.type === 'HtmlScript';
                    }));
                })
            .endif()
            .if(options.angular)
                .inlineAngularJsTemplates()
            .endif()
            .duplicateFavicon()
            .setAsyncOrDeferOnHtmlScripts({to: {isInline: false, url: /^file:/}}, options.asyncScripts, options.deferScripts)
            .queue(function omitFunctionCalls(assetGraph) {
                assetGraph.findRelations({type: ['JavaScriptGetStaticUrl', 'JavaScriptTrHtml'], to: {isLoaded: true}}).forEach(function (relation) {
                    relation.omitFunctionCall();
                });
            })
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
                .updateRelations({from: {type: 'Html', isFragment: true, nonInlineAncestor: {type: ['Rss', 'Atom']}}}, {hrefType: 'absolute'})
            .endif()
            .if(options.sourceMaps)
                .serializeSourceMaps({ sourcesContent: options.sourcesContent })
                .updateRelations({ type: 'SourceMapSource' }, { hrefType: 'rootRelative' }, { includeUnresolved: true })
                .removeRelations({ type: [ 'SourceMapSource', 'SourceMapFile' ] }, { unresolved: true })
            .endif()
            .if(!options.noFileRev)
                .moveAssetsInOrder(query.and(
                    {
                        isLoaded: true,
                        isInline: false,
                        type: query.not(['CacheManifest', 'Rss', 'Atom']),
                        fileName: query.not(['.htaccess', 'humans.txt', 'robots.txt'])
                    },
                    {
                        url: query.not(assetGraph.root + 'favicon.ico')
                    },

                    // Rule for service worker scripts:
                    // Must be served from the root domain: https://www.w3.org/TR/service-workers/#origin-relativity
                    // Must keep its file name across builds: https://twitter.com/jaffathecake/status/748123748969095168
                    // Exclude service worrkers from file revisioning.
                    query.not({
                        type: 'JavaScript',
                        incomingRelations: function (relations) {
                            return relations.some(function (rel) {
                                return rel.type === 'JavaScriptServiceWorkerRegistration' || rel.type === 'JavaScriptWebWorker';
                            });
                        }
                    }),

                    query.not({
                        type: 'Html',
                        incomingRelations: function (relations) {
                            return relations.some(function (rel) {
                                return rel.type === 'HtmlAnchor' || rel.type === 'HtmlMetaRefresh';
                            });
                        }
                    }),
                    query.or(
                        query.not({
                            isInitial: true
                        }),
                        // Assume that non-inline HTML assets without an <html> element, but with incoming relations
                        // are templates that can safely be moved to /static/ even though they're initial
                        // (probably the result of loading **/*.html)
                        {
                            type: 'Html',
                            isFragment: true,
                            incomingRelations: function (incomingRelations) {
                                return incomingRelations.length > 0;
                            }
                        }
                    )), function (asset, assetGraph) {
                        var targetUrl = (options.canonicalUrl || '/') + 'static/';
                        // Conservatively assume that all GETSTATICURL relations pointing at non-images are intended to be fetched via XHR
                        // and thus cannot be put on a CDN because of same origin restrictions:
                        if (options.cdnRoot && asset.type !== 'Htc' && asset.extension !== '.jar' && (asset.type !== 'Html' || options.cdnHtml) && (asset.isImage || assetGraph.findRelations({to: asset, type: 'JavaScriptGetStaticUrl'}).length === 0) || (options.cdnRoot && options.cdnFlash && asset.type === 'Flash')) {
                            targetUrl = options.cdnRoot;
                            assetGraph.findRelations({to: asset}).forEach(function (incomingRelation) {
                                if (/^\/\//.test(options.cdnRoot)) {
                                    incomingRelation.hrefType = 'protocolRelative';
                                }
                                // Set crossorigin=anonymous on <script> tags pointing at CDN JavaScript.
                                // See http://blog.errorception.com/2012/12/catching-cross-domain-js-errors.html'
                                if ((asset.type === 'JavaScript' && incomingRelation.type === 'HtmlScript') ||
                                    (asset.type === 'Css' && incomingRelation.type === 'HtmlStyle')) {

                                    incomingRelation.node.setAttribute('crossorigin', 'anonymous');
                                    incomingRelation.from.markDirty();
                                }
                            });
                        }
                        return targetUrl + asset.fileName.split('.').shift() + '.' + asset.md5Hex.substr(0, 10) + asset.extension + asset.url.replace(/^[^#\?]*(?:)/, ''); // Preserve query string and fragment identifier
                    })
            .endif()
            .reviewContentSecurityPolicy({type: 'Html', isInline: false, isFragment: false, isLoaded: true}, {update: options.contentSecurityPolicy})
            .reviewSubResourceIntegrity({type: 'Html', isInline: false, isFragment: false, isLoaded: true}, {update: options.subResourceIntegrity})
            .if(options.gzip)
                .gzip({isInline: false, isText: true, isLoaded: true, url: query.not(/\.t?gz([\?#]|$)/)})
            .endif()
            .run(cb);
    };
};
