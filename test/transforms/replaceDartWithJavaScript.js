/*global describe, it*/
var expect = require('../unexpected-with-plugins'),
    AssetGraph = require('../../lib/AssetGraph');

describe('replaceDartWithJavaScript', function (done) {
    it('should handle a test case with 2 Dart assets', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/transforms/replaceDartWithJavaScript/'})
            .loadAssets('index.html')
            .populate()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain relation', 'HtmlDart');
                expect(assetGraph, 'to contain no relations', 'HtmlScript');
            })
            .replaceDartWithJavaScript()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain no relations', 'HtmlDart');
                expect(assetGraph, 'to contain relation', 'HtmlScript');
            })
            .run(done);
    });
});
