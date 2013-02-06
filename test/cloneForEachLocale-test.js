var vows = require('vows'),
    assert = require('assert'),
    vm = require('vm'),
    _ = require('underscore'),
    AssetGraph = require('../lib/AssetGraph'),
    passError = require('passerror'),
    i18nTools = require('../lib/i18nTools'),
    bootstrapper = require('../lib/bootstrapper');

function getJavaScriptTextAndBootstrappedContext(assetGraph, htmlQueryObj) {
    var htmlAsset = assetGraph.findAssets(htmlQueryObj)[0],
        htmlScriptRelations = assetGraph.findRelations({from: htmlAsset, to: {type: 'JavaScript'}}),
        inlineJavaScript;

    if (htmlScriptRelations[0].node.getAttribute('id') === 'bootstrapper') {
        inlineJavaScript = htmlScriptRelations[1].to;
    } else {
        inlineJavaScript = htmlScriptRelations[0].to;
    }

    return {
        text: inlineJavaScript.text,
        context: bootstrapper.createContext(assetGraph.findAssets(htmlQueryObj)[0], assetGraph, {TRANSLATE: false})
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
                    .cloneForEachLocale({type: 'Html'}, {localeIds: ['en_US', 'da']})
                    .run(this.callback);
            },
            'the graph should contain 2 Html assets': function (assetGraph) {
                assert.equal(assetGraph.findAssets({type: 'Html'}).length, 2);
            },
            'the graph should contain 1 CacheManifest asset': function (assetGraph) {
                assert.equal(assetGraph.findAssets({type: 'CacheManifest'}).length, 1);
            },
            'the graph should contain 2 HtmlStyle relations pointing at style.css': function (assetGraph) {
                assert.equal(assetGraph.findRelations({type: 'HtmlStyle', to: {url: /\/style\.css$/}}).length, 2);
            },
            'the graph should still contain one CssImage relation': function (assetGraph) {
                assert.equal(assetGraph.findRelations({type: 'CssImage'}).length, 1);
            },
            'then getting the text of the American English version of the Html asset': {
                topic: function (assetGraph) {
                    return assetGraph.findAssets({url: /\/index\.en_us\.html$/})[0].text;
                },
                'the html tag should have a lang attribute with a value of "en_US"': function (text) {
                    assert.isTrue(/<html[^>]+lang=([\'\"])en_us\1/.test(text));
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
                    return assetGraph.findAssets({url: /\/index\.en_us\.html$/})[0].text;
                },
                'the TR expression in the inline script should be replaced with the American English text': function (text) {
                    assert.isTrue(/var localizedString\s*=\s*([\'\"])The American English text\1/.test(text));
                }
            },
            'then getting the text of the Danish Html asset': {
                topic: function (assetGraph) {
                    return assetGraph.findAssets({url: /\/index\.da\.html$/})[0].text;
                },
                'the TR expression in the inline script should be replaced with the Danish text': function (text) {
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
                .injectBootstrapper({type: 'Html', isInitial: true})
                .run(this.callback);
        },
        'the graph should contain 4 assets': function (assetGraph) {
            assert.equal(assetGraph.findAssets().length, 4);
        },
        'the graph should contain one Html asset': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Html'}).length, 1);
        },
        'the graph should contain 2 inline JavaScript assets': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'JavaScript', isInline: true}).length, 2);
        },
        'the graph should contain 1 JavaScriptInclude relation': function (assetGraph) {
            assert.equal(assetGraph.findRelations({type: 'JavaScriptInclude'}).length, 1);
        },
        'the graph should contain one I18n asset': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'I18n'}).length, 1);
        },
        'then get the inline JavaScript asset as text': {
            topic: function (assetGraph) {
                return getJavaScriptTextAndBootstrappedContext(assetGraph, {type: 'Html'});
            },
            'the plainTr function should use the American English (default) pattern': function (obj) {
                assert.equal(evaluateInContext(obj.text + "; return plainTr()", obj.context), 'Plain English');
            },
            'the callTRPAT function should use the American English (default) pattern': function (obj) {
                assert.equal(evaluateInContext(obj.text + "; return callTRPAT()", obj.context), 'Boring and stupid English pattern');
            },
            'the nonInvokedTrPattern should use the American English (default) pattern': function (obj) {
                assert.equal(evaluateInContext(obj.text + "; return nonInvokedTrPattern('X')", obj.context), 'Welcome to America, Mr. X');
            }
        },
        'then run the cloneForEachLocale transform': {
            topic: function (assetGraph) {
                assetGraph
                    .cloneForEachLocale({isInitial: true}, {localeIds: ['da', 'en_US', 'en_GB']})
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
                var paragraphs = assetGraph.findAssets({url: /\/index\.en_gb\.html$/})[0].parseTree.getElementsByTagName('p');
                assert.equal(paragraphs[0].firstChild.nodeValue, 'Some text in body');
                assert.equal(paragraphs[1].innerHTML, 'A <span>beautiful</span> text with oh so <span>lovely</span> placeholders in it');
            },
            'the American English Html asset should contain the American English texts': function (assetGraph) {
                var paragraphs = assetGraph.findAssets({url: /\/index\.en_us\.html$/})[0].parseTree.getElementsByTagName('p');
                assert.equal(paragraphs[0].firstChild.nodeValue, 'Some text in body');
                assert.equal(paragraphs[1].innerHTML, 'A <span>beautiful</span> text with <span>lovely</span> placeholders in it');
            },
            'then get the American English JavaScript as text along with the bootstrapped context': {
                topic: function (assetGraph) {
                    return getJavaScriptTextAndBootstrappedContext(assetGraph, {type: 'Html', url: /\/index\.en_us\.html$/});
                },
                'the plainTr function should use the "en" pattern': function (obj) {
                    assert.equal(evaluateInContext(obj.text + "; return plainTr()", obj.context), 'Plain English');
                },
                'the callTRPAT function should use the "en" pattern': function (obj) {
                    assert.equal(evaluateInContext(obj.text + "; return callTRPAT();", obj.context), "Boring and stupid English pattern");
                },
                'the nonInvokedTrPattern should use the "en_US" pattern': function (obj) {
                    assert.equal(evaluateInContext(obj.text + "; return nonInvokedTrPattern('X');", obj.context), "Welcome to America, Mr. X");
                }
            },
            'then get the Danish JavaScript as text': {
                topic: function (assetGraph) {
                    return getJavaScriptTextAndBootstrappedContext(assetGraph, {type: 'Html', url: /\/index\.da\.html$/});
                },
                'the plainTr function should use the "en" pattern': function (obj) {
                    assert.equal(evaluateInContext(obj.text + "; return plainTr()", obj.context), 'Jævnt dansk');
                },
                'the callTRPAT function should use the "en" pattern': function (obj) {
                    assert.equal(evaluateInContext(obj.text + "; return callTRPAT();", obj.context), "Kedeligt and stupid dansk mønster");
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
                    assert.equal(assetGraph.findAssets({type: 'Html', url: /\/index\.en_us\.html$/})[0].parseTree.title, "The awesome document title");
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
                .cloneForEachLocale({type: 'Html'}, {localeIds: ['en_US', 'da']})
                .inlineCssImagesWithLegacyFallback({type: 'Html'})
                .run(this.callback);
        },
        'there should be 2 non-inline Html assets': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Html', isInline: false}).length, 2);
        },
        'the American English Html should contain one HtmlConditionalComment relation': function (assetGraph) {
            assert.equal(assetGraph.findRelations({from: {url: /\/index\.en_us\.html$/}, type: 'HtmlConditionalComment'}).length, 1);
        },
        'the Danish Html should contain one HtmlConditionalComment relation': function (assetGraph) {
            assert.equal(assetGraph.findRelations({from: {url: /\/index\.da\.html$/}, type: 'HtmlConditionalComment'}).length, 1);
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
        'the graph should contain 3 Html asset': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Html'}).length, 3);
        },
        'the graph should contain 2 Html fragment assets': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Html', isFragment: true}).length, 2);
        },
        'the graph should contain 1 JavaScript asset': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'JavaScript'}).length, 1);
        },
        'the graph should contain 1 I18n assets': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'I18n'}).length, 1);
        },
        'then run the cloneForEachLocale transform': {
            topic: function (assetGraph) {
                assetGraph
                    .cloneForEachLocale({type: 'Html'}, {localeIds: ['en_US', 'da']})
                    .run(this.callback);
            },
            'the graph should contain 8 assets': function (assetGraph) {
                assert.equal(assetGraph.findAssets().length, 8);
            },
            'the graph should contain 5 Html assets': function (assetGraph) {
                assert.equal(assetGraph.findAssets({type: 'Html'}).length, 5);
            },
            'the graph should contain 2 JavaScript assets': function (assetGraph) {
                assert.equal(assetGraph.findAssets({type: 'JavaScript'}).length, 2);
            },
            'the graph should contain 1 I18n assets': function (assetGraph) {
                assert.equal(assetGraph.findAssets({type: 'I18n'}).length, 1);
            },
            'the graph should contain 3 Html fragment assets': function (assetGraph) {
                assert.equal(assetGraph.findAssets({type: 'Html', isFragment: true}).length, 3);
            },
            'the first template used by Danish and American English JavaScript asset should be the same asset': function (assetGraph) {
                var danishJavaScript = assetGraph.findRelations({type: 'HtmlScript', from: {url: /\/index\.da\.html$/}})[0].to,
                    americanEnglishJavaScript = assetGraph.findRelations({type: 'HtmlScript', from: {url: /\/index\.en_us\.html$/}})[0].to;
                assert.ok(danishJavaScript);
                assert.ok(americanEnglishJavaScript);
                assert.equal(assetGraph.findRelations({from: danishJavaScript})[0].to,
                             assetGraph.findRelations({from: americanEnglishJavaScript})[0].to);
            },
            'the second template used by the Danish JavaScript should be cloned and translated': function (assetGraph) {
                var danishJavaScript = assetGraph.findRelations({type: 'HtmlScript', from: {url: /\/index\.da\.html$/}})[0].to;
                assert.equal(assetGraph.findRelations({from: danishJavaScript, type: 'JavaScriptGetText'})[1].to.parseTree.firstChild.innerHTML,
                             '\n' +
                             '    <div>Min sprognøgle</div>\n' +
                             '    <span id="bar">Min anden sprognøgle</span>\n'+
                             '    quux på dansk\n' +
                             '    <span title="blah på dansk">baz på dansk</span>\n' +
                             '    Her er en rar dyb i18n-struktur på dansk\n');
            },
            'the second template used by the American English JavaScript should be cloned and translated': function (assetGraph) {
                var americanEnglishJavaScript = assetGraph.findRelations({type: 'HtmlScript', from: {url: /\/index\.en_us\.html$/}})[0].to;
                assert.equal(assetGraph.findRelations({from: americanEnglishJavaScript, type: 'JavaScriptGetText'})[1].to.parseTree.firstChild.innerHTML,
                             '\n' +
                             '    <div>My language key</div>\n' +
                             '    <span id="bar">My other language key</span>\n' +
                             '    quux in English\n' +
                             '    <span title="blah in English">baz in English</span>\n' +
                             '    Here is a nice and English nested i18n construct in English\n');
            }
        }
    },
    'After loading test case with missing keys and default values': {
        topic: function () {
            new AssetGraph({root: __dirname + '/cloneForEachLocale/missingKeysAndWrongDefaultValues/'})
                .loadAssets('index.html')
                .populate()
                .run(this.callback);
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
        'then running the cloneForEachLocale transform': {
            topic: function (assetGraph) {
                assetGraph._cloneForEachLocaleInfo = {};
                assetGraph
                    .cloneForEachLocale({type: 'Html'}, {localeIds: ['en', 'da'], infoObject: assetGraph._cloneForEachLocaleInfo})
                    .run(this.callback);
            },
            'assetGraph._cloneForEachLocaleInfo should have a localeIdsByMissingKey property with the expected values': function (assetGraph) {
                assert.deepEqual(assetGraph._cloneForEachLocaleInfo.localeIdsByMissingKey, {
                    TheMissingTitle: ['da'],
                    AnotherMissingKey: ['da']
                });
            },
            'assetGraph._cloneForEachLocaleInfo should have a defaultValueMismatchesByKey property with the expected values': function (assetGraph) {
                assert.deepEqual(assetGraph._cloneForEachLocaleInfo.defaultValueMismatchesByKey, {
                    KeyWithMismatchingDefaultValue: {defaultValues: ['The default heading'], en: 'The default heading2'},
                    AnotherKeyWithMismatchingDefaultValue: {defaultValues: ['Default value'], en: 'Default value2'}
                });
            }
        }
    },
    'After loading test case with a TR in a data-bind attribute and run the cloneForEachLocale transform': {
        topic: function () {
            new AssetGraph({root: __dirname + '/cloneForEachLocale/trInHtmlDataBindAttribute/'})
                .loadAssets('index.html')
                .populate()
                .cloneForEachLocale({type: 'Html'}, {localeIds: ['en_US', 'da']})
                .run(this.callback);
        },
        'the TR in the Danish HTML should be replaced with "Den danske værdi"': function (assetGraph) {
            assert.matches(assetGraph.findAssets({url: /\/index\.da\.html$/})[0].text, /Den danske værdi/);
        }
    },
    'After loading test case with a TR in a data-bind attribute in a .ko template and run the cloneForEachLocale transform': {
        topic: function () {
            new AssetGraph({root: __dirname + '/cloneForEachLocale/trInHtmlDataBindAttributeInKoTemplate/'})
                .registerRequireJsConfig()
                .loadAssets('index.html')
                .populate()
                .bundleRequireJs()
                .cloneForEachLocale({type: 'Html'}, {localeIds: ['en_US', 'da']})
                .run(this.callback);
        },
        'the graph should contain 2 Html fragment assets': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Html', isFragment: true}).length, 2);
        },
        'the TR in the Danish Knockout.js template should be replaced with "Den danske værdi"': function (assetGraph) {
            var danishRequireJsMain = assetGraph.findAssets({type: 'JavaScript', incoming: {type: 'HtmlRequireJsMain', from: {url: /\/index\.da\.html$/}}})[0],
                danishKnockoutJsTemplate = assetGraph.findRelations({from: danishRequireJsMain, to: {type: 'Html', isFragment: true}})[0].to;
            assert.matches(danishKnockoutJsTemplate.text, /Den danske værdi/);
        }
    },
    'After loading test case with a JavaScript that uses LOCALEID, DEFAULTLOCALE, LOCALECOOKIENAME, and SUPPORTEDLOCALEIDS': {
        topic: function () {
            new AssetGraph({root: __dirname + '/cloneForEachLocale/globalVarUsageInJavaScript/'})
                .loadAssets('index.html')
                .populate()
                .cloneForEachLocale({type: 'Html'}, {localeIds: ['en_US', 'da'], defaultLocaleId: 'en_US', localeCookieName: 'myCookie'})
                .run(this.callback);
        },
        'the graph should contain 2 JavaScript assets': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'JavaScript'}).length, 2);
        },
        'the upper case vars should be replaced by their respective values': function (assetGraph) {
            var danishJavaScript = assetGraph.findAssets({type: 'JavaScript', incoming: {type: 'HtmlScript', from: {url: /\/index\.da\.html$/}}})[0];
            assert.equal(danishJavaScript.text, 'alert("da");alert("en_us");alert("myCookie");alert(["en_us","da"]);LOCALEID="foo"');
        }
    },
    'After loading test case with a template in an inline script': {
        topic: function () {
            new AssetGraph({root: __dirname + '/cloneForEachLocale/inlineScriptTemplate/'})
                .loadAssets('index.html')
                .populate()
                .run(this.callback);
        },
        'the graph should contain 4 assets': function (assetGraph) {
            assert.equal(assetGraph.findAssets().length, 4);
        },
        'the graph should contain 2 Html assets': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Html'}).length, 2);
        },
        'the graph should contain 1 JavaScript asset': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'JavaScript'}).length, 1);
        },
        'the graph should contain 1 I18n assets': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'I18n'}).length, 1);
        },
        'then run the cloneForEachLocale transform': {
            topic: function (assetGraph) {
                assetGraph
                    .cloneForEachLocale({type: 'Html', isInline: false}, {localeIds: ['en_US', 'da']})
                    .run(this.callback);
            },
            'the graph should contain 7 assets': function (assetGraph) {
                assert.equal(assetGraph.findAssets().length, 7);
            },
            'the graph should contain 4 Html assets': function (assetGraph) {
                assert.equal(assetGraph.findAssets({type: 'Html'}).length, 4);
            },
            'the graph should contain 2 JavaScript assets': function (assetGraph) {
                assert.equal(assetGraph.findAssets({type: 'JavaScript'}).length, 2);
            },
            'the graph should contain 1 I18n assets': function (assetGraph) {
                assert.equal(assetGraph.findAssets({type: 'I18n'}).length, 1);
            },
            'the Danish Html asset should contain the Danish text in the template': function (assetGraph) {
                assert.matches(assetGraph.findAssets({url: /\/index\.da\.html$/})[0].text, /Min sprognøgle/);
            }
        }
    },
    'After loading test case with a template in an inline script in a Knockout.js template': {
        topic: function () {
            new AssetGraph({root: __dirname + '/cloneForEachLocale/inlineScriptTemplateInKnockoutJsTemplate/'})
                .loadAssets('index.html')
                .populate()
                .run(this.callback);
        },
        'the graph should contain 5 assets': function (assetGraph) {
            assert.equal(assetGraph.findAssets().length, 5);
        },
        'the graph should contain 3 Html assets': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Html'}).length, 3);
        },
        'the graph should contain 2 Html fragment assets': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Html', isFragment: true}).length, 2);
        },
        'the graph should contain 1 JavaScript asset': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'JavaScript'}).length, 1);
        },
        'the graph should contain 1 I18n assets': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'I18n'}).length, 1);
        },
        'then run the cloneForEachLocale transform': {
            topic: function (assetGraph) {
                assetGraph
                    .cloneForEachLocale({type: 'Html', isInline: false}, {localeIds: ['en_US', 'da']})
                    .run(this.callback);
            },
            'the graph should contain 9 assets': function (assetGraph) {
                assert.equal(assetGraph.findAssets().length, 9);
            },
            'the graph should contain 6 Html assets': function (assetGraph) {
                assert.equal(assetGraph.findAssets({type: 'Html'}).length, 6);
            },
            'the graph should contain 2 JavaScript assets': function (assetGraph) {
                assert.equal(assetGraph.findAssets({type: 'JavaScript'}).length, 2);
            },
            'the graph should contain 4 Html fragment assets': function (assetGraph) {
                assert.equal(assetGraph.findAssets({type: 'Html', isFragment: true}).length, 4);
            },
            'the graph should contain 1 I18n assets': function (assetGraph) {
                assert.equal(assetGraph.findAssets({type: 'I18n'}).length, 1);
            },
            'the Danish Html KnockoutJsTemplate should contain the Danish text in the template': function (assetGraph) {
                var danishHtml = assetGraph.findAssets({url: /\/index\.da\.html$/})[0],
                    danishJavaScript = assetGraph.findRelations({from: danishHtml, type: 'HtmlScript'})[0].to,
                    danishKnockoutJsTemplate = assetGraph.findRelations({from: danishJavaScript, type: 'JavaScriptGetText'})[0].to;
                assert.matches(danishKnockoutJsTemplate.text, /Min sprognøgle/);
            }
        }
    },
    'After loading test case with a TRHTML expression': {
        topic: function () {
            new AssetGraph({root: __dirname + '/cloneForEachLocale/JavaScriptTrHtml/'})
                .loadAssets('index.html')
                .populate()
                .run(this.callback);
        },
        'the graph should contain 4 assets': function (assetGraph) {
            assert.equal(assetGraph.findAssets().length, 4);
        },
        'the graph should contain 2 Html assets': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Html'}).length, 2);
        },
        'the graph should contain 1 JavaScript asset': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'JavaScript'}).length, 1);
        },
        'the graph should contain 1 I18n assets': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'I18n'}).length, 1);
        },
        'the graph should contain 1 JavaScriptTrHtml relation': function (assetGraph) {
            assert.equal(assetGraph.findRelations({type: 'JavaScriptTrHtml'}).length, 1);
        },
        'then run the cloneForEachLocale transform': {
            topic: function (assetGraph) {
                assetGraph
                    .cloneForEachLocale({type: 'Html', url: /\/index\.html$/}, {localeIds: ['en_US', 'da']})
                    .run(this.callback);
            },
            'the graph should contain 7 assets': function (assetGraph) {
                assert.equal(assetGraph.findAssets().length, 7);
            },
            'the graph should contain 4 Html assets': function (assetGraph) {
                assert.equal(assetGraph.findAssets({type: 'Html'}).length, 4);
            },
            'the graph should contain 2 JavaScript assets': function (assetGraph) {
                assert.equal(assetGraph.findAssets({type: 'JavaScript'}).length, 2);
            },
            'the graph should contain 1 I18n assets': function (assetGraph) {
                assert.equal(assetGraph.findAssets({type: 'I18n'}).length, 1);
            },
            'then inline the JavaScriptTrHtml relations': {
                topic: function (assetGraph) {
                    assetGraph
                        .inlineRelations({type: 'JavaScriptTrHtml'})
                        .run(this.callback);
                },
                'the Danish JavaScript should contain the Danish text': function (assetGraph) {
                    var danishHtml = assetGraph.findAssets({url: /\/index\.da\.html$/})[0];
                    assert.matches(assetGraph.findRelations({from: danishHtml, type: 'HtmlScript'})[0].to.text, /var myHtmlString\s*=\s*TRHTML\((['"])Den danske værdi\1\)/);
                }
            }
        }
    },
    'After loading test case with a TRHTML(GETTEXT(...)) expression': {
        topic: function () {
            new AssetGraph({root: __dirname + '/cloneForEachLocale/JavaScriptTrHtmlAndJavaScriptGetText/'})
                .loadAssets('index.html')
                .populate()
                .run(this.callback);
        },
        'the graph should contain 4 assets': function (assetGraph) {
            assert.equal(assetGraph.findAssets().length, 4);
        },
        'the graph should contain 2 Html assets': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Html'}).length, 2);
        },
        'the graph should contain 1 JavaScript asset': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'JavaScript'}).length, 1);
        },
        'the graph should contain 1 I18n assets': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'I18n'}).length, 1);
        },
        'the graph should contain 1 JavaScriptTrHtml relation': function (assetGraph) {
            assert.equal(assetGraph.findRelations({type: 'JavaScriptTrHtml'}).length, 1);
        },
        'the graph should contain no JavaScriptGetText relations': function (assetGraph) {
            assert.equal(assetGraph.findRelations({type: 'JavaScriptGetText'}).length, 0);
        },
        'then run the cloneForEachLocale transform': {
            topic: function (assetGraph) {
                assetGraph
                    .cloneForEachLocale({type: 'Html', url: /\/index\.html$/}, {localeIds: ['en_US', 'da']})
                    .run(this.callback);
            },
            'the graph should contain 7 assets': function (assetGraph) {
                assert.equal(assetGraph.findAssets().length, 7);
            },
            'the graph should contain 4 Html assets': function (assetGraph) {
                assert.equal(assetGraph.findAssets({type: 'Html'}).length, 4);
            },
            'the graph should contain 2 JavaScript assets': function (assetGraph) {
                assert.equal(assetGraph.findAssets({type: 'JavaScript'}).length, 2);
            },
            'the graph should contain 1 I18n assets': function (assetGraph) {
                assert.equal(assetGraph.findAssets({type: 'I18n'}).length, 1);
            },
            'then inline the JavaScriptTrHtml relations': {
                topic: function (assetGraph) {
                    assetGraph
                        .inlineRelations({type: 'JavaScriptTrHtml'})
                        .run(this.callback);
                },
                'the Danish JavaScript should contain the Danish text': function (assetGraph) {
                    var danishHtml = assetGraph.findAssets({url: /\/index\.da\.html$/})[0];
                    assert.matches(assetGraph.findRelations({from: danishHtml, type: 'HtmlScript'})[0].to.text, /var myHtmlString\s*=\s*TRHTML\((['"])Den danske værdi\\n\1\)/);
                },
                'then manipulate the Html assets pointed to by the JavaScriptTrHtml relations': {
                    topic: function (assetGraph) {
                        assetGraph.findRelations({type: 'JavaScriptTrHtml'}).forEach(function (javaScriptTrHtml) {
                            var htmlAsset = javaScriptTrHtml.to,
                                document = htmlAsset.parseTree;
                            document.appendChild(document.createElement('div')).appendChild(document.createTextNode('foo'));
                            htmlAsset.markDirty();
                        });
                        return assetGraph;
                    },
                    'the Danish JavaScript should have the freshly created <div>foo</div> in the string': function (assetGraph) {
                        var danishHtml = assetGraph.findAssets({url: /\/index\.da\.html$/})[0];
                        assert.matches(assetGraph.findRelations({from: danishHtml, type: 'HtmlScript'})[0].to.text, /var myHtmlString\s*=\s*TRHTML\((['"])Den danske værdi\\n<div>foo<\/div>\1\)/);
                    }
                }
            }
        }
    },
    'After loading test case with inconsistent default values in TR calls and running the cloneForEachLocale transform': {
        topic: function () {
            var assetGraph = new AssetGraph({root: __dirname + '/cloneForEachLocale/inconsistentTrDefaultValues/'});
            assetGraph._cloneForEachLocaleInfo = {};
            assetGraph
                .loadAssets('index.html')
                .populate()
                .cloneForEachLocale({type: 'Html'}, {localeIds: ['en', 'da'], infoObject: assetGraph._cloneForEachLocaleInfo})
                .run(this.callback);
        },
        'assetGraph._cloneForEachLocaleInfo should have a defaultValueMismatchesByKey property with the expected values': function (assetGraph) {
            assert.deepEqual(assetGraph._cloneForEachLocaleInfo.defaultValueMismatchesByKey, {
                keyname: {defaultValues: ['defaultValue1', 'defaultValue2']},
                keyname2: {defaultValues: ['defaultValue3', 'defaultValue4']}
            });
        }
    },
    'After loading test case with whitespace bugs in language key values and running the cloneForEachLocale transform': {
        topic: function () {
            var assetGraph = new AssetGraph({root: __dirname + '/cloneForEachLocale/whitespaceInDefaultValues/'});
            assetGraph._cloneForEachLocaleInfo = {};
            assetGraph
                .loadAssets('index.html')
                .populate()
                .cloneForEachLocale({type: 'Html'}, {localeIds: ['en', 'da'], infoObject: assetGraph._cloneForEachLocaleInfo})
                .run(this.callback);
        },
        'assetGraph._cloneForEachLocaleInfo should have a whitespaceWarningsByKey property with the expected values': function (assetGraph) {
            assert.deepEqual(assetGraph._cloneForEachLocaleInfo.whitespaceWarningsByKey, {
                trKeyWithLeadingWhitespaceInTheDefaultValue: [{type: 'defaultValue', localeId: 'en', value: ' foo'}],
                trKeyWithTrailingWhitespaceInTheDefaultValue: [{type: 'defaultValue', localeId: 'en', value: 'foo '}],
                trKeyWithLeadingWhitespaceInTheDanishValue: [{type: 'value', localeId: 'da', value: ' foo'}],
                trKeyWithTrailingWhitespaceInTheDanishValue: [{type: 'value', localeId: 'da', value: 'foo '}],
                dataI18nKeyWithLeadingWhitespaceInTheDanishValue: [{type: 'value', localeId: 'da', value: ' foo'}],
                dataI18nKeyWithTrailingWhitespaceInTheDanishValue: [{type: 'value', localeId: 'da', value: 'foo '}]
                // These are stripped by eachI18nTagInHtmlDocument:
                // dataI18nKeyWithLeadingWhitespaceInTheDefaultValue: [{type: 'defaultValue', localeId: 'en', value: ' foo'}],
                // dataI18nKeyWithTrailingWhitespaceInTheDefaultValue: [{type: 'defaultValue', localeId: 'en', value: 'foo '}],
            });
        }
    },
    'After loading test case with a Css asset that needs localization and running the cloneForEachLocale transform': {
        topic: function () {
            new AssetGraph({root: __dirname + '/cloneForEachLocale/css/'})
                .loadAssets('index.html')
                .populate()
                .cloneForEachLocale({type: 'Html'}, {localeIds: ['en', 'da', 'de']})
                .run(this.callback);
        },
        'the graph should contain 4 Css assets': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Css'}).length, 4);
        },
        'the graph should contain 3 Png assets': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Png'}).length, 3);
        },
        'the Danish Css should contain the expected rules and outgoing relations': function (assetGraph) {
            var danishCss = assetGraph.findAssets({url: /\/needsLocalization\.da\.css$/})[0],
                cssRules = danishCss.parseTree.cssRules;
            assert.equal(cssRules.length, 2);
            assert.equal(cssRules[0].selectorText, 'body');
            assert.equal(cssRules[1].selectorText, 'html .theThing');
            var outgoingRelations = assetGraph.findRelations({from: danishCss});
            assert.equal(outgoingRelations.length, 1);
            assert.equal(outgoingRelations[0].href, 'foo.png');
        },
        'the German Css should contain the expected rules and outgoing relations': function (assetGraph) {
            var germanCss = assetGraph.findAssets({url: /\/needsLocalization\.de\.css$/})[0],
                cssRules = germanCss.parseTree.cssRules;
            assert.equal(cssRules.length, 2);
            assert.equal(cssRules[0].selectorText, 'body');
            assert.equal(cssRules[1].selectorText, 'html.anotherClassOnHtml .theGermanThing');
            var outgoingRelations = assetGraph.findRelations({from: germanCss});
            assert.equal(outgoingRelations.length, 1);
            assert.ok(outgoingRelations[0].to.isImage);
        },
        'the English Css should contain the expected rules and outgoing relations': function (assetGraph) {
            var englishCss = assetGraph.findAssets({url: /\/needsLocalization\.en\.css$/})[0],
                cssRules = englishCss.parseTree.cssRules;
            assert.equal(cssRules.length, 1);
            assert.equal(cssRules[0].selectorText, 'body');
            var outgoingRelations = assetGraph.findRelations({from: englishCss});
            assert.equal(outgoingRelations.length, 0);
        },
        'bar.png should have no incoming relations': function (assetGraph) {
            assert.equal(assetGraph.findRelations({to: {url: /\/bar\.png$/}}).length, 0);
        },
        'needsLocalization.de.css should have a relation to an inline image': function (assetGraph) {
            assert.equal(assetGraph.findRelations({from: {url: /\/needsLocalization\.de\.css$/}, to: {isInline: true, isImage: true}}).length, 1);
        },
        'needsLocalization.da.css should not have a relation to an inline image': function (assetGraph) {
            assert.equal(assetGraph.findRelations({from: {url: /\/needsLocalization\.da\.css$/}, to: {isInline: true, isImage: true}}).length, 0);
        }
    },
    'After loading test case with two Html assets that include references to the same JavaScripts and running the cloneForEachLocale transform': {
        topic: function () {
            new AssetGraph({root: __dirname + '/cloneForEachLocale/multipleHtmls/'})
                .loadAssets('1.html', '2.html')
                .populate()
                .cloneForEachLocale({type: 'Html'}, {localeIds: ['en', 'da']})
                .run(this.callback);
        },
        'the graph should contain 4 Html assets with the expected urls': function (assetGraph) {
            assert.deepEqual(_.pluck(assetGraph.findAssets({type: 'Html'}), 'url').sort(), [
                assetGraph.root + '1.da.html',
                assetGraph.root + '1.en.html',
                assetGraph.root + '2.da.html',
                assetGraph.root + '2.en.html'
            ]);
        },
        'the graph should contain 4 JavaScript with the expected urls': function (assetGraph) {
            assert.deepEqual(_.pluck(assetGraph.findAssets({type: 'JavaScript'}), 'url').sort(), [
                assetGraph.root + 'doesNotNeedLocalization.da.js',
                assetGraph.root + 'doesNotNeedLocalization.en.js',
                assetGraph.root + 'needsLocalization.da.js',
                assetGraph.root + 'needsLocalization.en.js'
            ]);
        }
    },
    'After loading test case in which a language key uses the same placeholder twice in the Danish translation, then run the cloneForEachLocale transform': {
        topic: function () {
            new AssetGraph({root: __dirname + '/cloneForEachLocale/reusePlaceHolder/'})
                .loadAssets('index.html')
                .populate()
                .cloneForEachLocale({type: 'Html'}, {localeIds: ['en', 'da']})
                .run(this.callback);
        },
        'the Danish Html should have two spans': function (assetGraph) {
            assert.equal(assetGraph.findAssets({url: /\/index\.da\.html$/})[0].parseTree.body.innerHTML, '\n    <div>Some <span>foo</span> <span>foo</span> thing</div>\n    <script>INCLUDE("index.i18n")</script>\n');
        }
    },
    'After loading test case in which a language key uses the same placeholder twice in the Danish translation, and the placeholder in the Html has a relation in it, then run the cloneForEachLocale transform': {
        topic: function () {
            new AssetGraph({root: __dirname + '/cloneForEachLocale/relationInPlaceHolder/'})
                .loadAssets('index.html')
                .populate()
                .cloneForEachLocale({type: 'Html'}, {localeIds: ['en', 'da']})
                .run(this.callback);
        },
        'the English Html asset should have one outgoing HtmlImage relation': function (assetGraph) {
            assert.equal(assetGraph.findRelations({type: 'HtmlImage', from: {url: /\/index\.en\.html$/}}).length, 1);
        },
        'the Danish Html asset should have two outgoing HtmlImage relations': function (assetGraph) {
            assert.equal(assetGraph.findRelations({type: 'HtmlImage', from: {url: /\/index\.da\.html$/}}).length, 2);
        }
    },
    'After loading a test case with a script that uses LOCALEID in a conditional, then run the cloneForEachLocale transform': {
        topic: function () {
            new AssetGraph({root: __dirname + '/cloneForEachLocale/constantFoldLocaleId/'})
                .loadAssets('index.html')
                .populate()
                .cloneForEachLocale({type: 'Html'}, {localeIds: ['en', 'da']})
                .run(this.callback);
        },
        'the script in the English Html asset should have the expected contents': function (assetGraph) {
            assert.equal(assetGraph.findRelations({from: {url: /\/index\.en\.html$/}})[0].to.text, 'alert("foo");alert("baz");alert("quux")');
        },
        'the script in the Danish Html asset should have the expected contents': function (assetGraph) {
            assert.equal(assetGraph.findRelations({from: {url: /\/index\.da\.html$/}})[0].to.text, 'alert("foo");alert("bar");alert("boz");alert("quux")');
        }
    }
})['export'](module);
