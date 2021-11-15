/* eslint indent:0 */
const browsersList = require('browserslist');
const urlTools = require('urltools');
const _ = require('lodash');
const assetGraphHashfiles = require('assetgraph-hashfiles');

module.exports = function (options = {}) {
  options = options || {};

  const minify = typeof options.minify === 'undefined' ? true : options.minify;

  let selected;
  if (options.browsers) {
    selected = browsersList(options.browsers);
  } else if (browsersList.findConfig('.')) {
    selected = browsersList();
  } else {
    // Default to all browsers
    selected = browsersList('last 999 versions');
  }

  const browsers = {
    selected,
    has(browserOrBrowsers) {
      try {
        return browsersList(browserOrBrowsers).some((browser) =>
          browsers.selected.some(
            (selectedBrowser) =>
              selectedBrowser === browser ||
              selectedBrowser.indexOf(browser + ' ') === 0
          )
        );
      } catch (e) {
        // Parse error, try to match it as a browser name (any version) so that
        // browsers.has('ie') does the expected.
        return browsers.selected.some((selectedBrowser) =>
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
    },
  };

  const bundleStrategyName = options.sharedBundles
    ? 'sharedBundles'
    : 'oneBundlePerIncludingAsset';
  const inlineByRelationType = options.inlineByRelationType || {
    HtmlScript: 4096,
    HtmlStyle: 4096,
  };

  return async function buildProduction(assetGraph) {
    assetGraph.sourceMaps = !!options.sourceMaps;

    assetGraph.disableFetch = true;

    assetGraph.javaScriptSerializationOptions = _.defaults(
      {},
      options.javaScriptSerializationOptions,
      {
        ie8: browsers.minimum('ie') <= 8,
      }
    );

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
            { to: { url: { $not: excludePatterns } } },
          ],
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
        'JavaScriptFetch',
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
            { type: { $nin: excludeRelationTypes } },
          ],
        };
      } else {
        excludeRelationTypes.push('HtmlAnchor', 'HtmlMetaRefresh');
        followRelations = { type: { $nin: excludeRelationTypes } };
      }

      assetGraph.followRelations = getFollowRelationsQuery({
        $and: [
          {
            crossorigin: false,
          },
          followRelations,
        ],
      });
    }

    await assetGraph.bundleWebpack(
      {},
      {
        configPath: options.webpackConfigPath,
      }
    );
    await assetGraph.populate(
      getFollowRelationsQuery({
        from: { type: 'Html' },
        followRelations: { type: 'HtmlScript', crossorigin: false },
      })
    );
    await assetGraph.bundleSystemJs({
      polyfill: true, // FIXME: Check caniuse Promise vs. window.URL
      conditions: options.conditions,
    });
    await assetGraph.bundleRequireJs();
    await assetGraph.populate();
    await assetGraph.populate(
      getFollowRelationsQuery({ startAssets: { type: 'JavaScript' } })
    );

    await assetGraph.checkIncompatibleTypes();

    // Rename transpiled Css assets:
    for (const cssAsset of assetGraph.findAssets({
      isInline: false,
      isLoaded: true, // Only 1st party
      type: 'Css',
      extension: { $not: '.css' },
    })) {
      cssAsset.fileName += '.css';
    }

    if (options.sourceMaps) {
      await assetGraph.applySourceMaps();
    }

    await assetGraph.removeRelations(
      { type: { $in: ['SourceMapSource', 'SourceMapFile'] } },
      { unresolved: true }
    );
    await assetGraph.populate();
    await assetGraph.populate(
      getFollowRelationsQuery({ startAssets: { type: 'Html' } })
    );

    // Remove bootstrapper scripts injected by buildDevelopment:
    await assetGraph.removeRelations(
      {
        type: 'HtmlScript',
        node: { id: 'bootstrapper' },
        from: { type: 'Html' },
      },
      { detach: true, removeOrphan: true }
    );

    await assetGraph.addDataVersionAttributeToHtmlElement(
      { type: 'Html', isInitial: true },
      options.version
    );

    if (options.stripDebug) {
      await assetGraph.stripDebug({ type: 'JavaScript', isLoaded: true });
    }

    await assetGraph.externalizeRelations({
      from: { type: { $not: 'Htc' } },
      type: { $in: ['HtmlStyle', 'HtmlScript'] },
      to: { isLoaded: true },
      node: (node) => !node.hasAttribute('nobundle'),
    });
    await assetGraph.mergeIdenticalAssets({
      isImage: true,
      isLoaded: true,
      url: { $regex: /^[^?]$/ }, // Skip images with a query string in the url (might contain processImage instructions)
    });

    // First execute explicit instructions in the query strings for images that are to be sprited:
    await assetGraph.processImages({
      isImage: true,
      isLoaded: true,
      url: { $regex: /\?(?:|.*&)sprite(?:[&=#]|$)/ },
    });
    await assetGraph.spriteBackgroundImages();

    // Execute explicit and automatic optimizations for all images, including the generated sprite images:
    await assetGraph.processImages(
      { isImage: true, isLoaded: true },
      { autoLossless: options.optimizeImages }
    );

    if (options.svgo) {
      await assetGraph.minifySvgAssetsWithSvgo({ isLoaded: true });
    }
    await assetGraph.removeUnreferencedAssets({ isInitial: { $not: true } });
    await assetGraph.convertCssImportsToHtmlStyles();
    await assetGraph.removeDuplicateHtmlStyles({
      type: 'Html',
      isInitial: true,
    });
    await assetGraph.mergeIdenticalAssets({
      isLoaded: true,
      isInline: false,
      type: { $in: ['JavaScript', 'Css'] },
    });

    await assetGraph.autoprefixer(browsers.selected, {
      sourceMaps: options.sourceMaps,
      sourcesContent: options.sourcesContent,
    });

    if (options.addInitialHtmlExtension) {
      // Add initial html extension

      for (const asset of assetGraph.findAssets({
        isInitial: true,
        type: 'Html',
      })) {
        asset.fileName = asset.fileName.replace(
          /(?=\.|$)/,
          '.' + String(options.addInitialHtmlExtension).replace(/^\./, '')
        );
      }
    }

    if (minify) {
      for (const asset of assetGraph.findAssets({
        isLoaded: true,
        isInline: false,
      })) {
        if (asset.minify) {
          await asset.minify();
        }
      }
    }

    await assetGraph.cloneForEachConditionValue(
      { type: 'Html', isInitial: true },
      {
        splitConditions: options.splitConditions,
        conditions: options.conditions,
      }
    );
    await assetGraph.inlineHtmlTemplates();
    await assetGraph.bundleRelations(
      {
        type: 'HtmlStyle',
        to: { type: 'Css', isLoaded: true },
        node: function (node) {
          return !node.hasAttribute('nobundle');
        },
      },
      { strategyName: bundleStrategyName }
    );
    await assetGraph.splitCssIfIeLimitIsReached(
      { type: 'Css' },
      { minimumIeVersion: browsers.minimum('ie') }
    );
    await assetGraph.bundleRelations(
      {
        type: 'HtmlScript',
        to: { type: 'JavaScript', isLoaded: true },
        node: function (node) {
          return !node.hasAttribute('nobundle');
        },
      },
      { strategyName: bundleStrategyName }
    );
    await assetGraph.bundleRelations(
      {
        type: 'JavaScriptImportScripts',
        to: { type: 'JavaScript', isLoaded: true },
      },
      { strategyName: bundleStrategyName }
    );
    await assetGraph.mergeIdenticalAssets({
      isLoaded: true,
      isInline: false,
      type: { $in: ['JavaScript', 'Css'] },
    }); // The bundling might produce several identical files, especially the 'oneBundlePerIncludingAsset' strategy.

    for (const relation of assetGraph.findRelations({
      type: { $in: ['HtmlScript', 'HtmlStyle'] },
    })) {
      if (relation.node.hasAttribute('nobundle')) {
        relation.node.removeAttribute('nobundle');
        relation.from.markDirty();
      }
    }

    if (minify) {
      for (const asset of assetGraph.findAssets({ isLoaded: true })) {
        if (asset.minify) {
          await asset.minify();
        }
      }
    }

    if (inlineByRelationType.CssImage) {
      await assetGraph.inlineCssImagesWithLegacyFallback(
        {
          type: 'Html',
          isInline: false,
          isFragment: false,
        },
        {
          sizeThreshold:
            typeof inlineByRelationType.CssImage === 'boolean'
              ? inlineByRelationType.CssImage
                ? Infinity
                : 0
              : inlineByRelationType.CssImage,
          minimumIeVersion: browsers.minimum('ie'),
        }
      );
      await assetGraph.mergeIdenticalAssets({
        isLoaded: true,
        isInline: false,
        type: 'Css',
      });
    }

    if (options.defines) {
      await assetGraph.replaceSymbolsInJavaScript(
        { type: 'JavaScript', isLoaded: true },
        options.defines
      );
    }

    if (!options.noCompress) {
      await assetGraph.compressJavaScript(
        { type: 'JavaScript', isLoaded: true },
        undefined,
        {
          sourceMaps: options.sourceMaps,
          mangleOptions: { reserved: options.reservedNames || [] },
        }
      );
    }

    await assetGraph.removeEmptyJavaScripts();
    await assetGraph.removeEmptyStylesheets();

    // Inline relations:

    for (const relation of assetGraph.findRelations({
      to: { isLoaded: true, isInline: false, isRedirect: false },
      from: { isInline: false }, // Excludes relations occurring in conditional comments
    })) {
      if (
        relation.type === 'CssImage' &&
        !options.noInlineCssImagesWithLegacyFallback
      ) {
        continue; // Already handled by the inlineCssImagesWithLegacyFallback transform above
      }
      if (relation.from === relation.to) {
        continue; // Skip pure anchor links that essentially point at the document itself
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
      for (const asset of assetGraph.findAssets({
        type: 'Css',
        isLoaded: true,
      })) {
        asset.prettyPrint();
      }
      for (const asset of assetGraph.findAssets({
        isLoaded: true,
        type: 'JavaScript',
        $or: [
          { isInline: true },
          {
            incomingRelations: {
              $where: (incomingRelations) =>
                incomingRelations.every(
                  (incomingRelation) => incomingRelation.type === 'HtmlScript'
                ),
            },
          },
        ],
      })) {
        asset.prettyPrint();
      }
    }

    await assetGraph.duplicateFavicon();
    await assetGraph.setAsyncOrDeferOnHtmlScripts(
      { crossorigin: false, to: { isInline: false } },
      options.asyncScripts,
      options.deferScripts
    );

    // Omit .toString('url') function calls:

    for (const relation of assetGraph.findRelations({
      type: 'JavaScriptStaticUrl',
      to: { isLoaded: true },
    })) {
      relation.omitFunctionCall();
    }

    if (options.manifest) {
      await assetGraph.addCacheManifest({ isInitial: true });
    }

    if (assetGraph.canonicalRoot) {
      for (const relation of assetGraph.findRelations({
        to: {
          isLoaded: true,
          isInline: false,
        },
        from: {
          type: 'Html',
          isFragment: true,
          nonInlineAncestor: {
            type: { $in: ['Rss', 'Atom'] },
          },
        },
      })) {
        relation.canonical = true;
      }
    }

    if (options.sourceMaps) {
      await assetGraph.serializeSourceMaps({
        sourcesContent: options.sourcesContent,
      });
      for (const relation of assetGraph.findRelations({
        type: 'SourceMapSource',
      })) {
        relation.hrefType = 'rootRelative';
      }
      for (const relation of assetGraph.findRelations({
        type: { $regex: /SourceMappingUrl$/ },
        hrefType: { $in: ['relative', 'inline'] },
      })) {
        relation.hrefType = 'rootRelative';
      }
      await assetGraph.removeRelations(
        { type: { $in: ['SourceMapSource', 'SourceMapFile'] } },
        { unresolved: true }
      );
    }

    if (!options.noFileRev) {
      await assetGraphHashfiles(assetGraph, {
        cdnRoot: options.cdnRoot,
        cdnFlash: options.cdnFlash,
      });
    }

    await assetGraph.addRelNoopenerToBlankTargetAnchors();

    if (options.precacheServiceWorker) {
      await assetGraph.addPrecacheServiceWorker(
        { isInitial: true, isLoaded: true, isInline: false, type: 'Html' },
        {
          single: true,
          minify,
          configPath: options.precacheServiceWorkerConfigPath,
        }
      );

      // Omit .toString('url') function calls in the generated service worker:

      for (const relation of assetGraph.findRelations({
        type: 'JavaScriptStaticUrl',
        from: { fileName: { $regex: /precache-service-worker\.js$/ } },
        to: { isLoaded: true },
      })) {
        relation.omitFunctionCall();
      }

      if (!options.noCompress) {
        await assetGraph.compressJavaScript({
          type: 'JavaScript',
          isLoaded: true,
          fileName: { $regex: /precache-service-worker\.js$/ },
        });
      }
    }
    await assetGraph.reviewContentSecurityPolicy(
      {
        type: 'Html',
        isInline: false,
        isFragment: false,
        isLoaded: true,
        isRedirect: false,
      },
      {
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
                'child-src',
              ]
            : false,
      }
    );

    await assetGraph.reviewSubResourceIntegrity(
      {
        type: 'Html',
        isInline: false,
        isFragment: false,
        isLoaded: true,
        isRedirect: false,
      },
      { update: options.subResourceIntegrity }
    );

    if (options.gzip) {
      await assetGraph.gzip({
        isInline: false,
        isText: true,
        isLoaded: true,
        extension: { $nin: ['.tgz', '.gz'] },
      });
    }
  };
};
