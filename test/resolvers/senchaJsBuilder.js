/*global describe, it*/
var expect = require('../unexpected-with-plugins'),
    _ = require('lodash'),
    AssetGraph = require('../../lib/AssetGraph');

describe('resolvers/senchaJsBuilder', function () {
    it('should handle a test case with 3 assets', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/resolvers/senchaJsBuilder/rewriteBackgroundImageUrls/'})
            .registerLabelsAsCustomProtocols([
                {name: 'mylabel', url: __dirname + '/../../testdata/resolvers/senchaJsBuilder/rewriteBackgroundImageUrls/foo.jsb2'}
            ])
            .loadAssets('index.html')
            .populate()
            .flattenStaticIncludes({isInitial: true})
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain asset', 'Html');
                expect(assetGraph, 'to contain asset', {type: 'Css', isInline: false});
                expect(assetGraph, 'to contain asset', 'Png');

                var cssAsset = assetGraph.findAssets({type: 'Css'})[0],
                    cssBackgroundImageRelations = assetGraph.findRelations({type: 'CssImage', to: assetGraph.findAssets({type: 'Png'})[0]});
                expect(cssBackgroundImageRelations, 'to have length', 4);
                cssBackgroundImageRelations.forEach(function (cssBackgroundImageRelation) {
                    expect(cssBackgroundImageRelation.baseAsset, 'to be', cssAsset);
                });
                var src = assetGraph.findAssets({type: 'Css'})[0].text,
                    matches = src.match(/url\(\.\.\/\.\.\/images\/foo\/bar\/foo\.png\)/g);
                expect(matches, 'to have length', 4);
            })
            .inlineRelations({type: 'HtmlStyle'})
            .queue(function (assetGraph) {
                // All the background-image urls should be relative to the Html
                assetGraph.findRelations({type: 'CssImage'}).forEach(function (relation) {
                    expect(relation.cssRule.style[relation.propertyName], 'to equal', 'url(resources/images/foo/bar/foo.png)');
                });
                expect(assetGraph.findAssets({type: 'Html'})[0].text.match(/url\(resources\/images\/foo\/bar\/foo\.png\)/g), 'to have length', 4);
            })
            .run(done);
    });

    it('should handle an Html asset and a jsb2 describing packages that depend on each other', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/resolvers/senchaJsBuilder/dependentPackages/'})
            .registerLabelsAsCustomProtocols([
                {name: 'mylabel', url: __dirname + '/../../testdata/resolvers/senchaJsBuilder/dependentPackages/foo.jsb2'}
            ])
            .loadAssets('index.html')
            .populate()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain asset', 'Html');
                expect(assetGraph, 'to contain asset', {type: 'JavaScript', isInline: true});
                expect(assetGraph, 'to contain relations', 'JavaScriptInclude', 3);

                expect(assetGraph.findAssets({type: 'JavaScript', isInline: true})[0].text.match(/INCLUDE/g), 'to have length', 3);
            })
            .flattenStaticIncludes({isInitial: true})
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain relations', 'HtmlScript', 4);
                expect(_.pluck(assetGraph.findRelations({type: 'HtmlScript'}), 'href'), 'to equal', [
                    'js/A1.js',
                    'js/B1.js',
                    'js/C1.js',
                    undefined
                ]);
            })
            .run(done);
    });

    it('should handle overlapping jsb2 packages', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/resolvers/senchaJsBuilder/dependentPackages/'})
            .registerLabelsAsCustomProtocols([
                {name: 'mylabel', url: __dirname + '/../../testdata/resolvers/senchaJsBuilder/dependentPackages/foo.jsb2'}
            ])
            .loadAssets('overlappingIncludes.html')
            .populate()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain asset', 'Html');
                expect(assetGraph, 'to contain asset', {type: 'JavaScript', isInline: true});
                expect(assetGraph, 'to contain relations', 'JavaScriptInclude', 4);

                expect(assetGraph.findAssets({type: 'JavaScript', isInline: true})[0].text.match(/INCLUDE/g), 'to have length', 4);
            })
            .flattenStaticIncludes({isInitial: true})
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain relations', 'HtmlScript', 4);
                expect(_.pluck(assetGraph.findRelations({type: 'HtmlScript'}), 'href'), 'to equal', [
                    'js/A1.js',
                    'js/B1.js',
                    'js/C1.js',
                    undefined
                ]);
            })
            .run(done);
    });
});
