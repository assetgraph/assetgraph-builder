/*global describe, it*/
var expect = require('../unexpected-with-plugins'),
    AssetGraph = require('../../lib/AssetGraph');

describe('checkLanguageKeys', function () {
    it('should handle a combo test case', function (done) {
        var infos = [];
        new AssetGraph({root: __dirname + '/../../testdata/transforms/checkLanguageKeys/combo/'})
            .on('info', function (err) {
                infos.push(err);
            })
            .loadAssets('index.html')
            .populate()
            .checkLanguageKeys({
                supportedLocaleIds: ['en_us', 'da'],
                defaultLocaleId: 'en_us'
            })
            .queue(function (assetGraph) {
                expect(infos, 'to satisfy', [
                    /^Language key ThisIsTranslated is missing in da \(used in .*?\index\.html\)$/,
                    /^Language key TheTitle is missing in da \(used in .*?index\.html\)$/,
                    /^Language key ThisIsTranslated has mismatching default and\/or en_us values:\n\'This is translated\' \(.*?index\.html\)\n\'This is translated but with wrong content\' \(.*?index\.html\)$/,
                    /^Missing data-i18n attribute for tag contents \(.*?index\.html\):\n<span>This should be translated, but there is no data-i18n attribute for the text contents<\/span>$/,
                    /^No data-i18n attribute for 'title' attribute \(.*?index\.html\):\n<span title="This should be translated, but there is no data-i18n attribute for the title attribute"><\/span>$/,
                    /^Missing data-i18n attribute for tag contents \(.*?index.html\):\n<span title="This should be translated, but there is no data-i18n attribute for the title attribute">This should be translated, but there is no data-i18n attribute for the text contents<\/span>$/,
                    /^No data-i18n attribute for \'title\' attribute \(.*?index.html\):\n<span title="This should be translated, but there is no data-i18n attribute for the title attribute">This should be translated, but there is no data-i18n attribute for the text contents<\/span>$/,
                    /^No data-i18n attribute for \'title\' attribute \(.*?index.html\):\n<span title="This should be translated, but the data-i18n attribute does not cover the title attribute" data-i18n="ThisIsTranslated">This is \n        translated<\/span>$/,
                    /^Missing data-i18n attribute for tag contents \(.*?index.html\):\n<span title="The title" data-i18n="attr: {title: \'TheTitle\'}">This should be translated, but there is no data-i18n attribute for the text contents, although there is one for the title attribute<\/span>$/
                ]);
            }).run(done);
    });

    it('a space at the end of a TR original text', function (done) {
        var infos = [];
        new AssetGraph({root: __dirname + '/../../testdata/transforms/checkLanguageKeys/neverEndingSpaceLoop/'})
            .on('info', function (err) {
                infos.push(err);
            })
            .loadAssets('index.html')
            .populate()
            .checkLanguageKeys({
                supportedLocaleIds: ['en_us', 'da'],
                defaultLocaleId: 'en_us'
            })
            .queue(function (assetGraph) {
                expect(infos, 'to have length', 2);
            })
            .run(done);
    });

    it('warns when a structured value with plural rule keys is non-exhaustive for a given locale', function (done) {
        var infos = [];
        new AssetGraph({root: __dirname + '/../../testdata/transforms/checkLanguageKeys/pluralRule/'})
            .on('info', function (err) {
                infos.push(err);
            })
            .loadAssets('index.html')
            .populate()
            .checkLanguageKeys({
                supportedLocaleIds: ['en_us', 'cs', 'da'],
                defaultLocaleId: 'en_us'
            })
            .queue(function (assetGraph) {
                expect(infos, 'to equal', [
                    new Error('cs is missing EveryNWeeks[few]'),
                    new Error('cs is missing EveryNWeeks[many]'),
                    new Error('da should not have EveryNWeeks[many]=\'I should not be here\''),
                    new Error('en is missing DeeplyStructured[bar]'),
                    new Error('da is missing DeeplyStructured[bar]'),
                    new Error('cs is missing DeeplyStructured[foo][few]'),
                    new Error('cs is missing DeeplyStructured[foo][many]'),
                    new Error('da should not have DeeplyStructured[foo][many]=\'I should not be here\'')
                ]);
            })
            .run(done);
    });

    it('emits info events when multiple language keys have the same translation in the default locale', function (done) {
        var infos = [];
        new AssetGraph({root: __dirname + '/../../testdata/transforms/checkLanguageKeys/duplicateLanguageKeys/'})
            .on('info', function (err) {
                infos.push(err);
            })
            .loadAssets('index.html')
            .populate()
            .checkLanguageKeys({
                supportedLocaleIds: ['en_us', 'cs', 'da'],
                ignoreMessageTypes: 'missing',
                defaultLocaleId: 'en_us'
            })
            .queue(function (assetGraph) {
                expect(infos, 'to satisfy', [
                    /^2 language keys have the same default value \'Bar\'\n  SimpleAndIdentical1: inline JavaScript in .*\/index.html\n  SimpleAndIdentical2: inline JavaScript in .*\/index.html$/,
                    /^2 language keys have the same default value \{ blabla: 'Yep', hey: 'Bar' \}/,
                    /^2 language keys have the same default value \{ blabla: 'zzz', hey: 'Bar' \}/,
                    /^2 language keys have the same default value \'Blah\'\n  AnotherSimpleAndIdentical1: .*\/external.js:1:7\n  AnotherSimpleAndIdentical2: .*\/external.js:2:7/
                ]);
            })
            .run(done);
    });
});
