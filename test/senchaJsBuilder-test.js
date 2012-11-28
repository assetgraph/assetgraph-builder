var vows = require('vows'),
    assert = require('assert'),
    _ = require('underscore'),
    AssetGraph = require('../lib/AssetGraph');

vows.describe('resolvers.senchaJsBuilder test').addBatch({
    'After loading a test case with three assets': {
        topic: function () {
            new AssetGraph({root: __dirname + '/senchaJsBuilder/rewriteBackgroundImageUrls/'})
                .registerLabelsAsCustomProtocols([
                    {name: 'mylabel', url: __dirname + '/senchaJsBuilder/rewriteBackgroundImageUrls/foo.jsb2'}
                ])
                .loadAssets('index.html')
                .populate()
                .flattenStaticIncludes({isInitial: true})
                .run(this.callback);
        },
        'the graph should contain one Html asset': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Html'}).length, 1);
        },
        'the graph should contain one Css asset': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Css', isInline: false}).length, 1);
        },
        'the graph should contain one Png asset': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Png'}).length, 1);
        },
        'the Png should have 4 incoming CssImage relations with the Css as their base asset': function (assetGraph) {
            var cssAsset = assetGraph.findAssets({type: 'Css'})[0],
                cssBackgroundImageRelations = assetGraph.findRelations({type: 'CssImage', to: assetGraph.findAssets({type: 'Png'})[0]});
            assert.equal(cssBackgroundImageRelations.length, 4);
            cssBackgroundImageRelations.forEach(function (cssBackgroundImageRelation) {
                assert.equal(cssBackgroundImageRelation.baseAsset, cssAsset);
            });
        },
        'then get the Css as text': {
            topic: function (assetGraph) {
                return assetGraph.findAssets({type: 'Css'})[0].text;
            },
            'the src should contain four occurrences of the corrected url': function (src) {
                var matches = src.match(/url\(\.\.\/\.\.\/images\/foo\/bar\/foo\.png\)/g);
                assert.equal(matches.length, 4);
            },
            'then inlining the HtmlStyle relations': {
                topic: function (_, assetGraph) {
                    assetGraph.inlineRelations({type: 'HtmlStyle'}).run(this.callback);
                },
                'all the background-image urls should be relative to the Html': function (assetGraph) {
                    assetGraph.findRelations({type: 'CssImage'}).forEach(function (relation) {
                        assert.equal(relation.cssRule.style[relation.propertyName], "url(resources/images/foo/bar/foo.png)");
                    });
                },
                'then get the Html as text': {
                    topic: function (assetGraph) {
                        return assetGraph.findAssets({type: 'Html'})[0].text;
                    },
                    'there should be four occurrences of the corrected background-image url': function (src) {
                        var matches = src.match(/url\(resources\/images\/foo\/bar\/foo\.png\)/g);
                        assert.equal(matches.length, 4);
                    }
                }
            }
        }
    },
    'After loading a test case with an Html asset and a jsb2 describing packages that depend on each other': {
        topic: function () {
            new AssetGraph({root: __dirname + '/senchaJsBuilder/dependentPackages/'})
                .registerLabelsAsCustomProtocols([
                    {name: 'mylabel', url: __dirname + '/senchaJsBuilder/dependentPackages/foo.jsb2'}
                ])
                .loadAssets('index.html')
                .populate()
                .run(this.callback);
        },
        'the graph should contain a single Html asset': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Html'}).length, 1);
        },
        'the graph should contain a single inline JavaScript asset': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'JavaScript', isInline: true}).length, 1);
        },
        'the graph should contain 3 JavaScriptInclude relations': function (assetGraph) {
            assert.equal(assetGraph.findRelations({type: 'JavaScriptInclude'}).length, 3);
        },
        'then get the inline JavaScript as text': {
            topic: function (assetGraph) {
                return assetGraph.findAssets({type: 'JavaScript', isInline: true})[0].text;
            },
            'it should contain 3 INCLUDE statements': function (text) {
                assert.equal(text.match(/INCLUDE/g).length, 3);
            },
            'then running transforms.flattenStaticIncludes': {
                topic: function (text, assetGraph) {
                    assetGraph.flattenStaticIncludes({isInitial: true}).run(this.callback);
                },
                'the graph should contain 4 HtmlScript relations': function (assetGraph) {
                    assert.equal(assetGraph.findRelations({type: 'HtmlScript'}).length, 4);
                },
                'the order should be A1.js, B1.js, C1.js, inline script': function (assetGraph) {
                    assert.deepEqual(_.pluck(assetGraph.findRelations({type: 'HtmlScript'}), 'href'),
                                     ['js/A1.js', 'js/B1.js', 'js/C1.js', undefined]);
                }
            }
        }
    },
    'After loading a test case with includes of overlapping jsb2 packages': {
        topic: function () {
            new AssetGraph({root: __dirname + '/senchaJsBuilder/dependentPackages/'})
                .registerLabelsAsCustomProtocols([
                    {name: 'mylabel', url: __dirname + '/senchaJsBuilder/dependentPackages/foo.jsb2'}
                ])
                .loadAssets('overlappingIncludes.html')
                .populate()
                .run(this.callback);
        },
        'the graph should contain a single Html asset': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Html'}).length, 1);
        },
        'the graph should contain a single inline JavaScript asset': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'JavaScript', isInline: true}).length, 1);
        },
        'the graph should contain 4 JavaScriptInclude relations': function (assetGraph) {
            assert.equal(assetGraph.findRelations({type: 'JavaScriptInclude'}).length, 4);
        },
        'then get the inline JavaScript as text': {
            topic: function (assetGraph) {
                return assetGraph.findAssets({type: 'JavaScript', isInline: true})[0].text;
            },
            'it should contain 4 INCLUDE statements': function (text) {
                assert.equal(text.match(/INCLUDE/g).length, 4);
            },
            'then running transforms.flattenStaticIncludes': {
                topic: function (text, assetGraph) {
                    assetGraph
                        .flattenStaticIncludes({isInitial: true})
                        .run(this.callback);
                },
                'the graph should contain 4 HtmlScript relations': function (assetGraph) {
                    assert.equal(assetGraph.findRelations({type: 'HtmlScript'}).length, 4);
                },
                'The order should be A1.js, B1.js, C1.js, inline script': function (assetGraph) {
                    assert.deepEqual(_.pluck(assetGraph.findRelations({type: 'HtmlScript'}), 'href'),
                                     ['js/A1.js', 'js/B1.js', 'js/C1.js', undefined]);
                }
            }
        }
    }
})['export'](module);
