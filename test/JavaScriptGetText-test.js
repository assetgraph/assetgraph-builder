var vows = require('vows'),
    assert = require('assert'),
    AssetGraph = require('assetgraph'),
    query = AssetGraph.query;

require('../lib/registerTransforms');

vows.describe('GETTEXT').addBatch({
    'After loading test case': {
        topic: function () {
            new AssetGraph({root: __dirname + '/JavaScriptGetText/'})
                .loadAssets('index.html.template')
                .populate()
                .injectBootstrapper({isInitial: true})
                .run(this.callback);
        },
        'the graph should contain 4 assets': function (assetGraph) {
            assert.equal(assetGraph.findAssets().length, 4);
        },
        'the graph should contain one JavaScriptGetText relation': function (assetGraph) {
            assert.equal(assetGraph.findRelations({type: 'JavaScriptGetText'}).length, 1);
        },
        'then inline and remove the JavaScriptGetText relations': {
            topic: function (assetGraph) {
                assetGraph
                    .inlineRelations({type: 'JavaScriptGetText'})
                    .removeRelations({type: 'JavaScriptGetText'}, {removeOrphan: true})
                    .run(this.callback);
            },
            'the graph should be down to 3 assets': function (assetGraph) {
                assert.equal(assetGraph.findAssets().length, 3);
            },
            'then get the JavaScript asset as text': {
                topic: function (assetGraph) {
                    return assetGraph.findAssets({type: 'JavaScript'})[0].text;
                },
                'the contents of name.txt should have replaced the GETTEXT expression': function (text) {
                    assert.isTrue(/\"Hello, my name is \"\s*\+\s*\"Foobar/.test(text));
                }
            }
        }
    }
})['export'](module);
