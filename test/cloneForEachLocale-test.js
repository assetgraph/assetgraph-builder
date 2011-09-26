var vows = require('vows'),
    assert = require('assert'),
    vm = require('vm'),
    AssetGraph = require('assetgraph'),
    passError = require('assetgraph/lib/util/passError'),
    transforms = require('../lib/transforms'),
    i18nTools = require('../lib/util/i18nTools'),
    oneBootstrapper = require('../lib/util/oneBootstrapper');

function getJavaScriptTextAndBootstrappedContext(assetGraph, htmlQueryObj) {
    var htmlAsset = assetGraph.findAssets(htmlQueryObj)[0],
        htmlScriptRelations = assetGraph.findRelations({from: htmlAsset, to: {type: 'JavaScript'}}),
        inlineJavaScript;

    if (htmlScriptRelations[0].node.getAttribute('id') === 'oneBootstrapper') {
        inlineJavaScript = htmlScriptRelations[1].to;
    } else {
        inlineJavaScript = htmlScriptRelations[0].to;
    }

    return {
        text: inlineJavaScript.text,
        context: oneBootstrapper.createContext(assetGraph.findAssets(htmlQueryObj)[0], assetGraph)
    };
}

function evaluateInContext(src, context) {
    vm.runInContext("result = (function () {" + src + "}());", context);
    return context.result;
}

vows.describe('Make a clone of each Html file for each language').addBatch({
    'After loading simple test case': {
        topic: function () {
            new AssetGraph({root: __dirname + '/cloneForEachLocale/simple/'}).queue(
                transforms.loadAssets('index.html'),
                transforms.populate()
            ).run(this.callback);
        },
        'the graph should contain one Html asset': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Html'}).length, 1);
        },
        'the graph should contain one inline JavaScript asset': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'JavaScript', isInline: true}).length, 1);
        },
        'the graph should contain one I18n asset': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'I18n'}).length, 1);
        },
        'the graph should contain one HtmlStyle relation': function (assetGraph) {
            assert.equal(assetGraph.findRelations({type: 'HtmlStyle'}).length, 1);
        },
        'the graph should contain one Css asset': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Css'}).length, 1);
        },
        'the graph should contain one CssImage relation': function (assetGraph) {
            assert.equal(assetGraph.findRelations({type: 'CssImage'}).length, 1);
        },
        'the graph should contain one Png asset': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Png'}).length, 1);
        },
        'then running the cloneForEachLocale transform': {
            topic: function (assetGraph) {
                assetGraph.runTransform(transforms.cloneForEachLocale({type: 'Html'}, ['en_US', 'da']), this.callback);
            },
            'the graph should contain 2 Html assets': function (assetGraph) {
                assert.equal(assetGraph.findAssets({type: 'Html'}).length, 2);
            },
            'the graph should contain 2 HtmlStyle relations pointing at style.css': function (assetGraph) {
                assert.equal(assetGraph.findRelations({type: 'HtmlStyle', to: {url: /\/style\.css$/}}).length, 2);
            },
            'the graph should still contain one CssImage relation': function (assetGraph) {
                assert.equal(assetGraph.findRelations({type: 'CssImage'}).length, 1);
            },
            'then getting the text of the American English version of the Html asset': {
                topic: function (assetGraph) {
                    return assetGraph.findAssets({url: /\/index\.en_US\.html$/})[0].text;
                },
                'the html tag should have a lang attribute with a value of "en_US"': function (text) {
                    assert.isTrue(/<html[^>]+lang=([\'\"])en_US\1/.test(text));
                }
            },
            'then getting the text of the Danish version of the Html asset': {
                topic: function (assetGraph) {
                    return assetGraph.findAssets({url: /\/index\.da\.html$/})[0].text;
                },
                'the html tag should have a lang attribute with a value of "da"': function (text) {
                    assert.isTrue(/<html[^>]+lang=([\'\"])da\1/.test(text));
                }
            },
            'then getting the text of the American English Html asset': {
                topic: function (assetGraph) {
                    return assetGraph.findAssets({url: /\/index\.en_US\.html$/})[0].text;
                },
                'the one.tr expression in the inline script should be replaced with the American English text': function (text) {
                    assert.isTrue(/var localizedString\s*=\s*([\'\"])The American English text\1/.test(text));
                }
            },
            'then getting the text of the Danish Html asset': {
                topic: function (assetGraph) {
                    return assetGraph.findAssets({url: /\/index\.da\.html$/})[0].text;
                },
                'the one.tr expression in the inline script should be replaced with the Danish text': function (text) {
                    assert.isTrue(/var localizedString\s*=\s*([\'\"])The Danish text\1/.test(text));
                }
            }
        }
    },
    'After loading test case with multiple locales': {
        topic: function () {
            new AssetGraph({root: __dirname + '/cloneForEachLocale/multipleLocales/'}).queue(
                transforms.loadAssets('index.html'),
                transforms.populate(),
                transforms.injectOneBootstrapper({type: 'Html', isInitial: true})
            ).run(this.callback);
        },
        'the graph should contain 4 assets': function (assetGraph) {
            assert.equal(assetGraph.findAssets().length, 4);
            assert.equal(assetGraph.findAssets({type: 'Html'}).length, 1);
            assert.equal(assetGraph.findAssets({type: 'JavaScript', isInline: true}).length, 2);
            assert.equal(assetGraph.findAssets({type: 'I18n'}).length, 1);
        },
        'then get the inline JavaScript asset as text': {
            topic: function (assetGraph) {
                return getJavaScriptTextAndBootstrappedContext(assetGraph, {type: 'Html'});
            },
            'the plainOneTr function should use the default pattern': function (obj) {
                assert.equal(evaluateInContext(obj.text + "; return plainOneTr()", obj.context), 'Plain default');
            },
            'the callOneTrPattern function should use the default pattern': function (obj) {
                assert.equal(evaluateInContext(obj.text + "; return callOneTrPattern()", obj.context), 'Boring and stupid default pattern');
            },
            'the nonInvokedTrPattern should use the default pattern': function (obj) {
                assert.equal(evaluateInContext(obj.text + "; return nonInvokedTrPattern('X')", obj.context), 'Welcome to Default Country, Mr. X');
            }
        },
        'then run the cloneForEachLocale transform': {
            topic: function (assetGraph) {
                assetGraph.queue(
                    transforms.cloneForEachLocale({isInitial: true}, ['da', 'en_US']),
                    transforms.prettyPrintAssets({type: 'JavaScript'})
                ).run(this.callback);
            },
            'the graph should contain 2 Html assets': function (assetGraph) {
                assert.equal(assetGraph.findAssets({type: 'Html'}).length, 2);
            },
            'the graph should contain 4 JavaScript assets': function (assetGraph) {
                assert.equal(assetGraph.findAssets({type: 'JavaScript'}).length, 4);
            },
            'then get the American English JavaScript as text along with the bootstrapped context': {
                topic: function (assetGraph) {
                    return getJavaScriptTextAndBootstrappedContext(assetGraph, {type: 'Html', url: /\/index\.en_US\.html$/});
                },
                'the plainOneTr function should use the "en" pattern': function (obj) {
                    assert.equal(evaluateInContext(obj.text + "; return plainOneTr()", obj.context), 'Plain English');
                },
                'the callOneTrPattern function should use the "en" pattern': function (obj) {
                    assert.equal(evaluateInContext(obj.text + "; return callOneTrPattern();", obj.context), "Boring and stupid English pattern");
                },
                'the nonInvokedTrPattern should use the "en_US" pattern': function (obj) {
                    assert.equal(evaluateInContext(obj.text + "; return nonInvokedTrPattern('X');", obj.context), "Welcome to America, Mr. X");
                }
            },
            'then get the Danish JavaScript as text': {
                topic: function (assetGraph) {
                    return getJavaScriptTextAndBootstrappedContext(assetGraph, {type: 'Html', url: /\/index\.da\.html$/});
                },
                'the plainOneTr function should use the "en" pattern': function (obj) {
                    assert.equal(evaluateInContext(obj.text + "; return plainOneTr()", obj.context), 'Jævnt dansk');
                },
                'the callOneTrPattern function should use the "en" pattern': function (obj) {
                    assert.equal(evaluateInContext(obj.text + "; return callOneTrPattern();", obj.context), "Kedeligt and stupid dansk mønster");
                },
                'the nonInvokedTrPattern should use the "en_US" pattern': function (obj) {
                    assert.equal(evaluateInContext(obj.text + "; return nonInvokedTrPattern('X');", obj.context), "Velkommen til Danmark, hr. X");
                }
            },
            'the run the buildDevelopment conditional blocks': {
                topic: function (assetGraph) {
                    assetGraph.queue(transforms.runJavaScriptConditionalBlocks({isInitial: true}, 'buildDevelopment')).run(this.callback);
                },
                'the American English Html asset should contain the American English title': function (assetGraph) {
                    assert.equal(assetGraph.findAssets({type: 'Html', url: /\/index\.en_US\.html$/})[0].parseTree.title, "The awesome document title");
                },
                'the Danish Html asset should contain the Danish title': function (assetGraph) {
                    assert.equal(assetGraph.findAssets({type: 'Html', url: /\/index\.da\.html$/})[0].parseTree.title, "Dokumentets vidunderlige titel");
                }
            }
        }
    },
    'After loading test case with an Html asset with an inline HtmlStyle, then externalize the HtmlStyle and run cloneForEachLocale and inlineCssImagesWithLegacyFallback': {
        topic: function () {
            new AssetGraph({root: __dirname + '/cloneForEachLocale/inlineCssCombo/'}).queue(
                transforms.loadAssets('index.html'),
                transforms.populate(),
                transforms.externalizeRelations({type: 'HtmlStyle'}),
                transforms.cloneForEachLocale({type: 'Html'}, ['en_US', 'da']),
                transforms.inlineCssImagesWithLegacyFallback({type: 'Html'})
            ).run(this.callback);
        },
        'there should be 2 non-inline Html assets': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Html', isInline: false}).length, 2);
        },
        'the American English Html should contain two HtmlConditionalComment relations': function (assetGraph) {
            assert.equal(assetGraph.findRelations({from: {url: /\/index\.en_US\.html$/}, type: 'HtmlConditionalComment'}).length, 2);
        },
        'the Danish Html should contain two HtmlConditionalComment relations': function (assetGraph) {
            assert.equal(assetGraph.findRelations({from: {url: /\/index\.da\.html$/}, type: 'HtmlConditionalComment'}).length, 2);
        }

    }
})['export'](module);
