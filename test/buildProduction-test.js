var vows = require('vows'),
    assert = require('assert'),
    Stream = require('stream'),
    _ = require('underscore'),
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
        'the Html assets should contain the correct Content-Version meta tags': function (assetGraph) {
            assetGraph.findAssets({type: 'Html', isInline: false}).forEach(function (htmlAsset) {
                assert.equal(htmlAsset.parseTree.querySelectorAll('meta[http-equiv="Content-Version"][content="The version number"]').length, 1);
            });
        },
        'the English Html asset should have 2 outgoing HtmlScript relations': function (assetGraph) {
            assert.equal(assetGraph.findRelations({type: 'HtmlScript', from: {url: /\/index\.en\.html$/}}).length, 2);
        },
        'the English Html asset should have the expected contents': function (assetGraph) {
            assert.equal(assetGraph.findAssets({url: /\/index\.en\.html$/})[0].text,
                         '<!DOCTYPE html>\n<html lang="en" manifest="index.appcache"><head><meta http-equiv="Content-Version" content="The version number" /><title>The English title</title><style type="text/css">body{color:teal;color:maroon}</style><style type="text/css">body{color:tan}</style><style type="text/css">body div{width:100px}</style></head><body><script src="http://cdn.example.com/foo/e449e5e94f.js" async="async" defer="defer"></script><script>alert("script3");</script><script type="text/html" id="template"><a href="/index.html">The English link text</a><img src="http://cdn.example.com/foo/3fb51b1ae1.gif" /></script></body></html>');
        },
        'the Danish Html asset should have the expected contents': function (assetGraph) {
            assert.equal(assetGraph.findAssets({url: /\/index\.da\.html$/})[0].text,
                         '<!DOCTYPE html>\n<html lang="da" manifest="index.appcache"><head><meta http-equiv="Content-Version" content="The version number" /><title>Den danske titel</title><style type="text/css">body{color:teal;color:maroon}</style><style type="text/css">body{color:tan}</style><style type="text/css">body div{width:100px}</style></head><body><script src="http://cdn.example.com/foo/d6d599334f.js" async="async" defer="defer"></script><script>alert("script3");</script><script type="text/html" id="template"><a href="/index.html">Den danske linktekst</a><img src="http://cdn.example.com/foo/3fb51b1ae1.gif" /></script></body></html>');
        },
        'the English JavaScript should have the expected contents': function (assetGraph) {
            var afterRequireJs = assetGraph.findRelations({type: 'HtmlScript', from: {url: /\/index\.en\.html$/}})[0].to.text.replace(/^.*req\(cfg\)\}\}\)\(this\),/, '');
            assert.equal(afterRequireJs, 'alert("something else"),alert("shimmed"),define("amdDependency",function(){console.warn("here I AM(D)")}),require.config({shim:{shimmed:["somethingElse"]}}),require(["amdDependency"],function(){alert("Hello!")});');
        },
        'the Danish JavaScript should have the expected contents': function (assetGraph) {
            var afterRequireJs = assetGraph.findRelations({type: 'HtmlScript', from: {url: /\/index\.da\.html$/}})[0].to.text.replace(/^.*req\(cfg\)\}\}\)\(this\),/, '');
            assert.equal(afterRequireJs, 'alert("something else"),alert("shimmed"),define("amdDependency",function(){console.warn("here I AM(D)")}),require.config({shim:{shimmed:["somethingElse"]}}),require(["amdDependency"],function(){alert("Hej!")});');
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
                    htmlAsset.fileName === 'index.da.html' ?
                        'http://cdn.example.com/foo/d6d599334f.js' :
                        'http://cdn.example.com/foo/e449e5e94f.js',
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
                assetGraph.buildProduction().run(this.callback);
            },
            'the graph should contain no JavaScriptAngularJsTemplateCacheAssignment relations': function (assetGraph) {
                assert.equal(assetGraph.findRelations({type: 'JavaScriptAngularJsTemplateCacheAssignment'}).length, 0);
            },
            'the Html asset should have the expected contents': function (assetGraph) {
                assert.equal(assetGraph.findAssets({type: 'Html'})[0].text.replace(/src="static\/[a-f0-9]{10}\.js"/, 'src="MD5.js"'), '<!doctype html>\n<html ng-app="myApp"><head><title>My AngularJS App</title></head><body><ul class="menu"><li><a href="#/view1">view1</a></li> <li><a href="#/view2">view2</a></li> <li><a href="#/view3">view3</a></li> <li><a href="#/view4">view4</a></li></ul><div ng-view="ng-view"></div><script src="MD5.js"></script><script type="text/ng-template" id="partials/2.html"><h1>2: Template in a &lt;script type="text/ng-template"&gt;-tag</h1></script><script type="text/ng-template" id="partials/1.html"><h1>1: External template loaded asynchronously with <code>templateUrl: \'partials/1.html\'</code></h1></script><script type="text/ng-template" id="partials/4.html"><h1>4: Template with a relation (<img src="static/d65dd5318f.png" />) injected <span data-i18n="foo">directly</span> into <code>$templateCache</code></h1></script><script type="text/ng-template" id="partials/5.html"><h1>5: Template with a relation (<img src="static/d65dd5318f.png" />) injected directly into <code>$templateCache</code>, but using a different variable name</h1></script></body></html>');
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
                .buildProduction({localeIds: ['en', 'da']})
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
            assert.equal(assetGraph.findAssets({type: 'Html', url: /\/index\.en\.html$/})[0].text.replace(/src="static\/[a-f0-9]{10}\.js"/, 'src="MD5.js"'), '<!doctype html>\n<html ng-app="myApp" lang="en"><head><title>My AngularJS App</title></head><body><ul class="menu"><li><a href="#/view1">view1</a></li> <li><a href="#/view2">view2</a></li> <li><a href="#/view3">view3</a></li> <li><a href="#/view4">view4</a></li></ul><div ng-view="ng-view"></div><script src="MD5.js"></script><script type="text/ng-template" id="partials/2.html"><h1>2: Template in a &lt;script type="text/ng-template"&gt;-tag</h1></script><script type="text/ng-template" id="partials/1.html"><h1>1: External template loaded asynchronously with <code>templateUrl: \'partials/1.html\'</code></h1></script><script type="text/ng-template" id="partials/4.html"><h1>4: Template with a relation (<img src="static/d65dd5318f.png" />) injected directly into <code>$templateCache</code></h1></script><script type="text/ng-template" id="partials/5.html"><h1>5: Template with a relation (<img src="static/d65dd5318f.png" />) injected directly into <code>$templateCache</code>, but using a different variable name</h1></script></body></html>');
        },
        'index.da.html should have the expected contents': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Html', url: /\/index\.da\.html$/})[0].text.replace(/src="static\/[a-f0-9]{10}\.js"/, 'src="MD5.js"'), '<!doctype html>\n<html ng-app="myApp" lang="da"><head><title>My AngularJS App</title></head><body><ul class="menu"><li><a href="#/view1">view1</a></li> <li><a href="#/view2">view2</a></li> <li><a href="#/view3">view3</a></li> <li><a href="#/view4">view4</a></li></ul><div ng-view="ng-view"></div><script src="MD5.js"></script><script type="text/ng-template" id="partials/2.html"><h1>2: Template in a &lt;script type="text/ng-template"&gt;-tag</h1></script><script type="text/ng-template" id="partials/1.html"><h1>1: External template loaded asynchronously with <code>templateUrl: \'partials/1.html\'</code></h1></script><script type="text/ng-template" id="partials/4.html"><h1>4: Template with a relation (<img src="static/d65dd5318f.png" />) injected lige direkte into <code>$templateCache</code></h1></script><script type="text/ng-template" id="partials/5.html"><h1>5: Template with a relation (<img src="static/d65dd5318f.png" />) injected directly into <code>$templateCache</code>, but using a different variable name</h1></script></body></html>');
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
                .buildProduction()
                .run(this.callback);
        },
        'the graph should contain no JavaScriptAngularJsTemplateCacheAssignment relations': function (assetGraph) {
            assert.equal(assetGraph.findRelations({type: 'JavaScriptAngularJsTemplateCacheAssignment'}).length, 0);
        },
        'the Html asset should have the expected contents': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Html'})[0].text.replace(/src="static\/[a-f0-9]{10}\.js"/, 'src="MD5.js"'), '<!doctype html>\n<html ng-app="myApp"><head><title>My AngularJS App</title></head><body><ul class="menu"><li><a href="#/view1">view1</a></li> <li><a href="#/view2">view2</a></li> <li><a href="#/view3">view3</a></li> <li><a href="#/view4">view4</a></li></ul><div ng-view="ng-view"></div><script src="MD5.js"></script><script type="text/ng-template" id="partials/2.html"><h1>2: Template in a &lt;script type="text/ng-template"&gt;-tag</h1></script><script type="text/ng-template" id="partials/1.html"><h1>1: External template loaded asynchronously with <code>templateUrl: \'partials/1.html\'</code></h1></script><script type="text/ng-template" id="partials/4.html"><h1>4: Template with a relation (<img src="static/d65dd5318f.png" />) injected <span data-i18n="foo">directly</span> into <code>$templateCache</code></h1></script><script type="text/ng-template" id="partials/5.html"><h1>5: Template with a relation (<img src="static/d65dd5318f.png" />) injected directly into <code>$templateCache</code>, but using a different variable name</h1></script></body></html>');
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
                assetGraph.buildProduction().run(this.callback);
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
                assetGraph.buildProduction().run(this.callback);
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
                assetGraph.buildProduction().run(this.callback);
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
                assetGraph.buildProduction().run(this.callback);
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
                assetGraph.buildProduction().run(this.callback);
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
                .buildProduction()
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
                .buildProduction()
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
                .buildProduction()
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
                .buildProduction()
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
                .buildProduction()
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
                .buildProduction()
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
                .buildProduction()
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
                .buildProduction()
                .run(this.callback);
        },
        'the graph should contain a single JavaScript asset with the expected contents': function (assetGraph) {
            var javaScriptAssets = assetGraph.findAssets({type: 'JavaScript'});
            assert.equal(javaScriptAssets.length, 1);
            assert.matches(javaScriptAssets[0].text, /define\(\"..\/templates\/header\.html\".*require\(\[\"..\/templates\/header\.html/);
        }
    }
})['export'](module);
