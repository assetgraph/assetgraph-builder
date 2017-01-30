/*global describe, it, setImmediate:true*/
// node 0.8 compat
if (typeof setImmediate === 'undefined') {
    setImmediate = process.nextTick;
}

var expect = require('../unexpected-with-plugins'),
    Stream = require('stream'),
    gm = require('gm'),
    vm = require('vm'),
    passError = require('passerror'),
    sinon = require('sinon'),
    AssetGraph = require('../../lib/AssetGraph');

describe('buildProduction', function () {
    it('should handle a simple test case', function () {
        return new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/simple/'})
            .loadAssets('index.html')
            .buildProduction({
                quiet: true,
                version: 'The version number',
                optimizeImages: true, // Test it
                inlineSize: true, // Test it
                mangleTopLevel: false, // Test it
                manifest: true, // Test it
                asyncScripts: true, // Test it
                deferScripts: true, // Test it
                cdnRoot: 'http://cdn.example.com/foo/',
                prettyPrint: false // Test it
            })
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain assets', {type: 'Html', isInline: false}, 1);

                assetGraph.findAssets({type: 'Html', isInline: false}).forEach(function (htmlAsset) {
                    expect(htmlAsset.parseTree.querySelectorAll('html[data-version="The version number"]'), 'to have length', 1);
                });

                expect(assetGraph, 'to contain relations', {type: 'HtmlScript', from: {fileName: 'index.html'}}, 2);

                expect(assetGraph.findAssets({fileName: 'index.html'})[0].text, 'to equal', '<!DOCTYPE html><html data-version="The version number" manifest=index.appcache><head><title>The fancy title</title><style>body div{width:100px}body{color:teal;color:maroon}</style><style>body{color:tan}</style></head><body><script src=' + assetGraph.findRelations({type: 'HtmlScript', from: {fileName: 'index.html'}})[0].to.url + ' async defer crossorigin=anonymous></script><script>alert("script3");</script></body></html>');

                // someTextFile.txt should be found at /static/someTextFile.c7429a1035.txt (not on the CDN)
                expect(assetGraph, 'to contain assets', {url: /\/static\/someTextFile.c7429a1035\.txt$/}, 1);

                assetGraph.findAssets({type: 'Html', isInline: false}).forEach(function (htmlAsset) {
                    var htmlCacheManifestRelations = assetGraph.findRelations({from: htmlAsset, type: 'HtmlCacheManifest'});
                    expect(htmlCacheManifestRelations, 'to have length', 1);
                    var cacheManifest = htmlCacheManifestRelations[0].to;
                    expect(assetGraph, 'to contain relations', {from: cacheManifest}, 2);
                    var lines = cacheManifest.text.split('\n');
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
                });
            });
    });

    it('should not inline script with async=async and defer=defer, but should still bundle the ones with identical attributes', function () {
        return new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/asyncAndDeferredScripts/'})
            .loadAssets('index.html')
            .buildProduction({inlineByRelationType: {'*': true}})
            .queue(function (assetGraph) {
                expect(assetGraph.findAssets({fileName: 'index.html'})[0].text, 'not to contain', 'alert')
                    .and('to match', /<script src=[^"]+ async>/)
                    .and('to match', /<script src=[^"]+ defer>/);
                expect(assetGraph, 'to contain assets', {type: 'JavaScript', isInline: false, text: /alert/}, 2);
            });
    });

    it('should handle a test case with two stylesheets that @import the same stylesheet (assetgraph issue #82)', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/duplicateImports/'})
            .loadAssets('index.html')
            .buildProduction({version: false})
            .queue(function (assetGraph) {
                // The rules from the @imported stylesheet should only be included once
                expect(assetGraph.findRelations({type: 'HtmlStyle'})[0].to.text, 'to equal', 'body{color:#fff}');
            })
            .run(done);
    });

    it('should support webpack', function () {
        return new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/webpack/'})
            .loadAssets('index.html')
            .buildProduction()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain asset', 'JavaScript');
                expect(assetGraph, 'to contain relations', { type: 'HtmlScript', from: { url: /index\.html$/} }, 1);
                expect(assetGraph, 'to contain asset', {
                    type: 'JavaScript',
                    fileName: /bundle/
                });
                expect(assetGraph.findRelations({
                    from: { url: /index\.html$/ },
                    to: { fileName: /bundle/ }
                })[0].to.text, 'to contain', 'alert("noExistingSourceMap")')
                    .and('to contain', '* Sizzle CSS Selector Engine');
            });
    });

    it('should handle a test case with a JavaScriptStaticUrl pointing at an image to be processed', function () {
        return new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/JavaScriptStaticUrlWithProcessedImage/'})
            .loadAssets('index.html')
            .buildProduction({version: false})
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain asset', 'Png');
                expect(assetGraph.findAssets({type: 'Png'})[0].rawSrc.toString('ascii'), 'not to contain', 'pHYs');
            });
    });

    it('should handle a test case that uses both processImage instructions for both sprited images and the sprite itself', function () {
        return new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/spriteAndProcessImages/'})
            .loadAssets('index.html')
            .buildProduction({version: false})
            .queue(function (assetGraph, cb) {
                expect(assetGraph, 'to contain no assets', 'Png');
                expect(assetGraph, 'to contain asset', {isImage: true});
                expect(assetGraph, 'to contain asset', 'Gif');

                // Argh, switch to a lib that does this synchronously:
                var readStream = new Stream();
                readStream.readable = true;
                gm(readStream).identify(passError(cb, function (metadata) {
                    expect(metadata.Format, 'to match', /^GIF/i);
                    expect(metadata.Geometry, 'to equal', '10x10');
                    cb();
                }));
                setImmediate(function () {
                    readStream.emit('data', assetGraph.findAssets({type: 'Gif'})[0].rawSrc);
                    readStream.emit('end');
                });
            });
    });

    it('should handle a test case with Html fragments as initial assets', function () {
        return new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/initialHtmlFragments/'})
            .loadAssets('**/*.html')
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain assets', {type: 'Html'}, 2);
                expect(assetGraph, 'to contain asset', {type: 'Html', isFragment: true});
            })
            .buildProduction({version: false})
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain asset', {type: 'Png'});
                expect(assetGraph.findAssets({type: 'Html', fileName: 'index.html'})[0].text, 'to equal', '<!DOCTYPE html><html><head></head><body><script>var myTemplateUrl=\'/static/myTemplate.b8ee9bf196.html\'</script></body></html>');
            });
    });

    it('should handle a test case with an Html fragment as an initial asset, but without loading the asset referencing it', function () {
        return new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/initialHtmlFragments/'})
            .loadAssets('myTemplate.html')
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain asset', {type: 'Html'});
                expect(assetGraph, 'to contain asset', {type: 'Html', isFragment: true});
            })
            .buildProduction({version: false})
            .queue(function (assetGraph) {
                expect(assetGraph.findAssets({type: 'Html', fileName: 'myTemplate.html'})[0].text, 'to equal', '<div><h1>Template with a relative image reference: <img src=static/foo.d65dd5318f.png></h1></div>');
            });
    });

    it('should handle a test case with an HtmlScript relation pointing at an extension-less, non-existent file', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/nonExistentFileWithoutExtension/'})
            .on('error', done)
            .loadAssets('index.html')
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain asset', {});
            })
            .buildProduction({version: false})
            .queue(function (assetGraph) {
                expect(assetGraph.findAssets({url: /\/index\.html$/})[0].text, 'to equal', '<!DOCTYPE html><html><head></head><body><script src=foo></script></body></html>');
            })
            .run(done);
    });

    it('should handle a test case with a JavaScriptStaticUrl relation pointing at an image, without the cdnRoot option', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/GetStaticUrlImageOnCdn/'})
            .on('error', done)
            .loadAssets('index.html')
            .buildProduction({
                version: false,
                cdnRoot: 'http://cdn.example.com/foo/'
            })
            .queue(function (assetGraph) {
                expect(assetGraph.findAssets({url: /\/index\.html$/})[0].text, 'to equal', '<!DOCTYPE html><html><head></head><body><script>var imgUrl=\'http://cdn.example.com/foo/test.d65dd5318f.png\'</script></body></html>');
            })
            .run(done);
    });

    it('should handle a test case with a HtmlRequireDataMain relation pointing at a script with a relation pointing at an I18n asset', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/htmlDataMainWithI18n/'})
            .on('error', done)
            .loadAssets('index.html')
            .buildProduction({version: false, localeIds: ['da', 'en_US']})
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain no assets', {type: 'JavaScript', text: /toString('url')/});
            })
            .run(done);
    });

    it('should handle a test case with a JavaScriptStaticUrl relation pointing at a flash file, then running the buildProduction transform with the cdnRoot option', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/GetStaticUrlFlash/'})
            .on('error', done)
            .loadAssets('index.html')
            .buildProduction({
                version: false,
                minify: true,
                cdnRoot: 'http://cdn.example.com/foo/'
            })
            .queue(function (assetGraph) {
                expect(assetGraph.findAssets({url: /\/index\.html$/})[0].text, 'to equal', '<!DOCTYPE html><html><head></head><body><script>var swfUrl=\'static/foo.d41d8cd98f.swf\'</script></body></html>');
            })
            .run(done);
    });

    it('should set crossorigin=anonymous on script and link tags that end up pointing to the configured cdn', function () {
        return new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/crossoriginAnonymous/'})
            .loadAssets('index.html')
            .buildProduction({
                version: false,
                cdnRoot: '//cdn.example.com/foo/',
                inlineByRelationType: {'*': false}
            })
            .then(function (assetGraph) {
                expect(assetGraph.findRelations({type: ['HtmlStyle', 'HtmlScript']}), 'to have length', 2)
                    .and('to have items satisfying', { node: { attributes: { crossorigin: 'anonymous' } } });
            });
    });

    it('should set crossorigin=anonymous on script and link tags that end up pointing to the configured cdn, also when the cdnRoot is specified as an absolute url', function () {
        return new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/crossoriginAnonymous/'})
            .loadAssets('index.html')
            .buildProduction({
                version: false,
                cdnRoot: 'https://cdn.example.com/foo/',
                inlineByRelationType: {'*': false}
            })
            .then(function (assetGraph) {
                expect(assetGraph.findRelations({type: ['HtmlStyle', 'HtmlScript']}), 'to have length', 2)
                    .and('to have items satisfying', { node: { attributes: { crossorigin: 'anonymous' } } });
            });
    });

    it('should handle a test case with a JavaScriptStaticUrl relation pointing at a flash file, then running the buildProduction transform with the cdnRoot and cdnFlash options', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/GetStaticUrlFlash/'})
            .on('error', done)
            .loadAssets('index.html')
            .buildProduction({
                version: false,
                cdnRoot: 'http://cdn.example.com/foo/',
                cdnFlash: true
            })
            .queue(function (assetGraph) {
                expect(assetGraph.findAssets({url: /\/index\.html$/})[0].text, 'to equal', '<!DOCTYPE html><html><head></head><body><script>var swfUrl=\'http://cdn.example.com/foo/foo.d41d8cd98f.swf\'</script></body></html>');
            })
            .run(done);
    });

    it('should handle a test case with an @import rule in a stylesheet pulled in via require.js, then running the buildProduction transform', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/requiredCssImport/'})
            .on('error', done)
            .loadAssets('index.html')
            .buildProduction({version: false})
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain no assets', {type: 'CssImport'});
                expect(assetGraph, 'to contain asset', {type: 'Css'});
                expect(assetGraph.findAssets({type: 'Css'})[0].text, 'to equal', 'span{color:green}body{color:red}');
            })
            .run(done);
    });

    it('should handle a test case with a require.js paths config pointing at an http url', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/requireJsCdnPath/'})
            .on('error', done)
            .loadAssets('index.html')
            .buildProduction({version: false})
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain asset', {type: 'JavaScript'});
            })
            .run(done);
    });

    it('should handle a test case using the less! plugin, then running the buildProduction transform', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/lessPlugin/'})
            .loadAssets('index.html')
            .buildProduction()
            .queue(function (assetGraph) {
                var cssAssets = assetGraph.findAssets({type: 'Css'});
                expect(cssAssets, 'to have length', 1);
                expect(cssAssets[0].text, 'to equal', 'body{background-color:beige;color:tan;text-indent:10px}');
            })
            .run(done);
    });

    it('should handle a test case with a JavaScriptStaticUrl', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/GetStaticUrl/'})
            .loadAssets('index.html')
            .buildProduction({version: false})
            .queue(function (assetGraph) {
                var javaScriptAssets = assetGraph.findAssets({type: 'JavaScript'});
                expect(javaScriptAssets, 'to have length', 1);
                expect(javaScriptAssets[0].text, 'to equal', 'var fileName=\'static/justThisOneFile.22324131a2.txt\'');
            })
            .run(done);
    });

    it('should handle a test case for issue #54', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/issue54/'})
            .loadAssets('index.html')
            .buildProduction({version: false})
            .queue(function (assetGraph) {
                var javaScriptAssets = assetGraph.findAssets({type: 'JavaScript'});
                expect(javaScriptAssets, 'to have length', 1);
                expect(javaScriptAssets[0].text, 'to match', /return"backbone".*return"deepmodel".*"Yup/);
            })
            .run(done);
    });

    it('should handle a test case for issue #58', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/issue58/'})
            .loadAssets('index.html')
            .buildProduction({version: false})
            .queue(function (assetGraph) {
                var javaScriptAssets = assetGraph.findAssets({type: 'JavaScript'});
                expect(javaScriptAssets, 'to have length', 1);
                expect(javaScriptAssets[0].text, 'to contain', 'define\("text!../templates\/header\.html"')
                    .and('to contain', 'require(["text!../templates\/header.html"');
            })
            .run(done);
    });

    it('should handle a with a JavaScript asset that contains debugger statement and console.log, with stripDebug:true', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/stripDebug/'})
            .loadAssets('index.html')
            .buildProduction({stripDebug: true})
            .queue(function (assetGraph) {
                expect(
                    assetGraph.findAssets({type: 'JavaScript'})[0].text,
                    'to equal',
                    'function foo(a){a.log(\'foo\')}var foo=\'bar\';hey.log(\'foo\'),foo=123,alert(console.log(\'blah\'))'
                );
            })
            .run(done);
    });

    it('should handle a test where some require.js-loaded JavaScript files could become orphaned, then run the buildProduction transform', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/requireJsOrphans/'})
            .loadAssets('index.html')
            .buildProduction({version: false})
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain asset', {type: 'JavaScript'});
            })
            .run(done);
    });

    it('should handle a test case for issue #69', function () {
        return new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/issue69/'})
            .loadAssets('index.html')
            .buildProduction({version: false})
            .queue(function (assetGraph) {
                var javaScriptAssets = assetGraph.findAssets({type: 'JavaScript'});
                expect(javaScriptAssets, 'to have length', 1);
                expect(javaScriptAssets[0].text, 'to match', /SockJS=[\s\S]*define\("main",function\(\)\{\}\);/);

            })
            .queue(function (assetGraph, cb) {
                var html = assetGraph.findAssets({type: 'Html'})[0];
                var javaScript = assetGraph.findAssets({type: 'JavaScript'})[0];
                var context = vm.createContext();
                var window = {
                    document: html.parseTree,
                    navigator: { userAgent: 'foo' },
                    addEventListener: function () {}
                };

                require('assetgraph/lib/util/extendWithGettersAndSetters')(context, window);
                context.window = context;
                context.alert = function (message) {
                    if (/^got sockjs/.test(message)) {
                        setImmediate(function () {
                            cb(null, null);
                        });
                    }
                };
                context.errorInstance = null;
                try {
                    vm.runInContext(javaScript.text, context, javaScript.url);
                } catch (e) {
                    setImmediate(function () {
                        cb(e);
                    });
                }
            });
    });

    it('should handle a test case for issue #83', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/issue83/'})
            .loadAssets('index.html')
            .buildProduction({version: false, reservedNames: ['$$super', 'quux']})
            .queue(function (assetGraph) {
                var javaScriptAssets = assetGraph.findAssets({type: 'JavaScript'});
                expect(javaScriptAssets, 'to have length', 1);
                expect(javaScriptAssets[0].text, 'to match', /\$\$super,\w+,quux/);
                expect(javaScriptAssets[0].text, 'to match', /\$\$super\.foo/);
            })
            .run(done);
    });

    it('should handle a test case where multiple HTML files reference the same require.js config in an external JavaScript file, then run the buildProduction transform', function () {
        var warningSpy = sinon.spy();
        return new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/multipleHtmlsReferencingTheSameExternalRequireJsConfig/'})
            .on('warn', warningSpy)
            .loadAssets('*.html')
            .buildProduction({version: false})
            .queue(function (assetGraph) {
                expect(warningSpy, 'to have calls satisfying', []);
            });
    });

    it('should handle a test case with a JavaScript that needs a symbol replaced, then running the buildProduction transform with noCompress:true', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/noCompress/'})
            .loadAssets('index.html')
            .buildProduction({
                version: false,
                noCompress: true,
                defines: {
                    MYSYMBOL: { type: 'Literal', value: 'theValue' },
                    MYOTHERSYMBOL: { type: 'Literal', value: 'theOtherValue' },
                    MYOBJECT: { foo: 'bar' }
                }
            })
            .queue(function (assetGraph) {
                expect(assetGraph.findAssets({type: 'JavaScript'})[0].text, 'to match', /theValue/);
                expect(assetGraph.findAssets({type: 'JavaScript'})[0].text, 'not to match', /theOtherValue/);
                expect(assetGraph.findAssets({type: 'JavaScript'})[0].text, 'to match', /alert\(\'bar\'\)$/);
            })
            .run(done);
    });

    it('should handle a test case with a JavaScript that needs a symbol replaced, then running the buildProduction transform with noCompress:false', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/noCompress/'})
            .loadAssets('index.html')
            .buildProduction({
                version: false,
                noCompress: false,
                defines: {
                    MYSYMBOL: { type: 'Literal', value: 'theValue' },
                    MYOTHERSYMBOL: { type: 'Literal', value: 'theOtherValue' },
                    MYOBJECT: { foo: 'bar' }
                }
            })
            .queue(function (assetGraph) {
                expect(assetGraph.findAssets({type: 'JavaScript'})[0].text, 'to match', /theValue/);
                expect(assetGraph.findAssets({type: 'JavaScript'})[0].text, 'not to match', /theOtherValue/);
                expect(assetGraph.findAssets({type: 'JavaScript'})[0].text, 'to match', /alert\('bar'\)$/);
            })
            .run(done);
    });

    it('should handle a test case then running the buildProduction transform with gzip:true', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/gzip/'})
            .loadAssets('index.html')
            .buildProduction({version: false, gzip: true})
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain assets', {url: /\.gz$/}, 2);

                expect(assetGraph, 'to contain asset', {url: /\.js\.gz$/});

                var requireJsGz = assetGraph.findAssets({url: /\.js\.gz$/})[0];
                expect(requireJsGz, 'to be ok');
                expect(requireJsGz.rawSrc.length, 'to be greater than', 5000);
                expect(requireJsGz.rawSrc.length, 'to be less than', 10000);
            })
            .run(done);
    });

    it('should handle a test case with an HTML fragment that has an unpopulated relation, then running the buildProduction transform (regression test)', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/fragmentWithUnpopulatedRelation/'})
            .loadAssets('**/*.html')
            .buildProduction({version: false})
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain assets', {type: 'Html'}, 2);
            })
            .run(done);
    });

    it('should handle a test case with an existing source map, then running the buildProduction transform with gzip:true', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/existingSourceMap/'})
            .loadAssets('index.html')
            .buildProduction({version: false, gzip: true})
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain asset', {url: /\.gz$/});
            })
            .run(done);
    });

    it('should preserve sourcesContent from an existing source map', function () {
        return new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/inlineSourceMapWithSourcesContent/'})
            .loadAssets('index.html')
            .buildProduction({version: false, sourceMaps: true, sourcesContent: true})
            .queue(function (assetGraph) {
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
    });

    it('should handle a test case with some assets that can be inlined, with HtmlScript and HtmlStyle inlining thresholds of 100 bytes', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/inline/'})
            .loadAssets('index.html')
            .buildProduction({version: false, inlineByRelationType: {HtmlScript: 100, HtmlStyle: 100}})
            .queue(function (assetGraph) {
                expect(assetGraph.findAssets({type: 'JavaScript'})[0].isInline, 'to equal', true);
                expect(assetGraph.findAssets({type: 'Css'})[0].isInline, 'to equal', true);
            })
            .run(done);
    });

    it('should handle a test case with some assets that can be inlined, with HtmlScript and HtmlStyle inlining thresholds of 5 bytes', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/inline/'})
            .loadAssets('index.html')
            .buildProduction({version: false, inlineByRelationType: {HtmlScript: 5, HtmlStyle: 5}})
            .queue(function (assetGraph) {
                expect(assetGraph.findAssets({type: 'JavaScript'})[0].isInline, 'to equal', false);
                expect(assetGraph.findAssets({type: 'Css'})[0].isInline, 'to equal', false);
            })
            .run(done);
    });

    it('should handle a test case with some assets that can be inlined, with HtmlScript and HtmlStyle inlining thresholds of false', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/inline/'})
            .loadAssets('index.html')
            .buildProduction({version: false, inlineByRelationType: {HtmlScript: false, HtmlStyle: false}})
            .queue(function (assetGraph) {
                expect(assetGraph.findAssets({type: 'JavaScript'})[0].isInline, 'to equal', false);
                expect(assetGraph.findAssets({type: 'Css'})[0].isInline, 'to equal', false);
            })
            .run(done);
    });

    it('should call splitCssIfIeLimitIsReached unconditionally and correctly when IE >= 8 is to be supported', function (done) {
        var stub = sinon.stub(require('assetgraph/lib/TransformQueue').prototype, 'splitCssIfIeLimitIsReached', function (queryObj, options) {
            expect(options, 'to equal', {minimumIeVersion: 8});
            return this;
        });
        new AssetGraph()
            .loadAssets({url: 'http://example.com/index.html', type: 'Html', text: '<!DOCTYPE html>'})
            .buildProduction({version: false, browsers: 'ie >= 8'})
            .queue(function () {
                expect(stub, 'was called once');
                stub.restore();
            })
            .run(done);
    });

    it('should handle a test case where an initial asset has no <html> element and no incoming relations (#109)', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/initialAssetWithoutHtmlElement/'})
            .loadAssets('index.html')
            .buildProduction({version: false})
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain asset', {type: 'Html'});
                expect(assetGraph, 'to contain asset', {type: 'JavaScript', isInline: true});
            })
            .run(done);
    });

    it('should handle a test case with a web component that has a stylesheet reference inside a template tag', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/styleSheetInTemplate/'})
            .loadAssets('index.html')
            .buildProduction({version: false})
            .queue(function (assetGraph) {
                expect(assetGraph.findAssets({url: /static\/.*\.html/})[0].text, 'not to contain', 'style.css');
            })
            .run(done);
    });

    it('should handle a test case where a JavaScript is eliminated by stripDebug and uglifiction (#114)', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/issue114/'})
            .loadAssets('index.html')
            .buildProduction({stripDebug: true, version: false})
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain no assets', {type: 'JavaScript'});
                expect(assetGraph.findAssets({type: 'Html'})[0].text, 'to equal', '<!DOCTYPE html><html><head></head><body><div>Text</div></body></html>');
            })
            .run(done);
    });

    it('should handle a test case with an HTML fragment that has bundleable scripts and stylesheets', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/bundlingInHtmlFragments/'})
            .loadAssets('index.html')
            .buildProduction({version: false})
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain relation', {type: 'HtmlStyle'});
                expect(assetGraph, 'to contain asset', {type: 'Css'});
                expect(assetGraph, 'to contain relation', {type: 'HtmlScript'});
                expect(assetGraph, 'to contain asset', {type: 'JavaScript'});
                expect(assetGraph.findAssets({type: 'Html'})[0].text, 'to equal', '<style>body{color:#aaa;color:#bbb}</style><script>alert("a"),alert("b");</script>');
            })
            .run(done);
    });

    it('should handle a test case with require.js, a data-main and a data-almond attribute', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/dataMainAndAlmondJs/'})
            .loadAssets('index.html')
            .buildProduction({version: false})
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain asset', {type: 'JavaScript'});
                expect(assetGraph.findAssets({type: 'JavaScript'})[0].text,
                    'to equal',
                    "alert('a'),alert('b'),alert('almond'),alert('main'),define('main',function(){}),alert('d'),alert('e')"
                );
            })
            .run(done);
    });

    it('should handle a test case with some assets that should remain at the root (see assetgraph#185)', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/assetsThatShouldNotBeMoved/'})
            .loadAssets(['index.html'])
            .populate()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain asset', {url: assetGraph.root + 'robots.txt'});
                expect(assetGraph, 'to contain asset', {url: assetGraph.root + 'humans.txt'});
                expect(assetGraph, 'to contain asset', {url: assetGraph.root + '.htaccess'});
                expect(assetGraph, 'to contain asset', {url: assetGraph.root + 'favicon.ico'});
            })
            .buildProduction({version: false})
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain asset', {url: assetGraph.root + 'robots.txt'});
                expect(assetGraph, 'to contain asset', {url: assetGraph.root + 'humans.txt'});
                expect(assetGraph, 'to contain asset', {url: assetGraph.root + '.htaccess'});
                expect(assetGraph, 'to contain asset', {url: assetGraph.root + 'favicon.ico'});
                expect(assetGraph, 'to contain asset', {url: assetGraph.root + 'static/favicon.copy.9f0922f8d9.ico'});
                expect(assetGraph.findAssets({type: 'Html'})[0].text, 'to equal', '<!DOCTYPE html><html><head><link rel=author href=humans.txt type=text/plain><link rel=icon href=static/favicon.copy.9f0922f8d9.ico type=image/x-icon></head><body>Here\'s my <a href=.htaccess>.htaccess file</a>, grab it if you can! If you\'re a robot, please refer to <a href=robots.txt>robots.txt</a>.</body></html>');
            })
            .run(done);
    });

    it('should move a favicon.ico file not located at the root to /static/', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/faviconOutsideRoot/'})
            .loadAssets(['index.html'])
            .populate()
            .buildProduction({version: false})
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain asset', {url: assetGraph.root + 'static/favicon.9f0922f8d9.ico'});
                expect(assetGraph.findAssets({type: 'Html'})[0].text, 'to equal', '<!DOCTYPE html><html><head><link rel="shortcut icon" type=image/vnd.microsoft.icon href=static/favicon.9f0922f8d9.ico></head><body></body></html>');
            })
            .run(done);
    });

    it('should keep favicon.ico at its original location when file revision is disabled', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/faviconOutsideRoot/'})
            .loadAssets(['index.html'])
            .populate()
            .buildProduction({version: false, noFileRev: true})
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain asset', {url: assetGraph.root + 'foo/favicon.ico'});
                expect(assetGraph.findAssets({type: 'Html'})[0].text, 'to equal', '<!DOCTYPE html><html><head><link rel="shortcut icon" type=image/vnd.microsoft.icon href=foo/favicon.ico></head><body></body></html>');
            })
            .run(done);
    });

    it('should handle a test case with an RSS feed (#118)', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/rss/', canonicalRoot: 'http://www.someexamplerssdomain.com/'})
            .loadAssets(['index.html'])
            .populate()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain asset', {contentType: 'application/rss+xml', type: 'Rss'});
            })
            .buildProduction({
                version: false
            })
            .queue(function (assetGraph) {
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

                expect(assetGraph.findAssets({type: 'Rss'})[0].text, 'to equal', '<?xml version="1.0" encoding="UTF-8"?><rss version="2.0">\n<channel>\n <title>RSS Title</title>\n <description>This is an example of an RSS feed</description>\n <link>index.html</link>\n <lastBuildDate>Mon, 06 Sep 2010 00:01:00 +0000 </lastBuildDate>\n <pubDate>Mon, 06 Sep 2009 16:20:00 +0000 </pubDate>\n <ttl>1800</ttl>\n <item>\n  <title>Example entry</title>\n  <description>Here is some text containing an interesting description and an image: &lt;img src=http://www.someexamplerssdomain.com/static/foo.d65dd5318f.png>.</description>\n  <link>http://www.wikipedia.org/</link>\n  <guid>unique string per item</guid>\n  <pubDate>Mon, 06 Sep 2009 16:20:00 +0000 </pubDate>\n </item>\n</channel>\n</rss>');
            })
            .run(done);
    });

    it('should keep identical inline styles in svg files inlined', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/svgsWithIdenticalInlineStyle/'})
            .loadAssets(['*.svg'])
            .populate()
            .buildProduction({version: false})
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain assets', 'Svg', 2);
                expect(assetGraph, 'to contain no assets', {type: 'Css', isInline: false});
            })
            .run(done);
    });

    it('should not rename Html assets that are linked to with HtmlAnchor relations', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/nonInitialAssetWithIncomingHtmlAnchor/'})
            .loadAssets(['index.html'])
            .populate()
            .buildProduction({version: false})
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain asset', {fileName: 'index.html'});
                expect(assetGraph, 'to contain asset', {fileName: 'index2.html'});
            })
            .run(done);
    });

    it('should only remove empty scripts and stylesheets without extra attributes', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/emptyScriptsAndStylesheetsWithAttributes/'})
            .loadAssets(['index.html'])
            .populate()
            .buildProduction({version: false})
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain relations', 'HtmlStyle', 2);
                var htmlStyles = assetGraph.findRelations({type: 'HtmlStyle'});
                expect(htmlStyles[0].node.outerHTML, 'to equal', '<style type="text/css" foo="bar"></style>');
                expect(htmlStyles[1].node.outerHTML, 'to equal', '<style type="text/css" media="screen" foo="bar"></style>');

                expect(assetGraph, 'to contain relations', 'HtmlScript', 1);
                var htmlScripts = assetGraph.findRelations({type: 'HtmlScript'});
                expect(htmlScripts[0].node.outerHTML, 'to equal', '<script foo="bar"></script>');
            })
            .run(done);
    });

    // This test is skipped, because it demonstrates a weakness in the
    // requireJs configuration resolving in AssetGraph. We have looked
    // into it, but couldn't find a way to make this pass without
    // breaking other tests.
    it.skip('should handle implicitly defined baseUrl for requireJs', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/implicitBaseUrl/'})
            .on('warn', function (err) {
                (this._emittedWarnings = this._emittedWarnings || []).push(err);
            })
            .loadAssets(['index.html'])
            .populate()
            .buildProduction({version: false})
            .queue(function (assetGraph) {
                expect(assetGraph._emittedWarnings, 'to be undefined');
            })
            .run(done);
    });

    // FIXME: This one fails half the time on Travis
    it.skip('should handle images with wrong extensions', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/imagesWithWrongExtensions/'})
            .on('warn', function (err) {
                (this._emittedWarnings = this._emittedWarnings || []).push(err);
            })
            .loadAssets(['index.html'])
            .populate()
            .buildProduction({version: false, optimizeImages: true})
            .queue(function (assetGraph) {
                expect(assetGraph._emittedWarnings, 'to be an array whose items satisfy', 'to be an', Error);
                expect(assetGraph._emittedWarnings, 'to have length', 2);
                assetGraph._emittedWarnings.sort(function (a, b) {
                    return a.message < b.message ? -1 : (a.message > b.message ? 1 : 0);
                });
                expect(
                    assetGraph._emittedWarnings[0].message,
                    'to contain',
                    'testdata/transforms/buildProduction/imagesWithWrongExtensions/actuallyAJpeg.png: Error executing pngcrush -rem alla'
                );
                expect(
                    assetGraph._emittedWarnings[1].message,
                    'to contain',
                    'testdata/transforms/buildProduction/imagesWithWrongExtensions/actuallyAPng.jpg: Error executing /usr/bin/jpegtran -optimize: JpegTran: The stdout stream ended without emitting any data'
                );
                expect(assetGraph, 'to contain relation', 'HtmlStyle');
            })
            .run(done);
    });

    it('should not lose the type of an image that has been run through inkscape (regression test for an issue in express-processimage 1.0.0)', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/inkscape/'})
            .loadAssets('index.html')
            .populate()
            .buildProduction({version: false, optimizeImages: true, browsers: 'ie > 9', inlineByRelationType: {CssImage: 8192}})
            .queue(function (assetGraph) {
                var cssAsset = assetGraph.findAssets({type: 'Css'})[0];
                expect(cssAsset.text, 'not to contain', 'image/undefined');
                expect(cssAsset.text, 'not to match', /url\(image\.[a-f0-9]{10}\)/);
            })
            .run(done);
    });

    it('should not remove a data-bind attribute', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/missingDataBind/'})
            .loadAssets('index.html')
            .populate()
            .buildProduction({version: false, browsers: 'ie > 9'})
            .queue(function (assetGraph) {
                var htmlAsset = assetGraph.findAssets({type: 'Html'})[0];
                expect(htmlAsset.text, 'to contain', 'data-bind="template:{name:\'application\',\'if\':isInitialized');
            })
            .run(done);
    });

    it('should support a standalone svgfilter', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/svgFilter/'})
            .loadAssets('index.html')
            .populate()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain asset', 'Svg', 1);
            })
            .buildProduction()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain asset', 'Svg', 1);
                expect(assetGraph.findAssets({type: 'Svg'})[0].text, 'when parsed as XML', 'queried for', 'path', 'to satisfy', [
                    {
                        attributes: {
                            stroke: expect.it('to be colored', 'red')
                        }
                    }
                ]);
            })
            .run(done);
    });

    it('should support an inline SVG island inside an HTML asset', function () {
        return new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/HtmlSvgIsland/'})
            .loadAssets('index.html')
            .populate()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain asset', 'Html');
                expect(assetGraph, 'to contain assets', 'Svg', 2);
            })
            .buildProduction()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain assets', 'Svg', 2);
                expect(assetGraph.findAssets({type: 'Html'})[0].text, 'to match', /xlink:href=static\/gaussianBlur\.[0-9a-f]{10}\.svg/);
            });
    });

    it('should read in location data from existing source maps and produce source maps for bundles', function () {
        return new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/sourceMaps/'})
            .loadAssets('index.html')
            .populate()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain asset', 'Html');
            })
            .buildProduction({ sourceMaps: true, noCompress: true })
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain assets', 'SourceMap', 2);
                var sourceMaps = assetGraph.findAssets({ type: 'SourceMap' });
                expect(sourceMaps[0].parseTree.sources, 'to equal', [ '/jquery-1.10.1.js', '/a.js' ]);
                expect(sourceMaps[1].parseTree.sources, 'to equal', [ '/b.js', '/c.js' ]);
            });
    });

    it('should read in location data from existing source maps and produce source maps for bundles, without noCompress switch', function () {
        return new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/sourceMaps/'})
            .loadAssets('index.html')
            .populate()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain asset', 'Html');
            })
            .buildProduction({ sourceMaps: true })
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain assets', 'SourceMap', 2);
                var sourceMaps = assetGraph.findAssets({ type: 'SourceMap' });
                expect(sourceMaps[0].parseTree.sources, 'to equal', [ '/jquery-1.10.1.js', '/a.js' ]);
                expect(sourceMaps[1].parseTree.sources, 'to equal', [ '/b.js', '/c.js' ]);
            });
    });

    describe('JavaScript serialization options', function () {
        it('should honor indent_level', function (done) {
            new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/javaScriptSerializationOptions/'})
                .loadAssets('script.js')
                .populate()
                .buildProduction({
                    noCompress: true,
                    pretty: true,
                    javaScriptSerializationOptions: { indent_level: 1 }
                })
                .queue(function (assetGraph) {
                    expect(assetGraph.findAssets({type: 'JavaScript'})[0].text, 'to equal', 'function foo() {\n alert(\'☺\');\n};');
                })
                .run(done);
        });

        it('should honor ascii_only', function (done) {
            new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/javaScriptSerializationOptions/'})
                .loadAssets('script.js')
                .populate()
                .buildProduction({
                    noCompress: true,
                    pretty: true,
                    javaScriptSerializationOptions: { ascii_only: true }
                })
                .queue(function (assetGraph) {
                    expect(assetGraph.findAssets({type: 'JavaScript'})[0].text, 'to equal', 'function foo() {\n    alert(\'\\u263A\');\n};');
                })
                .run(done);
        });
    });

    it('should preserve source maps when autoprefixer is enabled', function () {
        return new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/existingExternalSourceMap'})
            .loadAssets('index.html')
            .populate()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain asset', 'Css');
                expect(assetGraph, 'to contain asset', 'SourceMap');
            })
            .buildProduction({
                browsers: 'last 2 versions, ie > 8, ff > 28',
                sourceMaps: true,
                inlineByRelationType: { HtmlStyle: false }
            })
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain asset', 'Css');
                expect(assetGraph.findAssets({ type: 'Css' })[0].text, 'to contain', 'sourceMappingURL=/static/foo.css.8f6b70eaf4.map');
                expect(assetGraph, 'to contain asset', 'SourceMap');
                expect(assetGraph.findAssets({ type: 'SourceMap' })[0].parseTree.sources, 'to contain', '/foo.less');
            });
    });

    it('should provide an external source map for an inline JavaScript asset', function () {
        return new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/addSourceMapToInlineJavaScript'})
            .loadAssets('index.html')
            .populate()
            .buildProduction({ sourceMaps: true })
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain asset', 'JavaScript');
                expect(assetGraph.findAssets({ type: 'JavaScript' })[0].text, 'to contain', '//# sourceMappingURL=/static/');
                expect(assetGraph, 'to contain asset', 'SourceMap');
                expect(assetGraph.findAssets({ type: 'SourceMap' })[0].parseTree.sources, 'to contain', '/index.html');
            });
    });

    it('should read the existing inline source maps correctly from the output of Fusile', function () {
        return new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/sourceMaps/fusile-output'})
            .loadAssets('index.html')
            .populate()
            .buildProduction({ sourceMaps: true })
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain asset', 'JavaScript');
                expect(assetGraph.findAssets({ type: 'JavaScript' })[0].text, 'to contain', '//# sourceMappingURL=/static/');
                expect(assetGraph, 'to contain assets', 'SourceMap', 2);
                expect(assetGraph.findRelations({ type: 'CssSourceMappingUrl' })[0].to.parseTree.sources, 'to contain', '/home/munter/assetgraph/builder/demoapp/main.scss');
                expect(assetGraph.findRelations({ type: 'JavaScriptSourceMappingUrl' })[0].to.parseTree.sources, 'to contain', '/home/munter/assetgraph/builder/demoapp/main.jsx');
            });
    });

    it('should bundle importScripts(...) calls in a web worker', function () {
        return new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/webWorker'})
            .loadAssets('index.html')
            .populate()
            .buildProduction()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain assets', 'JavaScript', 3);
                expect(assetGraph, 'to contain asset', {fileName: 'worker.js'});
                expect(assetGraph.findAssets({fileName: 'worker.js'})[0].text, 'to match', /^importScripts\('static\/bundle-[\w.]+\.js'\);$/);
            });
    });

    describe('with contentSecurityPolicy=true', function () {
        describe('with an existing policy', function () {
            it('should add image-src data: to an existing CSP when an image has been inlined', function () {
                return new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/contentSecurityPolicy/existingPolicy/'})
                    .loadAssets('index.html')
                    .populate()
                    .buildProduction({
                        contentSecurityPolicy: true,
                        inlineByRelationType: {CssImage: true},
                        // Prevent a non-inlined copy to be preserved in a stylesheet referenced from a conditional comment:
                        browsers: [ 'ie > 9' ]
                    })
                    .queue(function (assetGraph) {
                        expect(assetGraph, 'to contain asset', {type: 'Png', isInline: true});
                        expect(assetGraph.findAssets({type: 'ContentSecurityPolicy'})[0].parseTree, 'to satisfy', {
                            imgSrc: ['data:']
                        });
                    });
            });

            describe('when Safari 8 and 9 support is required', function () {
                it('should whitelist the whole origin of external scripts and stylesheets', function () {
                    return new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/contentSecurityPolicy/existingPolicy/'})
                        .loadAssets('index.html')
                        .populate()
                        .buildProduction({
                            browsers: 'Safari >= 8',
                            contentSecurityPolicy: true,
                            cdnRoot: '//my.cdn.com/',
                            inlineByRelationType: {}
                        })
                        .queue(function (assetGraph) {
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

            describe('when Safari 8 and 9 support is not required', function () {
                it('should include the full path when whitelisting external scripts and stylesheets', function () {
                    return new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/contentSecurityPolicy/existingPolicy/'})
                        .loadAssets('index.html')
                        .populate()
                        .buildProduction({
                            browsers: 'Safari >= 10',
                            contentSecurityPolicy: true,
                            cdnRoot: '//my.cdn.com/',
                            inlineByRelationType: {}
                        })
                        .queue(function (assetGraph) {
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
            });

            describe('along with a cdnRoot', function () {
                describe('given as a protocol-relative url', function () {
                    it('should add the CDN host name to the relevant sections without any scheme', function () {
                        return new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/contentSecurityPolicy/existingPolicy/'})
                            .loadAssets('index.html')
                            .populate()
                            .buildProduction({contentSecurityPolicy: true, cdnRoot: '//my.cdn.com/', inlineByRelationType: {}})
                            .queue(function (assetGraph) {
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

                describe('given as an absolute url', function () {
                    it('should add the CDN host name and scheme to the relevant section', function () {
                        return new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/contentSecurityPolicy/existingPolicy/'})
                            .loadAssets('index.html')
                            .populate()
                            .buildProduction({contentSecurityPolicy: true, cdnRoot: 'https://my.cdn.com/', inlineByRelationType: {}})
                            .queue(function (assetGraph) {
                                expect(assetGraph.findAssets({type: 'ContentSecurityPolicy'}), 'to satisfy', [
                                    {
                                        parseTree: expect.it('to equal', {
                                            styleSrc: ['\'self\'', 'https://my.cdn.com'],
                                            scriptSrc: ['\'self\'', 'https://my.cdn.com'],
                                            imgSrc: ['https://my.cdn.com']
                                        })
                                    }
                                ]);
                            });
                    });
                });
            });
        });
    });

    describe('with subResourceIntegrity=true', function () {
        it('should leave relations to other domains alone', function () {
            return new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/subResourceIntegrity/scriptsAndStylesheetOnForeignDomain/'})
                .loadAssets('index.html')
                .populate({followRelations: { to: { url: AssetGraph.query.not(/^https?:\/\//)}}})
                .buildProduction({subResourceIntegrity: true})
                .queue(function (assetGraph) {
                    expect(assetGraph.findAssets({type: 'Html'})[0].text, 'not to contain', 'integrity');
                });
        });

        it('should add integrity attributes to local relations', function () {
            return new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/subResourceIntegrity/externalScriptAndStylesheet/'})
                .loadAssets('index.html')
                .populate()
                .buildProduction({subResourceIntegrity: true, inlineByRelationType: {}})
                .queue(function (assetGraph) {
                    expect(assetGraph.findAssets({type: 'Html'})[0].text, 'to contain',
                        'integrity="sha256-',
                        'integrity="sha256-');
                });
        });

        it('should add integrity attributes to assets that are put on a CDN', function () {
            return new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/subResourceIntegrity/externalScriptAndStylesheet/'})
                .loadAssets('index.html')
                .populate()
                .buildProduction({subResourceIntegrity: true, cdnRoot: '//my.cdn.com/', inlineByRelationType: {}})
                .queue(function (assetGraph) {
                    expect(assetGraph.findAssets({type: 'Html'})[0].text, 'to contain',
                        'integrity="sha256-',
                        'integrity="sha256-');
                });
        });

        it('should use suitable serialization options after processing a data-bind attribute', function () {
            return new AssetGraph()
                .loadAssets({
                    type: 'Html',
                    url: 'http://example.com/foo.html',
                    text: '<!DOCTYPE html><html><body><div data-bind="click: function () {console.log(\'click\')}"></div></body></html>'
                })
                .buildProduction({localeIds: ['en_us'], noCompress: false, stripDebug: true})
                .queue(function (assetGraph) {
                    expect(assetGraph.findAssets({type: 'Html'})[0].text, 'to contain', 'data-bind=click:function(){;}');
                });
        });
    });

    describe('with a #{locale} conditional', function () {
        describe('without a value provided up front', function () {
            it('should attach the correct locale bundles to the pages in the cloneForEachConditionValue step', function () {
                return new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/systemJsConditionals/locale/'})
                    .loadAssets('index.html')
                    .populate()
                    .buildProduction({
                        conditions: { locale: ['en_us', 'da'] },
                        splitConditions: ['locale'],
                        inlineByRelationType: {'*': true}
                    })
                    .queue(function (assetGraph) {
                        expect(assetGraph.findAssets({fileName: 'index.da.html'})[0].text, 'to contain', 'Danish')
                            .and('not to contain', 'needed in American English');
                        expect(assetGraph.findAssets({fileName: 'index.en_us.html'})[0].text, 'to contain', 'needed in American English')
                            .and('not to contain', 'Danish');
                    });
            });
        });

        it('should pick up a non-CSS conditional asset from the asset list', function () {
            return new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/systemJsConditionals/conditionalTemplate/'})
                .loadAssets('index.html')
                .populate()
                .buildProduction({
                    splitConditions: ['weather.js']
                })
                .queue(function (assetGraph) {
                    expect(assetGraph.findAssets({fileName: 'index.sunny.html'})[0].text, 'to contain', '<script type=text/html id=foo-sunny')
                        .and('not to contain', 'rainy');
                    expect(assetGraph.findAssets({fileName: 'index.rainy.html'})[0].text, 'to contain', '<script type=text/html id=foo-rainy')
                        .and('not to contain', 'sunny');
                });
        });
    });

    describe('with a #{locale.js} conditional', function () {
        describe('without a value provided up front', function () {
            it('should attach the correct locale bundles to the pages in the cloneForEachConditionValue step', function () {
                return new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/systemJsConditionals/localeJs/'})
                    .loadAssets('index.html')
                    .populate()
                    .buildProduction({
                        conditions: { locale: ['en_us', 'da'] },
                        splitConditions: ['locale'],
                        inlineByRelationType: {'*': true}
                    })
                    .queue(function (assetGraph) {
                        expect(assetGraph.findAssets({fileName: 'index.da.html'})[0].text, 'to contain', 'Danish')
                            .and('not to contain', 'needed in American English');
                        expect(assetGraph.findAssets({fileName: 'index.en_us.html'})[0].text, 'to contain', 'needed in American English')
                            .and('not to contain', 'Danish');
                    });
            });
        });

        describe('pointing at a stylesheet', function () {
            it('should attach the correct stylesheet to the pages in the cloneForEachConditionValue step', function () {
                return new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/systemJsConditionals/stylesheet/'})
                    .loadAssets('index.html')
                    .populate()
                    .buildProduction({
                        conditions: { locale: ['en_us', 'da'] },
                        splitConditions: ['locale'],
                        inlineByRelationType: {'*': true}
                    })
                    .queue(function (assetGraph) {
                        expect(assetGraph.findAssets({fileName: 'index.da.html'})[0].text, 'to contain', '<style>body{color:#fff;background-color:red}</style>')
                            .and('not to contain', '<style>body{color:#fff;background-color:blue}</style>');
                        expect(assetGraph.findAssets({fileName: 'index.en_us.html'})[0].text, 'to contain', '<style>body{color:#fff;background-color:blue}</style>')
                            .and('not to contain', '<style>body{color:#fff;background-color:red}</style>');
                    });
            });
        });
    });

    describe('with a JavaScript service worker registration', function () {
        it('should keep the service worker unbundled', function () {
            return new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/serviceWorker/'})
                .loadAssets('javascriptregistration.html')
                .populate()
                .buildProduction()
                .queue(function (assetGraph) {
                    expect(assetGraph, 'to contain assets', 'JavaScript', 2);
                });
        });

        it('should keep the service worker file name', function () {
            return new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/serviceWorker/'})
                .loadAssets('javascriptregistration.html')
                .populate()
                .buildProduction()
                .queue(function (assetGraph) {
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
    });

    describe('with a Html service worker registration', function () {
        it('should keep the service worker unbundled', function () {
            return new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/serviceWorker/'})
                .loadAssets('htmlregistration.html')
                .populate()
                .buildProduction()
                .queue(function (assetGraph) {
                    expect(assetGraph, 'to contain assets', 'JavaScript', 2);
                });
        });

        it('should keep the service worker unbundled', function () {
            return new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/serviceWorker/'})
                .loadAssets('htmlregistration.html')
                .populate()
                .buildProduction()
                .queue(function (assetGraph) {
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
    });

    it('should keep everything before the (last) extension when moving to the static folder', function () {
        return new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/fileNamesWithDots/'})
            .loadAssets('index.html')
            .populate()
            .buildProduction({
                inlineByRelationType: {'*': false}
            })
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain asset', {fileName: /^script\.with\.dots\.[a-f0-9]+\.js$/})
                    .and('to contain asset', {fileName: /^style\.sheet\.with\.dots\.[a-f0-9]+\.css$/});
            });
    });

    it('should add a .css extension to transpiled assets', function () {
        return new AssetGraph({root: __dirname  })
            .loadAssets(new AssetGraph.Html({
                url: 'file://' + __dirname + '/index.html',
                text:
                    '<!DOCTYPE html>' +
                    '<html><head>' +
                    '<link rel="stylesheet" nobundle href="styles.less">' +
                    '<link rel="stylesheet" nobundle href="styles.scss?qs">' +
                    '<link rel="stylesheet" nobundle href="styles.stylus">' +
                    '</head></body></html>'
            }), new AssetGraph.Css({
                url: 'file://' + __dirname + '/styles.less',
                text: 'body { color: red; }'
            }), new AssetGraph.Css({
                url: 'file://' + __dirname + '/styles.scss?qs',
                text: 'body { color: blue; }'
            }), new AssetGraph.Css({
                url: 'file://' + __dirname + '/styles.stylus',
                text: 'body { color: green; }'
            }))
            .populate()
            .buildProduction({
                inlineByRelationType: {'*': false}
            })
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain asset', {fileName: 'styles.less.css'})
                    .and('to contain asset', {fileName: 'styles.scss.css', url: /\?qs$/})
                    .and('to contain asset', {fileName: 'styles.stylus.css'});
            });
    });

    it('should not issue absolute file:// urls when pointing back into assetGraph.root from assets put on a CDN', function () {
        return new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/systemJsAssetPlugin/'})
            .loadAssets('index.html')
            .populate()
            .buildProduction({
                inlineByRelationType: {'*': false},
                cdnRoot: '//example.com/'
            })
            .queue(function (assetGraph) {
                expect(assetGraph.findAssets({type: 'JavaScript'})[0].text, 'not to contain', assetGraph.root);
            });

    });

    it('should not leave extraneous whitespace in an inline JavaScript', function () {
        return new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/trailingWhitespaceInInlineScript/'})
            .loadAssets('index.html')
            .populate()
            .buildProduction({
                sourceMaps: true,
                contentSecurityPolicy: true,
                subResourceIntegrity: true
            })
            .queue(function (assetGraph) {
                expect(assetGraph.findAssets({type: 'Html'})[0].text, 'not to match', / <\/script>/);
            });
    });

    it('should not leave extraneous whitespace in an inline JavaScript when the "newline" JavaScript serialization option is passed', function () {
        return new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/trailingWhitespaceInInlineScript/'})
            .loadAssets('index.html')
            .populate({
                followRelations: {crossorigin: false}
            })
            .buildProduction({ version: undefined,
                sourceMaps: true,
                contentSecurityPolicy: true,
                gzip: false,
                javaScriptSerializationOptions: { newline: '\n' }
            })
            .queue(function (assetGraph) {
                expect(assetGraph.findAssets({type: 'Html'})[0].text, 'not to match', / <\/script>/);
            });
    });

    describe('options.excludePatterns', function () {
        it('should not exclude any asset when no pattern is defined', function () {
            return new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/excludePattern/'})
                .loadAssets('index.html')
                .buildProduction({
                    inlineByRelationType: {},
                    noFileRev: true
                })
                .queue(function (assetGraph) {
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

        it('should exclude all files with .css extensions', function () {
            return new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/excludePattern/'})
                .loadAssets('index.html')
                .buildProduction({
                    inlineByRelationType: {},
                    noFileRev: true,
                    excludePatterns: ['*.css']
                })
                .queue(function (assetGraph) {
                    expect(assetGraph.findAssets(), 'to satisfy', [
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
        });

        it('should exclude all files within /foo/ directory', function () {
            return new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/excludePattern/'})
                .loadAssets('index.html')
                .buildProduction({
                    inlineByRelationType: {},
                    noFileRev: true,
                    excludePatterns: ['testdata/transforms/buildProduction/excludePattern/foo/']
                })
                .queue(function (assetGraph) {
                    expect(assetGraph.findAssets(), 'to satisfy', [
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
        });

        it('should exclude all non-initial assets', function () {
            return new AssetGraph({root: __dirname + '/../../testdata/transforms/buildProduction/excludePattern/'})
                .loadAssets('index.html')
                .buildProduction({
                    inlineByRelationType: {},
                    noFileRev: true,
                    excludePatterns: [
                        '*bar.css',
                        'testdata/transforms/buildProduction/excludePattern/baz',
                        '*/js/'
                    ]
                })
                .queue(function (assetGraph) {
                    expect(assetGraph.findAssets(), 'to satisfy', [
                        {
                            type: 'Html',
                            fileName: 'index.html'
                        }
                    ]);
                });
        });
    });
});
