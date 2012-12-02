var vows = require('vows'),
    assert = require('assert'),
    _ = require('underscore'),
    seq = require('seq'),
    AssetGraph = require('../lib/AssetGraph');

vows.describe('transforms.processImages').addBatch({
    'After loading a Css test case': {
        topic: function () {
            new AssetGraph({root: __dirname + '/processImages/css/'})
                .loadAssets('style.css')
                .populate()
                .run(this.callback);
        },
        'the graph should contain 3 Png assets': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Png'}).length, 3);
        },
        'the graph should contain 1 Css asset': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Css'}).length, 1);
        },
        'the graph should contain 3 CssImage relations': function (assetGraph) {
            assert.equal(assetGraph.findRelations({type: 'CssImage'}).length, 3);
        },
        'then running the processImages transform': {
            topic: function (assetGraph) {
                assetGraph
                    .processImages()
                    .run(this.callback);
            },
            'the number of Png assets should be 3': function (assetGraph) {
                assert.equal(assetGraph.findAssets({type: 'Png'}).length, 3);
            },
            'the urls of the image assets should have the processing instructions removed from the query string, but added before the extension': function (assetGraph) {
                assert.deepEqual(_.pluck(assetGraph.findAssets({isImage: true}), 'url').sort(), [
                    assetGraph.root + 'purplealpha24bit.pngquant-256.png',
                    assetGraph.root + 'redalpha24bit.png?irrelevant',
                    assetGraph.root + 'redalpha24bit.pngquant-128.png'
                ]);
            },
            'the first two CssImage relations should be in the same cssRule': function (assetGraph) {
                var cssBackgroundImages = assetGraph.findRelations({type: 'CssImage'});
                assert.equal(cssBackgroundImages[0].cssRule, cssBackgroundImages[1].cssRule);
            },
            'then fetching the source of the two images': {
                topic: function (assetGraph) {
                    return assetGraph.findRelations({type: 'CssImage'}).map(function (cssImageRelation) {
                        return cssImageRelation.to.rawSrc;
                    });
                },
                'should return something that looks like Pngs': function (rawSrcs) {
                    assert.deepEqual(_.toArray(rawSrcs[0].slice(0, 4)), [0x89, 0x50, 0x4e, 0x47]);
                    assert.deepEqual(_.toArray(rawSrcs[1].slice(0, 4)), [0x89, 0x50, 0x4e, 0x47]);
                },
                'the second one should be smaller than the first': function (rawSrcs) {
                    assert.lesser(rawSrcs[1].length, rawSrcs[0].length);
                }
            }
        }
    },
    'After loading an Html test case': {
        topic: function () {
            new AssetGraph({root: __dirname + '/processImages/html/'})
                .loadAssets('index.html')
                .populate()
                .run(this.callback);
        },
        'the graph should contain 3 Png assets': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Png'}).length, 3);
        },
        'the Png assets should have the expected urls': function (assetGraph) {
            assert.deepEqual(_.pluck(assetGraph.findAssets({isImage: true}), 'url').sort(), [
                assetGraph.root + 'myImage.png',
                assetGraph.root + 'myImage.png?resize=200+200',
                assetGraph.root + 'myImage.png?resize=400+400'
            ]);
        },
        'the Png assets should all have a size of 8285 bytes': function (assetGraph) {
            assetGraph.findAssets({type: 'Png'}).forEach(function (pngAsset) {
                assert.equal(pngAsset.rawSrc.length, 8285);
            });
        },
        'the graph should contain 1 Html asset': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Html'}).length, 1);
        },
        'then running the processImages transform': {
            topic: function (assetGraph) {
                assetGraph
                    .processImages()
                    .run(this.callback);
            },
            'the urls of the image assets should have the processing instructions removed from the query string, but added before the extension': function (assetGraph) {
                assert.deepEqual(_.pluck(assetGraph.findAssets({isImage: true}), 'url').sort(), [
                    assetGraph.root + 'myImage.resize-200-200.png',
                    assetGraph.root + 'myImage.resize-400-400.png',
                    assetGraph.root + 'myImage.png'
                ].sort());
            }
        }
    },
    'After loading a Css test case with a setFormat instruction in the query string of a background-image url': {
        topic: function () {
            new AssetGraph({root: __dirname + '/processImages/setFormat/'})
                .loadAssets('index.css')
                .populate()
                .run(this.callback);
        },
        'the graph should contain a Png asset': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Png'}).length, 1);
        },
        'the graph should contain 1 Css asset': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Css'}).length, 1);
        },
        'the graph should contain 1 CssImage relations': function (assetGraph) {
            assert.equal(assetGraph.findRelations({type: 'CssImage'}).length, 1);
        },
        'then running the processImages transform': {
            topic: function (assetGraph) {
                assetGraph
                    .processImages()
                    .run(this.callback);
            },
            'there should be no Png assets': function (assetGraph) {
                assert.equal(assetGraph.findAssets({type: 'Png'}).length, 0);
            },
            'there should be one Gif asset': function (assetGraph) {
                assert.equal(assetGraph.findAssets({type: 'Gif'}).length, 1);
            },
            'the url of the gif should be updated correctly': function (assetGraph) {
                assert.deepEqual(_.pluck(assetGraph.findAssets({isImage: true}), 'url').sort(), [
                    assetGraph.root + 'foo.gif'
                ]);
            }
        }
    },
    'After loading test with a Jpeg': {
        topic: function () {
            new AssetGraph({root: __dirname + '/processImages/jpeg/'})
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
        'then running the processImages transform with {jpegtran: true}': {
            topic: function (assetGraph) {
                assetGraph
                    .processImages({type: 'Jpeg'}, {jpegtran: true})
                    .run(this.callback);
            },
            'turtle.jpg should be smaller': function (assetGraph) {
                var turtle = assetGraph.findAssets({url: /\/turtle\.jpg$/})[0];
                assert.lesser(turtle.rawSrc.length, 105836);
            }
        }
    },
    'After loading test case with a couple of pngs': {
        topic: function () {
            new AssetGraph({root: __dirname + '/processImages/pngs/'})
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
        'then running the processImages transform with all the png tools turned on': {
            topic: function (assetGraph) {
                assetGraph
                    .processImages({type: 'Png'}, {pngcrush: true, optipng: true, pngquant: true})
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
