/*global describe, it*/
var expect = require('./unexpected-with-plugins'),
    AssetGraph = require('../lib/AssetGraph');

describe('transforms.autoprefixer', function () {
    it('should handle an unprefixed test case', function (done) {
        new AssetGraph({root: __dirname + '/../testdata/autoprefixer/'})
            .loadAssets('index.html')
            .populate()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain relations', 'HtmlStyle', 2);
                expect(assetGraph, 'to contain relations', 'CssImage', 1);
            })
            .autoprefixer()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain relations', 'HtmlStyle', 2);
                expect(assetGraph, 'to contain relations', 'CssImage', 3);
            })
            .run(done);
    });

    it('should handle a simple option case', function (done) {
        expect(function () {
            new AssetGraph({root: __dirname + '/../testdata/autoprefixer/'})
                .loadAssets('index.html')
                .populate()
                .autoprefixer('last 2 versions')
                .run(done);
        }, 'not to throw');
    });

    it('should handle a complex option case', function (done) {
        expect(function () {
            new AssetGraph({root: __dirname + '/../testdata/autoprefixer/'})
                .loadAssets('index.html')
                .populate()
                .autoprefixer('last 2 versions, ie > 8,ff > 28')
                .run(done);
        }, 'not to throw');
    });

    it('should remove prefixfree.js and prefixfree.min.js', function (done) {
        new AssetGraph({root: __dirname + '/../testdata/autoprefixer/'})
            .loadAssets('prefixfree.html')
            .populate()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain relations', 'HtmlScript', 2);
            })
            .autoprefixer()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain relations', 'HtmlScript', 0);
            })
            .run(done);
    });
});
