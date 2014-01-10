var vows = require('vows'),
    assert = require('assert'),
    AssetGraph = require('../lib/AssetGraph');

vows.describe('transforms.replaceDartWithJavaScript').addBatch({
    'After loading a Css test case': {
        topic: function () {
            new AssetGraph({root: __dirname + '/replaceDartWithJavaScript/'})
                .loadAssets('index.html')
                .populate()
                .run(this.callback);
        },
        'the graph should contain 1 HtmlDart relations': function (assetGraph) {
            assert.equal(assetGraph.findRelations({type: 'HtmlDart'}).length, 1);
        },
        'the graph should contain 0 HtmlScript relations': function (assetGraph) {
            assert.equal(assetGraph.findRelations({type: 'HtmlScript'}).length, 0);
        },
        'then running the replaceDartWithJavaScript transform': {
            topic: function (assetGraph) {
                assetGraph
                    .replaceDartWithJavaScript()
                    .run(this.callback);
            },
            'the graph should contain 0 HtmlDart relations': function (assetGraph) {
                assert.equal(assetGraph.findRelations({type: 'HtmlDart'}).length, 0);
            },
            'the graph should contain 1 HtmlScript relations': function (assetGraph) {
                assert.equal(assetGraph.findRelations({type: 'HtmlScript'}).length, 1);
            }
        }
    }

})['export'](module);
