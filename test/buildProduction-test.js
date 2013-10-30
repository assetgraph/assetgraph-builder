var vows = require('vows'),
    assert = require('assert'),
    Stream = require('stream'),
    _ = require('underscore'),
    gm = require('gm'),
    vm = require('vm'),
    AssetGraph = require('../lib/AssetGraph');

vows.describe('buildProduction').addBatch({
    'After loading a simple test case and running the buildProduction transform': {
        topic: function () {
            new AssetGraph({root: __dirname + '/buildProduction/simple/'})
                .on('error', this.callback)
                .registerRequireJsConfig()
                .loadAssets('index.html')
                .buildProduction({
                    quiet: true,
                    version: "The version number",
                    less: true,
                    optimizeImages: true, // Test it
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
                    prettyPrint: false // Test it
                })
                .run(this.callback);
        },
        'the graph should contain 2 non-inline Html assets': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Html', isInline: false}).length, 2);
        },
        'the graph should contain 2 inline Html assets': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Html', isInline: true}).length, 2);
        },
        'the graph should contain an index.da.html with the correct lang attribute on the html element and the right title': function (assetGraph) {
            var htmlAssets = assetGraph.findAssets({type: 'Html', url: /\/index\.da\.html$/});
            assert.equal(htmlAssets.length, 1);
            var htmlAsset = htmlAssets[0];
            assert.equal(htmlAsset.parseTree.documentElement.getAttribute('lang'), 'da');
            assert.equal(htmlAsset.parseTree.title, 'Den danske titel');
        },
        'the graph should contain an index.en.html with the correct lang attribute on the html element and the right title': function (assetGraph) {
            var htmlAssets = assetGraph.findAssets({type: 'Html', url: /\/index\.en\.html$/});
            assert.equal(htmlAssets.length, 1);
            var htmlAsset = htmlAssets[0];
            assert.equal(htmlAsset.parseTree.documentElement.getAttribute('lang'), 'en');
            assert.equal(htmlAsset.parseTree.title, 'The English title');
        },
        'the Html assets should contain the correct data-version attribute on the <html> element': function (assetGraph) {
            assetGraph.findAssets({type: 'Html', isInline: false}).forEach(function (htmlAsset) {
                assert.equal(htmlAsset.parseTree.querySelectorAll('html[data-version="The version number"]').length, 1);
            });
        },
        'the English Html asset should have 2 outgoing HtmlScript relations': function (assetGraph) {
            assert.equal(assetGraph.findRelations({type: 'HtmlScript', from: {url: /\/index\.en\.html$/}}).length, 2);
        },
        'the English Html asset should have the expected contents': function (assetGraph) {
            assert.equal(assetGraph.findAssets({url: /\/index\.en\.html$/})[0].text,
                         '<!DOCTYPE html>\n<html data-version="The version number" lang="en" manifest="index.appcache"><head><title>The English title</title><style type="text/css">body{color:teal;color:maroon}</style><style type="text/css">body{color:tan}</style><style type="text/css">body div{width:100px}</style></head><body><script src="' + assetGraph.findRelations({type: 'HtmlScript', from: {url: /\/index\.en\.html$/}})[0].to.url + '" async="async" defer="defer"></script><script>alert("script3");</script><script type="text/html" id="template"><a href="/index.html">The English link text</a><img src="http://cdn.example.com/foo/3fb51b1ae1.gif" /></script></body></html>');
        },
        'the Danish Html asset should have the expected contents': function (assetGraph) {
            assert.equal(assetGraph.findAssets({url: /\/index\.da\.html$/})[0].text,
                         '<!DOCTYPE html>\n<html data-version="The version number" lang="da" manifest="index.appcache"><head><title>Den danske titel</title><style type="text/css">body{color:teal;color:maroon}</style><style type="text/css">body{color:tan}</style><style type="text/css">body div{width:100px}</style></head><body><script src="' + assetGraph.findRelations({type: 'HtmlScript', from: {url: /\/index\.da\.html$/}})[0].to.url + '" async="async" defer="defer"></script><script>alert("script3");</script><script type="text/html" id="template"><a href="/index.html">Den danske linktekst</a><img src="http://cdn.example.com/foo/3fb51b1ae1.gif" /></script></body></html>');
        },
        'the English JavaScript should have the expected contents': function (assetGraph) {
            var afterRequireJs = assetGraph.findRelations({type: 'HtmlScript', from: {url: /\/index\.en\.html$/}})[0].to.text.replace(/^[\s\S]*req\(cfg\)\}\}\(this\),/, '');
            assert.equal(afterRequireJs, 'alert("something else"),define("somethingElse",function(){}),alert("shimmed"),define("shimmed",function(){}),define("amdDependency",function(){console.warn("here I AM(D)")}),require.config({shim:{shimmed:["somethingElse"]}}),require(["shimmed","amdDependency"],function(){alert("Hello!")}),define("main",function(){});');
        },
        'the Danish JavaScript should have the expected contents': function (assetGraph) {
            var afterRequireJs = assetGraph.findRelations({type: 'HtmlScript', from: {url: /\/index\.da\.html$/}})[0].to.text.replace(/^[\s\S]*req\(cfg\)\}\}\(this\),/, '');
            assert.equal(afterRequireJs, 'alert("something else"),define("somethingElse",function(){}),alert("shimmed"),define("shimmed",function(){}),define("amdDependency",function(){console.warn("here I AM(D)")}),require.config({shim:{shimmed:["somethingElse"]}}),require(["shimmed","amdDependency"],function(){alert("Hej!")}),define("main",function(){});');
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
            assetGraph.findAssets({type: 'Html', isInline: false}).forEach(function (htmlAsset) {
                var htmlCacheManifestRelations = assetGraph.findRelations({from: htmlAsset, type: 'HtmlCacheManifest'});
                assert.equal(htmlCacheManifestRelations.length, 1);
                var cacheManifest = htmlCacheManifestRelations[0].to;
                assert.equal(assetGraph.findRelations({from: cacheManifest}).length, 3);
                var lines = cacheManifest.text.split('\n');
                lines[1] = lines[1].replace(/ @.*$/, ''); // Remove md5 sum
                assert.deepEqual(lines, [
                    'CACHE MANIFEST',
                    '# ' + htmlCacheManifestRelations[0].from.fileName,
                    'static/c7429a1035.txt',
                    assetGraph.findRelations({type: 'HtmlScript', from: htmlAsset})[0].to.url,
                    'http://cdn.example.com/foo/3fb51b1ae1.gif',
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
                .buildProduction({version: false})
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
                    version: false,
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
                    version: false,
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
                    version: false,
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
        'the graph should contain 8 Html assets': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Html'}).length, 8);
        },
        'the graph should contain 5 Html assets with isFragment:true': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Html', isFragment: true}).length, 5);
        },
        'the graph should contain 2 Html assets with isFragment:undefined': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Html', isFragment: undefined}).length, 2);
        },
        'the graph should contain 2 JavaScript assets': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'JavaScript'}).length, 2);
        },
        'the graph should contain 4 JavaScriptAngularJsTemplate relations': function (assetGraph) {
            assert.equal(assetGraph.findRelations({type: 'JavaScriptAngularJsTemplate'}).length, 4);
        },
        'the graph should have an inline Html asset with <img src="foo.png"> in its text': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Html', isInline: true, text: /<img src="foo.png">/}).length, 1);
        },
        'the graph should contain 2 JavaScriptAngularJsTemplateCacheAssignment relations': function (assetGraph) {
            assert.equal(assetGraph.findRelations({type: 'JavaScriptAngularJsTemplateCacheAssignment'}).length, 2);
        },
        'the graph should have an inline Html asset with <h1>4: Template injected directly into <code>$templateCache</code></h1> in its text': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Html', isInline: true, text: "<h1>4: Template with a relation (<img src='bar.png'>) injected <span data-i18n='foo'>directly</span> into <code>$templateCache</code></h1>"}).length, 1);
        },
        'the graph should have an inline Html asset with <h1>5: Template injected directly into <code>$templateCache</code></h1> in its text': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Html', isInline: true, text: "<h1>5: Template with a relation (<img src='quux.png'>) injected directly into <code>$templateCache</code>, but using a different variable name</h1>"}).length, 1);
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
                assetGraph.buildProduction({version: false}).run(this.callback);
            },
            'the graph should contain no JavaScriptAngularJsTemplateCacheAssignment relations': function (assetGraph) {
                assert.equal(assetGraph.findRelations({type: 'JavaScriptAngularJsTemplateCacheAssignment'}).length, 0);
            },
            'the Html asset should have the expected contents': function (assetGraph) {
                assert.equal(assetGraph.findAssets({type: 'Html'})[0].text.replace(/src="static\/[a-f0-9]{10}\.js"/, 'src="MD5.js"'), '<!doctype html>\n<html ng-app="myApp"><head><title>My AngularJS App</title></head><body><ul class="menu"><li><a href="#/view1">view1</a></li> <li><a href="#/view2">view2</a></li> <li><a href="#/view3">view3</a></li> <li><a href="#/view4">view4</a></li></ul><div ng-view=""></div><script src="MD5.js"></script><script type="text/ng-template" id="partials/2.html"><h1>2: Template in a &lt;script type="text/ng-template"&gt;-tag</h1></script><script type="text/ng-template" id="partials/1.html"><h1>1: External template loaded asynchronously with <code>templateUrl: \'partials/1.html\'</code></h1></script><script type="text/ng-template" id="partials/4.html"><h1>4: Template with a relation (<img src="static/d65dd5318f.png" />) injected <span data-i18n="foo">directly</span> into <code>$templateCache</code></h1></script><script type="text/ng-template" id="partials/5.html"><h1>5: Template with a relation (<img src="static/d65dd5318f.png" />) injected directly into <code>$templateCache</code>, but using a different variable name</h1></script></body></html>');
            },
            'the graph should contain a single loaded non-inline Html (or subclass) asset': function (assetGraph) {
                assert.equal(assetGraph.findAssets({isHtml: true, isInline: false, isLoaded: true}).length, 1);
            },
            'the graph should contain 4 HtmlInlineScriptTemplate relations': function (assetGraph) {
                assert.equal(assetGraph.findRelations({type: 'HtmlInlineScriptTemplate'}).length, 4);
            },
            'one of the HtmlInlineScriptTemplateRelations should have an id of "partials/1.html" and point at an Html asset with the correct contents': function (assetGraph) {
                var relation = assetGraph.findRelations({type: 'HtmlInlineScriptTemplate', node: function (node) {return node.getAttribute('id') === 'partials/1.html';}})[0];
                assert.ok(relation);
                assert.equal(relation.to.text, '<h1>1: External template loaded asynchronously with <code>templateUrl: \'partials/1.html\'</code></h1>');
            },
            'none of the HtmlInlineScriptTemplateRelations should point at an asset with "3: Template" in its text': function (assetGraph) {
                assert.equal(assetGraph.findRelations({type: 'HtmlInlineScriptTemplate', to: {text: /3: Template/}}).length, 0);
            },
            'one of the HtmlInlineScriptTemplateRelations should have an id of "partials/2.html" and point at an Html asset with the correct contents': function (assetGraph) {
                var relation = assetGraph.findRelations({type: 'HtmlInlineScriptTemplate', node: function (node) {return node.getAttribute('id') === 'partials/2.html';}})[0];
                assert.ok(relation);
                assert.equal(relation.to.text, '<h1>2: Template in a &lt;script type="text/ng-template"&gt;-tag</h1>');
            },
            'one of the HtmlInlineScriptTemplateRelations should have an id of "partials/4.html" and point at an Html asset with the correct contents': function (assetGraph) {
                var relation = assetGraph.findRelations({type: 'HtmlInlineScriptTemplate', node: function (node) {return node.getAttribute('id') === 'partials/4.html';}})[0];
                assert.ok(relation);
                assert.equal(relation.to.text, '<h1>4: Template with a relation (<img src="static/d65dd5318f.png" />) injected <span data-i18n="foo">directly</span> into <code>$templateCache</code></h1>');
            },
            'one of the HtmlInlineScriptTemplateRelations should have an id of "partials/5.html" and point at an Html asset with the correct contents': function (assetGraph) {
                var relation = assetGraph.findRelations({type: 'HtmlInlineScriptTemplate', node: function (node) {return node.getAttribute('id') === 'partials/5.html';}})[0];
                assert.ok(relation);
                assert.equal(relation.to.text, '<h1>5: Template with a relation (<img src="static/d65dd5318f.png" />) injected directly into <code>$templateCache</code>, but using a different variable name</h1>');
            }
        }
    },
    'After loading the same test Angular.js test case again and running buildProduction with localization turned on': {
        topic: function () {
            new AssetGraph({root: __dirname + '/buildProduction/angularJs/'})
                .registerRequireJsConfig()
                .loadAssets('index.html')
                .buildProduction({version: false, localeIds: ['en', 'da']})
                .run(this.callback);
        },
        'the graph should contain 2 non-fragment Html assets': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Html', isFragment: false}).length, 2);
        },
        'the graph should contain 2 JavaScript assets': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'JavaScript'}).length, 2);
        },
        'the graph should contain no JavaScriptAngularJsTemplateCacheAssignment relations': function (assetGraph) {
            assert.equal(assetGraph.findRelations({type: 'JavaScriptAngularJsTemplateCacheAssignment'}).length, 0);
        },
        'index.en.html should have the expected contents': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Html', url: /\/index\.en\.html$/})[0].text.replace(/src="static\/[a-f0-9]{10}\.js"/, 'src="MD5.js"'), '<!doctype html>\n<html ng-app="myApp" lang="en"><head><title>My AngularJS App</title></head><body><ul class="menu"><li><a href="#/view1">view1</a></li> <li><a href="#/view2">view2</a></li> <li><a href="#/view3">view3</a></li> <li><a href="#/view4">view4</a></li></ul><div ng-view=""></div><script src="MD5.js"></script><script type="text/ng-template" id="partials/2.html"><h1>2: Template in a &lt;script type="text/ng-template"&gt;-tag</h1></script><script type="text/ng-template" id="partials/1.html"><h1>1: External template loaded asynchronously with <code>templateUrl: \'partials/1.html\'</code></h1></script><script type="text/ng-template" id="partials/4.html"><h1>4: Template with a relation (<img src="static/d65dd5318f.png" />) injected directly into <code>$templateCache</code></h1></script><script type="text/ng-template" id="partials/5.html"><h1>5: Template with a relation (<img src="static/d65dd5318f.png" />) injected directly into <code>$templateCache</code>, but using a different variable name</h1></script></body></html>');
        },
        'index.da.html should have the expected contents': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Html', url: /\/index\.da\.html$/})[0].text.replace(/src="static\/[a-f0-9]{10}\.js"/, 'src="MD5.js"'), '<!doctype html>\n<html ng-app="myApp" lang="da"><head><title>My AngularJS App</title></head><body><ul class="menu"><li><a href="#/view1">view1</a></li> <li><a href="#/view2">view2</a></li> <li><a href="#/view3">view3</a></li> <li><a href="#/view4">view4</a></li></ul><div ng-view=""></div><script src="MD5.js"></script><script type="text/ng-template" id="partials/2.html"><h1>2: Template in a &lt;script type="text/ng-template"&gt;-tag</h1></script><script type="text/ng-template" id="partials/1.html"><h1>1: External template loaded asynchronously with <code>templateUrl: \'partials/1.html\'</code></h1></script><script type="text/ng-template" id="partials/4.html"><h1>4: Template with a relation (<img src="static/d65dd5318f.png" />) injected lige direkte into <code>$templateCache</code></h1></script><script type="text/ng-template" id="partials/5.html"><h1>5: Template with a relation (<img src="static/d65dd5318f.png" />) injected directly into <code>$templateCache</code>, but using a different variable name</h1></script></body></html>');
        },
        'the graph should contain 2 loaded non-inline Html (or subclass) asset': function (assetGraph) {
            assert.equal(assetGraph.findAssets({isHtml: true, isInline: false, isLoaded: true}).length, 2);
        },
        'the graph should contain 8 HtmlInlineScriptTemplate relations': function (assetGraph) {
            assert.equal(assetGraph.findRelations({type: 'HtmlInlineScriptTemplate'}).length, 8);
        },
        'one of the HtmlInlineScriptTemplateRelations should have an id of "partials/1.html" and point at an Html asset with the correct contents': function (assetGraph) {
            var relation = assetGraph.findRelations({type: 'HtmlInlineScriptTemplate', node: function (node) {return node.getAttribute('id') === 'partials/1.html';}})[0];
            assert.ok(relation);
            assert.equal(relation.to.text, '<h1>1: External template loaded asynchronously with <code>templateUrl: \'partials/1.html\'</code></h1>');
        },
        'none of the HtmlInlineScriptTemplateRelations should point at an asset with "3: Template" in its text': function (assetGraph) {
            assert.equal(assetGraph.findRelations({type: 'HtmlInlineScriptTemplate', to: {text: /3: Template/}}).length, 0);
        },
        'one of the HtmlInlineScriptTemplateRelations should have an id of "partials/2.html" and point at an Html asset with the correct contents': function (assetGraph) {
            var relation = assetGraph.findRelations({type: 'HtmlInlineScriptTemplate', node: function (node) {return node.getAttribute('id') === 'partials/2.html';}})[0];
            assert.ok(relation);
            assert.equal(relation.to.text, '<h1>2: Template in a &lt;script type="text/ng-template"&gt;-tag</h1>');
        },
        'one of the HtmlInlineScriptTemplateRelations from index.en.html should have an id of "partials/4.html" and point at an Html asset with the correct contents': function (assetGraph) {
            var relation = assetGraph.findRelations({type: 'HtmlInlineScriptTemplate', from: {url: /\/index\.en\.html$/}, node: function (node) {return node.getAttribute('id') === 'partials/4.html';}})[0];
            assert.ok(relation);
            assert.equal(relation.to.text, '<h1>4: Template with a relation (<img src="static/d65dd5318f.png" />) injected directly into <code>$templateCache</code></h1>');
        },
        'one of the HtmlInlineScriptTemplateRelations from index.da.html should have an id of "partials/4.html" and point at an Html asset with the correct contents': function (assetGraph) {
            var relation = assetGraph.findRelations({type: 'HtmlInlineScriptTemplate', from: {url: /\/index\.da\.html$/}, node: function (node) {return node.getAttribute('id') === 'partials/4.html';}})[0];
            assert.ok(relation);
            assert.equal(relation.to.text, '<h1>4: Template with a relation (<img src="static/d65dd5318f.png" />) injected lige direkte into <code>$templateCache</code></h1>');
        },
        'one of the HtmlInlineScriptTemplateRelations should have an id of "partials/5.html" and point at an Html asset with the correct contents': function (assetGraph) {
            var relation = assetGraph.findRelations({type: 'HtmlInlineScriptTemplate', node: function (node) {return node.getAttribute('id') === 'partials/5.html';}})[0];
            assert.ok(relation);
            assert.equal(relation.to.text, '<h1>5: Template with a relation (<img src="static/d65dd5318f.png" />) injected directly into <code>$templateCache</code>, but using a different variable name</h1>');
        }
    },
    'After loading the same test Angular.js test case by loading **/*.html and populating, then running the buildProduction transform': {
        topic: function () {
            new AssetGraph({root: __dirname + '/buildProduction/angularJs/'})
                .registerRequireJsConfig()
                .loadAssets('**/*.html')
                .buildProduction({version: false})
                .run(this.callback);
        },
        'the graph should contain no JavaScriptAngularJsTemplateCacheAssignment relations': function (assetGraph) {
            assert.equal(assetGraph.findRelations({type: 'JavaScriptAngularJsTemplateCacheAssignment'}).length, 0);
        },
        'the Html asset should have the expected contents': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Html'})[0].text.replace(/src="static\/[a-f0-9]{10}\.js"/, 'src="MD5.js"'), '<!doctype html>\n<html ng-app="myApp"><head><title>My AngularJS App</title></head><body><ul class="menu"><li><a href="#/view1">view1</a></li> <li><a href="#/view2">view2</a></li> <li><a href="#/view3">view3</a></li> <li><a href="#/view4">view4</a></li></ul><div ng-view=""></div><script src="MD5.js"></script><script type="text/ng-template" id="partials/2.html"><h1>2: Template in a &lt;script type="text/ng-template"&gt;-tag</h1></script><script type="text/ng-template" id="partials/1.html"><h1>1: External template loaded asynchronously with <code>templateUrl: \'partials/1.html\'</code></h1></script><script type="text/ng-template" id="partials/4.html"><h1>4: Template with a relation (<img src="static/d65dd5318f.png" />) injected <span data-i18n="foo">directly</span> into <code>$templateCache</code></h1></script><script type="text/ng-template" id="partials/5.html"><h1>5: Template with a relation (<img src="static/d65dd5318f.png" />) injected directly into <code>$templateCache</code>, but using a different variable name</h1></script></body></html>');
        },
        'the graph should contain a single loaded non-inline Html (or subclass) asset': function (assetGraph) {
            assert.equal(assetGraph.findAssets({isHtml: true, isInline: false, isLoaded: true}).length, 1);
        },
        'the graph should contain 4 HtmlInlineScriptTemplate relations': function (assetGraph) {
            assert.equal(assetGraph.findRelations({type: 'HtmlInlineScriptTemplate'}).length, 4);
        },
        'one of the HtmlInlineScriptTemplateRelations should have an id of "partials/1.html" and point at an Html asset with the correct contents': function (assetGraph) {
            var relation = assetGraph.findRelations({type: 'HtmlInlineScriptTemplate', node: function (node) {return node.getAttribute('id') === 'partials/1.html';}})[0];
            assert.ok(relation);
            assert.equal(relation.to.text, '<h1>1: External template loaded asynchronously with <code>templateUrl: \'partials/1.html\'</code></h1>');
        },
        'none of the HtmlInlineScriptTemplateRelations should point at an asset with "3: Template" in its text': function (assetGraph) {
            assert.equal(assetGraph.findRelations({type: 'HtmlInlineScriptTemplate', to: {text: /3: Template/}}).length, 0);
        },
        'one of the HtmlInlineScriptTemplateRelations should have an id of "partials/2.html" and point at an Html asset with the correct contents': function (assetGraph) {
            var relation = assetGraph.findRelations({type: 'HtmlInlineScriptTemplate', node: function (node) {return node.getAttribute('id') === 'partials/2.html';}})[0];
            assert.ok(relation);
            assert.equal(relation.to.text, '<h1>2: Template in a &lt;script type="text/ng-template"&gt;-tag</h1>');
        },
        'one of the HtmlInlineScriptTemplateRelations should have an id of "partials/4.html" and point at an Html asset with the correct contents': function (assetGraph) {
            var relation = assetGraph.findRelations({type: 'HtmlInlineScriptTemplate', node: function (node) {return node.getAttribute('id') === 'partials/4.html';}})[0];
            assert.ok(relation);
            assert.equal(relation.to.text, '<h1>4: Template with a relation (<img src="static/d65dd5318f.png" />) injected <span data-i18n="foo">directly</span> into <code>$templateCache</code></h1>');
        },
        'one of the HtmlInlineScriptTemplateRelations should have an id of "partials/5.html" and point at an Html asset with the correct contents': function (assetGraph) {
            var relation = assetGraph.findRelations({type: 'HtmlInlineScriptTemplate', node: function (node) {return node.getAttribute('id') === 'partials/5.html';}})[0];
            assert.ok(relation);
            assert.equal(relation.to.text, '<h1>5: Template with a relation (<img src="static/d65dd5318f.png" />) injected directly into <code>$templateCache</code>, but using a different variable name</h1>');
        }
    },
    'After loading an Angular.js test case with multiple references to the same template': {
        topic: function () {
            new AssetGraph({root: __dirname + '/buildProduction/angularJsMultipleTemplateRefs/'})
                .registerRequireJsConfig()
                .loadAssets('index.html')
                .populate()
                .run(this.callback);
        },
        'the graph should contain 2 JavaScriptAngularJsTemplate relations': function (assetGraph) {
            assert.equal(assetGraph.findRelations({type: 'JavaScriptAngularJsTemplate'}).length, 2);
        },
        'the graph should contain 1 Html fragment asset': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Html', isFragment: true}).length, 1);
        },
        'then run the buildProduction transform': {
            topic: function (assetGraph) {
                assetGraph.buildProduction({version: false}).run(this.callback);
            },
            'the graph should contain 1 HtmlInlineScriptTemplate relations': function (assetGraph) {
                assert.equal(assetGraph.findRelations({type: 'HtmlInlineScriptTemplate'}).length, 1);
            },
            'the graph should contain 2 inline Html fragment assets': function (assetGraph) {
                assert.equal(assetGraph.findAssets({type: 'Html', isFragment: true, isInline: true}).length, 1);
            },
            'the graph should contain no non-inline Html fragment assets': function (assetGraph) {
                assert.equal(assetGraph.findAssets({type: 'Html', isFragment: true, isInline: false}).length, 0);
            }
        }
    },
    'After loading a test case with a SSI in the document title, then running the buildProduction transform': {
        topic: function () {
            new AssetGraph({root: __dirname + '/buildProduction/ssi/'})
                .on('error', this.callback)
                .registerRequireJsConfig()
                .loadAssets('index.html')
                .buildProduction({
                    version: false,
                    localeIds: ['da', 'en']
                })
                .run(this.callback);
        },
        'the graph should contain 2 Html assets': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Html'}).length, 2);
        },
        'the graph should contain an index.da.html with the correct lang attribute on the html element and the expected contents': function (assetGraph) {
            var htmlAssets = assetGraph.findAssets({type: 'Html', url: /\/index\.da\.html$/});
            assert.equal(htmlAssets.length, 1);
            var htmlAsset = htmlAssets[0];
            assert.equal(htmlAsset.parseTree.documentElement.getAttribute('lang'), 'da');
            assert.equal(htmlAsset.text, '<!DOCTYPE html>\n<html lang="da"><head><title>Ja, <!--#echo "exactly" --> sådan</title></head><body><div><!--#echo "Here" --> er tingen</div></body></html>');
        }
    },
    'After loading a test case with Knockout.js templates': {
        topic: function () {
            new AssetGraph({root: __dirname + '/buildProduction/knockoutJs/'})
                .registerRequireJsConfig()
                .loadAssets('index.html')
                .populate()
                .run(this.callback);
        },
        'the graph should contain 3 Html asset': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Html'}).length, 3);
        },
        'the graph should contain 3 non-inline JavaScript assets': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'JavaScript', isInline: false}).length, 3);
        },
        'the graph should contain 3 JavaScriptAmdRequire/JavaScriptAmdDefine relations pointing at Html assets': function (assetGraph) {
            assert.equal(assetGraph.findRelations({type: ['JavaScriptAmdRequire', 'JavaScriptAmdDefine'], to: {type: 'Html'}}).length, 3);
        },
        'the graph should contain 1 JavaScriptGetStaticUrl relation': function (assetGraph) {
            assert.equal(assetGraph.findRelations({type: 'JavaScriptGetStaticUrl'}).length, 1);
        },
        'the graph should contain 1 Png asset': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Png'}).length, 1);
        },
        'then run the buildProduction transform': {
            topic: function (assetGraph) {
                assetGraph.buildProduction({version: false}).run(this.callback);
            },
            'the graph should contain no JavaScriptAmdRequire/JavaScriptAmdDefine relations pointing at Html assets': function (assetGraph) {
                assert.equal(assetGraph.findRelations({type: ['JavaScriptAmdRequire', 'JavaScriptAmdDefine'], to: {type: 'Html'}}).length, 0);
            },
            'the graph should contain 2 HtmlInlineScriptTemplate relations': function (assetGraph) {
                assert.equal(assetGraph.findRelations({type: 'HtmlInlineScriptTemplate'}).length, 2);
            },
            'index.html should have the expected contents': function (assetGraph) {
                assert.equal(assetGraph.findAssets({url: /\/index\.html$/})[0].text.replace(/src="static\/[a-f0-9]{10}\.js"/, 'src="MD5.js"'), '<!DOCTYPE html>\n<html><head></head><body><script src="MD5.js"></script><script type="text/html" id="foo"><img data-bind="attr:{src:\'static/d65dd5318f.png\'}" /></script><script type="text/html" id="bar"><div><h1>bar.ko</h1></div></script></body></html>');
            },
            'one of the HtmlInlineScriptTemplateRelations should have an id of "foo" and point at a KnockoutJsTemplate asset with the correct contents': function (assetGraph) {
                var relation = assetGraph.findRelations({type: 'HtmlInlineScriptTemplate', node: function (node) {return node.getAttribute('id') === 'foo';}})[0];
                assert.ok(relation);
                assert.equal(relation.to.text, '<img data-bind="attr:{src:\'static/d65dd5318f.png\'}" />');
            },
            'one of the HtmlInlineScriptTemplateRelations should have an id of "bar" and point at a KnockoutJsTemplate asset with the correct contents': function (assetGraph) {
                var relation = assetGraph.findRelations({type: 'HtmlInlineScriptTemplate', node: function (node) {return node.getAttribute('id') === 'bar';}})[0];
                assert.ok(relation);
                assert.equal(relation.to.text, '<div><h1>bar.ko</h1></div>');
            }
        }
    },
    'After loading a test case with Html fragments as initial assets': {
        topic: function () {
            new AssetGraph({root: __dirname + '/buildProduction/initialHtmlFragments/'})
                .on('error', this.callback)
                .registerRequireJsConfig()
                .loadAssets('**/*.html')
                .run(this.callback);
        },
        'the graph should contain 2 Html assets': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Html'}).length, 2);
        },
        'the graph should contain 1 Html fragment asset': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Html', isFragment: true}).length, 1);
        },
        'then run the buildProduction transform': {
            topic: function (assetGraph) {
                assetGraph.buildProduction({version: false}).run(this.callback);
            },
            'the graph should contain 1 Png assets': function (assetGraph) {
                assert.equal(assetGraph.findAssets({type: 'Png'}).length, 1);
            },
            'the main Html asset should have the expected contents': function (assetGraph) {
                assert.equal(assetGraph.findAssets({type: 'Html', isInitial: true, isFragment: false})[0].text, '<!DOCTYPE html>\n<html><head></head><body><script>var myTemplateUrl="static/76e8658965.html";</script></body></html>');
            }
        }
    },
    'After loading a test case with an Html fragment as an initial asset, but without loading the asset referencing it': {
        topic: function () {
            new AssetGraph({root: __dirname + '/buildProduction/initialHtmlFragments/'})
                .on('error', this.callback)
                .registerRequireJsConfig()
                .loadAssets('myTemplate.html')
                .run(this.callback);
        },
        'the graph should contain 1 Html asset': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Html'}).length, 1);
        },
        'the graph should contain 1 Html fragment asset': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Html', isFragment: true}).length, 1);
        },
        'then run the buildProduction transform': {
            topic: function (assetGraph) {
                assetGraph.buildProduction({version: false}).run(this.callback);
            },
            'the Html fragment asset should have the expected contents': function (assetGraph) {
                assert.equal(assetGraph.findAssets({type: 'Html', isInitial: true, isFragment: true})[0].text, '<div><h1>Template with a relative image reference: <img src="foo.png" /></h1></div>');
            }
        }
    },
    'After loading a test case with an HtmlScript relation pointing at an extension-less, non-existent file': {
        topic: function () {
            new AssetGraph({root: __dirname + '/buildProduction/nonExistentFileWithoutExtension/'})
                .on('error', this.callback)
                .registerRequireJsConfig()
                .loadAssets('index.html')
                .run(this.callback);
        },
        'the graph should contain 1 asset': function (assetGraph) {
            assert.equal(assetGraph.findAssets().length, 1);
        },
        'then run the buildProduction transform': {
            topic: function (assetGraph) {
                assetGraph.buildProduction({version: false}).run(this.callback);
            },
            'the main Html asset should have the expected contents': function (assetGraph) {
                assert.equal(assetGraph.findAssets({url: /\/index\.html$/})[0].text, '<!DOCTYPE html>\n<html><head></head><body><script src="foo"></script></body></html>');
            }
        }
    },
    'After loading a test case with a JavaScriptGetStaticUrl relation pointing at an image, then running the buildProduction transform with the cdnRoot option': {
        topic: function () {
            new AssetGraph({root: __dirname + '/buildProduction/GetStaticUrlImageOnCdn/'})
                .on('error', this.callback)
                .registerRequireJsConfig()
                .loadAssets('index.html')
                .buildProduction({
                    version: false,
                    cdnRoot: 'http://cdn.example.com/foo/'
                })
                .run(this.callback);
        },
        'the main Html asset should have the expected contents': function (assetGraph) {
            assert.equal(assetGraph.findAssets({url: /\/index\.html$/})[0].text, '<!DOCTYPE html>\n<html><head></head><body><script>var imgUrl="http://cdn.example.com/foo/d65dd5318f.png";</script></body></html>');
        }
    },
    'After loading a test case with a HtmlRequireDataMain relation pointing at a script with a JavaScriptInclude relation pointing at an I18n asset, then running the buildProduction transform': {
        topic: function () {
            new AssetGraph({root: __dirname + '/buildProduction/htmlDataMainWithI18n/'})
                .on('error', this.callback)
                .registerRequireJsConfig()
                .loadAssets('index.html')
                .buildProduction({version: false})
                .run(this.callback);
        },
        'no JavaScript asset should contain an include': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'JavaScript', text: /INCLUDE/}).length, 0);
        }
    },
    'After loading a test case with a JavaScriptGetStaticUrl relation pointing at a flash file, then running the buildProduction transform with the cdnRoot option': {
        topic: function () {
            new AssetGraph({root: __dirname + '/buildProduction/GetStaticUrlFlash/'})
                .on('error', this.callback)
                .registerRequireJsConfig()
                .loadAssets('index.html')
                .buildProduction({
                    version: false,
                    cdnRoot: 'http://cdn.example.com/foo/'
                })
                .run(this.callback);
        },
        'the main Html asset should have the expected contents': function (assetGraph) {
            assert.equal(assetGraph.findAssets({url: /\/index\.html$/})[0].text, '<!DOCTYPE html>\n<html><head></head><body><script>var swfUrl="static/d41d8cd98f.swf";</script></body></html>');
        }
    },
    'After loading a test case with a JavaScriptGetStaticUrl relation pointing at a flash file, then running the buildProduction transform with the cdnRoot and cdnFlash options': {
        topic: function () {
            new AssetGraph({root: __dirname + '/buildProduction/GetStaticUrlFlash/'})
                .on('error', this.callback)
                .registerRequireJsConfig()
                .loadAssets('index.html')
                .buildProduction({
                    version: false,
                    cdnRoot: 'http://cdn.example.com/foo/',
                    cdnFlash: true
                })
                .run(this.callback);
        },
        'the main Html asset should have the expected contents': function (assetGraph) {
            assert.equal(assetGraph.findAssets({url: /\/index\.html$/})[0].text, '<!DOCTYPE html>\n<html><head></head><body><script>var swfUrl="http://cdn.example.com/foo/d41d8cd98f.swf";</script></body></html>');
        }
    },
    'After loading a test case with an @import rule in a stylesheet pulled in via require.js, then running the buildProduction transform': {
        topic: function () {
            new AssetGraph({root: __dirname + '/buildProduction/requiredCssImport/'})
                .on('error', this.callback)
                .registerRequireJsConfig()
                .loadAssets('index.html')
                .buildProduction({version: false})
                .run(this.callback);
        },
        'the graph should contain no CssImport relations': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'CssImport'}).length, 0);
        },
        'the graph should contain a single Css asset': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Css'}).length, 1);
        },
        'the graph should have the expected contents': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Css'})[0].text, 'span{color:green}body{color:red}');
        }
    },
    'After loading a test case with a require.js paths config pointing at an http url': {
        topic: function () {
            new AssetGraph({root: __dirname + '/buildProduction/requireJsCdnPath/'})
                .on('error', this.callback)
                .registerRequireJsConfig()
                .loadAssets('index.html')
                .buildProduction({version: false})
                .run(this.callback);
        },
        'the graph should contain 1 JavaScript asset': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'JavaScript'}).length, 1);
        }
    },
    'After loading a test case using the less! plugin, then running the buildProduction transform': {
        topic: function () {
            new AssetGraph({root: __dirname + '/buildProduction/lessPlugin/'})
                .registerRequireJsConfig()
                .loadAssets('index.html')
                .buildProduction({less: true})
                .run(this.callback);
        },
        'the graph should contain a single Css asset with the expected contents': function (assetGraph) {
            var cssAssets = assetGraph.findAssets({type: 'Css'});
            assert.equal(cssAssets.length, 1);
            assert.equal(cssAssets[0].text, 'body{color:tan;background-color:beige;text-indent:10px}');
        }
    },
    'After loading a test case with a GETSTATICURL that has a wildcard value, but only matches a single file': {
        topic: function () {
            new AssetGraph({root: __dirname + '/buildProduction/GetStaticUrlSingleFileWildcard/'})
                .registerRequireJsConfig()
                .loadAssets('index.html')
                .buildProduction({version: false})
                .run(this.callback);
        },
        'the graph should contain a single JavaScript asset with the expected contents': function (assetGraph) {
            var javaScriptAssets = assetGraph.findAssets({type: 'JavaScript'});
            assert.equal(javaScriptAssets.length, 1);
            // assert.equal(javaScriptAssets[0].text, 'var fileName={File:"static/22324131a2.txt"}["File"];');
            assert.equal(javaScriptAssets[0].text, 'var fileName="static/22324131a2.txt";');
        }
    },
    'After loading a test case with a GETSTATICURL that has two wildcard values, but only matches a single file': {
        topic: function () {
            new AssetGraph({root: __dirname + '/buildProduction/GetStaticUrlSingleFileAndTwoWildcards/'})
                .registerRequireJsConfig()
                .loadAssets('index.html')
                .buildProduction({version: false})
                .run(this.callback);
        },
        'the graph should contain a single JavaScript asset with the expected contents': function (assetGraph) {
            var javaScriptAssets = assetGraph.findAssets({type: 'JavaScript'});
            assert.equal(javaScriptAssets.length, 1);
            // assert.equal(javaScriptAssets[0].text, 'var fileName={dir:{File:"static/22324131a2.txt"}}["dir"]["File"];');
            assert.equal(javaScriptAssets[0].text, 'var fileName="static/22324131a2.txt";');
        }
    },
    'After loading a test case where the require.js configuration is in an external file, but it is being used in an inline script': {
        topic: function () {
            new AssetGraph({root: __dirname + '/buildProduction/requireJsConfigurationInExternalFile/'})
                .registerRequireJsConfig({preventPopulationOfJavaScriptAssetsUntilConfigHasBeenFound: true})
                .loadAssets('index.html')
                .buildProduction({version: false})
                .run(this.callback);
        },
        'the graph should contain a single JavaScript asset with the contents of foo.js': function (assetGraph) {
            var javaScriptAssets = assetGraph.findAssets({type: 'JavaScript'});
            assert.equal(javaScriptAssets.length, 1);
            assert.matches(javaScriptAssets[0].text, /alert\((['"])foo\1\)/);
        }
    },
    'After loading a test case for issue #54': {
        topic: function () {
            new AssetGraph({root: __dirname + '/buildProduction/issue54/'})
                .registerRequireJsConfig({preventPopulationOfJavaScriptAssetsUntilConfigHasBeenFound: true})
                .loadAssets('index.html')
                .buildProduction({version: false})
                .run(this.callback);
        },
        'the graph should contain a single JavaScript asset with the expected contents': function (assetGraph) {
            var javaScriptAssets = assetGraph.findAssets({type: 'JavaScript'});
            assert.equal(javaScriptAssets.length, 1);
            assert.matches(javaScriptAssets[0].text, /return"backbone".*return"deepmodel".*"Yup/);
        }
    },
    'After loading a test case for issue #58': {
        topic: function () {
            new AssetGraph({root: __dirname + '/buildProduction/issue58/'})
                .registerRequireJsConfig({preventPopulationOfJavaScriptAssetsUntilConfigHasBeenFound: true})
                .loadAssets('index.html')
                .buildProduction({version: false})
                .run(this.callback);
        },
        'the graph should contain a single JavaScript asset with the expected contents': function (assetGraph) {
            var javaScriptAssets = assetGraph.findAssets({type: 'JavaScript'});
            assert.equal(javaScriptAssets.length, 1);
            assert.matches(javaScriptAssets[0].text, /define\(\"\/templates\/header\.html\".*require\(\[\"\/templates\/header\.html/);
        }
    },
    'After loading a test case for issue #60': {
        topic: function () {
            new AssetGraph({root: __dirname + '/buildProduction/issue60/'})
                .registerRequireJsConfig({preventPopulationOfJavaScriptAssetsUntilConfigHasBeenFound: true})
                .loadAssets('index.html')
                .buildProduction({version: false})
                .run(this.callback);
        },
        'the graph should contain a single JavaScript asset with the expected contents': function (assetGraph) {
            var javaScriptAssets = assetGraph.findAssets({type: 'JavaScript'});
            assert.equal(javaScriptAssets.length, 1);
            assert.matches(javaScriptAssets[0].text, /require.config\(\{baseUrl:"\/js"\}\),define\("modules\/utils",function\(\)\{alert\("These are the utils!"\)\}\),require\(\["modules\/utils"\],function\(\)\{console.log\("Ready."\)\}\),define\("main",function\(\)\{\}\);/);
        }
    },
    'After loading a test case with multiple pages pulling in the same AMD modules, then running the buildProduction transform with sharedBundles:true': {
        topic: function () {
            new AssetGraph({root: __dirname + '/buildProduction/multiPageRequireJs/'})
                .registerRequireJsConfig({preventPopulationOfJavaScriptAssetsUntilConfigHasBeenFound: true})
                .loadAssets('index*.html')
                .buildProduction({sharedBundles: true})
                .run(this.callback);
        },
        'the graph should contain 3 JavaScript assets': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'JavaScript'}).length, 3);
        },
        'one of the JavaScript assets should be shared and contain require.js and the definitions of the common modules': function (assetGraph) {
            var commonJavaScripts = assetGraph.findAssets(function (asset) {
                return asset.type === 'JavaScript' && asset.incomingRelations.length > 1;
            });
            assert.equal(commonJavaScripts.length, 1);
            assert.matches(commonJavaScripts[0].text, /2\.1\.5/);
            assert.matches(commonJavaScripts[0].text, /alert\(['"]common1/);
            assert.matches(commonJavaScripts[0].text, /alert\(['"]common2/);
        },
        'the two main scripts should be inlined and contain only the require(...) part': function (assetGraph) {
            [1, 2].forEach(function (pageNumber) {
                var htmlAsset = assetGraph.findAssets({fileName: 'index' + pageNumber + '.html'})[0];
                assert.ok(htmlAsset);
                var htmlScripts = assetGraph.findRelations({type: 'HtmlScript', from: htmlAsset});
                assert.equal(htmlScripts.length, 2);
                assert.equal(htmlScripts[1].to.isInline, true);
                assert.equal(htmlScripts[1].to.text, 'require(["common1","common2"],function(){alert("main' + pageNumber + '")}),define("main' + pageNumber + '",function(){});');
            });
        }
    },
    'After loading a with a JavaScript asset that contains debugger statement and console.log, then run buildProduction with stripDebug:true': {
        topic: function () {
            new AssetGraph({root: __dirname + '/buildProduction/stripDebug/'})
                .registerRequireJsConfig({preventPopulationOfJavaScriptAssetsUntilConfigHasBeenFound: true})
                .loadAssets('index.html')
                .buildProduction({stripDebug: true})
                .run(this.callback);
        },
        'the JavaScript asset should should have the statement-level debugger and console.* calls removed': function (assetGraph) {
            assert.matches(assetGraph.findAssets({type: 'JavaScript'})[0].text,
                          /function foo\(([a-z])\)\{\1\.log\("foo"\)\}var foo="bar";hey\.log\("foo"\),foo=123,alert\(console.log\("blah"\)\);/);
        }
    },
    'After loading a test where some require.js-loaded JavaScript files could become orphaned, then run the buildProduction transform': {
        topic: function () {
            new AssetGraph({root: __dirname + '/buildProduction/requireJsOrphans/'})
                .registerRequireJsConfig({preventPopulationOfJavaScriptAssetsUntilConfigHasBeenFound: true})
                .loadAssets('index.html')
                .buildProduction({version: false})
                .run(this.callback);
        },
        'the graph should contain one JavaScript asset': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'JavaScript'}).length, 1);
        }
    },
    'After loading a test case for issue #69': {
        topic: function () {
            new AssetGraph({root: __dirname + '/buildProduction/issue69/'})
                .registerRequireJsConfig({preventPopulationOfJavaScriptAssetsUntilConfigHasBeenFound: true})
                .loadAssets('index.html')
                .buildProduction({version: false})
                .run(this.callback);
        },
        'the graph should contain a single JavaScript asset with the expected contents': function (assetGraph) {
            var javaScriptAssets = assetGraph.findAssets({type: 'JavaScript'});
            assert.equal(javaScriptAssets.length, 1);
            assert.matches(javaScriptAssets[0].text, /SockJS=[\s\S]*define\("main",function\(\)\{\}\);/);
        },
        'then run the JavaScript asset in a jsdom window and wait for the alert call': {
            topic: function (assetGraph) {
                var html = assetGraph.findAssets({type: 'Html'})[0],
                    javaScript = assetGraph.findAssets({type: 'JavaScript'})[0],
                    context = vm.createContext(),
                    callback = this.callback;
                require('assetgraph/lib/util/extendWithGettersAndSetters')(context, html.parseTree.createWindow());
                context.window = context;
                context.alert = function (message) {
                    if (/^got sockjs/.test(message)) {
                        process.nextTick(function () {
                            callback(null, null);
                        });
                    }
                };
                context.errorInstance = null;
                try {
                    vm.runInContext(javaScript.text, context, javaScript.url);
                } catch (e) {
                    process.nextTick(function () {
                        callback(e);
                    });
                }
            },
            'no JavaScript error should have occurred during the execution': function (err, result) {
                assert.isNull(err);
            }
        }
    },
    'After loading a test case for issue #83': {
        topic: function () {
            new AssetGraph({root: __dirname + '/buildProduction/issue83/'})
                .registerRequireJsConfig({preventPopulationOfJavaScriptAssetsUntilConfigHasBeenFound: true})
                .loadAssets('index.html')
                .buildProduction({version: false, reservedNames: ['$$super', 'quux']})
                .run(this.callback);
        },
        'the graph should contain a single JavaScript asset with $$super unmangled': function (assetGraph) {
            var javaScriptAssets = assetGraph.findAssets({type: 'JavaScript'});
            assert.equal(javaScriptAssets.length, 1);
            assert.matches(javaScriptAssets[0].text, /\$\$super,\w+,quux/);
            assert.matches(javaScriptAssets[0].text, /\$\$super\.foo/);
        }
    },
    'After loading a test case with a JavaScript that needs a symbol replaced, then running the buildProduction transform with noCompress:true': {
        topic: function () {
            new AssetGraph({root: __dirname + '/buildProduction/noCompress/'})
                .registerRequireJsConfig({preventPopulationOfJavaScriptAssetsUntilConfigHasBeenFound: true})
                .loadAssets('index.html')
                .buildProduction({version: false, noCompress: true, defines: {
                    MYSYMBOL: new AssetGraph.JavaScript.uglifyJs.AST_String({value: 'theValue'}),
                    MYOTHERSYMBOL: new AssetGraph.JavaScript.uglifyJs.AST_String({value: 'theOtherValue'})
                }})
                .run(this.callback);
        },
        'the compiled JavaScript should contain the MYSYMBOL replacement string': function (assetGraph) {
            assert.matches(assetGraph.findAssets({type: 'JavaScript'})[0].text, /theValue/);
        },
        'the compiled JavaScript should not contain the MYOTHERSYMBOL replacement string': function (assetGraph) {
            assert.ok(!/theOtherValue/.test(assetGraph.findAssets({type: 'JavaScript'})[0].text));
        }
    },
    'After loading a test case with a JavaScript that needs a symbol replaced, then running the buildProduction transform with noCompress:false': {
        topic: function () {
            new AssetGraph({root: __dirname + '/buildProduction/noCompress/'})
                .registerRequireJsConfig({preventPopulationOfJavaScriptAssetsUntilConfigHasBeenFound: true})
                .loadAssets('index.html')
                .buildProduction({version: false, noCompress: false, defines: {
                    MYSYMBOL: new AssetGraph.JavaScript.uglifyJs.AST_String({value: 'theValue'}),
                    MYOTHERSYMBOL: new AssetGraph.JavaScript.uglifyJs.AST_String({value: 'theOtherValue'})
                }})
                .run(this.callback);
        },
        'the compiled JavaScript should contain the MYSYMBOL replacement string': function (assetGraph) {
            assert.matches(assetGraph.findAssets({type: 'JavaScript'})[0].text, /theValue/);
        },
        'the compiled JavaScript should not contain the MYOTHERSYMBOL replacement string': function (assetGraph) {
            assert.ok(!/theOtherValue/.test(assetGraph.findAssets({type: 'JavaScript'})[0].text));
        }
    },
    'After loading a test case then running the buildProduction transform with gzip:true': {
        topic: function () {
            new AssetGraph({root: __dirname + '/buildProduction/gzip/'})
                .registerRequireJsConfig({preventPopulationOfJavaScriptAssetsUntilConfigHasBeenFound: true})
                .loadAssets('index.html')
                .buildProduction({version: false, gzip: true})
                .run(this.callback);
        },
        'the graph should contain 2 .gz assets': function (assetGraph) {
            assert.equal(assetGraph.findAssets({url: /\.gz$/}).length, 2);
        },
        'the graph should contain one .js.gz asset': function (assetGraph) {
            assert.equal(assetGraph.findAssets({url: /\.js\.gz$/}).length, 1);
        },
        'the gz asset should be greater than 5 KB and less than 10 KB': function (assetGraph) {
            var requireJsGz = assetGraph.findAssets({url: /\.js\.gz$/})[0];
            assert.ok(requireJsGz);
            assert.greater(requireJsGz.rawSrc.length, 5000);
            assert.lesser(requireJsGz.rawSrc.length, 10000);
        }
    },
    'After loading a test case with an HTML fragment that has an unpopulated relation, then running the buildProduction transform (regression test)': {
        topic: function () {
            new AssetGraph({root: __dirname + '/buildProduction/fragmentWithUnpopulatedRelation/'})
                .registerRequireJsConfig({preventPopulationOfJavaScriptAssetsUntilConfigHasBeenFound: true})
                .loadAssets('**/*.html')
                .buildProduction({version: false})
                .run(this.callback);
        },
        'the graph should contain 2 Html assets': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Html'}).length, 2);
        }
    },
    'After loading a test case with an existing source map, then running the buildProduction transform with gzip:true': {
        topic: function () {
            new AssetGraph({root: __dirname + '/buildProduction/existingSourceMap/'})
                .registerRequireJsConfig({preventPopulationOfJavaScriptAssetsUntilConfigHasBeenFound: true})
                .loadAssets('index.html')
                .buildProduction({version: false, gzip: true})
                .run(this.callback);
        },
        'the graph should contain 1 .gz assets': function (assetGraph) {
            assert.equal(assetGraph.findAssets({url: /\.gz$/}).length, 1);
        }
    },
    'After loading a test case with some assets that can be inlined, then run buildProduction with HtmlScript and HtmlStyline inlining thresholds of 100 bytes': {
        topic: function () {
            new AssetGraph({root: __dirname + '/buildProduction/inline/'})
                .registerRequireJsConfig({preventPopulationOfJavaScriptAssetsUntilConfigHasBeenFound: true})
                .loadAssets('index.html')
                .buildProduction({version: false, inlineByRelationType: {HtmlScript: 100, HtmlStyle: 100}})
                .run(this.callback);
        },
        'the script and the stylesheet should be inlined': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'JavaScript'})[0].isInline, true);
            assert.equal(assetGraph.findAssets({type: 'Css'})[0].isInline, true);
        }
    },
    'After loading a test case with some assets that can be inlined, then run buildProduction with HtmlScript and HtmlStyline inlining thresholds of 5 bytes': {
        topic: function () {
            new AssetGraph({root: __dirname + '/buildProduction/inline/'})
                .registerRequireJsConfig({preventPopulationOfJavaScriptAssetsUntilConfigHasBeenFound: true})
                .loadAssets('index.html')
                .buildProduction({version: false, inlineByRelationType: {HtmlScript: 5, HtmlStyle: 5}})
                .run(this.callback);
        },
        'the script and the stylesheet should not be inlined': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'JavaScript'})[0].isInline, false);
            assert.equal(assetGraph.findAssets({type: 'Css'})[0].isInline, false);
        }
    },
    'After loading a test case with some assets that can be inlined, then run buildProduction with HtmlScript and HtmlStyline inlining thresholds of false': {
        topic: function () {
            new AssetGraph({root: __dirname + '/buildProduction/inline/'})
                .registerRequireJsConfig({preventPopulationOfJavaScriptAssetsUntilConfigHasBeenFound: true})
                .loadAssets('index.html')
                .buildProduction({version: false, inlineByRelationType: {HtmlScript: false, HtmlStyle: false}})
                .run(this.callback);
        },
        'the script and the stylesheet should not be inlined': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'JavaScript'})[0].isInline, false);
            assert.equal(assetGraph.findAssets({type: 'Css'})[0].isInline, false);
        }
    },
    'After loading a test case with a very big stylesheet that needs to be split up in order to work in old IE versions (#107)': {
        topic: function () {
            new AssetGraph({root: __dirname + '/buildProduction/issue107/'})
                .registerRequireJsConfig({preventPopulationOfJavaScriptAssetsUntilConfigHasBeenFound: true})
                .loadAssets('falcon.html')
                .buildProduction({version: false})
                .run(this.callback);
        },
        'the graph should contain 3 HtmlStyle relations': function (assetGraph) {
            assert.equal(assetGraph.findRelations({type: 'HtmlStyle'}).length, 3);
        },
        'the graph should contain 3 Css assets': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Css'}).length, 3);
        },
        'the Html asset should have the expected contents': function (assetGraph) {
            var htmlAsset = assetGraph.findAssets({type: 'Html'})[0],
                matchLinkRelStylesheet = htmlAsset.text.match(/<link rel="stylesheet" href="static\/[0-9a-f]{10}\.css" \/>/g);
            assert.ok(matchLinkRelStylesheet);
            assert.equal(matchLinkRelStylesheet.length, 3);
        },
        'the split stylesheets should have the expected number of outgoing relations': function (assetGraph) {
            var unresolvedRelationsFromCss = assetGraph.findRelations({from: {type: 'Css'}}, true);
            assert.equal(unresolvedRelationsFromCss.length, 53); // The number of url(...) occurrences in falcon-example.css
        },
        'one of the split stylesheets should have a relation to an inline asset (ie. contain a data: url)': function (assetGraph) {
            assert.equal(assetGraph.findRelations({from: {type: 'Css'}, to: {isInline: true}}).length, 1);
        },
        'the split stylesheets should have the expected number of resolved outgoing relations (all pointing to the asset previously known as fake.png)': function (assetGraph) {
            var relationsFromCssToLoadedAssets = assetGraph.findRelations({from: {type: 'Css'}, to: {isLoaded: true, isInline: false}});
            assert.ok(relationsFromCssToLoadedAssets.every(function (relationFromCssToLoadedAsset) {
                return /\/static\/d65dd5318f\.png$/.test(relationFromCssToLoadedAsset.to.url);
            }));
        }
    }
})['export'](module);
