/*global describe, it*/
var expect = require('../unexpected-with-plugins'),
    vm = require('vm'),
    _ = require('underscore'),
    AssetGraph = require('../../lib/AssetGraph'),
    bootstrapper = require('../../lib/bootstrapper');

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
    vm.runInContext('result = (function () {' + src + '}());', context);
    return context.result;
}

describe('cloneForEachLocale', function () {
    it('should make a clone of each Html file for each language', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/transforms/cloneForEachLocale/simple/'})
            .loadAssets('index.html')
            .populate()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain asset', 'Html');
                expect(assetGraph, 'to contain asset', 'CacheManifest');
                expect(assetGraph, 'to contain asset', {type: 'JavaScript', isInline: true});
                expect(assetGraph, 'to contain asset', 'I18n');
                expect(assetGraph, 'to contain relation', 'HtmlStyle');
                expect(assetGraph, 'to contain asset', 'Css');
                expect(assetGraph, 'to contain relation', 'CssImage');
                expect(assetGraph, 'to contain asset', 'Png');
            })
            .cloneForEachLocale({type: 'Html'}, {localeIds: ['en_US', 'da']})
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain assets', 'Html', 2);
                expect(assetGraph, 'to contain asset', 'CacheManifest');
                expect(assetGraph, 'to contain relations', {type: 'HtmlStyle', to: {url: /\/style\.css$/}}, 2);
                expect(assetGraph, 'to contain relation', 'CssImage');

                expect(assetGraph.findAssets({url: /\/index\.en_us\.html$/})[0].text, 'to match', /<html[^>]+lang=([\'\"])en_us\1/);
                expect(assetGraph.findAssets({url: /\/index\.en_us\.html$/})[0].text, 'to match', /var localizedString\s*=\s*([\'\"])The American English text\1/);
                expect(assetGraph.findAssets({url: /\/index\.da\.html$/})[0].text, 'to match', /var localizedString\s*=\s*([\'\"])The Danish text\1/);
            })
            .run(done);
    });

    it('should handle multiple locales', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/transforms/cloneForEachLocale/multipleLocales/'})
            .loadAssets('index.html')
            .populate()
            .injectBootstrapper({type: 'Html', isInitial: true})
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain assets', {}, 4);
                expect(assetGraph, 'to contain asset', 'Html');
                expect(assetGraph, 'to contain assets', {type: 'JavaScript', isInline: true}, 2);
                expect(assetGraph, 'to contain relation', 'JavaScriptInclude');
                expect(assetGraph, 'to contain asset', 'I18n');

                var obj = getJavaScriptTextAndBootstrappedContext(assetGraph, {type: 'Html'});
                expect(evaluateInContext(obj.text + '; return plainTr()', obj.context), 'to equal', 'Plain English');
                expect(evaluateInContext(obj.text + '; return callTRPAT()', obj.context), 'to equal', 'Boring and stupid English pattern');
                expect(evaluateInContext(obj.text + '; return nonInvokedTrPattern(\'X\')', obj.context), 'to equal', 'Welcome to America, Mr. X');
            })
            .cloneForEachLocale({isInitial: true}, {localeIds: ['da', 'en_US', 'en_GB']})
            .prettyPrintAssets({type: 'JavaScript'})
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain assets', 'Html', 3);
                expect(assetGraph, 'to contain assets', 'JavaScript', 6);

                var paragraphs = assetGraph.findAssets({url: /\/index\.da\.html$/})[0].parseTree.getElementsByTagName('p');
                expect(paragraphs[0].firstChild.nodeValue, 'to equal', 'Kropstekst');
                expect(paragraphs[1].innerHTML, 'to equal', 'En <span>beautiful</span> tekst med <span>lovely</span> pladsholdere i sig');

                paragraphs = assetGraph.findAssets({url: /\/index\.en_gb\.html$/})[0].parseTree.getElementsByTagName('p');
                expect(paragraphs[0].firstChild.nodeValue, 'to equal', 'Some text in body');
                expect(paragraphs[1].innerHTML, 'to equal', 'A <span>beautiful</span> text with oh so <span>lovely</span> placeholders in it');

                paragraphs = assetGraph.findAssets({url: /\/index\.en_us\.html$/})[0].parseTree.getElementsByTagName('p');
                expect(paragraphs[0].firstChild.nodeValue, 'to equal', 'Some text in body');
                expect(paragraphs[1].innerHTML, 'to equal', 'A <span>beautiful</span> text with <span>lovely</span> placeholders in it');

                var obj = getJavaScriptTextAndBootstrappedContext(assetGraph, {type: 'Html', url: /\/index\.en_us\.html$/});
                expect(evaluateInContext(obj.text + '; return plainTr()', obj.context), 'to equal', 'Plain English');
                expect(evaluateInContext(obj.text + '; return callTRPAT();', obj.context), 'to equal', 'Boring and stupid English pattern');
                expect(evaluateInContext(obj.text + '; return nonInvokedTrPattern(\'X\');', obj.context), 'to equal', 'Welcome to America, Mr. X');

                obj = getJavaScriptTextAndBootstrappedContext(assetGraph, {type: 'Html', url: /\/index\.da\.html$/});
                expect(evaluateInContext(obj.text + '; return plainTr()', obj.context), 'to equal', 'Jævnt dansk');
                expect(evaluateInContext(obj.text + '; return callTRPAT();', obj.context), 'to equal', 'Kedeligt and stupid dansk mønster');
                expect(evaluateInContext(obj.text + '; return nonInvokedTrPattern(\'X\');', obj.context), 'to equal', 'Velkommen til Danmark, hr. X');
            })
            .runJavaScriptConditionalBlocks({isInitial: true}, 'buildDevelopment')
            .queue(function (assetGraph) {
                expect(assetGraph.findAssets({type: 'Html', url: /\/index\.en_us\.html$/})[0].parseTree.title, 'to equal', 'The awesome document title');
                expect(assetGraph.findAssets({type: 'Html', url: /\/index\.da\.html$/})[0].parseTree.title, 'to equal', 'Dokumentets vidunderlige titel');
            })
            .run(done);
    });

    it('should handle a test case with an externalized inline HtmlStyle and inlineCssImagesWithLegacyFallback', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/transforms/cloneForEachLocale/inlineCssCombo/'})
            .loadAssets('index.html')
            .populate()
            .externalizeRelations({type: 'HtmlStyle'})
            .cloneForEachLocale({type: 'Html'}, {localeIds: ['en_US', 'da']})
            .inlineCssImagesWithLegacyFallback({type: 'Html'})
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain assets', {type: 'Html', isInline: false}, 2);
                expect(assetGraph, 'to contain relation', {from: {url: /\/index\.en_us\.html$/}, type: 'HtmlConditionalComment'});
                expect(assetGraph, 'to contain relation', {from: {url: /\/index\.da\.html$/}, type: 'HtmlConditionalComment'});
            })
            .run(done);
    });

    it('should handle Knockout.js templates', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/transforms/cloneForEachLocale/knockoutTemplate/'})
            .loadAssets('index.html')
            .populate()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain assets', {}, 5);
                expect(assetGraph, 'to contain assets', 'Html', 3);
                expect(assetGraph, 'to contain assets', {type: 'Html', isFragment: true}, 2);
                expect(assetGraph, 'to contain asset', 'JavaScript');
                expect(assetGraph, 'to contain asset', 'I18n');
            })
            .cloneForEachLocale({type: 'Html'}, {localeIds: ['en_US', 'da']})
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain assets', {}, 8);
                expect(assetGraph, 'to contain assets', 'Html', 5);
                expect(assetGraph, 'to contain assets', 'JavaScript', 2);
                expect(assetGraph, 'to contain asset', 'I18n');
                expect(assetGraph, 'to contain assets', {type: 'Html', isFragment: true}, 3);

                var danishJavaScript = assetGraph.findRelations({type: 'HtmlScript', from: {url: /\/index\.da\.html$/}})[0].to,
                    americanEnglishJavaScript = assetGraph.findRelations({type: 'HtmlScript', from: {url: /\/index\.en_us\.html$/}})[0].to;
                expect(danishJavaScript, 'to be truthy');
                expect(americanEnglishJavaScript, 'to be truthy');
                expect(assetGraph.findRelations({from: danishJavaScript})[0].to, 'to equal', assetGraph.findRelations({from: americanEnglishJavaScript})[0].to);

                danishJavaScript = assetGraph.findRelations({type: 'HtmlScript', from: {url: /\/index\.da\.html$/}})[0].to;
                expect(
                    assetGraph.findRelations({from: danishJavaScript, type: 'JavaScriptGetText'})[1].to.parseTree.firstChild.innerHTML,
                    'to equal',
                    '\n' +
                    '    <div>Min sprognøgle</div>\n' +
                    '    <span id="bar">Min anden sprognøgle</span>\n' +
                    '    quux på dansk\n' +
                    '    <span title="blah på dansk">baz på dansk</span>\n' +
                    '    Her er en rar dyb i18n-struktur på dansk\n'
                );

                americanEnglishJavaScript = assetGraph.findRelations({type: 'HtmlScript', from: {url: /\/index\.en_us\.html$/}})[0].to;
                expect(
                    assetGraph.findRelations({from: americanEnglishJavaScript, type: 'JavaScriptGetText'})[1].to.parseTree.firstChild.innerHTML,
                    'to equal',
                     '\n' +
                     '    <div>My language key</div>\n' +
                     '    <span id="bar">My other language key</span>\n' +
                     '    quux in English\n' +
                     '    <span title="blah in English">baz in English</span>\n' +
                     '    Here is a nice and English nested i18n construct in English\n'
                );
            })
            .run(done);

    });

    it('should handle a TR in a data-bind attribute', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/transforms/cloneForEachLocale/trInHtmlDataBindAttribute/'})
            .loadAssets('index.html')
            .populate()
            .cloneForEachLocale({type: 'Html'}, {localeIds: ['en_US', 'da']})
            .queue(function (assetGraph) {
                expect(assetGraph.findAssets({url: /\/index\.da\.html$/})[0].text, 'to match', /Den danske værdi/);
            })
            .run(done);
    });

    it('should handle a TR in a data-bind attribute in a .ko template', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/transforms/cloneForEachLocale/trInHtmlDataBindAttributeInKoTemplate/'})
            .registerRequireJsConfig()
            .loadAssets('index.html')
            .populate()
            .flattenRequireJs()
            .cloneForEachLocale({type: 'Html'}, {localeIds: ['en_US', 'da']})
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain assets', {type: 'Html', isFragment: true}, 2);

                var danishKnockoutJsTemplate = assetGraph.findRelations({type: 'JavaScriptGetText', from: function (asset) {
                    return asset.incomingRelations.some(function (incomingRelation) {
                        return incomingRelation.from === assetGraph.findAssets({url: /\/index\.da\.html$/})[0];
                    });
                }})[0].to;
                expect(danishKnockoutJsTemplate.text, 'to match', /Den danske værdi/);
            })
            .run(done);
    });

    it('should handle a JavaScript asset that uses LOCALEID, DEFAULTLOCALE, LOCALECOOKIENAME, and SUPPORTEDLOCALEIDS', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/transforms/cloneForEachLocale/globalVarUsageInJavaScript/'})
            .loadAssets('index.html')
            .populate()
            .cloneForEachLocale({type: 'Html'}, {localeIds: ['en_US', 'da'], defaultLocaleId: 'en_US', localeCookieName: 'myCookie'})
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain assets', 'JavaScript', 2);

                var danishJavaScript = assetGraph.findAssets({type: 'JavaScript', incoming: {type: 'HtmlScript', from: {url: /\/index\.da\.html$/}}})[0];
                expect(danishJavaScript.text, 'to equal', 'alert("da");alert("en_us");alert("myCookie");alert(["en_us","da"]);LOCALEID="foo";');
            })
            .run(done);
    });

    it('should handle a template in an inline script', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/transforms/cloneForEachLocale/inlineScriptTemplate/'})
            .loadAssets('index.html')
            .populate()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain assets', {}, 4);
                expect(assetGraph, 'to contain assets', 'Html', 2);
                expect(assetGraph, 'to contain asset', 'JavaScript');
                expect(assetGraph, 'to contain asset', 'I18n');
            })
            .cloneForEachLocale({type: 'Html', isInline: false}, {localeIds: ['en_US', 'da']})
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain assets', {}, 7);
                expect(assetGraph, 'to contain assets', 'Html', 4);
                expect(assetGraph, 'to contain assets', 'JavaScript', 2);
                expect(assetGraph, 'to contain asset', 'I18n');
                expect(assetGraph.findAssets({url: /\/index\.da\.html$/})[0].text, 'to match', /Min sprognøgle/);
            })
            .run(done);
    });

    it('should handle a template in an inline script in a Knockout.js template', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/transforms/cloneForEachLocale/inlineScriptTemplateInKnockoutJsTemplate/'})
            .loadAssets('index.html')
            .populate()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain assets', {}, 5);
                expect(assetGraph, 'to contain assets', 'Html', 3);
                expect(assetGraph, 'to contain assets', {type: 'Html', isFragment: true}, 2);
                expect(assetGraph, 'to contain asset', 'JavaScript');
                expect(assetGraph, 'to contain asset', 'I18n');
            })
            .cloneForEachLocale({type: 'Html', isInline: false}, {localeIds: ['en_US', 'da']})
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain assets', {}, 9);
                expect(assetGraph, 'to contain assets', 'Html', 6);
                expect(assetGraph, 'to contain assets', 'JavaScript', 2);
                expect(assetGraph, 'to contain assets', {type: 'Html', isFragment: true}, 4);
                expect(assetGraph, 'to contain asset', 'I18n');

                var danishHtml = assetGraph.findAssets({url: /\/index\.da\.html$/})[0],
                    danishJavaScript = assetGraph.findRelations({from: danishHtml, type: 'HtmlScript'})[0].to,
                    danishKnockoutJsTemplate = assetGraph.findRelations({from: danishJavaScript, type: 'JavaScriptGetText'})[0].to;
                expect(danishKnockoutJsTemplate.text, 'to match', /Min sprognøgle/);
            })
            .run(done);
    });

    it('should handle a TRHTML expression', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/transforms/cloneForEachLocale/JavaScriptTrHtml/'})
            .loadAssets('index.html')
            .populate()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain assets', {}, 4);
                expect(assetGraph, 'to contain assets', 'Html', 2);
                expect(assetGraph, 'to contain asset', 'JavaScript');
                expect(assetGraph, 'to contain asset', 'I18n');
                expect(assetGraph, 'to contain relation', 'JavaScriptTrHtml');
            })
            .cloneForEachLocale({type: 'Html', url: /\/index\.html$/}, {localeIds: ['en_US', 'da']})
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain assets', {}, 7);
                expect(assetGraph, 'to contain assets', 'Html', 4);
                expect(assetGraph, 'to contain assets', 'JavaScript', 2);
                expect(assetGraph, 'to contain asset', 'I18n');
            })
            .inlineRelations({type: 'JavaScriptTrHtml'})
            .queue(function (assetGraph) {
                var danishHtml = assetGraph.findAssets({url: /\/index\.da\.html$/})[0];
                expect(assetGraph.findRelations({from: danishHtml, type: 'HtmlScript'})[0].to.text, 'to match', /var myHtmlString\s*=\s*TRHTML\((['"])Den danske værdi\1\)/);
            })
            .run(done);
    });

    it('should handle a TRHTML(GETTEXT(...)) expression', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/transforms/cloneForEachLocale/JavaScriptTrHtmlAndJavaScriptGetText/'})
            .loadAssets('index.html')
            .populate()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain assets', {}, 4);
                expect(assetGraph, 'to contain assets', 'Html', 2);
                expect(assetGraph, 'to contain asset', 'JavaScript');
                expect(assetGraph, 'to contain asset', 'I18n');
                expect(assetGraph, 'to contain relations', 'JavaScriptTrHtml');
                expect(assetGraph, 'to contain no relations', 'JavaScriptGetText');
            })
            .cloneForEachLocale({type: 'Html', url: /\/index\.html$/}, {localeIds: ['en_US', 'da']})
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain assets', {}, 7);
                expect(assetGraph, 'to contain assets', 'Html', 4);
                expect(assetGraph, 'to contain assets', 'JavaScript', 2);
                expect(assetGraph, 'to contain asset', 'I18n');
            })
            .inlineRelations({type: 'JavaScriptTrHtml'})
            .queue(function (assetGraph) {
                var danishHtml = assetGraph.findAssets({url: /\/index\.da\.html$/})[0];
                expect(assetGraph.findRelations({from: danishHtml, type: 'HtmlScript'})[0].to.text, 'to match', /var myHtmlString\s*=\s*TRHTML\((['"])Den danske værdi\\n\1\)/);

                assetGraph.findRelations({type: 'JavaScriptTrHtml'}).forEach(function (javaScriptTrHtml) {
                    var htmlAsset = javaScriptTrHtml.to,
                        document = htmlAsset.parseTree;
                    document.appendChild(document.createElement('div')).appendChild(document.createTextNode('foo'));
                    htmlAsset.markDirty();
                });

                expect(assetGraph.findRelations({from: danishHtml, type: 'HtmlScript'})[0].to.text, 'to match', /var myHtmlString\s*=\s*TRHTML\((['"])Den danske værdi\\n<div>foo<\/div>\1\)/);
            })
            .run(done);
    });

    it('should handle Css asset that needs localization', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/transforms/cloneForEachLocale/css/'})
            .loadAssets('index.html')
            .populate()
            .cloneForEachLocale({type: 'Html'}, {localeIds: ['en', 'da', 'de']})
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain assets', {type: 'Css'}, 4);
                expect(assetGraph, 'to contain assets', {type: 'Png'}, 3);

                var danishCss = assetGraph.findAssets({url: /\/needsLocalization\.da\.css$/})[0],
                    cssRules = danishCss.parseTree.cssRules;
                expect(cssRules, 'to have length', 2);
                expect(cssRules[0].selectorText, 'to equal', 'body');
                expect(cssRules[1].selectorText, 'to equal', 'html .theThing');
                var outgoingRelations = assetGraph.findRelations({from: danishCss});
                expect(outgoingRelations, 'to have length', 1);
                expect(outgoingRelations[0].href, 'to equal',  'foo.png');

                var germanCss = assetGraph.findAssets({url: /\/needsLocalization\.de\.css$/})[0];
                expect(germanCss.parseTree.cssRules, 'to have length', 2);
                expect(germanCss.parseTree.cssRules[0].selectorText, 'to equal', 'body');
                expect(germanCss.parseTree.cssRules[1].selectorText, 'to equal', 'html.anotherClassOnHtml .theGermanThing');

                outgoingRelations = assetGraph.findRelations({from: germanCss});
                expect(outgoingRelations, 'to have length', 1);
                expect(outgoingRelations[0].to, 'to have property', 'isImage', true);

                var englishCss = assetGraph.findAssets({url: /\/needsLocalization\.en\.css$/})[0];
                expect(englishCss.parseTree.cssRules, 'to have length', 1);
                expect(englishCss.parseTree.cssRules[0].selectorText, 'to equal', 'body');

                expect(assetGraph, 'to contain no relations', {from: englishCss});

                expect(assetGraph, 'to contain no relations', {to: {url: /\/bar\.png$/}});

                expect(assetGraph, 'to contain relation', {from: {url: /\/needsLocalization\.de\.css$/}, to: {isInline: true, isImage: true}});

                expect(assetGraph, 'to contain no relations', {from: {url: /\/needsLocalization\.da\.css$/}, to: {isInline: true, isImage: true}});
            })
            .run(done);
    });

    it('should handle two Html assets that include references to the same JavaScripts', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/transforms/cloneForEachLocale/multipleHtmls/'})
            .loadAssets('1.html', '2.html')
            .populate()
            .cloneForEachLocale({type: 'Html'}, {localeIds: ['en', 'da']})
            .queue(function (assetGraph) {
                expect(_.pluck(assetGraph.findAssets({type: 'Html'}), 'url').sort(), 'to equal', [
                    assetGraph.root + '1.da.html',
                    assetGraph.root + '1.en.html',
                    assetGraph.root + '2.da.html',
                    assetGraph.root + '2.en.html'
                ]);

                expect(_.pluck(assetGraph.findAssets({type: 'JavaScript'}), 'url').sort(), 'to equal', [
                    assetGraph.root + 'doesNotNeedLocalization.da.js',
                    assetGraph.root + 'doesNotNeedLocalization.en.js',
                    assetGraph.root + 'needsLocalization.da.js',
                    assetGraph.root + 'needsLocalization.en.js'
                ]);
            })
            .run(done);
    });

    it('should handle a language key that uses the same placeholder twice in the Danish translation', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/transforms/cloneForEachLocale/reusePlaceHolder/'})
            .loadAssets('index.html')
            .populate()
            .cloneForEachLocale({type: 'Html'}, {localeIds: ['en', 'da']})
            .queue(function (assetGraph) {
                expect(assetGraph.findAssets({url: /\/index\.da\.html$/})[0].parseTree.body.innerHTML, 'to equal', '\n    <div>Some <span>foo</span> <span>foo</span> thing</div>\n    <script>INCLUDE("index.i18n");</script>\n');
            })
            .run(done);
    });

    it('should handle a language key that uses the same placeholder twice in the Danish translation when the placeholder in the Html has a relation in it', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/transforms/cloneForEachLocale/relationInPlaceHolder/'})
            .loadAssets('index.html')
            .populate()
            .cloneForEachLocale({type: 'Html'}, {localeIds: ['en', 'da']})
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain relation', {type: 'HtmlImage', from: {url: /\/index\.en\.html$/}});
                expect(assetGraph, 'to contain relations', {type: 'HtmlImage', from: {url: /\/index\.da\.html$/}}, 2);
            })
            .run(done);
    });


    it('should localize Svg assets', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/transforms/cloneForEachLocale/svg/'})
            .loadAssets('index.html')
            .populate()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain asset', 'Svg');
            })
            .cloneForEachLocale({type: 'Html'}, {localeIds: ['en_US', 'da']})
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain assets', 'Html', 2);
                expect(assetGraph, 'to contain assets', 'Svg', 2);
                expect(assetGraph.findRelations({type: 'HtmlImage', from: {url: /\/index\.da\.html$/}})[0].to.text, 'to match', /Dansk nøgle/);
                expect(assetGraph.findRelations({type: 'HtmlImage', from: {url: /\/index\.en_us\.html$/}})[0].to.text, 'to match', /English key/);
            })
            .run(done);
    });

    it('should handle a JavaScript asset that contains only LOCALECOOKIENAME', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/transforms/cloneForEachLocale/localeCookieName/'})
            .loadAssets('index.html')
            .populate()
            .cloneForEachLocale({type: 'Html'}, {localeCookieName: 'MyCookie', localeIds: ['en', 'da']})
            .queue(function (assetGraph) {
                // TODO: The presence of only LOCALECOOKIENAME/SUPPORTEDLOCALEIDS/DEFAULTLOCALEID don't really require the asset to be cloned as
                // they just need to be replaced to the same value in each locale.
                var numJavaScriptAssets = assetGraph.findAssets({type: 'JavaScript'}).length;
                expect(numJavaScriptAssets === 1 || numJavaScriptAssets === 2, 'to be truthy');
                assetGraph.findAssets({type: 'JavaScript'}).forEach(function (javaScriptAsset) {
                    expect(javaScriptAsset.text, 'to match', /MyCookie/);
                });
            })
            .run(done);
    });
});
