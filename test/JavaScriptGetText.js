/*global describe, it*/
var expect = require('./unexpected-with-plugins'),
    AssetGraph = require('../lib/AssetGraph');

describe('GETTEXT', function () {
    it('should handle a simple test case', function (done) {
        new AssetGraph({root: __dirname + '/../testdata/JavaScriptGetText/'})
            .loadAssets('index.html.template')
            .populate()
            .injectBootstrapper({isInitial: true})
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain assets', {}, 4);
                expect(assetGraph, 'to contain relation', 'JavaScriptGetText');
            })
            .inlineRelations({type: 'JavaScriptGetText'})
            .removeRelations({type: 'JavaScriptGetText'}, {removeOrphan: true})
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain assets', {}, 3);
                expect(assetGraph.findAssets({type: 'JavaScript'})[0].text, 'to match', /\"Hello, my name is \"\s*\+\s*\"Foobar/);
            })
            .run(done);
    });
});
