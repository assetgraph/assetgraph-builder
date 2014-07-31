/*global describe, it*/
var expect = require('../unexpected-with-plugins'),
    AssetGraph = require('../../lib/AssetGraph');

describe('runJavaScriptConditionalBlocks', function () {
    it('shold handle a simple test case with some code that alters the DOM', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/transforms/runJavaScriptConditionalBlocks'})
            .loadAssets('index.html')
            .populate()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain asset', 'JavaScript');
            })
            .runJavaScriptConditionalBlocks({type: 'Html'}, 'THEENVIRONMENT')
            .queue(function (assetGraph) {
                var html = assetGraph.findAssets({type: 'Html'})[0],
                    divs = html.parseTree.getElementsByTagName('div');
                expect(divs, 'to have length', 2);
                expect(divs[0].firstChild.nodeValue, 'to equal', 'Howdy');
                expect(divs[1].firstChild.nodeValue, 'to equal', 'there');
            })
            .run(done);
    });
});
