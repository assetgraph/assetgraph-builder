var urlTools = require('urltools'),
    _ = require('lodash'),
    browsersList = require('browserslist');

module.exports = function (options) {
    options = options || {};

    var minify = typeof options.minify === 'undefined' ? true : options.minify;

    var javaScriptSerializationOptions = _.extend({}, options.javaScriptSerializationOptions);

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

        if (browsers.minimum('ie') > 8) {
            javaScriptSerializationOptions.screw_ie8 = true;
        }
    }

    var bundleStrategyName = options.sharedBundles ? 'sharedBundles' : 'oneBundlePerIncludingAsset',
        inlineByRelationType = options.inlineByRelationType || {HtmlScript: 4096, HtmlStyle: 4096};

    return function buildProduction(assetGraph, cb) {
        var query = assetGraph.query;

        assetGraph.javaScriptSerializationOptions = javaScriptSerializationOptions;

        if (!assetGraph.followRelations) {
            if (options.recursive) {
                assetGraph.followRelations =
                    query.or({
                        to: {type: 'I18n'}
                    },
                    {
                        type: ['HtmlAnchor', 'HtmlMetaRefresh'],
                        to: /^file:/
                    },
                    {
                        type: query.not(['JavaScriptInclude', 'JavaScriptExtJsRequire', 'JavaScriptCommonJsRequire', 'SvgAnchor', 'JavaScriptSourceMappingUrl', 'JavaScriptSourceUrl']),
                        to: {url: query.not(/^https?:/)}
                    });
            } else {
                assetGraph.followRelations =
                    query.or({
                        to: {type: 'I18n'}
                    },
                    {
                        type: query.not(['JavaScriptInclude', 'JavaScriptExtJsRequire', 'JavaScriptCommonJsRequire', 'SvgAnchor', 'JavaScriptSourceMappingUrl', 'JavaScriptSourceUrl', 'HtmlAnchor', 'HtmlMetaRefresh']),
                        to: {url: query.not(/^https?:/)}
                    });
            }
        }

        assetGraph
            .populate({from: {type: 'Html'}, followRelations: {type: 'HtmlScript', to: {url: /^file:/}}})
            .assumeRequireJsConfigHasBeenFound()
            .populate()
            .fixBaseAssetsOfUnresolvedOutgoingRelationsFromHtmlFragments({isInitial: true})
            .assumeThatAllHtmlFragmentAssetsWithoutIncomingRelationsAreNotTemplates()
            .populate({startAssets: {type: 'Html'}})
            // Remove bootstrapper scripts injected by buildDevelopment:
            .removeRelations({type: 'HtmlScript', node: {id: 'bootstrapper'}, from: {type: 'Html'}}, {detach: true, removeOrphan: true})
            .addDataVersionAttributeToHtmlElement({type: 'Html', isInitial: true}, options.version)
            .replaceDartWithJavaScript()
            .populate({startAssets: {type: 'JavaScript', url: /\.dart\.js$/}})
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
            .endif()
            .if(options.scss)
                .compileScssToCss({type: 'Scss', isLoaded: true})
            .endif()
            .compileJsxToJs()
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
            .queue(function checkForRequireJsConfig(assetGraph, done) {
                if (assetGraph.requireJsConfig) {
                    assetGraph
                        .flattenRequireJs({type: 'Html', isFragment: false})
                        .run(done);
                } else {
                    done();
                }
            })
            // Remove orphan assets, except I18n which might originally have been referenced from the no longer existing bootstrapper:
            .removeUnreferencedAssets({type: query.not('I18n'), isInitial: query.not(true)})
            .convertCssImportsToHtmlStyles()
            .removeDuplicateHtmlStyles({type: 'Html', isInitial: true})
            .mergeIdenticalAssets({isLoaded: true, isInline: false, type: ['JavaScript', 'Css']})
            .if(options.browsers)
                .autoprefixer(options.browsers)
            .endif()
            .bundleRelations({type: 'HtmlStyle', to: {type: 'Css', isLoaded: true}, node: function (node) {return !node.hasAttribute('nobundle');}}, {strategyName: bundleStrategyName})
            .splitCssIfIeLimitIsReached({type: 'Css'}, {minimumIeVersion: browsers.minimum('ie')})
            .replaceRequireJsWithAlmond()
            .bundleRelations({type: 'HtmlScript', to: {type: 'JavaScript', isLoaded: true}, node: function (node) {return !node.hasAttribute('nobundle');}}, {strategyName: bundleStrategyName})
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
            .if(minify)
                .minifyAssets({isLoaded: true})
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
            .if(options.defines)
                .replaceSymbolsInJavaScript({type: 'JavaScript', isLoaded: true}, options.defines)
            .endif()
            .if(options.removeDeadIfs)
                .removeDeadIfsInJavaScript({isLoaded: true})
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
            .if(options.angular)
              .inlineAngularJsTemplates()
            .endif()
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
                .updateRelations({from: {type: 'Html', isFragment: true, nonInlineAncestor: {type: ['Rss', 'Atom']}}}, {hrefType: 'absolute'})
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
                        {
                            type: 'Html',
                            isFragment: true
                        }
                    )), function (asset, assetGraph) {
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
                        })
            .endif()
            .if(options.gzip)
                .gzip({isInline: false, isText: true, isLoaded: true, url: query.not(/\.t?gz([\?#]|$)/)})
            .endif()
            .run(cb);
    };
};
