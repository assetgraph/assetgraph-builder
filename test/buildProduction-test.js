var vows = require('vows'),
    assert = require('assert'),
    Stream = require('stream'),
    gm = require('gm'),
    AssetGraph = require('../lib/AssetGraph');

vows.describe('buildProduction').addBatch({
    'After loading test case and running the buildProduction transform': {
        topic: function () {
            new AssetGraph({root: __dirname + '/buildProduction/simple/'})
                .on('error', this.callback)
                .registerRequireJsConfig()
                .loadAssets('index.html')
                .buildProduction({
                    quiet: true,
                    version: "The version number",
                    less: true,
                    optimizePngs: true, // Test it
                    inlineSize: true, // Test it
                    mangleTopLevel: false, // Test it
                    localeIds: ['da', 'en'],
                    localeCookieName: 'myLocaleCookie', // Test it
                    defaultLocaleId: 'da', // Test it
                    manifest: true, // Test it
                    negotiateManifest: true, // Test it
                    asyncScripts: true, // Test it
                    deferScripts: true, // Test it
                    cdnRoot: 'http://cdn.example.com/foo/',
                    noCompress: false // Test it
                })
                .run(this.callback);
        },
        'the graph should contain 2 Html assets': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Html'}).length, 2);
        },
        'the graph should an index.da.html with the correct lang attribute on the html element and the right title': function (assetGraph) {
            var htmlAssets = assetGraph.findAssets({type: 'Html', url: /\/index\.da\.html$/});
            assert.equal(htmlAssets.length, 1);
            var htmlAsset = htmlAssets[0];
            assert.equal(htmlAsset.parseTree.documentElement.getAttribute('lang'), 'da');
            assert.equal(htmlAsset.parseTree.title, 'Den danske titel');
        },
        'the graph should an index.en.html with the correct lang attribute on the html element and the right title': function (assetGraph) {
            var htmlAssets = assetGraph.findAssets({type: 'Html', url: /\/index\.en\.html$/});
            assert.equal(htmlAssets.length, 1);
            var htmlAsset = htmlAssets[0];
            assert.equal(htmlAsset.parseTree.documentElement.getAttribute('lang'), 'en');
            assert.equal(htmlAsset.parseTree.title, 'The English title');
        },
        'the Html assets should contain the correct Content-Version meta tags': function (assetGraph) {
            assetGraph.findAssets({type: 'Html'}).forEach(function (htmlAsset) {
                assert.equal(htmlAsset.parseTree.querySelectorAll('meta[http-equiv="Content-Version"][content="The version number"]').length, 1);
            });
        },
        'the English Html asset should have 2 outgoing HtmlScript relations': function (assetGraph) {
            assert.equal(assetGraph.findRelations({type: 'HtmlScript', from: {url: /\/index\.en\.html$/}}).length, 2);
        },
        'the English Html asset should have the expected contents': function (assetGraph) {
            assert.equal(assetGraph.findAssets({url: /\/index\.en\.html$/})[0].text,
                         '<!DOCTYPE html>\n<html lang="en" manifest="index.appcache"><head><title>The English title</title><style type="text/css">body{color:teal;color:maroon}</style><style type="text/css">body{color:tan}</style><style type="text/css">body div{width:100px}</style><meta http-equiv="Content-Version" content="The version number" /></head><body><script src="http://cdn.example.com/foo/5503882c3f.js" data-main="http://cdn.example.com/foo/56082cbc37" async="async" defer="defer"></script><script>alert("script3")</script></body></html>');
        },
        'the Danish Html asset should have the expected contents': function (assetGraph) {
            assert.equal(assetGraph.findAssets({url: /\/index\.da\.html$/})[0].text,
                         '<!DOCTYPE html>\n<html lang="da" manifest="index.appcache"><head><title>Den danske titel</title><style type="text/css">body{color:teal;color:maroon}</style><style type="text/css">body{color:tan}</style><style type="text/css">body div{width:100px}</style><meta http-equiv="Content-Version" content="The version number" /></head><body><script src="http://cdn.example.com/foo/5503882c3f.js" data-main="http://cdn.example.com/foo/271b906b9b" async="async" defer="defer"></script><script>alert("script3")</script></body></html>');
        },
        'the English Html data-main js should have the expected contents': function (assetGraph) {
            assert.equal(assetGraph.findRelations({type: 'HtmlRequireJsMain', from: {url: /\/index\.en\.html$/}})[0].to.text, 'alert("something else"),alert("shimmed"),define("amdDependency",function(){console.warn("here I AM(D)")}),define("view/template.ko",ko.externalTemplateEngine.templates.template=\'<a href="/index.html">The English link text</a><img src="http://cdn.example.com/foo/3fb51b1ae1.gif" />\'),require.config({shim:{shimmed:["somethingElse"]}}),require(["amdDependency","view/template.ko"],function(e){alert("Hello!")})');
        },
        'the Danish Html data-main js should have the expected contents': function (assetGraph) {
            assert.equal(assetGraph.findRelations({type: 'HtmlRequireJsMain', from: {url: /\/index\.da\.html$/}})[0].to.text, 'alert("something else"),alert("shimmed"),define("amdDependency",function(){console.warn("here I AM(D)")}),define("view/template.ko",ko.externalTemplateEngine.templates.template=\'<a href="/index.html">Den danske linktekst</a><img src="http://cdn.example.com/foo/3fb51b1ae1.gif" />\'),require.config({shim:{shimmed:["somethingElse"]}}),require(["amdDependency","view/template.ko"],function(e){alert("Hej!")})');
        },
        'someTextFile.txt should be found at /static/c7429a1035.txt (not on the CDN)': function (assetGraph) {
            assert.equal(assetGraph.findAssets({url: /\/static\/c7429a1035\.txt$/}).length, 1);
        },
        'myImage.gif should be put on the CDN and have 4 incoming relations': function (assetGraph) {
            var queryObj = {url: 'http://cdn.example.com/foo/3fb51b1ae1.gif'};
            assert.equal(assetGraph.findAssets(queryObj).length, 1);
            assert.equal(assetGraph.findRelations({to: queryObj}).length, 4);
        },
        'each Html asset should have an HtmlCacheManifest relation and the cache manifest should have the expected contents': function (assetGraph) {
            assetGraph.findAssets({type: 'Html'}).forEach(function (htmlAsset) {
                var htmlCacheManifestRelations = assetGraph.findRelations({from: htmlAsset, type: 'HtmlCacheManifest'});
                assert.equal(htmlCacheManifestRelations.length, 1);
                var cacheManifest = htmlCacheManifestRelations[0].to;
                assert.equal(assetGraph.findRelations({from: cacheManifest}).length, 4);
                var lines = cacheManifest.text.split('\n');
                lines[1] = lines[1].replace(/ @.*$/, ''); // Remove md5 sum
                assert.deepEqual(lines, [
                    'CACHE MANIFEST',
                    '# ' + htmlCacheManifestRelations[0].from.fileName,
                    'static/c7429a1035.txt',
                    'http://cdn.example.com/foo/5503882c3f.js',
                    'http://cdn.example.com/foo/3fb51b1ae1.gif',
                    htmlAsset.fileName === 'index.da.html' ?
                        'http://cdn.example.com/foo/271b906b9b.js' :
                        'http://cdn.example.com/foo/56082cbc37.js',
                    'NETWORK:',
                    '*',
                    ''
                ]);
            });
        }
    },
    'After loading a test case with two stylesheets that @import the same stylesheet, then running the buildProduction transform (assetgraph issue #82)': {
        topic: function () {
            new AssetGraph({root: __dirname + '/buildProduction/duplicateImports/'})
                .registerRequireJsConfig()
                .loadAssets('index.html')
                .buildProduction()
                .run(this.callback);
        },
        'the rules from the @imported stylesheet should only be included once': function (assetGraph) {
            assert.equal(assetGraph.findRelations({type: 'HtmlStyle'})[0].to.text, 'body{color:white}');
        }
    },
    'After loading a test case with 3 in-browser less compilers, then running the buildProduction transform': {
        topic: function () {
            new AssetGraph({root: __dirname + '/buildProduction/lessCompiler/'})
                .registerRequireJsConfig()
                .loadAssets('index.html')
                .buildProduction({
                    less: true
                })
                .run(this.callback);
        },
        'there should be no relations': function (assetGraph) {
            assert.equal(assetGraph.findRelations({}, true).length, 0);
        }
    },
    'After loading a test case with a GETSTATICURL then running the buildProduction transform': {
        topic: function () {
            new AssetGraph({root: __dirname + '/buildProduction/JavaScriptGetStaticUrlWithProcessedImages/'})
                .registerRequireJsConfig()
                .loadAssets('index.html')
                .buildProduction({
                    less: true
                })
                .run(this.callback);
        },
        'the graph should contain 2 Png images': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Png'}).length, 2);
        },
        'none of the Png assets should contain a gAMA chunk': function (assetGraph) {
            assetGraph.findAssets({type: 'Png'}).forEach(function (pngAsset) {
                assert.equal(pngAsset.rawSrc.toString('ascii').indexOf('gAMA'), -1);
            });
        }
    },
    'After loading a test case that uses both processImage instructions for both sprited images and the sprite itself': {
        topic: function () {
            new AssetGraph({root: __dirname + '/buildProduction/spriteAndProcessImages/'})
                .registerRequireJsConfig()
                .loadAssets('index.html')
                .buildProduction({
                    less: true
                })
                .run(this.callback);
        },
        'the graph should contain no Png images': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Png'}).length, 0);
        },
        'the graph should contain one image, and it should have type=Gif': function (assetGraph) {
            var imageAssets = assetGraph.findAssets({isImage: true});
            assert.equal(imageAssets.length, 1);
            assert.equal(imageAssets[0].type, 'Gif');
        },
        'then get the metadata for the Gif': {
            topic: function (assetGraph) {
                var gifAssets = assetGraph.findAssets({isImage: true});
                assert.equal(gifAssets.length, 1);
                var readStream = new Stream();
                readStream.readable = true;
                gm(readStream)
                    .identify(this.callback);
                process.nextTick(function () {
                    readStream.emit('data', assetGraph.findAssets({type: 'Gif'})[0].rawSrc);
                    readStream.emit('end');
                });
            },
            'it should be a 10x10 GIF': function (metadata) {
                assert.matches(metadata.Format, /^GIF/i);
                assert.equal(metadata.Geometry, '10x10');
            }
        }
    },
    'After loading a test case with Angular.js templates': {
        topic: function () {
            new AssetGraph({root: __dirname + '/buildProduction/angularJs/'})
                .registerRequireJsConfig()
                .loadAssets('index.html')
                .populate()
                .run(this.callback);
        },
        'the graph should contain 1 Html asset': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Html'}).length, 1);
        },
        'the graph should contain 2 JavaScript assets': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'JavaScript'}).length, 2);
        },
        'the graph should contain 4 JavaScriptAngularJsTemplate relations': function (assetGraph) {
            assert.equal(assetGraph.findRelations({type: 'JavaScriptAngularJsTemplate'}).length, 4);
        },
        'the graph should contain 7 AngularJsTemplate assets': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'AngularJsTemplate'}).length, 7);
        },
        'the graph should have an inline AngularJsTemplate with <img src="foo.png"> in its text': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'AngularJsTemplate', isInline: true, text: /<img src="foo.png">/}).length, 1);
        },
        'the graph should contain 2 JavaScriptAngularJsTemplateCacheAssignment relations': function (assetGraph) {
            assert.equal(assetGraph.findRelations({type: 'JavaScriptAngularJsTemplateCacheAssignment'}).length, 2);
        },
        'the graph should have an inline AngularJsTemplate with <h1>4: Template injected directly into <code>$templateCache</code></h1> in its text': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'AngularJsTemplate', isInline: true, text: "<h1>4: Template with a relation (<img src='bar.png'>) injected directly into <code>$templateCache</code></h1>"}).length, 1);
        },
        'the graph should have an inline AngularJsTemplate with <h1>5: Template injected directly into <code>$templateCache</code></h1> in its text': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'AngularJsTemplate', isInline: true, text: "<h1>5: Template with a relation (<img src='quux.png'>) injected directly into <code>$templateCache</code>, but using a different variable name</h1>"}).length, 1);
        },
        'the graph should have foo.png': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Png', url: /\/foo\.png$/}).length, 1);
        },
        'the graph should have bar.png': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Png', url: /\/bar\.png$/}).length, 1);
        },
        'the graph should have quux.png': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Png', url: /\/quux\.png$/}).length, 1);
        },
        'then run the buildProduction transform': {
            topic: function (assetGraph) {
                assetGraph.buildProduction().run(this.callback);
            },
            'the graph should contain no JavaScriptAngularJsTemplateCacheAssignment relations': function (assetGraph) {
                assert.equal(assetGraph.findRelations({type: 'JavaScriptAngularJsTemplateCacheAssignment'}).length, 0);
            },
            'the Html asset should have the expected contents': function (assetGraph) {
                assert.equal(assetGraph.findAssets({type: 'Html'})[0].text, '<!doctype html>\n<html ng-app="myApp"><head><title>My AngularJS App</title></head><body><ul class="menu"><li><a href="#/view1">view1</a></li><li><a href="#/view2">view2</a></li><li><a href="#/view3">view3</a></li><li><a href="#/view4">view4</a></li></ul><div ng-view="ng-view"></div><script src="static/e3a06b2a25.js"></script><script type="text/ng-template" id="partials/2.html"><h1>2: Template in a &lt;script type="text/ng-template"&gt;-tag</h1></script><script type="text/ng-template" id="partials/1.html"><h1>1: External template loaded asynchronously with <code>templateUrl: \'partials/1.html\'</code></h1></script><script type="text/ng-template" id="partials/4.html"><h1>4: Template with a relation (<img src="static/d65dd5318f.png" />) injected directly into <code>$templateCache</code></h1></script><script type="text/ng-template" id="partials/5.html"><h1>5: Template with a relation (<img src="static/d65dd5318f.png" />) injected directly into <code>$templateCache</code>, but using a different variable name</h1></script></body></html>');
            },
            'the graph should contain 4 HtmlInlineScriptTemplate relations': function (assetGraph) {
                assert.equal(assetGraph.findRelations({type: 'HtmlInlineScriptTemplate'}).length, 4);
            },
            'one of the HtmlInlineScriptTemplateRelations should have an id of "partials/1.html" and point at an AngularJsTemplate asset with the correct contents': function (assetGraph) {
                var relation = assetGraph.findRelations({type: 'HtmlInlineScriptTemplate', node: function (node) {return node.getAttribute('id') === 'partials/1.html';}})[0];
                assert.ok(relation);
                assert.equal(relation.to.text, '<h1>1: External template loaded asynchronously with <code>templateUrl: \'partials/1.html\'</code></h1>');
            },
            'none of the HtmlInlineScriptTemplateRelations should point at an asset with "3: Template" in its text': function (assetGraph) {
                assert.equal(assetGraph.findRelations({type: 'HtmlInlineScriptTemplate', to: {text: /3: Template/}}).length, 0);
            },
            'one of the HtmlInlineScriptTemplateRelations should have an id of "partials/2.html" and point at an AngularJsTemplate asset with the correct contents': function (assetGraph) {
                var relation = assetGraph.findRelations({type: 'HtmlInlineScriptTemplate', node: function (node) {return node.getAttribute('id') === 'partials/2.html';}})[0];
                assert.ok(relation);
                assert.equal(relation.to.text, '<h1>2: Template in a &lt;script type="text/ng-template"&gt;-tag</h1>');
            },
            'one of the HtmlInlineScriptTemplateRelations should have an id of "partials/4.html" and point at an AngularJsTemplate asset with the correct contents': function (assetGraph) {
                var relation = assetGraph.findRelations({type: 'HtmlInlineScriptTemplate', node: function (node) {return node.getAttribute('id') === 'partials/4.html';}})[0];
                assert.ok(relation);
                assert.equal(relation.to.text, '<h1>4: Template with a relation (<img src="static/d65dd5318f.png" />) injected directly into <code>$templateCache</code></h1>');
            },
            'one of the HtmlInlineScriptTemplateRelations should have an id of "partials/5.html" and point at an AngularJsTemplate asset with the correct contents': function (assetGraph) {
                var relation = assetGraph.findRelations({type: 'HtmlInlineScriptTemplate', node: function (node) {return node.getAttribute('id') === 'partials/5.html';}})[0];
                assert.ok(relation);
                assert.equal(relation.to.text, '<h1>5: Template with a relation (<img src="static/d65dd5318f.png" />) injected directly into <code>$templateCache</code>, but using a different variable name</h1>');
            }
        }
    }
})['export'](module);
