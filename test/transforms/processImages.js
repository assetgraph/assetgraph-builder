/*global describe, it*/
var expect = require('../unexpected-with-plugins'),
    _ = require('lodash'),
    AssetGraph = require('../../lib/AssetGraph'),
    urlTools = require('urltools');

describe('processImages', function () {
    it('should handle a Css test case', function () {
        return new AssetGraph({root: __dirname + '/../../testdata/transforms/processImages/css/'})
            .loadAssets('style.css')
            .populate()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain assets', 'Png', 3);
                expect(assetGraph, 'to contain assets', 'Css', 1);
                expect(assetGraph, 'to contain relations', 'CssImage', 3);
            })
            .processImages()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain assets', 'Png', 3);

                expect(_.map(assetGraph.findAssets({isImage: true}), 'url').sort(), 'to equal', [
                    urlTools.resolveUrl(assetGraph.root, 'purplealpha24bit.pngquant256.png'),
                    urlTools.resolveUrl(assetGraph.root, 'redalpha24bit.png?irrelevant'),
                    urlTools.resolveUrl(assetGraph.root, 'redalpha24bit.pngquant128.png')
                ]);
                // The first two CssImage relations should be in the same cssRule
                var cssBackgroundImages = assetGraph.findRelations({type: 'CssImage'});
                expect(cssBackgroundImages[0].cssRule, 'to equal', cssBackgroundImages[1].cssRule);

                var rawSrcs = assetGraph.findRelations({type: 'CssImage'}).map(function (cssImageRelation) {
                    return cssImageRelation.to.rawSrc;
                });

                // Should look like PNGs:
                expect(_.toArray(rawSrcs[0].slice(0, 4)), 'to equal', [0x89, 0x50, 0x4e, 0x47]);
                expect(_.toArray(rawSrcs[1].slice(0, 4)), 'to equal', [0x89, 0x50, 0x4e, 0x47]);
                expect(rawSrcs[1].length, 'to be less than', rawSrcs[0].length);

                cssBackgroundImages = assetGraph.findRelations({type: 'CssImage'});
                expect(cssBackgroundImages[0].cssRule, 'to equal', cssBackgroundImages[1].cssRule);
            });
    });

    it('should handle an Html test case', function () {
        return new AssetGraph({root: __dirname + '/../../testdata/transforms/processImages/html/'})
            .loadAssets('index.html')
            .populate()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain assets', 'Png', 3);

                expect(_.map(assetGraph.findAssets({isImage: true}), 'url').sort(), 'to equal', [
                    urlTools.resolveUrl(assetGraph.root, 'myImage.png'),
                    urlTools.resolveUrl(assetGraph.root, 'myImage.png?resize=200+200'),
                    urlTools.resolveUrl(assetGraph.root, 'myImage.png?resize=400+400')
                ]);
                expect(assetGraph, 'to contain relation', {href: 'myImage.png?resize=400+400#foo'});

                assetGraph.findAssets({type: 'Png'}).forEach(function (pngAsset) {
                    expect(pngAsset.rawSrc, 'to have length', 8285);
                });
                expect(assetGraph, 'to contain asset', 'Html');
            })
            .processImages()
            .queue(function (assetGraph) {
                // The urls of the image assets should have the processing instructions removed from the query string, but added before the extension:
                expect(_.map(assetGraph.findAssets({isImage: true}), 'url').sort(), 'to equal', [
                    urlTools.resolveUrl(assetGraph.root, 'myImage.resize200-200.png'),
                    urlTools.resolveUrl(assetGraph.root, 'myImage.resize400-400.png'),
                    urlTools.resolveUrl(assetGraph.root, 'myImage.png')
                ].sort());
                expect(assetGraph, 'to contain relation', {href: /myImage\.resize400-400\.png#foo/});
            });
    });

    it('should handle a Css test case with a setFormat instruction in the query string of a background-image url', function () {
        return new AssetGraph({root: __dirname + '/../../testdata/transforms/processImages/setFormat/'})
            .loadAssets('index.css')
            .populate()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain asset', 'Png');
                expect(assetGraph, 'to contain asset', 'Css');
                expect(assetGraph, 'to contain relation', 'CssImage');
            })
            .processImages()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain no assets', 'Png');
                expect(assetGraph, 'to contain asset', 'Gif');
                expect(_.map(assetGraph.findAssets({isImage: true}), 'url').sort(), 'to equal', [
                    urlTools.resolveUrl(assetGraph.root, 'foo.setFormatgif.gif')
                ]);
            });
    });

    it('should handle a test case with a Jpeg', function () {
        return new AssetGraph({root: __dirname + '/../../testdata/transforms/processImages/jpeg/'})
            .loadAssets('style.css')
            .populate()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain assets', {}, 2);
                expect(assetGraph, 'to contain asset', 'Jpeg');
                expect(assetGraph, 'to contain asset', 'Css');
                expect(assetGraph, 'to contain relation', 'CssImage');
            })
            .processImages({type: 'Jpeg'}, {jpegtran: true})
            .queue(function (assetGraph) {
                expect(assetGraph.findAssets({url: /\/turtle\.jpg$/})[0].rawSrc.length, 'to be less than', 105836);
            });
    });

    it('should handle a test case with a couple of pngs', function () {
        return new AssetGraph({root: __dirname + '/../../testdata/transforms/processImages/pngs/'})
            .loadAssets('style.css')
            .populate()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain asset', {}, 4);
                expect(assetGraph, 'to contain assets', 'Png', 3);
                expect(assetGraph, 'to contain asset', 'Css');
                expect(assetGraph, 'to contain relations', 'CssImage', 3);
            })
            .processImages({type: 'Png'}, {pngcrush: true, optipng: true, pngquant: true})
            .queue(function (assetGraph) {
                var redAlpha24BitPngquanted = assetGraph.findAssets({url: /\/redalpha24bit\.pngquant256\.png$/})[0];
                expect(_.toArray(redAlpha24BitPngquanted.rawSrc.slice(0, 4)), 'to equal', [0x89, 0x50, 0x4e, 0x47]);
                expect(redAlpha24BitPngquanted.rawSrc.length, 'to be less than', 6037);

                var purpleAlpha24BitPngcrushed = assetGraph.findAssets({url: /\/purplealpha24bit\.pngcrush\.png$/})[0];
                expect(_.toArray(purpleAlpha24BitPngcrushed.rawSrc.slice(0, 4)), 'to equal', [0x89, 0x50, 0x4e, 0x47]);
                expect(purpleAlpha24BitPngcrushed.rawSrc.length, 'to be less than', 8285);
            });
    });

    it('should handle a test case with a Svg', function () {
        return new AssetGraph({root: __dirname + '/../../testdata/transforms/processImages/svg/'})
            .loadAssets('index.html')
            .populate()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain asset', 'Svg');
                expect(assetGraph, 'to contain asset', 'Html');
            })
            .processImages({type: 'Svg'})
            .queue(function (assetGraph) {
                expect(assetGraph.findAssets({type: 'Svg'})[0].text, 'to match', /id="theBogusElementId"/);
            });
    });

    it('should handle dots in urls (regression test for a regexp issue)', function () {
        return new AssetGraph({root: __dirname + '/../../testdata/transforms/processImages/dot.in.path/'})
            .loadAssets('style.css')
            .populate()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain asset', 'Css', 1);
                expect(assetGraph, 'to contain asset', 'Png', 1);
            })
            .processImages()
            .queue(function (assetGraph) {
                expect(assetGraph.findAssets({type: 'Png'})[0].url, 'to equal', urlTools.resolveUrl(assetGraph.root, 'redalpha24bit.optipng.png'));
                expect(assetGraph.findAssets({type: 'Css'})[0].text, 'to match', /url\(redalpha24bit\.optipng\.png\)/);
            });
    });

    it('should apply device pixel ratio to images', function () {
        return new AssetGraph({root: __dirname + '/../../testdata/transforms/processImages/devicePixelRatio/'})
            .loadAssets('style.css')
            .populate()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain asset', 'Css', 1);
                expect(assetGraph, 'to contain asset', 'Png', 9);

                expect(_.map(assetGraph.findAssets({ isImage: true }), 'devicePixelRatio'), 'to equal', [1, 2, 1, 1, 1, 1, 1, 8, 1]);
            })
            .processImages()
            .queue(function (assetGraph) {
                var outputs = [
                    {
                        type: 'Png',
                        devicePixelRatio: 1
                    },
                    {
                        type: 'Png',
                        devicePixelRatio: 2
                    },
                    {
                        type: 'Png',
                        devicePixelRatio: 3,
                        url: /foo\.png$/
                    },
                    {
                        type: 'Png',
                        devicePixelRatio: 1
                    },
                    {
                        type: 'Png',
                        devicePixelRatio: 5,
                        url: /foo.*\.resize200,200\.png$/
                    },
                    {
                        type: 'Png',
                        devicePixelRatio: 6,
                        url: /foo.*\.resize200,200\.png$/
                    },
                    {
                        type: 'Png',
                        devicePixelRatio: 7,
                        url: /foo\.png\?foo=bar$/
                    },
                    {
                        type: 'Png',
                        devicePixelRatio: 1
                    },
                    {
                        type: 'Jpeg',
                        devicePixelRatio: 9
                    }
                ];

                expect(assetGraph.findAssets({ isImage: true }), 'to be an array whose items satisfy', function (img, idx) {
                    expect(img, 'to satisfy', outputs[idx]);
                });
            });
    });

    it('should not touch images that have auto=false', function () {
        return new AssetGraph({root: __dirname + '/../../testdata/transforms/processImages/autoFalse/'})
            .loadAssets('index.html')
            .populate()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain asset', 'Png', 1);
            })
            .processImages({type: 'Png'}, {autoLossless: true})
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain asset', 'Png', 1);
                expect(assetGraph.findAssets({type: 'Png'})[0].rawSrc.length, 'to equal', 8285);
            });
    });

    it('should support a standalone svgfilter', function () {
        return new AssetGraph({root: __dirname + '/../../testdata/transforms/processImages/svgFilter/'})
            .loadAssets('index.html')
            .populate()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain asset', 'Svg', 1);
            })
            .processImages()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain asset', 'Svg', 1);
                expect(assetGraph.findAssets({type: 'Svg'})[0].text, 'when parsed as XML', 'queried for', 'path', 'to satisfy', [
                    {
                        attributes: {
                            stroke: expect.it('to be colored', 'red')
                        }
                    }
                ]);
            });
    });

    it('should handle multiple gifsicle-powered operations on a gif', function () {
        return new AssetGraph({root: __dirname + '/../../testdata/transforms/processImages/gifsicle/'})
            .loadAssets('index.html')
            .populate()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain asset', 'Gif', 1);
            })
            .processImages()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain asset', 'Gif', 1);
            });
    });
});
