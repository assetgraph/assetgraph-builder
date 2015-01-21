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
                expect(infos, 'to have length', 9);

/*
                expect(infos[0].message, 'to match', /^Language key ThisIsTranslated is missing in da \(used in .*?\index\.html\)$/);
                expect(infos[1].message, 'to match', /^Language key TheTitle is missing in da \(used in .*?index\.html\)$/);
                expect(infos[2].message, 'to match', /^Language key ThisIsTranslated has mismatching default and\/or en_us values:\n\'This is translated\' \(.*?index\.html\)\n\'This is translated but with wrong content\' \(.*?index\.html\)$/);
                expect(infos[3].message, 'to match', /^Missing data-i18n attribute for tag contents \(.*?index\.html\):\n<span>This should be translated, but there is no data-i18n attribute for the text contents<\/span>$/);
                expect(infos[4].message, 'to match', /^No data-i18n attribute for 'title' attribute \(.*?index\.html\):\n<span title="This should be translated, but there is no data-i18n attribute for the title attribute"><\/span>$/);

                expect(infos[5].message, 'to match', /^Missing data-i18n attribute for tag contents \(.*?index.html\):\n<span title="This should be translated, but there is no data-i18n attribute for the title attribute">This should be translated, but there is no data-i18n attribute for the text contents<\/span>$/);
                expect(infos[6].message, 'to match', /^No data-i18n attribute for \'title\' attribute \(.*?index.html\):\n<span title="This should be translated, but there is no data-i18n attribute for the title attribute">This should be translated, but there is no data-i18n attribute for the text contents<\/span>$/);
                expect(infos[7].message, 'to match', /^No data-i18n attribute for \'title\' attribute \(.*?index.html\):\n<span title="This should be translated, but the data-i18n attribute does not cover the title attribute" data-i18n="ThisIsTranslated">This is \n        translated<\/span>$/);
                expect(infos[8].message, 'to match', /^Missing data-i18n attribute for tag contents \(.*?index.html\):\n<span title="The title" data-i18n="attr: {title: \'TheTitle\'}">This should be translated, but there is no data-i18n attribute for the text contents, although there is one for the title attribute<\/span>$/);
*/
            })
            .run(done);
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
});
