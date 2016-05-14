/*global describe, it*/
var expect = require('../unexpected-with-plugins'),
    passError = require('passerror'),
    AssetGraph = require('../../lib/AssetGraph');

describe('buildDevelopment', function () {
    it('should handle a simple test case', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/transforms/buildDevelopment/simple/'})
            .loadAssets('index.html.template')
            .populate()
            .buildDevelopment({
                version: 'The version number',
                supportedLocaleIds: ['en', 'da'],
                defaultLocaleId: 'en',
                localeCookieName: 'myLocaleCookie',
                cssImports: true,
                inlineUrlWildCard: false // Test it
            })
            .run(passError(done, function (assetGraph) {
                expect(assetGraph, 'to contain asset', 'Html', 1);

                expect(assetGraph.findAssets({type: 'Html'})[0].parseTree.title, 'to equal', 'The default title');

                expect(assetGraph, 'to contain relations', {
                    type: 'HtmlScript',
                    node: function (node) {
                        return node.getAttribute('id') === 'bootstrapper';
                    }
                }, 1);

                var bootstrapperText = assetGraph.findRelations({type: 'HtmlScript', node: function (node) {return node.getAttribute('id') === 'bootstrapper'; }})[0].to.text;
                expect(bootstrapperText, 'to match', /\bwindow\.SUPPORTEDLOCALEIDS\s*=\s*\[\s*(['"])en\1\s*,\s*\1da\1\s*\]\s*;/);
                expect(bootstrapperText, 'to match', /\bwindow\.DEFAULTLOCALEID\s*=\s*(['"])en\1\s*;/);
                expect(bootstrapperText, 'to match', /\bwindow\.LOCALECOOKIENAME\s*=\s*(['"])myLocaleCookie\1\s*;/);
                expect(bootstrapperText, 'to match', /\bwindow\.I18NKEYS\s*=\s*\{\s*myLanguageKey:\s*\{\s*en:\s*(['"])The English value\1\s*,\s*da:\s*\1Den danske værdi\1\s*\}\s*\}\s*;/);

                expect(assetGraph.findAssets({type: 'Html'})[0].parseTree.querySelectorAll('html[data-version="The version number"]'), 'to have length', 1);
                done();
            }));
    });

    it('should not mangle an inline stylesheet with a data-bind attribute', function (done) {
        new AssetGraph({root: __dirname + '/../../testdata/transforms/buildDevelopment/dataBindOnHtmlStyle/'})
            .loadAssets('index.html.template')
            .populate()
            .buildDevelopment({
                version: 'The version number'
            })
            .queue(function (assetGraph) {
                expect(assetGraph.findAssets({type: 'Html'})[0].text, 'to contain', '<style data-bind="text: dynamicStyle">\n</style>');
            })
            .run(done);
    });
});
