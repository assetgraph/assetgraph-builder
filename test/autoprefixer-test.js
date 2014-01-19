var vows = require('vows'),
    assert = require('assert'),
    AssetGraph = require('../lib/AssetGraph');

vows.describe('transforms.autoprefixer').addBatch({
    'After loading an unprefixed test case': {
        topic: function () {
            new AssetGraph({root: __dirname + '/autoprefixer/'})
                .loadAssets('index.html')
                .populate()
                .run(this.callback);
        },
        'the graph should contain 2 HtmlStyle relations': function (assetGraph) {
            assert.equal(assetGraph.findRelations({type: 'HtmlStyle'}).length, 2);
        },
        'the graph should contain 1 CssImage relation': function (assetGraph) {
            assert.equal(assetGraph.findRelations({type: 'CssImage'}).length, 1);
        },
        'then running the autoprefixer transform': {
            topic: function (assetGraph) {
                assetGraph
                    .autoprefixer()
                    .run(this.callback);
            },
            'the graph should contain 2 HtmlStyle relations': function (assetGraph) {
                assert.equal(assetGraph.findRelations({type: 'HtmlStyle'}).length, 2);
            },
            'the graph should contain 3 CssImage relation': function (assetGraph) {
                assert.equal(assetGraph.findRelations({type: 'CssImage'}).length, 3);
            }
        }
    },
    'After loading an test case using prefixfree.js': {
        topic: function () {
            new AssetGraph({root: __dirname + '/autoprefixer/'})
                .loadAssets('prefixfree.html')
                .populate()
                .run(this.callback);
        },
        'the graph should contain 2 HtmlScript relations': function (assetGraph) {
            assert.equal(assetGraph.findRelations({type: 'HtmlScript'}).length, 2);
        },
        'then running the autoprefixer transform': {
            topic: function (assetGraph) {
                assetGraph
                    .autoprefixer()
                    .run(this.callback);
            },
            'the graph should contain 0 HtmlScript relations': function (assetGraph) {
                assert.equal(assetGraph.findRelations({type: 'HtmlScript'}).length, 0);
            }
        }
    }

})['export'](module);
