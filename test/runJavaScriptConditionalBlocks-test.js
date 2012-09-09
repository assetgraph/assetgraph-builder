var vows = require('vows'),
    assert = require('assert'),
    AssetGraph = require('assetgraph');

require('../lib/registerTransforms');

vows.describe('executeJavaScriptConditionalBlocks').addBatch({
    'After loading test case': {
        topic: function () {
            new AssetGraph({root: __dirname + '/runJavaScriptConditionalBlocks'})
                .loadAssets('index.html')
                .populate()
                .run(this.callback);
        },
        'the graph should contain a single JavaScript asset': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'JavaScript'}).length, 1);
        },
        'then running the conditional blocks': {
            topic: function (assetGraph) {
                assetGraph
                    .runJavaScriptConditionalBlocks({type: 'Html'}, 'THEENVIRONMENT')
                    .run(this.callback);
            },
            'the Html should contain two new <div>s with greetings from the conditional blocks': function (assetGraph) {
                var html = assetGraph.findAssets({type: 'Html'})[0],
                    divs = html.parseTree.getElementsByTagName('div');
                assert.equal(divs.length, 2);
                assert.equal(divs[0].firstChild.nodeValue, "Howdy");
                assert.equal(divs[1].firstChild.nodeValue, "there");
            }
        }
    }
})['export'](module);
