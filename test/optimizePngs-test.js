var vows = require('vows'),
    assert = require('assert'),
    _ = require('underscore'),
    seq = require('seq'),
    AssetGraph = require('assetgraph');

require('../lib/registerTransforms');

vows.describe('Postprocess images').addBatch({
    'After loading the test case': {
        topic: function () {
            new AssetGraph({root: __dirname + '/optimizePngs/'})
                .loadAssets('style.css')
                .populate()
                .run(this.callback);
        },
        'the graph contains the expected assets and relations': function (assetGraph) {
            assert.equal(assetGraph.findAssets().length, 3);
            assert.equal(assetGraph.findAssets({type: 'Png'}).length, 2);
            assert.equal(assetGraph.findAssets({type: 'Css'}).length, 1);
            assert.equal(assetGraph.findRelations({type: 'CssImage'}).length, 2);
        },
        'then running the optimizePngs transform': {
            topic: function (assetGraph) {
                assetGraph
                    .optimizePngs()
                    .run(this.callback);
            },
            'redalpha24bit.png should be smaller and still a PNG': function (assetGraph) {
                var redAlpha24Bit = assetGraph.findAssets({url: /\/redalpha24bit\.png$/})[0];
                assert.deepEqual(_.toArray(redAlpha24Bit.rawSrc.slice(0, 4)), [0x89, 0x50, 0x4e, 0x47]);
                assert.lesser(redAlpha24Bit.rawSrc.length, 6037);
            },
            'purplealpha24bit.png should be smaller and still a PNG': function (assetGraph) {
                var purpleAlpha24Bit = assetGraph.findAssets({url: /\/purplealpha24bit\.png$/})[0];
                assert.deepEqual(_.toArray(purpleAlpha24Bit.rawSrc.slice(0, 4)), [0x89, 0x50, 0x4e, 0x47]);
                assert.lesser(purpleAlpha24Bit.rawSrc.length, 8285);
            }
        }
    }
})['export'](module);
