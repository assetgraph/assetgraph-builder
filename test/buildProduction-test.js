var vows = require('vows'),
    assert = require('assert'),
    AssetGraph = require('assetgraph');

require('../lib/registerTransforms');

vows.describe('GETTEXT').addBatch({
    'After loading test case and running the buildProduction transform': {
        topic: function () {
            new AssetGraph({root: __dirname + '/buildProduction/simple/'})
                .registerRequireJsConfig()
                .loadAssets('index.html')
                .populate()
                .buildProduction({
                    quiet: true,
                    version: "The version number",
                    less: true,
                    optimizePngs: true, // Test it
                    inlineSize: true, // Test it
                    mangleTopLevel: true, // Test it
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
        }
    }
})['export'](module);
