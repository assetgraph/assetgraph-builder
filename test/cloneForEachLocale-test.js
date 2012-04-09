var vows = require('vows'),
    assert = require('assert'),
    vm = require('vm'),
    AssetGraph = require('assetgraph'),
    passError = require('assetgraph/lib/util/passError'),
    i18nTools = require('../lib/util/i18nTools'),
    oneBootstrapper = require('../lib/util/oneBootstrapper');

require('../lib/registerTransforms');

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
            new AssetGraph({root: __dirname + '/cloneForEachLocale/simple/'})
                .loadAssets('index.html')
                .populate()
                .run(this.callback);
        },
        'the graph should contain one Html asset': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Html'}).length, 1);
        },
        'the graph should contain one CacheManifest asset': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'CacheManifest'}).length, 1);
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
                assetGraph
                    .cloneForEachLocale({type: 'Html'}, ['en_US', 'da'])
                    .run(this.callback);
            },
            'the graph should contain 2 Html assets': function (assetGraph) {
                assert.equal(assetGraph.findAssets({type: 'Html'}).length, 2);
            },
            'the graph should contain 2 CacheManifest assets': function (assetGraph) {
                assert.equal(assetGraph.findAssets({type: 'CacheManifest'}).length, 2);
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
            new AssetGraph({root: __dirname + '/cloneForEachLocale/multipleLocales/'})
                .loadAssets('index.html')
                .populate()
                .injectOneBootstrapper({type: 'Html', isInitial: true})
                .run(this.callback);
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
            'the plainOneTr function should use the American English (default) pattern': function (obj) {
                assert.equal(evaluateInContext(obj.text + "; return plainOneTr()", obj.context), 'Plain English');
            },
            'the callOneTrPattern function should use the American English (default) pattern': function (obj) {
                assert.equal(evaluateInContext(obj.text + "; return callOneTrPattern()", obj.context), 'Boring and stupid English pattern');
            },
            'the nonInvokedTrPattern should use the American English (default) pattern': function (obj) {
                assert.equal(evaluateInContext(obj.text + "; return nonInvokedTrPattern('X')", obj.context), 'Welcome to America, Mr. X');
            }
        },
        'then run the cloneForEachLocale transform': {
            topic: function (assetGraph) {
                assetGraph
                    .cloneForEachLocale({isInitial: true}, ['da', 'en_US', 'en_GB'])
                    .prettyPrintAssets({type: 'JavaScript'})
                    .run(this.callback);
            },
            'the graph should contain 3 Html assets': function (assetGraph) {
                assert.equal(assetGraph.findAssets({type: 'Html'}).length, 3);
            },
            'the graph should contain 6 JavaScript assets': function (assetGraph) {
                assert.equal(assetGraph.findAssets({type: 'JavaScript'}).length, 6);
            },
            'the Danish Html asset should contain the Danish texts': function (assetGraph) {
                var paragraphs = assetGraph.findAssets({url: /\/index\.da\.html$/})[0].parseTree.getElementsByTagName('p');
                assert.equal(paragraphs[0].firstChild.nodeValue, 'Kropstekst');
                assert.equal(paragraphs[1].innerHTML, 'En <span>beautiful</span> tekst med <span>lovely</span> pladsholdere i sig');
            },
            'the British English Html asset should contain the British English texts': function (assetGraph) {
                var paragraphs = assetGraph.findAssets({url: /\/index\.en_GB\.html$/})[0].parseTree.getElementsByTagName('p');
                assert.equal(paragraphs[0].firstChild.nodeValue, 'Some text in body');
                assert.equal(paragraphs[1].innerHTML, 'A <span>beautiful</span> text with oh so <span>lovely</span> placeholders in it');
            },
            'the American English Html asset should contain the American English texts': function (assetGraph) {
                var paragraphs = assetGraph.findAssets({url: /\/index\.en_US\.html$/})[0].parseTree.getElementsByTagName('p');
                assert.equal(paragraphs[0].firstChild.nodeValue, 'Some text in body');
                assert.equal(paragraphs[1].innerHTML, 'A <span>beautiful</span> text with <span>lovely</span> placeholders in it');
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
                    assetGraph
                        .runJavaScriptConditionalBlocks({isInitial: true}, 'buildDevelopment')
                        .run(this.callback);
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
            new AssetGraph({root: __dirname + '/cloneForEachLocale/inlineCssCombo/'})
                .loadAssets('index.html')
                .populate()
                .externalizeRelations({type: 'HtmlStyle'})
                .cloneForEachLocale({type: 'Html'}, ['en_US', 'da'])
                .inlineCssImagesWithLegacyFallback({type: 'Html'})
                .run(this.callback);
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

    },
    'After loading test case with a couple of Knockout templates': {
        topic: function () {
            new AssetGraph({root: __dirname + '/cloneForEachLocale/knockoutTemplate/'})
                .loadAssets('index.html')
                .populate()
                .run(this.callback);
        },
        'the graph should contain 5 assets': function (assetGraph) {
            assert.equal(assetGraph.findAssets().length, 5);
        },
        'the graph should contain 1 Html asset': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Html'}).length, 1);
        },
        'the graph should contain 1 JavaScript asset': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'JavaScript'}).length, 1);
        },
        'the graph should contain 1 I18n assets': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'I18n'}).length, 1);
        },
        'the graph should contain 2 KnockoutJsTemplate assets': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'KnockoutJsTemplate'}).length, 2);
        },
        'then run the cloneForEachLocale transform': {
            topic: function (assetGraph) {
                assetGraph
                    .cloneForEachLocale({type: 'Html'}, ['en_US', 'da'])
                    .run(this.callback);
            },
            'the graph should contain 8 assets': function (assetGraph) {
                assert.equal(assetGraph.findAssets().length, 8);
            },
            'the graph should contain 2 Html assets': function (assetGraph) {
                assert.equal(assetGraph.findAssets({type: 'Html'}).length, 2);
            },
            'the graph should contain 2 JavaScript assets': function (assetGraph) {
                assert.equal(assetGraph.findAssets({type: 'JavaScript'}).length, 2);
            },
            'the graph should contain 1 I18n assets': function (assetGraph) {
                assert.equal(assetGraph.findAssets({type: 'I18n'}).length, 1);
            },
            'the graph should contain 3 KnockoutJsTemplate assets': function (assetGraph) {
                assert.equal(assetGraph.findAssets({type: 'KnockoutJsTemplate'}).length, 3);
            },
            'the first template used by Danish and American English JavaScript asset should be the same asset': function (assetGraph) {
                var danishJavaScript = assetGraph.findRelations({type: 'HtmlScript', from: {url: /\/index\.da\.html$/}})[0].to,
                    americanEnglishJavaScript = assetGraph.findRelations({type: 'HtmlScript', from: {url: /\/index\.en_US\.html$/}})[0].to;
                assert.ok(danishJavaScript);
                assert.ok(americanEnglishJavaScript);
                assert.equal(assetGraph.findRelations({from: danishJavaScript})[0].to,
                             assetGraph.findRelations({from: americanEnglishJavaScript})[0].to);
            },
            'the second template used by the Danish JavaScript should be cloned and translated': function (assetGraph) {
                var danishJavaScript = assetGraph.findRelations({type: 'HtmlScript', from: {url: /\/index\.da\.html$/}})[0].to;
                assert.equal(assetGraph.findRelations({from: danishJavaScript, type: 'JavaScriptOneGetText'})[1].to.parseTree.firstChild.innerHTML,
                             '\n    Min sprognøgle\n    Her er en rar dyb i18n-struktur på dansk\n');
            },
            'the second template used by the American English JavaScript should be cloned and translated': function (assetGraph) {
                var americanEnglishJavaScript = assetGraph.findRelations({type: 'HtmlScript', from: {url: /\/index\.en_US\.html$/}})[0].to;
                assert.equal(assetGraph.findRelations({from: americanEnglishJavaScript, type: 'JavaScriptOneGetText'})[1].to.parseTree.firstChild.innerHTML,
                             '\n    My language key\n    Here is a nice and English nested i18n construct in English\n');
            }
        }
    }
})['export'](module);
