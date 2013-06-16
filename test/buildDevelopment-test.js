var vows = require('vows'),
    assert = require('assert'),
    AssetGraph = require('../lib/AssetGraph');

vows.describe('GETTEXT').addBatch({
    'After loading test case and running the buildDevelopment transform': {
        topic: function () {
            new AssetGraph({root: __dirname + '/buildDevelopment/simple/'})
                .registerRequireJsConfig()
                .loadAssets('index.html.template')
                .populate()
                .buildDevelopment({
                    version: 'The version number',
                    supportedLocaleIds: ['en', 'da'],
                    defaultLocaleId: 'en',
                    localeCookieName: 'myLocaleCookie',
                    cssImports: true,
                    inlineUrlWildCard: false // Test it
                })
                .run(this.callback);
        },
        'the graph should contain one Html asset': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Html'}).length, 1);
        },
        'the document title should be left alone': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Html'})[0].parseTree.title, 'The default title');
        },
        'the graph should contain one HtmlScript relation pointing at a bootstrapper script': function (assetGraph) {
            assert.equal(assetGraph.findRelations({type: 'HtmlScript', node: function (node) {return node.getAttribute('id') === 'bootstrapper';}}).length, 1);
        },
        'the bootstrapper should contain declarations of window.SUPPORTEDLOCALEIDS, window.DEFAULTLOCALEID and window.LOCALECOOKIENAME': function (assetGraph) {
            var bootstrapper = assetGraph.findRelations({type: 'HtmlScript', node: function (node) {return node.getAttribute('id') === 'bootstrapper';}})[0].to;
            assert.matches(bootstrapper.text, /\bwindow\.SUPPORTEDLOCALEIDS\s*=\s*\[\s*(['"])en\1\s*,\s*\1da\1\s*\]\s*;/);
            assert.matches(bootstrapper.text, /\bwindow\.DEFAULTLOCALEID\s*=\s*(['"])en\1\s*;/);
            assert.matches(bootstrapper.text, /\bwindow\.LOCALECOOKIENAME\s*=\s*(['"])myLocaleCookie\1\s*;/);
            assert.matches(bootstrapper.text, /\bwindow\.I18NKEYS\s*=\s*\{\s*myLanguageKey:\s*\{\s*en:\s*(['"])The English value\1\s*,\s*da:\s*\1Den danske værdi\1\s*\}\s*\}\s*;/);
        },
        'the Html asset should contain the correct data-tag attribute': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Html'})[0].parseTree.querySelectorAll('html[data-version="The version number"]').length, 1);
        }
    }
})['export'](module);
