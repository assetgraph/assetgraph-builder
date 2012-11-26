var vows = require('vows'),
    assert = require('assert'),
    _ = require('underscore'),
    seq = require('seq'),
    AssetGraph = require('assetgraph');

require('../lib/registerTransforms');

vows.describe('Postprocess images').addBatch({
    'After loading the test case': {
        topic: function () {
            new AssetGraph({root: __dirname + '/optimizeJpgs/'})
                .loadAssets('style.css')
                .populate()
                .run(this.callback);
        },
        'the graph contains the expected assets and relations': function (assetGraph) {
            assert.equal(assetGraph.findAssets().length, 2);
            assert.equal(assetGraph.findAssets({type: 'Jpeg'}).length, 1);
            assert.equal(assetGraph.findAssets({type: 'Css'}).length, 1);
            assert.equal(assetGraph.findRelations({type: 'CssImage'}).length, 1);
        },
        'then running the optimizeJpgs transform': {
            topic: function (assetGraph) {
                assetGraph
                    .optimizeJpgs()
                    .run(this.callback);
            },
            'turtle.jpg should be smaller': function (assetGraph) {
                var turtle = assetGraph.findAssets({url: /\/turtle\.jpg$/})[0];
                assert.lesser(turtle.rawSrc.length, 105836);
            }
        }
    }
})['export'](module);
