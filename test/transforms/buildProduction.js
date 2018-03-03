/*global describe, it*/

const expect = require('../unexpected-with-plugins');
const Stream = require('stream');
const gm = require('gm');
const vm = require('vm');
const passError = require('passerror');
const sinon = require('sinon');
const AssetGraph = require('../../lib/AssetGraph');

describe('buildProduction', function () {
    it('should handle a simple test case', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/simple/'});
        await assetGraph.loadAssets('index.html');
        await assetGraph.buildProduction({
            quiet: true,
            version: 'The version number',
            optimizeImages: true,
            inlineSize: true,
            mangleTopLevel: false,
            manifest: true,
            asyncScripts: true,
            deferScripts: true,
            cdnRoot: 'http://cdn.example.com/foo/',
            prettyPrint: false
        });

        expect(assetGraph, 'to contain assets', {type: 'Html', isInline: false}, 1);

        for (const htmlAsset of assetGraph.findAssets({type: 'Html', isInline: false})) {
            expect(htmlAsset.parseTree.querySelectorAll('html[data-version="The version number"]'), 'to have length', 1);
        }

        expect(assetGraph, 'to contain relations', {type: 'HtmlScript', from: {fileName: 'index.html'}}, 2);

        expect(assetGraph.findAssets({fileName: 'index.html'})[0].text, 'to equal', '<!DOCTYPE html><html data-version="The version number" manifest=index.appcache><head><title>The fancy title</title><style>body{color:tan}</style><style>body{color:teal;color:maroon}body div{width:100px}</style></head><body><script src=http://cdn.example.com/foo/bundle.aa79b2788e.js async defer crossorigin=anonymous></script><script>alert(\'script3\')</script></body></html>');

        // someTextFile.txt should be found at /static/someTextFile.c7429a1035.txt (not on the CDN)
        expect(assetGraph, 'to contain asset', {url: {$regex: /\/static\/someTextFile.c7429a1035\.txt$/}});

        for (const htmlAsset of assetGraph.findAssets({type: 'Html', isInline: false})) {
            const htmlCacheManifestRelations = assetGraph.findRelations({from: htmlAsset, type: 'HtmlCacheManifest'});
            expect(htmlCacheManifestRelations, 'to have length', 1);
            const cacheManifest = htmlCacheManifestRelations[0].to;
            expect(assetGraph, 'to contain relations', {from: cacheManifest}, 2);
            const lines = cacheManifest.text.split('\n');
            lines[1] = lines[1].replace(/ @.*$/, ''); // Remove md5 sum
            expect(lines, 'to equal', [
                'CACHE MANIFEST',
                '# ' + htmlCacheManifestRelations[0].from.fileName,
                'static/someTextFile.c7429a1035.txt',
                assetGraph.findRelations({type: 'HtmlScript', from: htmlAsset})[0].to.url,
                'NETWORK:',
                '*',
                ''
            ]);
        }
    });

    it('should not inline script with async=async and defer=defer, but should still bundle the ones with identical attributes', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/asyncAndDeferredScripts/'});
        await assetGraph.loadAssets('index.html');
        await assetGraph.buildProduction({inlineByRelationType: {'*': true}});

        expect(assetGraph.findAssets({fileName: 'index.html'})[0].text, 'not to contain', 'alert')
            .and('to match', /<script async src=[^"]+>/)
            .and('to match', /<script defer src=[^"]+>/);
        expect(assetGraph, 'to contain assets', {type: 'JavaScript', isInline: false, text: /alert/}, 2);
    });

    it('should handle a test case with two stylesheets that @import the same stylesheet (assetgraph issue #82)', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/duplicateImports/'});
        await assetGraph.loadAssets('index.html');
        await assetGraph.buildProduction({version: false});

        // The rules from the @imported stylesheet should only be included once
        expect(assetGraph.findRelations({type: 'HtmlStyle'})[0].to.text, 'to equal', 'body{color:#fff}');
    });

    it('should support webpack', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/webpack/'});
        await assetGraph.loadAssets('index.html');
        await assetGraph.buildProduction();

        expect(assetGraph, 'to contain asset', 'JavaScript');
        expect(assetGraph, 'to contain relations', { type: 'HtmlScript', from: { url: /index\.html$/} }, 1);
        expect(assetGraph, 'to contain asset', {
            type: 'JavaScript',
            fileName: /bundle/
        });
        expect(assetGraph.findRelations({
            type: 'HtmlScript',
            from: { url: /index\.html$/ },
            to: { fileName: /bundle/ }
        })[0].to.text, 'to match', /alert\(['"]noExistingSourceMap/)
            .and('to contain', '* Sizzle CSS Selector Engine');
    });

    // Derived from a vanilla application output by create-react-app (1.3.0)
    it('should support pages rendered by HtmlWebpackPlugin', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/htmlWebpackPlugin'});
        await assetGraph.buildProduction();

        expect(assetGraph, 'to contain asset', { type: 'Html', url: /\/build\/index\.html$/, isInitial: true });
    });

    it('should handle a test case with a JavaScriptStaticUrl pointing at an image to be processed', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/JavaScriptStaticUrlWithProcessedImage/'});
        await assetGraph.loadAssets('index.html');
        await assetGraph.buildProduction({version: false});

        expect(assetGraph, 'to contain asset', 'Png');
        expect(assetGraph.findAssets({type: 'Png'})[0].rawSrc.toString('ascii'), 'not to contain', 'pHYs');
    });

    it('should handle a test case that uses both processImage instructions for both sprited images and the sprite itself', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/spriteAndProcessImages/'});
        await assetGraph.loadAssets('index.html');
        await assetGraph.buildProduction({version: false});

        expect(assetGraph, 'to contain no assets', 'Png');
        expect(assetGraph, 'to contain asset', {isImage: true});
        expect(assetGraph, 'to contain asset', 'Gif');

        // Argh, switch to a lib that does this synchronously:
        await new Promise((resolve, reject) => {
            const readStream = new Stream();
            readStream.readable = true;
            gm(readStream).identify(passError(reject, function (metadata) {
                expect(metadata.Format, 'to match', /^GIF/i);
                expect(metadata.Geometry, 'to equal', '10x10');
                resolve();
            }));
            setImmediate(() => {
                readStream.emit('data', assetGraph.findAssets({type: 'Gif'})[0].rawSrc);
                readStream.emit('end');
            });
        });
    });

    it('should handle a test case with Html fragments as initial assets', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/initialHtmlFragments/'});
        await assetGraph.loadAssets('**/*.html');

        expect(assetGraph, 'to contain assets', {type: 'Html'}, 2);
        expect(assetGraph, 'to contain asset', {type: 'Html', isFragment: true});

        await assetGraph.buildProduction({version: false});

        expect(assetGraph, 'to contain asset', {type: 'Png'});
        expect(assetGraph.findAssets({type: 'Html', fileName: 'index.html'})[0].text, 'to equal', '<!DOCTYPE html><html><head></head><body><script>var myTemplateUrl=\'/static/myTemplate.d87b038d95.html\'</script></body></html>');
    });

    it('should handle a test case with an Html fragment as an initial asset, but without loading the asset referencing it', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/initialHtmlFragments/'});
        await assetGraph.loadAssets('myTemplate.html');

        expect(assetGraph, 'to contain asset', {type: 'Html'});
        expect(assetGraph, 'to contain asset', {type: 'Html', isFragment: true});

        await assetGraph.buildProduction({version: false});

        expect(assetGraph.findAssets({type: 'Html', fileName: 'myTemplate.html'})[0].text, 'to equal', '<div><h1>Template with a relative image reference: <img src=static/foo.d65dd5318f.png></h1></div>');
    });

    it('should handle a test case with an HtmlScript relation pointing at an extension-less, non-existent file', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/nonExistentFileWithoutExtension/'});
        const warnSpy = sinon.spy().named('warn');
        await assetGraph.loadAssets('index.html');

        expect(assetGraph, 'to contain assets', {}, 2);

        assetGraph.on('warn', warnSpy);
        await assetGraph.buildProduction({version: false});
        // The event is actually emitted four times because populate is used four times during buildProduction.
        // It would be nice to suppress some of that noise. Perhaps by scoping the populates. Imagine if a transform
        // could forward a set of assets as a selection/subgraph so we could do something like:
        // await assetGraph.bundleRequireJs().populate();
        expect(warnSpy, 'to have a call satisfying', () => {
            warnSpy(/ENOENT/);
        });

        expect(assetGraph.findAssets({url: /\/index\.html$/})[0].text, 'to equal', '<!DOCTYPE html><html><head></head><body><script src=foo></script></body></html>');
    });

    it('should handle a test case with a JavaScriptStaticUrl relation pointing at an image, without the cdnRoot option', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/GetStaticUrlImageOnCdn/'});
        await assetGraph.loadAssets('index.html');
        await assetGraph.buildProduction({
            version: false,
            cdnRoot: 'http://cdn.example.com/foo/'
        });

        expect(assetGraph.findAssets({url: /\/index\.html$/})[0].text, 'to equal', '<!DOCTYPE html><html><head></head><body><script>var imgUrl=\'http://cdn.example.com/foo/test.d65dd5318f.png\'</script></body></html>');
    });

    it('should handle a test case with a HtmlRequireDataMain relation pointing at a script with a relation pointing at an I18n asset', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/htmlDataMainWithI18n/'});
        await assetGraph.loadAssets('index.html');
        await assetGraph.buildProduction({version: false, localeIds: ['da', 'en_US']});

        expect(assetGraph, 'to contain no assets', {type: 'JavaScript', text: /toString('url')/});
    });

    it('should handle a test case with a JavaScriptStaticUrl relation pointing at a flash file, then running the buildProduction transform with the cdnRoot option', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/GetStaticUrlFlash/'});
        await assetGraph.loadAssets('index.html');
        await assetGraph.buildProduction({
            version: false,
            minify: true,
            cdnRoot: 'http://cdn.example.com/foo/'
        });

        expect(assetGraph.findAssets({url: /\/index\.html$/})[0].text, 'to equal', '<!DOCTYPE html><html><head></head><body><script>var swfUrl=\'static/foo.d41d8cd98f.swf\'</script></body></html>');
    });

    it('should set crossorigin=anonymous on script and link tags that end up pointing to the configured cdn', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/crossoriginAnonymous/'});
        await assetGraph.loadAssets('index.html');
        await assetGraph.buildProduction({
            version: false,
            cdnRoot: '//cdn.example.com/foo/',
            inlineByRelationType: {'*': false}
        });

        expect(assetGraph.findRelations({type: { $in: ['HtmlStyle', 'HtmlScript'] }}), 'to have length', 2)
            .and('to have items satisfying', { node: { attributes: { crossorigin: 'anonymous' } } });
    });

    it('should set crossorigin=anonymous on script and link tags that end up pointing to the configured cdn, also when the cdnRoot is specified as an absolute url', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/crossoriginAnonymous/'});
        await assetGraph.loadAssets('index.html');
        await assetGraph.buildProduction({
            version: false,
            cdnRoot: 'https://cdn.example.com/foo/',
            inlineByRelationType: {'*': false}
        });

        expect(assetGraph.findRelations({type: { $in: ['HtmlStyle', 'HtmlScript'] }}), 'to have length', 2)
            .and('to have items satisfying', { node: { attributes: { crossorigin: 'anonymous' } } });
    });

    it('should handle a test case with a JavaScriptStaticUrl relation pointing at a flash file, then running the buildProduction transform with the cdnRoot and cdnFlash options', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/GetStaticUrlFlash/'});
        await assetGraph.loadAssets('index.html');
        await assetGraph.buildProduction({
            version: false,
            cdnRoot: 'http://cdn.example.com/foo/',
            cdnFlash: true
        });

        expect(assetGraph.findAssets({url: /\/index\.html$/})[0].text, 'to equal', '<!DOCTYPE html><html><head></head><body><script>var swfUrl=\'http://cdn.example.com/foo/foo.d41d8cd98f.swf\'</script></body></html>');
    });

    it('should handle a test case with an @import rule in a stylesheet pulled in via require.js, then running the buildProduction transform', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/requiredCssImport/'});

        await assetGraph.loadAssets('index.html');
        await assetGraph.buildProduction({version: false});

        expect(assetGraph, 'to contain no assets', {type: 'CssImport'});
        expect(assetGraph, 'to contain asset', {type: 'Css'});
        expect(assetGraph.findAssets({type: 'Css'})[0].text, 'to equal', 'span{color:green}body{color:red}');
    });

    it('should handle a test case with a require.js paths config pointing at an http url', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/requireJsCdnPath/'});
        await assetGraph.loadAssets('index.html');
        await assetGraph.buildProduction({version: false});

        expect(assetGraph, 'to contain asset', {type: 'JavaScript'});
    });

    it('should handle a test case using the less! plugin, then running the buildProduction transform', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/lessPlugin/'});
        await assetGraph.loadAssets('index.html');
        await assetGraph.buildProduction();

        const cssAssets = assetGraph.findAssets({type: 'Css'});
        expect(cssAssets, 'to have length', 1);
        expect(cssAssets[0].text, 'to equal', 'body{background-color:beige;color:tan;text-indent:10px}');
    });

    it('should handle a test case with a JavaScriptStaticUrl', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/GetStaticUrl/'});
        await assetGraph.loadAssets('index.html');
        await assetGraph.buildProduction({version: false});

        const javaScriptAssets = assetGraph.findAssets({type: 'JavaScript'});
        expect(javaScriptAssets, 'to have length', 1);
        expect(javaScriptAssets[0].text, 'to equal', 'var fileName=\'static/justThisOneFile.22324131a2.txt\'');
    });

    it('should handle a test case for issue #54', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/issue54/'});
        await assetGraph.loadAssets('index.html');
        await assetGraph.buildProduction({version: false});

        const javaScriptAssets = assetGraph.findAssets({type: 'JavaScript'});
        expect(javaScriptAssets, 'to have length', 1);
        expect(javaScriptAssets[0].text, 'to match', /return"backbone".*return"deepmodel".*"Yup/);
    });

    it('should handle a test case for issue #58', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/issue58/'});
        await assetGraph.loadAssets('index.html');
        await assetGraph.buildProduction({version: false});

        const javaScriptAssets = assetGraph.findAssets({type: 'JavaScript'});
        expect(javaScriptAssets, 'to have length', 1);
        expect(javaScriptAssets[0].text, 'to contain', 'define\("text!../templates\/header\.html"')
            .and('to contain', 'require(["text!../templates\/header.html"');
    });

    it('should handle a with a JavaScript asset that contains debugger statement and console.log, with stripDebug:true', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/stripDebug/'});
        await assetGraph.loadAssets('index.html');
        await assetGraph.buildProduction({stripDebug: true});

        expect(
            assetGraph.findAssets({type: 'JavaScript'})[0].text,
            'to equal',
            'function foo(o){o.log(\'foo\')}var foo=\'bar\';hey.log(\'foo\'),foo=123,alert(console.log(\'blah\'))'
        );
    });

    it('should handle a test where some require.js-loaded JavaScript files could become orphaned, then run the buildProduction transform', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/requireJsOrphans/'});
        await assetGraph.loadAssets('index.html');
        await assetGraph.buildProduction({version: false});

        expect(assetGraph, 'to contain asset', {type: 'JavaScript'});
    });

    it('should handle a test case for issue #69', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/issue69/'});
        await assetGraph.loadAssets('index.html');
        await assetGraph.buildProduction({version: false});

        const javaScriptAssets = assetGraph.findAssets({type: 'JavaScript'});
        expect(javaScriptAssets, 'to have length', 1);
        expect(javaScriptAssets[0].text, 'to match', /SockJS=[\s\S]*define\("main",function\(\)\{\}\);/);

        return new Promise((resolve, reject) => {
            const html = assetGraph.findAssets({type: 'Html'})[0];
            const javaScript = assetGraph.findAssets({type: 'JavaScript'})[0];
            const context = vm.createContext();
            const window = {
                document: html.parseTree,
                navigator: { userAgent: 'foo' },
                addEventListener() {}
            };

            Object.assign(context, window);
            context.window = context;
            context.alert = message => {
                if (/^got sockjs/.test(message)) {
                    setImmediate(resolve);
                }
            };
            context.errorInstance = null;
            try {
                vm.runInContext(javaScript.text, context, javaScript.url);
            } catch (e) {
                setImmediate(function () {
                    reject(e);
                });
            }
        });
    });

    it('should handle a test case for issue #83', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/issue83/'});
        await assetGraph.loadAssets('index.html');
        await assetGraph.buildProduction({version: false, reservedNames: ['$$super', 'quux']});

        const javaScriptAssets = assetGraph.findAssets({type: 'JavaScript'});
        expect(javaScriptAssets, 'to have length', 1);
        expect(javaScriptAssets[0].text, 'to match', /\$\$super,\w+,quux/);
        expect(javaScriptAssets[0].text, 'to match', /\$\$super\.foo/);
    });

    it('should handle a test case where multiple HTML files reference the same require.js config in an external JavaScript file, then run the buildProduction transform', async function () {
        const warnSpy = sinon.spy();
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/multipleHtmlsReferencingTheSameExternalRequireJsConfig/'});
        assetGraph.on('warn', warnSpy);
        await assetGraph.loadAssets('*.html');
        await assetGraph.buildProduction({version: false});

        expect(warnSpy, 'to have calls satisfying', []);
    });

    it('should handle a test case with a JavaScript that needs a symbol replaced, then running the buildProduction transform with noCompress:true', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/noCompress/'});
        await assetGraph.loadAssets('index.html');
        await assetGraph.buildProduction({
            version: false,
            noCompress: true,
            defines: {
                MYSYMBOL: { type: 'Literal', value: 'theValue' },
                MYOTHERSYMBOL: { type: 'Literal', value: 'theOtherValue' },
                MYOBJECT: { foo: 'bar' }
            }
        });

        expect(assetGraph.findAssets({type: 'JavaScript'})[0].text, 'to match', /theValue/);
        expect(assetGraph.findAssets({type: 'JavaScript'})[0].text, 'not to match', /theOtherValue/);
        expect(assetGraph.findAssets({type: 'JavaScript'})[0].text, 'to match', /alert\(\'bar\'\)$/);
    });

    it('should handle a test case with a JavaScript that needs a symbol replaced, then running the buildProduction transform with noCompress:false', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/noCompress/'});
        await assetGraph.loadAssets('index.html');
        await assetGraph.buildProduction({
            version: false,
            noCompress: false,
            defines: {
                MYSYMBOL: { type: 'Literal', value: 'theValue' },
                MYOTHERSYMBOL: { type: 'Literal', value: 'theOtherValue' },
                MYOBJECT: { foo: 'bar' }
            }
        });

        expect(assetGraph.findAssets({type: 'JavaScript'})[0].text, 'to match', /theValue/);
        expect(assetGraph.findAssets({type: 'JavaScript'})[0].text, 'not to match', /theOtherValue/);
        expect(assetGraph.findAssets({type: 'JavaScript'})[0].text, 'to match', /alert\('bar'\)$/);
    });

    it('should handle a test case then running the buildProduction transform with gzip:true', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/gzip/'});
        await assetGraph.loadAssets('index.html');
        await assetGraph.buildProduction({version: false, gzip: true});

        expect(assetGraph, 'to contain assets', {url: /\.gz$/}, 2);

        expect(assetGraph, 'to contain asset', {url: /\.js\.gz$/});

        const requireJsGz = assetGraph.findAssets({url: /\.js\.gz$/})[0];
        expect(requireJsGz, 'to be ok');
        expect(requireJsGz.rawSrc.length, 'to be greater than', 5000);
        expect(requireJsGz.rawSrc.length, 'to be less than', 10000);
    });

    it('should handle a test case with an HTML fragment that has an unpopulated relation, then running the buildProduction transform (regression test)', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/fragmentWithUnpopulatedRelation/'});
        await assetGraph.loadAssets('**/*.html');
        await assetGraph.buildProduction({version: false});

        expect(assetGraph, 'to contain assets', {type: 'Html'}, 2);
    });

    it('should handle a test case with an existing source map, then running the buildProduction transform with gzip:true', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/existingSourceMap/'});
        await assetGraph.loadAssets('index.html');
        await assetGraph.buildProduction({version: false, gzip: true});

        expect(assetGraph, 'to contain asset', {url: /\.gz$/});
    });

    it('should preserve sourcesContent from an existing source map', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/inlineSourceMapWithSourcesContent/'});
        await assetGraph.loadAssets('index.html');
        await assetGraph.buildProduction({version: false, sourceMaps: true, sourcesContent: true});

        expect(assetGraph, 'to contain asset', 'SourceMap');
        expect(assetGraph.findAssets({type: 'SourceMap'})[0].parseTree, 'to satisfy', {
            sourcesContent: [
                expect.it('to begin with', '(function e(t,n,r)'),
                expect.it('to begin with', 'module.exports = {\n  colors:'),
                expect.it('to begin with', 'var d3 = require(\'d3\');'),
                expect.it('to begin with', 'var projectionData'),
                expect.it('to begin with', 'module.exports = {\n  balanced:'),
                expect.it('to begin with', 'module.exports = function (graph, animationSpeed)')
            ]
        });
    });

    it('should handle a test case with some assets that can be inlined, with HtmlScript and HtmlStyle inlining thresholds of 100 bytes', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/inline/'});
        await assetGraph.loadAssets('index.html');
        await assetGraph.buildProduction({version: false, inlineByRelationType: {HtmlScript: 100, HtmlStyle: 100}});

        expect(assetGraph.findAssets({type: 'JavaScript'})[0].isInline, 'to equal', true);
        expect(assetGraph.findAssets({type: 'Css'})[0].isInline, 'to equal', true);
    });

    it('should handle a test case with some assets that can be inlined, with HtmlScript and HtmlStyle inlining thresholds of 5 bytes', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/inline/'});
        await assetGraph.loadAssets('index.html');
        await assetGraph.buildProduction({version: false, inlineByRelationType: {HtmlScript: 5, HtmlStyle: 5}});

        expect(assetGraph.findAssets({type: 'JavaScript'})[0].isInline, 'to equal', false);
        expect(assetGraph.findAssets({type: 'Css'})[0].isInline, 'to equal', false);
    });

    it('should handle a test case with some assets that can be inlined, with HtmlScript and HtmlStyle inlining thresholds of false', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/inline/'});
        await assetGraph.loadAssets('index.html');
        await assetGraph.buildProduction({version: false, inlineByRelationType: {HtmlScript: false, HtmlStyle: false}});

        expect(assetGraph.findAssets({type: 'JavaScript'})[0].isInline, 'to equal', false);
        expect(assetGraph.findAssets({type: 'Css'})[0].isInline, 'to equal', false);
    });

    it('should call splitCssIfIeLimitIsReached unconditionally and correctly when IE >= 8 is to be supported', async function () {
        const stub = sinon.stub(require('assetgraph/lib/TransformQueue').prototype, 'splitCssIfIeLimitIsReached').returnsThis();
        const assetGraph = new AssetGraph();
        await assetGraph.loadAssets({url: 'http://example.com/index.html', type: 'Html', text: '<!DOCTYPE html>'});
        try {
            await assetGraph.buildProduction({version: false, browsers: 'ie >= 8'});

            expect(stub, 'to have calls satisfying', function () {
                stub({ type: 'Css' }, { minimumIeVersion: 8 });
            });
        } finally {
            stub.restore();
        }
    });

    it('should handle a test case where an initial asset has no <html> element and no incoming relations (#109)', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/initialAssetWithoutHtmlElement/'});
        await assetGraph.loadAssets('index.html');
        await assetGraph.buildProduction({version: false});

        expect(assetGraph, 'to contain asset', {type: 'Html'});
        expect(assetGraph, 'to contain asset', {type: 'JavaScript', isInline: true});
    });

    it('should handle a test case with a web component that has a stylesheet reference inside a template tag', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/styleSheetInTemplate/'});
        await assetGraph.loadAssets('index.html');
        await assetGraph.buildProduction({version: false});

        expect(assetGraph.findAssets({url: /static\/.*\.html/})[0].text, 'not to contain', 'style.css');
    });

    it('should handle a test case where a JavaScript is eliminated by stripDebug and uglifiction (#114)', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/issue114/'});
        await assetGraph.loadAssets('index.html');
        await assetGraph.buildProduction({stripDebug: true, version: false});

        expect(assetGraph, 'to contain no assets', {type: 'JavaScript'});
        expect(assetGraph.findAssets({type: 'Html'})[0].text, 'to equal', '<!DOCTYPE html><html><head></head><body><div>Text</div></body></html>');
    });

    it('should handle a test case with an HTML fragment that has bundleable scripts and stylesheets', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/bundlingInHtmlFragments/'});
        await assetGraph.loadAssets('index.html');
        await assetGraph.buildProduction({version: false});

        expect(assetGraph, 'to contain relation', {type: 'HtmlStyle'});
        expect(assetGraph, 'to contain asset', {type: 'Css'});
        expect(assetGraph, 'to contain relation', {type: 'HtmlScript'});
        expect(assetGraph, 'to contain asset', {type: 'JavaScript'});
        expect(assetGraph.findAssets({type: 'Html'})[0].text, 'to equal', '<style>body{color:#aaa;color:#bbb}</style><script>alert(\'a\'),alert(\'b\')</script>');
    });

    it('should handle a test case with require.js, a data-main and a data-almond attribute', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/dataMainAndAlmondJs/'});
        await assetGraph.loadAssets('index.html');
        await assetGraph.buildProduction({version: false});

        expect(assetGraph, 'to contain asset', {type: 'JavaScript'});
        expect(assetGraph.findAssets({type: 'JavaScript'})[0].text,
            'to equal',
            "alert('a'),alert('b'),alert('almond'),alert('main'),define('main',function(){}),alert('d'),alert('e')"
        );
    });

    it('should handle a test case with some assets that should remain at the root (see assetgraph#185)', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/assetsThatShouldNotBeMoved/'});
        await assetGraph.loadAssets(['index.html']);
        await assetGraph.populate();

        expect(assetGraph, 'to contain asset', {url: assetGraph.root + 'robots.txt'});
        expect(assetGraph, 'to contain asset', {url: assetGraph.root + 'humans.txt'});
        expect(assetGraph, 'to contain asset', {url: assetGraph.root + '.htaccess'});
        expect(assetGraph, 'to contain asset', {url: assetGraph.root + 'favicon.ico'});

        await assetGraph.buildProduction({version: false});

        expect(assetGraph, 'to contain asset', {url: assetGraph.root + 'robots.txt'});
        expect(assetGraph, 'to contain asset', {url: assetGraph.root + 'humans.txt'});
        expect(assetGraph, 'to contain asset', {url: assetGraph.root + '.htaccess'});
        expect(assetGraph, 'to contain asset', {url: assetGraph.root + 'favicon.ico'});
        expect(assetGraph, 'to contain asset', {url: assetGraph.root + 'static/favicon.copy.9f0922f8d9.ico'});
        expect(assetGraph.findAssets({type: 'Html'})[0].text, 'to equal', '<!DOCTYPE html><html><head><link rel=author href=humans.txt type=text/plain><link rel=icon href=static/favicon.copy.9f0922f8d9.ico type=image/x-icon></head><body>Here\'s my <a href=.htaccess>.htaccess file</a>, grab it if you can! If you\'re a robot, please refer to <a href=robots.txt>robots.txt</a>.</body></html>');
    });

    it('should move a favicon.ico file not located at the root to /static/', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/faviconOutsideRoot/'});
        await assetGraph.loadAssets('index.html');
        await assetGraph.populate();
        await assetGraph.buildProduction({version: false});

        expect(assetGraph, 'to contain asset', {url: assetGraph.root + 'static/favicon.9f0922f8d9.ico'});
        expect(assetGraph.findAssets({type: 'Html'})[0].text, 'to equal', '<!DOCTYPE html><html><head><link rel="shortcut icon" type=image/vnd.microsoft.icon href=static/favicon.9f0922f8d9.ico></head><body></body></html>');
    });

    it('should keep favicon.ico at its original location when file revision is disabled', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/faviconOutsideRoot/'});
        await assetGraph.loadAssets('index.html');
        await assetGraph.populate();
        await assetGraph.buildProduction({version: false, noFileRev: true});

        expect(assetGraph, 'to contain asset', {url: assetGraph.root + 'foo/favicon.ico'});
        expect(assetGraph.findAssets({type: 'Html'})[0].text, 'to equal', '<!DOCTYPE html><html><head><link rel="shortcut icon" type=image/vnd.microsoft.icon href=foo/favicon.ico></head><body></body></html>');
    });

    it('should handle a test case with an RSS feed (#118)', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/rss/', canonicalRoot: 'http://www.someexamplerssdomain.com/'});
        await assetGraph.loadAssets('index.html');
        await assetGraph.populate();

        expect(assetGraph, 'to contain asset', {contentType: 'application/rss+xml', type: 'Rss'});

        await assetGraph.buildProduction({
            version: false
        });

        expect(assetGraph.findRelations(), 'to satisfy', [
            {
                type: 'HtmlAlternateLink',
                href: 'rssFeed.xml',
                canonical: false
            },
            {
                type: 'RssChannelLink',
                href: 'index.html',
                canonical: false
            },
            {
                type: 'XmlHtmlInlineFragment'
            },
            {
                type: 'HtmlImage',
                canonical: true,
                href: 'http://www.someexamplerssdomain.com/static/foo.d65dd5318f.png'
            }
        ]);

        expect(assetGraph.findAssets({type: 'Rss'})[0].text, 'to equal', '<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n<channel>\n <title>RSS Title</title>\n <description>This is an example of an RSS feed</description>\n <link>index.html</link>\n <lastBuildDate>Mon, 06 Sep 2010 00:01:00 +0000 </lastBuildDate>\n <pubDate>Mon, 06 Sep 2009 16:20:00 +0000 </pubDate>\n <ttl>1800</ttl>\n <item>\n  <title>Example entry</title>\n  <description>Here is some text containing an interesting description and an image: &lt;img src=http://www.someexamplerssdomain.com/static/foo.d65dd5318f.png>.</description>\n  <link>http://www.wikipedia.org/</link>\n  <guid>unique string per item</guid>\n  <pubDate>Mon, 06 Sep 2009 16:20:00 +0000 </pubDate>\n </item>\n</channel>\n</rss>');
    });

    it('should keep identical inline styles in svg files inlined', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/svgsWithIdenticalInlineStyle/'});
        await assetGraph.loadAssets('*.svg');
        await assetGraph.populate();
        await assetGraph.buildProduction({version: false});

        expect(assetGraph, 'to contain assets', 'Svg', 2);
        expect(assetGraph, 'to contain no assets', {type: 'Css', isInline: false});
    });

    it('should not rename Html assets that are linked to with HtmlAnchor relations', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/nonInitialAssetWithIncomingHtmlAnchor/'});
        await assetGraph.loadAssets('index.html');
        await assetGraph.populate();
        await assetGraph.buildProduction({version: false});

        expect(assetGraph, 'to contain asset', {fileName: 'index.html'});
        expect(assetGraph, 'to contain asset', {fileName: 'index2.html'});
    });

    it('should only remove empty scripts and stylesheets without extra attributes', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/emptyScriptsAndStylesheetsWithAttributes/'});
        await assetGraph.loadAssets('index.html');
        await assetGraph.populate();
        await assetGraph.buildProduction({version: false});

        expect(assetGraph, 'to contain relations', 'HtmlStyle', 2);

        const htmlStyles = assetGraph.findRelations({type: 'HtmlStyle'});
        expect(htmlStyles[0].node.outerHTML, 'to equal', '<style foo="bar"></style>');
        expect(htmlStyles[1].node.outerHTML, 'to equal', '<style media="screen" foo="bar"></style>');

        expect(assetGraph, 'to contain relations', 'HtmlScript', 1);
        const htmlScripts = assetGraph.findRelations({type: 'HtmlScript'});
        expect(htmlScripts[0].node.outerHTML, 'to equal', '<script foo="bar"></script>');
    });

    // This test is skipped, because it demonstrates a weakness in the
    // requireJs configuration resolving in AssetGraph. We have looked
    // into it, but couldn't find a way to make this pass without
    // breaking other tests.
    it.skip('should handle implicitly defined baseUrl for requireJs', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/implicitBaseUrl/'});
        const warnSpy = sinon.spy().named('warn');
        assetGraph.on('warn', warnSpy);
        await assetGraph.loadAssets('index.html');
        await assetGraph.populate();
        await assetGraph.buildProduction({version: false});

        expect(warnSpy, 'was not called');
    });

    // FIXME: This one fails half the time on Travis
    it.skip('should handle images with wrong extensions', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/imagesWithWrongExtensions/'});
        const warnSpy = sinon.spy().named('warn');
        assetGraph.on('warn', warnSpy);
        await assetGraph.loadAssets('index.html');
        await assetGraph.populate();
        await assetGraph.buildProduction({version: false, optimizeImages: true});

        expect(assetGraph._emittedWarnings, 'to be an array whose items satisfy', 'to be an', Error);
        expect(assetGraph._emittedWarnings, 'to have length', 2);
        expect(warnSpy, 'was called twice');
        expect(warnSpy, 'to have a call satisfying', () => {
            warnSpy('testdata/transforms/buildProduction/imagesWithWrongExtensions/actuallyAJpeg.png: Error executing pngcrush -rem alla');
        }).and('to have a call satisfying', () => {
            warnSpy('testdata/transforms/buildProduction/imagesWithWrongExtensions/actuallyAPng.jpg: Error executing /usr/bin/jpegtran -optimize: JpegTran: The stdout stream ended without emitting any data');
        });
        expect(assetGraph, 'to contain relation', 'HtmlStyle');
    });

    it('should not lose the type of an image that has been run through inkscape (regression test for an issue in express-processimage 1.0.0)', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/inkscape/'});
        await assetGraph.loadAssets('index.html');
        await assetGraph.populate();
        await assetGraph.buildProduction({version: false, optimizeImages: true, browsers: 'ie > 9', inlineByRelationType: {CssImage: 8192}});

        const cssAsset = assetGraph.findAssets({type: 'Css'})[0];
        expect(cssAsset.text, 'not to contain', 'image/undefined');
        expect(cssAsset.text, 'not to match', /url\(image\.[a-f0-9]{10}\)/);
    });

    it('should not remove a data-bind attribute', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/missingDataBind/'});
        await assetGraph.loadAssets('index.html');
        await assetGraph.populate();
        await assetGraph.buildProduction({version: false, browsers: 'ie > 9'});

        const htmlAsset = assetGraph.findAssets({type: 'Html'})[0];
        expect(htmlAsset.text, 'to contain', 'data-bind=template:{name:&quot;application&quot;,if:isInitialized');
    });

    it('should support a standalone svgfilter', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/svgFilter/'});
        await assetGraph.loadAssets('index.html');
        await assetGraph.populate();

        expect(assetGraph, 'to contain asset', 'Svg');

        await assetGraph.buildProduction();

        expect(assetGraph, 'to contain asset', 'Svg');
        expect(assetGraph.findAssets({type: 'Svg'})[0].text, 'when parsed as XML', 'queried for', 'path', 'to satisfy', [
            {
                attributes: {
                    stroke: expect.it('to be colored', 'red')
                }
            }
        ]);
    });

    it('should support an inline SVG island inside an HTML asset', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/HtmlSvgIsland/'});
        await assetGraph.loadAssets('index.html');
        await assetGraph.populate();

        expect(assetGraph, 'to contain asset', 'Html');
        expect(assetGraph, 'to contain assets', 'Svg', 2);

        await assetGraph.buildProduction();

        expect(assetGraph, 'to contain assets', 'Svg', 2);
        expect(assetGraph.findAssets({type: 'Html'})[0].text, 'to match', /xlink:href=static\/gaussianBlur\.[0-9a-f]{10}\.svg/);
    });

    it('should support an inline SVG island with an inline style tag inside an HTML asset', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/HtmlSvgIslandWithStyle/'});
        await assetGraph.loadAssets('index.html');
        await assetGraph.populate();

        expect(assetGraph, 'to contain relation', 'SvgStyle');
        expect(assetGraph, 'to contain no relations', 'HtmlStyle');
        expect(assetGraph, 'to contain asset', 'Html');
        expect(assetGraph, 'to contain asset', 'Svg');
        expect(assetGraph, 'to contain asset', 'Css');

        await assetGraph.buildProduction();

        expect(assetGraph, 'to contain asset', 'Html');
        expect(assetGraph, 'to contain asset', 'Svg');
        expect(assetGraph, 'to contain asset', 'Css');
    });

    it('should read in location data from existing source maps and produce source maps for bundles', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/sourceMaps/'});
        await assetGraph.loadAssets('index.html');
        await assetGraph.populate();

        expect(assetGraph, 'to contain asset', 'Html');

        await assetGraph.buildProduction({ sourceMaps: true, noCompress: true });

        expect(assetGraph, 'to contain assets', 'SourceMap', 2);
        const sourceMaps = assetGraph.findAssets({ type: 'SourceMap' });
        expect(sourceMaps[0].parseTree.sources, 'to equal', [ '/jquery-1.10.1.js', '/a.js' ]);
        expect(sourceMaps[1].parseTree.sources, 'to equal', [ '/b.js', '/c.js' ]);
    });

    it('should read in location data from existing source maps and produce source maps for bundles, without noCompress switch', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/sourceMaps/'});
        await assetGraph.loadAssets('index.html');
        await assetGraph.populate();

        expect(assetGraph, 'to contain asset', 'Html');

        await assetGraph.buildProduction({ sourceMaps: true });

        expect(assetGraph, 'to contain assets', 'SourceMap', 2);
        const sourceMaps = assetGraph.findAssets({ type: 'SourceMap' });
        expect(sourceMaps[0].parseTree.sources, 'to equal', [ '/jquery-1.10.1.js', '/a.js' ]);
        expect(sourceMaps[1].parseTree.sources, 'to equal', [ '/b.js', '/c.js' ]);
    });

    it('should preserve source map relations so that sourcesContent can be reestablished', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/existingJavaScriptSourceMapsWithSourcesContent/'});
        await assetGraph.loadAssets('index.html');
        await assetGraph.populate();
        await assetGraph.buildProduction({
            sourceMaps: true,
            sourcesContent: true
        });

        expect(assetGraph, 'to contain asset', 'SourceMap');
        const sourceMap = assetGraph.findAssets({type: 'SourceMap'})[0];
        expect(sourceMap.parseTree.sourcesContent, 'to equal', ['foo', 'bar']);
    });

    it('should leave meaningful paths', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/webpackSourceMaps/webroot'});
        await assetGraph.loadAssets('index.html');
        await assetGraph.populate();
        await assetGraph.buildProduction({
            webpackConfigPath: require('path').resolve(__dirname, '../../testdata/transforms/buildProduction/webpackSourceMaps/webpack.config.js'),
            sourceMaps: true,
            sourcesContent: true
        });

        // expect(assetGraph, 'to contain asset', 'SourceMap');
        const sourceMaps = assetGraph.findAssets({type: 'SourceMap'});
        const sourceMapSources = sourceMaps.map(asset => ({
            fileName: require('path').relative(asset.assetGraph.root, asset.url),
            sources: asset.parseTree.sources,
            incomingRelations: asset.incomingRelations.map(
                relation => relation.from.fileName // for some reason the referencing javascript asset has no content and no url
            )
        }));

        expect(sourceMapSources, 'to satisfy', [
            {
                fileName: expect.it('to begin with', 'static/index-'),
                sources: [
                    '/dist/webpack/bootstrap%20032413f5df1b0769617f',
                    '../src/index.js'
                ],
                incomingRelations: [
                    'bundle.js'
                ]
            }
        ]);
    });

    describe('JavaScript serialization options', function () {
        it('should honor indent_level', async function () {
            const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/javaScriptSerializationOptions/'});
            await assetGraph.loadAssets('script.js');
            await assetGraph.populate();
            await assetGraph.buildProduction({
                noCompress: true,
                pretty: true,
                javaScriptSerializationOptions: { indent_level: 1 }
            });

            expect(assetGraph.findAssets({type: 'JavaScript'})[0].text, 'to equal', 'function foo() {\n alert(\'☺\');\n};');
        });

        it('should honor ascii_only', async function () {
            const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/javaScriptSerializationOptions/'});
            await assetGraph.loadAssets('script.js');
            await assetGraph.populate();
            await assetGraph.buildProduction({
                noCompress: true,
                pretty: true,
                javaScriptSerializationOptions: { ascii_only: true }
            });

            expect(assetGraph.findAssets({type: 'JavaScript'})[0].text, 'to equal', 'function foo() {\n    alert(\'\\u263A\');\n};');
        });
    });

    it('should preserve source maps when autoprefixer is enabled', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/existingExternalSourceMap'});
        await assetGraph.loadAssets('index.html');
        await assetGraph.populate();

        expect(assetGraph, 'to contain asset', 'Css');
        expect(assetGraph, 'to contain asset', 'SourceMap');

        await assetGraph.buildProduction({
            browsers: 'last 2 versions, ie > 8, ff > 28',
            sourceMaps: true,
            inlineByRelationType: { HtmlStyle: false }
        });

        expect(assetGraph, 'to contain asset', 'Css');
        expect(assetGraph.findAssets({ type: 'Css' })[0].text, 'to contain', 'sourceMappingURL=/static/foo.css.8f6b70eaf4.map');
        expect(assetGraph, 'to contain asset', 'SourceMap');
        expect(assetGraph.findAssets({ type: 'SourceMap' })[0].parseTree.sources, 'to contain', '/foo.less');
    });

    it('should provide an external source map for an inline JavaScript asset', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/addSourceMapToInlineJavaScript'});
        await assetGraph.loadAssets('index.html');
        await assetGraph.populate();
        await assetGraph.buildProduction({ sourceMaps: true });

        expect(assetGraph, 'to contain asset', 'JavaScript');
        expect(assetGraph.findAssets({ type: 'JavaScript' })[0].text, 'to contain', '//# sourceMappingURL=/static/');
        expect(assetGraph, 'to contain asset', 'SourceMap');
        expect(assetGraph.findAssets({ type: 'SourceMap' })[0].parseTree.sources, 'to contain', '/index.html');
    });

    it('should read the existing inline source maps correctly from the output of Fusile', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/sourceMaps/fusile-output'});
        await assetGraph.loadAssets('index.html');
        await assetGraph.populate();
        await assetGraph.buildProduction({ sourceMaps: true });

        expect(assetGraph, 'to contain asset', 'JavaScript');
        expect(assetGraph.findAssets({ type: 'JavaScript' })[0].text, 'to contain', '//# sourceMappingURL=/static/');
        expect(assetGraph, 'to contain assets', 'SourceMap', 2);
        expect(assetGraph.findRelations({ type: 'CssSourceMappingUrl' })[0].to.parseTree.sources, 'to contain', '/home/munter/assetgraph/builder/demoapp/main.scss');
        expect(assetGraph.findRelations({ type: 'JavaScriptSourceMappingUrl' })[0].to.parseTree.sources, 'to contain', '/home/munter/assetgraph/builder/demoapp/main.jsx');
    });

    it('should bundle importScripts(...) calls in a web worker', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/webWorker'});
        await assetGraph.loadAssets('index.html');
        await assetGraph.populate();
        await assetGraph.buildProduction();

        expect(assetGraph, 'to contain assets', 'JavaScript', 3);
        expect(assetGraph, 'to contain asset', {fileName: 'worker.js'});
        expect(assetGraph.findAssets({fileName: 'worker.js'})[0].text, 'to match', /^importScripts\('static\/bundle-[\w.]+\.js'\);$/);
    });

    describe('with contentSecurityPolicy=true', function () {
        describe('with an existing policy', function () {
            it('should add image-src data: to an existing CSP when an image has been inlined', async function () {
                const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/contentSecurityPolicy/existingPolicy/'});
                await assetGraph.loadAssets('index.html');
                await assetGraph.populate();
                await assetGraph.buildProduction({
                    contentSecurityPolicy: true,
                    inlineByRelationType: {CssImage: true},
                    // Prevent a non-inlined copy to be preserved in a stylesheet referenced from a conditional comment:
                    browsers: [ 'ie > 9' ]
                });

                expect(assetGraph, 'to contain asset', {type: 'Png', isInline: true});
                expect(assetGraph.findAssets({type: 'ContentSecurityPolicy'})[0].parseTree, 'to satisfy', {
                    imgSrc: ['data:']
                });
            });

            describe('when Safari 8 and 9 support is required', function () {
                it('should whitelist the whole origin of external scripts and stylesheets', async function () {
                    const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/contentSecurityPolicy/existingPolicy/'});
                    await assetGraph.loadAssets('index.html');
                    await assetGraph.populate();
                    await assetGraph.buildProduction({
                        browsers: 'Safari >= 8',
                        contentSecurityPolicy: true,
                        cdnRoot: '//my.cdn.com/',
                        inlineByRelationType: {}
                    });

                    expect(assetGraph.findAssets({type: 'ContentSecurityPolicy'}), 'to satisfy', [
                        {
                            parseTree: expect.it('to equal', {
                                styleSrc: ['\'self\'', 'my.cdn.com'],
                                scriptSrc: ['\'self\'', 'my.cdn.com'],
                                imgSrc: ['my.cdn.com']
                            })
                        }
                    ]);
                });
            });

            describe('when Safari 8 and 9 support is not required', function () {
                it('should include the full path when whitelisting external scripts and stylesheets', async function () {
                    const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/contentSecurityPolicy/existingPolicy/'});
                    await assetGraph.loadAssets('index.html');
                    await assetGraph.populate();
                    await assetGraph.buildProduction({
                        browsers: 'Safari >= 10',
                        contentSecurityPolicy: true,
                        cdnRoot: '//my.cdn.com/',
                        inlineByRelationType: {}
                    });

                    expect(assetGraph.findAssets({type: 'ContentSecurityPolicy'}), 'to satisfy', [
                        {
                            parseTree: expect.it('to equal', {
                                styleSrc: ['\'self\'', 'my.cdn.com/styles.399c62e85c.css'],
                                scriptSrc: ['\'self\'', 'my.cdn.com/script.af5c77b360.js'],
                                imgSrc: ['my.cdn.com']
                            })
                        }
                    ]);
                });
            });

            describe('along with a cdnRoot', function () {
                describe('given as a protocol-relative url', function () {
                    it('should add the CDN host name to the relevant sections without any scheme', async function () {
                        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/contentSecurityPolicy/existingPolicy/'});
                        await assetGraph.loadAssets('index.html');
                        await assetGraph.populate();
                        await assetGraph.buildProduction({contentSecurityPolicy: true, cdnRoot: '//my.cdn.com/', inlineByRelationType: {}});

                        expect(assetGraph.findAssets({type: 'ContentSecurityPolicy'}), 'to satisfy', [
                            {
                                parseTree: expect.it('to equal', {
                                    styleSrc: ['\'self\'', 'my.cdn.com'],
                                    scriptSrc: ['\'self\'', 'my.cdn.com'],
                                    imgSrc: ['my.cdn.com']
                                })
                            }
                        ]);
                    });
                });

                describe('given as an absolute url', function () {
                    it('should add the CDN host name and scheme to the relevant section', async function () {
                        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/contentSecurityPolicy/existingPolicy/'});
                        await assetGraph.loadAssets('index.html');
                        await assetGraph.populate();
                        await assetGraph.buildProduction({contentSecurityPolicy: true, cdnRoot: 'https://my.cdn.com/', inlineByRelationType: {}});

                        expect(assetGraph.findAssets({type: 'ContentSecurityPolicy'}), 'to satisfy', [
                            {
                                parseTree: expect.it('to equal', {
                                    styleSrc: ['\'self\'', 'my.cdn.com'],
                                    scriptSrc: ['\'self\'', 'my.cdn.com'],
                                    imgSrc: ['my.cdn.com']
                                })
                            }
                        ]);
                    });
                });
            });
        });
    });

    describe('with subResourceIntegrity=true', function () {
        it('should leave relations to other domains alone', async function () {
            const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/subResourceIntegrity/scriptsAndStylesheetOnForeignDomain/'});
            await assetGraph.loadAssets('index.html');
            await assetGraph.populate({followRelations: { to: { protocol: { $not: 'https:' } } } });
            await assetGraph.buildProduction({subResourceIntegrity: true});

            expect(assetGraph.findAssets({type: 'Html'})[0].text, 'not to contain', 'integrity');
        });

        it('should add integrity attributes to local relations', async function () {
            const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/subResourceIntegrity/externalScriptAndStylesheet/'});
            await assetGraph.loadAssets('index.html');
            await assetGraph.populate();
            await assetGraph.buildProduction({subResourceIntegrity: true, inlineByRelationType: {}});

            expect(
                assetGraph.findAssets({type: 'Html'})[0].text,
                'to contain',
                'integrity="sha256-',
                'integrity="sha256-'
            );
        });

        it('should add integrity attributes to assets that are put on a CDN', async function () {
            const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/subResourceIntegrity/externalScriptAndStylesheet/'});
            await assetGraph.loadAssets('index.html');
            await assetGraph.populate();
            await assetGraph.buildProduction({subResourceIntegrity: true, cdnRoot: '//my.cdn.com/', inlineByRelationType: {}});

            expect(assetGraph.findAssets({type: 'Html'})[0].text, 'to contain',
                'integrity="sha256-',
                'integrity="sha256-'
            );
        });

        it('should use suitable serialization options after processing a data-bind attribute', async function () {
            const assetGraph = new AssetGraph();
            await assetGraph.loadAssets({
                type: 'Html',
                url: 'http://example.com/foo.html',
                text: '<!DOCTYPE html><html><body><div data-bind="click: function () {console.log(\'click\')}"></div></body></html>'
            });
            await assetGraph.buildProduction({localeIds: ['en_us'], noCompress: false, stripDebug: true});

            expect(assetGraph.findAssets({type: 'Html'})[0].text, 'to contain', 'data-bind=click:function(){}');
        });
    });

    describe('with a #{locale} conditional', function () {
        describe('without a value provided up front', function () {
            it('should attach the correct locale bundles to the pages in the cloneForEachConditionValue step', async function () {
                const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/systemJsConditionals/locale/'});
                await assetGraph.loadAssets('index.html');
                await assetGraph.populate();
                await assetGraph.buildProduction({
                    conditions: { locale: ['en_us', 'da'] },
                    splitConditions: ['locale'],
                    inlineByRelationType: {'*': true}
                });

                expect(assetGraph.findAssets({fileName: 'index.da.html'})[0].text, 'to contain', 'Danish')
                    .and('not to contain', 'needed in American English');
                expect(assetGraph.findAssets({fileName: 'index.en_us.html'})[0].text, 'to contain', 'needed in American English')
                    .and('not to contain', 'Danish');
            });
        });

        it('should pick up a non-CSS conditional asset from the asset list', async function () {
            const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/systemJsConditionals/conditionalTemplate/'});
            await assetGraph.loadAssets('index.html');
            await assetGraph.populate();
            await assetGraph.buildProduction({
                splitConditions: ['weather.js']
            });

            expect(assetGraph.findAssets({fileName: 'index.sunny.html'})[0].text, 'to contain', '<script type=text/html id=foo-sunny')
                .and('not to contain', 'rainy');
            expect(assetGraph.findAssets({fileName: 'index.rainy.html'})[0].text, 'to contain', '<script type=text/html id=foo-rainy')
                .and('not to contain', 'sunny');
        });
    });

    describe('with a #{locale.js} conditional', function () {
        describe('without a value provided up front', function () {
            it('should attach the correct locale bundles to the pages in the cloneForEachConditionValue step', async function () {
                const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/systemJsConditionals/localeJs/'});
                await assetGraph.loadAssets('index.html');
                await assetGraph.populate();
                await assetGraph.buildProduction({
                    conditions: { locale: ['en_us', 'da'] },
                    splitConditions: ['locale'],
                    inlineByRelationType: {'*': true}
                });

                expect(assetGraph.findAssets({fileName: 'index.da.html'})[0].text, 'to contain', 'Danish')
                    .and('not to contain', 'needed in American English');
                expect(assetGraph.findAssets({fileName: 'index.en_us.html'})[0].text, 'to contain', 'needed in American English')
                    .and('not to contain', 'Danish');
            });
        });

        describe('pointing at a stylesheet', function () {
            it('should attach the correct stylesheet to the pages in the cloneForEachConditionValue step', async function () {
                const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/systemJsConditionals/stylesheet/'});
                await assetGraph.loadAssets('index.html');
                await assetGraph.populate();
                await assetGraph.buildProduction({
                    conditions: { locale: ['en_us', 'da'] },
                    splitConditions: ['locale'],
                    inlineByRelationType: {'*': true}
                });

                expect(assetGraph.findAssets({fileName: 'index.da.html'})[0].text, 'to contain', '<style>body{background-color:red;color:#fff}</style>')
                    .and('not to contain', '<style>body{background-color:#00f;color:#fff}</style>');
                expect(assetGraph.findAssets({fileName: 'index.en_us.html'})[0].text, 'to contain', '<style>body{background-color:#00f;color:#fff}</style>')
                    .and('not to contain', '<style>body{background-color:red;color:#fff}</style>');
            });
        });
    });

    describe('with a JavaScript service worker registration', function () {
        it('should keep the service worker unbundled', async function () {
            const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/serviceWorker/'});
            await assetGraph.loadAssets('javascriptregistration.html');
            await assetGraph.populate();
            await assetGraph.buildProduction();

            expect(assetGraph, 'to contain assets', 'JavaScript', 2);
        });

        it('should keep the service worker file name', async function () {
            const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/serviceWorker/'});
            await assetGraph.loadAssets('javascriptregistration.html');
            await assetGraph.populate();
            await assetGraph.buildProduction();

            expect(assetGraph.findAssets(), 'to satisfy', [
                {
                    type: 'Html',
                    fileName: 'javascriptregistration.html'
                },
                {
                    type: 'JavaScript',
                    fileName: 'service-worker.js',
                    isInline: false
                },
                {
                    type: 'JavaScript',
                    isInline: true
                }
            ]);
        });
    });

    describe('with a Html service worker registration', function () {
        it('should keep the service worker unbundled', async function () {
            const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/serviceWorker/'});
            await assetGraph.loadAssets('htmlregistration.html');
            await assetGraph.populate();
            await assetGraph.buildProduction();

            expect(assetGraph, 'to contain assets', 'JavaScript', 2);
        });

        it('should keep the service worker unbundled', async function () {
            const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/serviceWorker/'});
            await assetGraph.loadAssets('htmlregistration.html');
            await assetGraph.populate();
            await assetGraph.buildProduction();

            expect(assetGraph.findAssets(), 'to satisfy', [
                {
                    type: 'Html',
                    fileName: 'htmlregistration.html'
                },
                {
                    type: 'JavaScript',
                    fileName: 'service-worker.js',
                    isInline: false
                },
                {
                    type: 'JavaScript',
                    isInline: true
                }
            ]);
        });
    });

    it('should keep everything before the (last) extension when moving to the static folder', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/fileNamesWithDots/'});
        await assetGraph.loadAssets('index.html');
        await assetGraph.populate();
        await assetGraph.buildProduction({
            inlineByRelationType: {'*': false}
        });

        expect(assetGraph, 'to contain asset', {fileName: /^script\.with\.dots\.[a-f0-9]+\.js$/})
            .and('to contain asset', {fileName: /^style\.sheet\.with\.dots\.[a-f0-9]+\.css$/});
    });

    it('should add a .css extension to transpiled assets', async function () {
        const assetGraph = new AssetGraph({root: __dirname});
        await assetGraph.loadAssets({
            type: 'Html',
            url: 'file://' + __dirname + '/index.html',
            text:
                '<!DOCTYPE html>' +
                '<html><head>' +
                '<link rel="stylesheet" nobundle href="styles.less">' +
                '<link rel="stylesheet" nobundle href="styles.scss?qs">' +
                '<link rel="stylesheet" nobundle href="styles.stylus">' +
                '</head></body></html>'
        }, {
            type: 'Css',
            url: 'file://' + __dirname + '/styles.less',
            text: 'body { color: red; }'
        }, {
            type: 'Css',
            url: 'file://' + __dirname + '/styles.scss?qs',
            text: 'body { color: blue; }'
        }, {
            type: 'Css',
            url: 'file://' + __dirname + '/styles.stylus',
            text: 'body { color: green; }'
        });
        await assetGraph.populate();
        await assetGraph.buildProduction({
            inlineByRelationType: {'*': false}
        });

        expect(assetGraph, 'to contain asset', {fileName: 'styles.less.css'})
            .and('to contain asset', {fileName: 'styles.scss.css', url: /\?qs$/})
            .and('to contain asset', {fileName: 'styles.stylus.css'});
    });

    it('should not issue absolute file:// urls when pointing back into assetGraph.root from assets put on a CDN', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/systemJsAssetPlugin/'});
        await assetGraph.loadAssets('index.html');
        await assetGraph.populate();
        await assetGraph.buildProduction({
            inlineByRelationType: {'*': false},
            cdnRoot: '//example.com/'
        });

        expect(assetGraph.findAssets({type: 'JavaScript'})[0].text, 'not to contain', assetGraph.root);

    });

    it('should not leave extraneous whitespace in an inline JavaScript', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/trailingWhitespaceInInlineScript/'});
        await assetGraph.loadAssets('index.html');
        await assetGraph.populate();
        await assetGraph.buildProduction({
            sourceMaps: true,
            contentSecurityPolicy: true,
            subResourceIntegrity: true
        });

        expect(assetGraph.findAssets({type: 'Html'})[0].text, 'not to match', / <\/script>/);
    });

    it('should not leave extraneous whitespace in an inline JavaScript when the "newline" JavaScript serialization option is passed', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/trailingWhitespaceInInlineScript/'});
        await assetGraph.loadAssets('index.html');
        await assetGraph.populate({
            followRelations: {crossorigin: false}
        });
        await assetGraph.buildProduction({ version: undefined,
            sourceMaps: true,
            contentSecurityPolicy: true,
            gzip: false,
            javaScriptSerializationOptions: { newline: '\n' }
        });

        expect(assetGraph.findAssets({type: 'Html'})[0].text, 'not to match', / <\/script>/);
    });

    describe('options.excludePatterns', function () {
        it('should not exclude any asset when no pattern is defined', async function () {
            const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/excludePattern/'});
            await assetGraph.loadAssets('index.html');
            await assetGraph.buildProduction({
                inlineByRelationType: {},
                noFileRev: true
            });

            expect(assetGraph.findAssets(), 'to satisfy', [
                {
                    type: 'Html',
                    fileName: 'index.html'
                },
                {
                    type: 'Css',
                    fileName: 'bar.css'
                },
                {
                    type: 'Css',
                    fileName: 'æ.css'
                },
                {
                    type: 'Png',
                    fileName: 'quux.png'
                },
                {
                    type: 'JavaScript',
                    fileName: 'main.js'
                }
            ]);
        });

        it('should exclude all files with .css extensions', async function () {
            const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/excludePattern/'});
            await assetGraph.loadAssets('index.html');
            await assetGraph.buildProduction({
                inlineByRelationType: {},
                noFileRev: true,
                excludePatterns: ['*.css']
            });

            expect(assetGraph.findAssets({isLoaded: true}), 'to satisfy', [
                {
                    type: 'Html',
                    fileName: 'index.html'
                },
                {
                    type: 'Png',
                    fileName: 'quux.png'
                },
                {
                    type: 'JavaScript',
                    fileName: 'main.js'
                }
            ]);
        });

        it('should exclude all files within /foo/ directory', async function () {
            const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/excludePattern/'});
            await assetGraph.loadAssets('index.html');
            await assetGraph.buildProduction({
                inlineByRelationType: {},
                noFileRev: true,
                excludePatterns: ['testdata/transforms/buildProduction/excludePattern/foo/']
            });

            expect(assetGraph.findAssets({ isLoaded: true }), 'to satisfy', [
                {
                    type: 'Html',
                    fileName: 'index.html'
                },
                {
                    type: 'Css',
                    fileName: 'æ.css'
                },
                {
                    type: 'Png',
                    fileName: 'quux.png'
                },
                {
                    type: 'JavaScript',
                    fileName: 'main.js'
                }
            ]);
        });

        it('should exclude all non-initial assets', async function () {
            const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/excludePattern/'});
            await assetGraph.loadAssets('index.html');
            await assetGraph.buildProduction({
                inlineByRelationType: {},
                noFileRev: true,
                excludePatterns: [
                    '*bar.css',
                    'testdata/transforms/buildProduction/excludePattern/baz',
                    '*/js/'
                ]
            });

            expect(assetGraph.findAssets(), 'to satisfy', [
                {
                    type: 'Html',
                    fileName: 'index.html'
                },
                {
                    type: 'Css',
                    fileName: 'æ.css'
                }
            ]);
        });

        it('should exclude paths with non-url safe characters', async function () {
            const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/excludePattern/'});
            await assetGraph.loadAssets('index.html');
            await assetGraph.buildProduction({
                inlineByRelationType: {},
                noFileRev: true,
                excludePatterns: [
                    '*/æ.css'
                ]
            });

            expect(assetGraph.findAssets({isLoaded: true}), 'to satisfy', [
                {
                    type: 'Html',
                    fileName: 'index.html'
                },
                {
                    type: 'Css',
                    fileName: 'bar.css'
                },
                {
                    type: 'Png',
                    fileName: 'quux.png'
                },
                {
                    type: 'JavaScript',
                    fileName: 'main.js'
                }
            ]);
        });
    });

    it('should not attempt to populate JavaScriptFetch relations', async function () {
        const warnSpy = sinon.spy();
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/javaScriptFetch/'});
        assetGraph.on('warn', warnSpy);
        await assetGraph.loadAssets('index.html');
        await assetGraph.buildProduction();

        expect(warnSpy, 'was not called');
    });

    it('should not rewrite the href of JavaScriptFetch relations', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/javaScriptFetch/'});
        await assetGraph.loadAssets('index.html');
        await assetGraph.buildProduction({
            cdnRoot: '//example.com/',
            inlineByRelationType: {}
        });

        expect(assetGraph.findAssets({type: 'JavaScript'})[0].text, 'not to contain', 'file://');
    });

    it('should issue an absolute url for a JavaScriptStaticUrl relation pointing at the CDN', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/staticUrlMovedToHttpsCdn/'});
        await assetGraph.loadAssets('index.html');
        await assetGraph.buildProduction({
            localeIds: ['en_us', 'da'],
            cdnRoot: 'https://example.com/cdn/',
            inlineByRelationType: {}
        });

        expect(assetGraph, 'to contain asset', { url: 'https://example.com/cdn/heart.ed30c45242.svg' })
            .and('to contain asset', { url: 'https://example.com/cdn/script.6b8882d2e8.js' });
        expect(assetGraph.findAssets({type: 'JavaScript'})[0].text, 'to contain', '\'https://example.com/cdn/heart.ed30c45242.svg\'');
    });

    it('should issue the correct MD5 hashes for the moved files', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/md5Hashes/'});
        await assetGraph.loadAssets('index.html');
        await assetGraph.buildProduction({
            cdnRoot: 'https://example.com/cdn/',
            inlineByRelationType: {}
        });

        const js = assetGraph.findAssets({type: 'JavaScript'})[0];
        expect(js.url, 'to contain', require('crypto').createHash('md5').update(js.rawSrc).digest('hex').substr(0, 10));
    });

    it('should handle a test case with a JavaScript asset pointing at a SourceMap, then rewriting the relation to an absolute URL when running the buildProduction transform with the cdnRoot option', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/absoluteUrlToSourceMapOnCdn/'});
        await assetGraph.loadAssets('index.html');
        await assetGraph.buildProduction({
            version: false,
            sourceMaps: true,
            inlineByRelationType: {'*': false},
            minify: true,
            cdnRoot: 'http://cdn.example.com/foo/'
        });

        expect(assetGraph.findAssets({url: /\/index\.html$/})[0].text, 'to match', /src=http:\/\/cdn.example.com\/foo\/bundle\.\w+\.js/);
        expect(assetGraph.findAssets({url: /\/bundle\.\w+\.js$/})[0].text, 'to equal', 'alert(\'foo\')//# sourceMappingURL=http://cdn.example.com/foo/bundle.js.256cdc4f81.map\n');
    });

    // Regression test: Previously the self-references would be left in an unresolved state after
    // minifySvgAssetsWithSvgo had run, causing moveAssetsInOrder to break:
    it('should reconnect self-references from an Svg after minifying it with svgo', async function () {
        const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/svgWithSelfReferences/'});
        await assetGraph.loadAssets('index.html');
        await assetGraph.populate();
        await assetGraph.buildProduction({ svgo: true });

        expect(assetGraph.findAssets({type: 'Svg'})[0].text, 'to contain', 'xlink:href="#a"');
    });

    describe('with precacheServiceWorker:true', function () {
        it('should generate a service worker', async function () {
            const assetGraph = new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/precacheServiceWorker/'});
            await assetGraph.loadAssets('index.html');
            await assetGraph.buildProduction({
                precacheServiceWorker: true,
                cdnRoot: 'https://example.com/cdn/',
                inlineByRelationType: {}
            });

            expect(assetGraph, 'to contain relation', 'JavaScriptServiceWorkerRegistration');
            expect(assetGraph.findRelations({type: 'JavaScriptServiceWorkerRegistration'})[0].to.text, 'to contain', '/static/bar.c9e9c0fad6.txt')
                .and('to match', /https:\/\/example\.com\/cdn\/bundle-\d+\.e01f897076\.js/)
                .and('to contain', 'e01f8970765fda371bb397754c36e114')
                .and('not to contain', '.toString(\'url\')');
        });
    });
});
