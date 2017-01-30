/*eslint indent:0*/
var browsersList = require('browserslist');
var urlTools = require('urltools');

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


        var excludePatterns;

        if (Array.isArray(options.excludePatterns)) {
            function regexEscape(pattern) {
                return pattern.replace(/[\.\+\{\}\[\]\(\)\?\^\$]/g, '\\$&').replace(/\*/g, '.*?');
            }

            excludePatterns = new RegExp('^file:\/\/' + regexEscape(urlTools.ensureTrailingSlash(process.cwd())) + '(:?' + options.excludePatterns.map(regexEscape).join('|') + ')');
        }

        function getFollowRelationsQuery(followRelationsQuery) {
            if (excludePatterns) {
                return query.and(followRelationsQuery, { to: { url: query.not(excludePatterns) }});
            }

            return followRelationsQuery;
        }

        if (!assetGraph.followRelations) {
            var followRelations;
            var excludeRelationTypes = ['SvgAnchor', 'SourceMapSource', 'SourceMapFile'];
            if (!options.sourceMaps) {
                excludeRelationTypes.push('JavaScriptSourceMappingUrl', 'JavaScriptSourceUrl', 'CssSourceMappingUrl', 'CssSourceUrl');
            }
            if (options.recursive) {
                followRelations = query.or({ type: ['HtmlAnchor', 'HtmlMetaRefresh'] }, { type: query.not(excludeRelationTypes) });
            } else {
                excludeRelationTypes.push('HtmlAnchor', 'HtmlMetaRefresh');
                followRelations = { type: query.not(excludeRelationTypes) };
            }

            assetGraph.followRelations = getFollowRelationsQuery(query.and(
                {
                    crossorigin: false
                },
                followRelations
            ));
        }

        assetGraph
            .bundleWebpack()
            .populate(getFollowRelationsQuery({from: {type: 'Html'}, followRelations: {type: 'HtmlScript', crossorigin: false}}))
            .bundleSystemJs({
                polyfill: true, // FIXME: Check caniuse Promise vs. window.URL
                conditions: options.conditions
            })
            .bundleRequireJs()
            .populate()
            .populate(getFollowRelationsQuery({startAssets: {type: 'JavaScript'}}))
            .queue(function renameTranspiledCss() {
                assetGraph.findAssets({isInline: false, type: 'Css'}).forEach(function (cssAsset) {
                    var fileName = cssAsset.fileName;
                    if (!/\.css$/i.test(fileName)) {
                        cssAsset.fileName += '.css';
                    }
                });
            })
            .if(options.sourceMaps)
                .applySourceMaps()
            .endif()
            .removeRelations({ type: [ 'SourceMapSource', 'SourceMapFile' ] }, { unresolved: true })
            .populate()
            .populate(getFollowRelationsQuery({startAssets: {type: 'Html'}}))
            // Remove bootstrapper scripts injected by buildDevelopment:
            .removeRelations({type: 'HtmlScript', node: {id: 'bootstrapper'}, from: {type: 'Html'}}, {detach: true, removeOrphan: true})
            .addDataVersionAttributeToHtmlElement({type: 'Html', isInitial: true}, options.version)
            .if(options.stripDebug)
                .stripDebug({type: 'JavaScript', isLoaded: true})
            .endif()
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
            .if(options.svgo)
                .minifySvgAssetsWithSvgo({isLoaded: true})
            .endif()
            .removeUnreferencedAssets({isInitial: query.not(true)})
            .convertCssImportsToHtmlStyles()
            .removeDuplicateHtmlStyles({type: 'Html', isInitial: true})
            .mergeIdenticalAssets({isLoaded: true, isInline: false, type: ['JavaScript', 'Css']})
            .if(options.browsers)
                .autoprefixer(options.browsers, { sourceMaps: options.sourceMaps, sourcesContent: options.sourcesContent })
            .endif()
            .if(options.addInitialHtmlExtension)
                .queue(function addInitialHtmlExtension() {
                    assetGraph.findAssets({isInitial: true, type: 'Html'}).forEach(function (asset) {
                        asset.fileName = asset.fileName.replace(/(?=\.|$)/, '.' + String(options.addInitialHtmlExtension).replace(/^\./, ''));
                    });
                })
            .endif()
            .if(minify)
                .minifyAssets({isLoaded: true, isInline: false})
            .endif()
            .cloneForEachConditionValue({type: 'Html', isInitial: true}, {
                splitConditions: options.splitConditions,
                conditions: options.conditions
            })
            .inlineHtmlTemplates()
            .bundleRelations({type: 'HtmlStyle', to: {type: 'Css', isLoaded: true}, node: function (node) {return !node.hasAttribute('nobundle');}}, {strategyName: bundleStrategyName})
            .splitCssIfIeLimitIsReached({type: 'Css'}, {minimumIeVersion: browsers.minimum('ie')})
            .bundleRelations({type: 'HtmlScript', to: {type: 'JavaScript', isLoaded: true}, node: function (node) {return !node.hasAttribute('nobundle');}}, {strategyName: bundleStrategyName})
            .bundleRelations({type: 'JavaScriptImportScripts', to: {type: 'JavaScript', isLoaded: true}}, {strategyName: bundleStrategyName})
            .mergeIdenticalAssets({isLoaded: true, isInline: false, type: ['JavaScript', 'Css']}) // The bundling might produce several identical files, especially the 'oneBundlePerIncludingAsset' strategy.
            .removeNobundleAttribute({type: ['HtmlScript', 'HtmlStyle']})
            .if(minify)
                .minifyAssets({isLoaded: true})
            .endif()
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
            .if(options.defines)
                .replaceSymbolsInJavaScript({type: 'JavaScript', isLoaded: true}, options.defines)
            .endif()
            .if(!options.noCompress)
                .compressJavaScript({type: 'JavaScript', isLoaded: true}, 'uglifyJs', { sourceMaps: options.sourceMaps, mangleOptions: { except: options.reservedNames || [] } })
            .endif()
            .removeEmptyJavaScripts()
            .removeEmptyStylesheets()
            .queue(function inlineRelations(assetGraph) {
                assetGraph.findRelations({
                    to: {isLoaded: true, isInline: false},
                    from: {isInline: false} // Excludes relations occurring in conditional comments
                }).forEach(function (relation) {
                    if (relation.type === 'CssImage' && !options.noInlineCssImagesWithLegacyFallback) {
                        return; // Already handled by the inlineCssImagesWithLegacyFallback transform above
                    }
                    if (relation.type === 'HtmlScript' && (relation.node.hasAttribute('async') || relation.node.hasAttribute('defer'))) {
                        return;
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
            .duplicateFavicon()
            .setAsyncOrDeferOnHtmlScripts({crossorigin: false, to: {isInline: false}}, options.asyncScripts, options.deferScripts)
            .queue(function omitFunctionCalls(assetGraph) {
                assetGraph.findRelations({type: 'JavaScriptStaticUrl', to: {isLoaded: true}}).forEach(function (relation) {
                    relation.omitFunctionCall();
                });
            })
            .if(options.manifest)
                .addCacheManifest({isInitial: true})
            .endif()
            .if(assetGraph.canonicalRoot)
                .updateRelations({
                    to: {
                        isLoaded: true,
                        isInline: false
                    },
                    from: {
                        type: 'Html',
                        isFragment: true,
                        nonInlineAncestor: {
                            type: ['Rss', 'Atom']
                        }
                    }
                }, {canonical: true})
            .endif()
            .if(options.sourceMaps)
                .serializeSourceMaps({ sourcesContent: options.sourcesContent })
                .updateRelations({ type: 'SourceMapSource' }, { hrefType: 'rootRelative' }, { includeUnresolved: true })
                .updateRelations({ type: /SourceMappingUrl$/, hrefType: 'relative' }, { hrefType: 'rootRelative' }, { includeUnresolved: true })
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
                                var notAllowedIncomingRelations = [
                                    'JavaScriptServiceWorkerRegistration',
                                    'HtmlServiceWorkerRegistration',
                                    'JavaScriptWebWorker'
                                ];
                                return notAllowedIncomingRelations.indexOf(rel.type) !== -1;
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
                        var targetUrl = '/static/';
                        // Conservatively assume that all JavaScriptStaticUrl relations pointing at non-images are intended to be fetched via XHR
                        // and thus cannot be put on a CDN because of same origin restrictions:
                        if (options.cdnRoot && asset.type !== 'Htc' && asset.extension !== '.jar' && (asset.type !== 'Html' || options.cdnHtml) && (asset.isImage || assetGraph.findRelations({to: asset, type: 'JavaScriptStaticUrl'}).length === 0) || (options.cdnRoot && options.cdnFlash && asset.type === 'Flash')) {
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
                        return targetUrl + asset.fileName.replace(/\.[^.]+$/, '') + '.' + asset.md5Hex.substr(0, 10) + asset.extension + asset.url.replace(/^[^#\?]*(?:)/, ''); // Preserve query string and fragment identifier
                    })
            .endif()
            .addRelNoopenerToBlankTargetAnchors()
            .reviewContentSecurityPolicy({type: 'Html', isInline: false, isFragment: false, isLoaded: true}, {
                update: options.contentSecurityPolicy,
                includePath: browsers.has('Safari 8') || browsers.has('Safari 9') || browsers.has('Safari 9.1') ?
                    false :
                    ['script-src', 'style-src', 'frame-src', 'object-src', 'manifest-src', 'child-src']
            })
            .reviewSubResourceIntegrity({type: 'Html', isInline: false, isFragment: false, isLoaded: true}, {update: options.subResourceIntegrity})
            .if(options.gzip)
                .gzip({isInline: false, isText: true, isLoaded: true, url: query.not(/\.t?gz([\?#]|$)/)})
            .endif()
            .run(cb);
    };
};
