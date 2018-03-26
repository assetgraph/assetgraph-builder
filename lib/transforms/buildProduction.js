/*eslint indent:0*/
const browsersList = require('browserslist');
const urlTools = require('urltools');
const _ = require('lodash');

module.exports = function(options) {
  options = options || {};

  const minify = typeof options.minify === 'undefined' ? true : options.minify;

  // Default to try to support all browsers
  let browsers = {
    has() {
      return true;
    },
    minimum() {
      return 1;
    }
  };

  let selected;
  if (options.browsers) {
    selected = browsersList(options.browsers);
  } else if (browsersList.findConfig('.')) {
    selected = browsersList();
  }
  if (selected) {
    browsers = {
      selected,
      has(browserOrBrowsers) {
        try {
          return browsersList(browserOrBrowsers).some(browser =>
            browsers.selected.some(
              selectedBrowser =>
                selectedBrowser === browser ||
                selectedBrowser.indexOf(browser + ' ') === 0
            )
          );
        } catch (e) {
          // Parse error, try to match it as a browser name (any version) so that
          // browsers.has('ie') does the expected.
          return browsers.selected.some(selectedBrowser =>
            selectedBrowser.startsWith(browserOrBrowsers + ' ')
          );
        }
      },
      // Find the minimum version of a given browser that is to be supported.
      // For example: browsers.minimum('ie'); // 10
      minimum(browser) {
        let minimumVersion = null;
        for (const selectedBrowser of browsers.selected) {
          if (selectedBrowser.startsWith(browser + ' ')) {
            const version = parseFloat(
              selectedBrowser.substr(browser.length + 1)
            );
            if (minimumVersion === null || version < minimumVersion) {
              minimumVersion = version;
            }
          }
        }
        return minimumVersion;
      }
    };
  }

  const bundleStrategyName = options.sharedBundles
    ? 'sharedBundles'
    : 'oneBundlePerIncludingAsset';
  const inlineByRelationType = options.inlineByRelationType || {
    HtmlScript: 4096,
    HtmlStyle: 4096
  };

  return async function buildProduction(assetGraph) {
    assetGraph.sourceMaps = !!options.sourceMaps;

    assetGraph.disableFetch = true;

    assetGraph.javaScriptSerializationOptions = _.defaults(
      {},
      options.javaScriptSerializationOptions,
      {
        ie8: browsers.minimum('ie') <= 8
      }
    );

    const moveAssetsInOrderQuery = {
      $and: [
        {
          isLoaded: true,
          isInline: false,
          type: { $nin: ['CacheManifest', 'Rss', 'Atom'] },
          fileName: { $nin: ['.htaccess', 'humans.txt', 'robots.txt'] }
        },
        {
          url: { $not: assetGraph.root + 'favicon.ico' }
        },

        // Rule for service worker scripts:
        // Must be served from the root domain: https://www.w3.org/TR/service-workers/#origin-relativity
        // Must keep its file name across builds: https://twitter.com/jaffathecake/status/748123748969095168
        // Exclude service workers from file revisioning.
        {
          $not: {
            type: 'JavaScript',
            incomingRelations: {
              $elemMatch: {
                type: {
                  $in: [
                    'JavaScriptServiceWorkerRegistration',
                    'HtmlServiceWorkerRegistration',
                    'JavaScriptWebWorker'
                  ]
                }
              }
            }
          }
        },
        {
          $not: {
            type: 'Html',
            incomingRelations: {
              $elemMatch: {
                type: {
                  $in: ['HtmlAnchor', 'HtmlMetaRefresh']
                }
              }
            }
          }
        },
        {
          $or: [
            { $not: { isInitial: true } },
            // Assume that non-inline HTML assets without an <html> element, but with incoming relations
            // are templates that can safely be moved to /static/ even though they're initial
            // (probably the result of loading **/*.html)
            {
              type: 'Html',
              isFragment: true,
              incomingRelations: { $not: { $size: 0 } }
            }
          ]
        }
      ]
    };

    let excludePatterns;

    function regexEscape(pattern) {
      return pattern.replace(/[.+{}[]()?^$]/g, '\\$&').replace(/\*/g, '.*?');
    }

    if (Array.isArray(options.excludePatterns)) {
      excludePatterns = new RegExp(
        '^file://' +
          regexEscape(urlTools.ensureTrailingSlash(process.cwd())) +
          '(:?' +
          options.excludePatterns.map(regexEscape).join('|') +
          ')'
      );
    }

    function getFollowRelationsQuery(followRelationsQuery) {
      if (excludePatterns) {
        return {
          $and: [
            followRelationsQuery,
            { to: { url: { $not: excludePatterns } } }
          ]
        };
      }

      return followRelationsQuery;
    }

    if (!assetGraph.followRelations) {
      let followRelations;
      const excludeRelationTypes = [
        'SvgAnchor',
        'SourceMapSource',
        'SourceMapFile',
        'JavaScriptFetch'
      ];
      if (!options.sourceMaps) {
        excludeRelationTypes.push(
          'JavaScriptSourceMappingUrl',
          'JavaScriptSourceUrl',
          'CssSourceMappingUrl',
          'CssSourceUrl'
        );
      }
      if (options.recursive) {
        followRelations = {
          $or: [
            { type: { $in: ['HtmlAnchor', 'HtmlMetaRefresh'] } },
            { type: { $nin: excludeRelationTypes } }
          ]
        };
      } else {
        excludeRelationTypes.push('HtmlAnchor', 'HtmlMetaRefresh');
        followRelations = { type: { $nin: excludeRelationTypes } };
      }

      assetGraph.followRelations = getFollowRelationsQuery({
        $and: [
          {
            crossorigin: false
          },
          followRelations
        ]
      });
    }

    await assetGraph.bundleWebpack({
      configPath: options.webpackConfigPath
    });
    await assetGraph.populate(
      getFollowRelationsQuery({
        from: { type: 'Html' },
        followRelations: { type: 'HtmlScript', crossorigin: false }
      })
    );
    await assetGraph.bundleSystemJs({
      polyfill: true, // FIXME: Check caniuse Promise vs. window.URL
      conditions: options.conditions
    });
    await assetGraph.bundleRequireJs();
    await assetGraph.populate();
    await assetGraph.populate(
      getFollowRelationsQuery({ startAssets: { type: 'JavaScript' } })
    );

    // Rename transpiled Css assets:
    for (const cssAsset of assetGraph.findAssets({
      isInline: false,
      type: 'Css',
      extension: { $not: '.css' }
    })) {
      cssAsset.fileName += '.css';
    }

    if (options.sourceMaps) {
      await assetGraph.applySourceMaps();
    }

    await assetGraph
      .findRelations({ type: { $in: ['SourceMapSource', 'SourceMapFile'] } })
      .remove();
    await assetGraph.populate();
    await assetGraph.populate(
      getFollowRelationsQuery({ startAssets: { type: 'Html' } })
    );

    // Remove bootstrapper scripts injected by buildDevelopment:
    await assetGraph
      .findRelations({
        type: 'HtmlScript',
        node: { id: 'bootstrapper' },
        from: { type: 'Html' }
      })
      .remove({ detach: true, removeOrphan: true });

    await assetGraph
      .findAssets({ type: 'Html', isInitial: true })
      .addDataVersionAttributeToHtmlElement(options.version);

    if (options.stripDebug) {
      await assetGraph
        .findAssets({ type: 'JavaScript', isLoaded: true })
        .stripDebug();
    }

    await assetGraph
      .findRelations({
        from: { type: { $not: 'Htc' } },
        type: { $in: ['HtmlStyle', 'HtmlScript'] },
        to: { isLoaded: true },
        node: node => !node.hasAttribute('nobundle')
      })
      .externalize();

    await assetGraph
      .findAssets({
        isImage: true,
        isLoaded: true,
        url: { $regex: /^[^?]$/ } // Skip images with a query string in the url (might contain processImage instructions)
      })
      .mergeIdenticalAssets();

    // First execute explicit instructions in the query strings for images that are to be sprited:
    await assetGraph
      .findAssets({
        isImage: true,
        isLoaded: true,
        url: { $regex: /\?(?:|.*&)sprite(?:[&=#]|$)/ }
      })
      .processImages();
    await assetGraph.spriteBackgroundImages();

    // Execute explicit and automatic optimizations for all images, including the generated sprite images:
    await assetGraph
      .findAssets({ isImage: true, isLoaded: true })
      .processImages({ autoLossless: options.optimizeImages });

    if (options.svgo) {
      await assetGraph.findAssets({ isLoaded: true }).minifySvgAssetsWithSvgo();
    }
    await assetGraph
      .findAssets({ isInitial: { $not: true } })
      .removeUnreferencedAssets();
    await assetGraph.convertCssImportsToHtmlStyles();
    await assetGraph
      .findAssets({
        type: 'Html',
        isInitial: true
      })
      .removeDuplicateHtmlStyles();
    await assetGraph
      .findAssets({
        isLoaded: true,
        isInline: false,
        type: { $in: ['JavaScript', 'Css'] }
      })
      .mergeIdenticalAssets();

    if (options.browsers) {
      await assetGraph.autoprefixer({
        browsers: options.browsers,
        sourceMaps: options.sourceMaps,
        sourcesContent: options.sourcesContent
      });
    }

    if (options.addInitialHtmlExtension) {
      // Add initial html extension

      for (const asset of assetGraph.findAssets({
        isInitial: true,
        type: 'Html'
      })) {
        asset.fileName = asset.fileName.replace(
          /(?=\.|$)/,
          '.' + String(options.addInitialHtmlExtension).replace(/^\./, '')
        );
      }
    }

    if (minify) {
      await assetGraph
        .findAssets({
          isLoaded: true,
          isInline: false,
          minify: { $exists: true }
        })
        .minify();
    }

    await assetGraph
      .findAssets({ type: 'Html', isInitial: true })
      .cloneForEachConditionValue({
        splitConditions: options.splitConditions,
        conditions: options.conditions
      });

    await assetGraph.inlineHtmlTemplates();

    await assetGraph
      .findRelations({
        type: 'HtmlStyle',
        to: { type: 'Css', isLoaded: true },
        node: function(node) {
          return !node.hasAttribute('nobundle');
        }
      })
      .bundleRelations({ strategyName: bundleStrategyName });

    await assetGraph
      .findAssets({ type: 'Css' })
      .splitCssIfIeLimitIsReached({ minimumIeVersion: browsers.minimum('ie') });

    await assetGraph
      .findRelations({
        type: 'HtmlScript',
        to: { type: 'JavaScript', isLoaded: true },
        node: function(node) {
          return !node.hasAttribute('nobundle');
        }
      })
      .bundleRelations({ strategyName: bundleStrategyName });

    await assetGraph
      .findRelations({
        type: 'JavaScriptImportScripts',
        to: { type: 'JavaScript', isLoaded: true }
      })
      .bundleRelations({ strategyName: bundleStrategyName });

    await assetGraph
      .findAssets({
        isLoaded: true,
        isInline: false,
        type: { $in: ['JavaScript', 'Css'] }
      })
      .mergeIdenticalAssets(); // The bundling might produce several identical files, especially the 'oneBundlePerIncludingAsset' strategy.

    for (const relation of assetGraph.findRelations({
      type: { $in: ['HtmlScript', 'HtmlStyle'] }
    })) {
      if (relation.node.hasAttribute('nobundle')) {
        relation.node.removeAttribute('nobundle');
        relation.from.markDirty();
      }
    }

    if (minify) {
      await assetGraph
        .findAssets({ isLoaded: true, minify: { $exists: true } })
        .minify();
    }

    if (inlineByRelationType.CssImage) {
      await assetGraph
        .findAssets({
          type: 'Html',
          isInline: false,
          isFragment: false
        })
        .inlineCssImagesWithLegacyFallback({
          sizeThreshold:
            typeof inlineByRelationType.CssImage === 'boolean'
              ? inlineByRelationType.CssImage ? Infinity : 0
              : inlineByRelationType.CssImage,
          minimumIeVersion: browsers.minimum('ie')
        });

      await assetGraph
        .findAssets({
          isLoaded: true,
          isInline: false,
          type: 'Css'
        })
        .mergeIdenticalAssets();
    }

    if (options.defines) {
      await assetGraph
        .findAssets({ type: 'JavaScript', isLoaded: true })
        .replaceSymbolsInJavaScript(options.defines);
    }

    if (!options.noCompress) {
      await assetGraph
        .findAssets({ type: 'JavaScript', isLoaded: true })
        .compressJavaScript('uglifyJs', {
          sourceMaps: options.sourceMaps,
          mangleOptions: { reserved: options.reservedNames || [] }
        });
    }

    await assetGraph.removeEmptyJavaScripts();
    await assetGraph.removeEmptyStylesheets();

    // Inline relations:

    for (const relation of assetGraph.findRelations({
      to: { isLoaded: true, isInline: false },
      from: { isInline: false } // Excludes relations occurring in conditional comments
    })) {
      if (
        relation.type === 'CssImage' &&
        !options.noInlineCssImagesWithLegacyFallback
      ) {
        continue; // Already handled by the inlineCssImagesWithLegacyFallback transform above
      }
      if (
        relation.type === 'HtmlScript' &&
        (relation.node.hasAttribute('async') ||
          relation.node.hasAttribute('defer'))
      ) {
        continue;
      }
      let sizeThreshold = inlineByRelationType[relation.type];
      let isStarRule = false;
      if (typeof sizeThreshold === 'undefined') {
        sizeThreshold = inlineByRelationType['*'];
        isStarRule = true;
      }
      if (
        (typeof sizeThreshold !== 'undefined' && sizeThreshold === true) ||
        relation.to.lastKnownByteLength < sizeThreshold
      ) {
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
    }

    if (options.pretty) {
      await assetGraph
        .findAssets({
          type: 'Css',
          isLoaded: true
        })
        .prettyPrint();

      await assetGraph
        .findAssets({
          isLoaded: true,
          type: 'JavaScript',
          $or: [
            { isInline: true },
            {
              incomingRelations: {
                $where: incomingRelations =>
                  incomingRelations.every(
                    incomingRelation => incomingRelation.type === 'HtmlScript'
                  )
              }
            }
          ]
        })
        .prettyPrint();
    }

    await assetGraph.duplicateFavicon();
    await assetGraph
      .findRelations({ crossorigin: false, to: { isInline: false } })
      .setAsyncOrDeferOnHtmlScripts(options.asyncScripts, options.deferScripts);

    // Omit .toString('url') function calls:

    await assetGraph
      .findRelations({
        type: 'JavaScriptStaticUrl',
        to: { isLoaded: true }
      })
      .omitFunctionCall();

    if (options.manifest) {
      await assetGraph.findAssets({ isInitial: true }).addCacheManifest();
    }

    if (assetGraph.canonicalRoot) {
      assetGraph.findRelations({
        to: {
          isLoaded: true,
          isInline: false
        },
        from: {
          type: 'Html',
          isFragment: true,
          nonInlineAncestor: {
            type: { $in: ['Rss', 'Atom'] }
          }
        }
      }).canonical = true;
    }

    if (options.sourceMaps) {
      await assetGraph.serializeSourceMaps({
        sourcesContent: options.sourcesContent
      });
      assetGraph.findRelations({
        type: 'SourceMapSource'
      }).hrefType =
        'rootRelative';

      assetGraph.findRelations({
        type: { $regex: /SourceMappingUrl$/ },
        hrefType: { $in: ['relative', 'inline'] }
      }).hrefType =
        'rootRelative';

      await assetGraph
        .findRelations({ type: { $in: ['SourceMapSource', 'SourceMapFile'] } })
        .remove();
    }

    if (options.subsetFonts) {
      await assetGraph.subsetFonts(options.subsetFonts);
    }

    if (!options.noFileRev) {
      await assetGraph
        .findAssets(moveAssetsInOrderQuery)
        .moveAssetsInOrder((asset, assetGraph) => {
          let baseUrl =
            (assetGraph.canonicalRoot || assetGraph.root) + 'static/';
          // Conservatively assume that all JavaScriptStaticUrl relations pointing at non-images are intended to be fetched via XHR
          // and thus cannot be put on a CDN because of same origin restrictions:
          const hasIncomingJavaScriptStaticUrlOrServiceWorkerRelations =
            assetGraph.findRelations({
              to: asset,
              type: {
                $in: [
                  'JavaScriptStaticUrl',
                  'JavaScriptServiceWorkerRegistration',
                  'HtmlServiceWorkerRegistration'
                ]
              }
            }).length > 0;
          if (
            (options.cdnRoot &&
              asset.type !== 'Htc' &&
              asset.extension !== '.jar' &&
              (asset.type !== 'Html' || options.cdnHtml) &&
              (asset.isImage ||
                !hasIncomingJavaScriptStaticUrlOrServiceWorkerRelations)) ||
            (options.cdnRoot && options.cdnFlash && asset.type === 'Flash')
          ) {
            baseUrl = options.cdnRoot;
            assetGraph
              .findRelations({ to: asset })
              .forEach(function(incomingRelation) {
                if (/^\/\//.test(options.cdnRoot)) {
                  incomingRelation.hrefType = 'protocolRelative';
                } else if (
                  (asset.type === 'SourceMap' ||
                    hasIncomingJavaScriptStaticUrlOrServiceWorkerRelations) &&
                  /^https?:/.test(options.cdnRoot)
                ) {
                  incomingRelation.hrefType = 'absolute';
                }
                // Set crossorigin=anonymous on <script> tags pointing at CDN JavaScript.
                // See http://blog.errorception.com/2012/12/catching-cross-domain-js-errors.html'
                if (
                  (asset.type === 'JavaScript' &&
                    incomingRelation.type === 'HtmlScript') ||
                  (asset.type === 'Css' &&
                    incomingRelation.type === 'HtmlStyle')
                ) {
                  incomingRelation.node.setAttribute(
                    'crossorigin',
                    'anonymous'
                  );
                  incomingRelation.from.markDirty();
                }
              });
          }
          return baseUrl + asset.fileName;
        });
      await assetGraph
        .findAssets(moveAssetsInOrderQuery)
        .moveAssetsInOrder(function(asset, assetGraph) {
          return (
            asset.fileName.replace(/\.[^.]+$/, '') +
            '.' +
            asset.md5Hex.substr(0, 10) +
            asset.extension +
            asset.url.replace(/^[^#?]*(?:)/, '')
          ); // Preserve query string and fragment identifier
        });
    }

    await assetGraph.addRelNoopenerToBlankTargetAnchors();

    if (options.precacheServiceWorker) {
      await assetGraph
        .findAssets({
          isInitial: true,
          isLoaded: true,
          isInline: false,
          type: 'Html'
        })
        .addPrecacheServiceWorker({ single: true });

      // Omit .toString('url') function calls in the generated service worker:

      assetGraph
        .findRelations({
          type: 'JavaScriptStaticUrl',
          from: { fileName: { $regex: /precache-service-worker\.js$/ } },
          to: { isLoaded: true }
        })
        .omitFunctionCall();

      if (minify) {
        assetGraph
          .findAssets({
            isLoaded: true,
            isInline: false,
            fileName: { $regex: /precache-service-worker\.js$/ },
            minify: { $exists: true }
          })
          .minify();
      }
      if (!options.noCompress) {
        await assetGraph
          .findAssets({
            type: 'JavaScript',
            isLoaded: true,
            fileName: { $regex: /precache-service-worker\.js$/ }
          })
          .compressJavaScript('uglifyJs');
      }
    }
    await assetGraph
      .findAssets({
        type: 'Html',
        isInline: false,
        isFragment: false,
        isLoaded: true
      })
      .reviewContentSecurityPolicy({
        update: options.contentSecurityPolicy,
        level: options.contentSecurityPolicyLevel,
        includePath:
          options.contentSecurityPolicyLevel >= 2 ||
          !(
            browsers.has('Safari 8') ||
            browsers.has('Safari 9') ||
            browsers.has('Safari 9.1')
          )
            ? [
                'script-src',
                'style-src',
                'frame-src',
                'object-src',
                'manifest-src',
                'child-src'
              ]
            : false
      });

    await assetGraph
      .findAssets({
        type: 'Html',
        isInline: false,
        isFragment: false,
        isLoaded: true
      })
      .reviewSubResourceIntegrity({ update: options.subResourceIntegrity });

    if (options.gzip) {
      await assetGraph
        .findAssets({
          isInline: false,
          isText: true,
          isLoaded: true,
          extension: { $nin: ['.tgz', '.gz'] }
        })
        .gzip();
    }
  };
};
