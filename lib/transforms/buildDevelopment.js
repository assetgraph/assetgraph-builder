var urlTools = require('urltools');

module.exports = function (options) {
    options = options || {};
    return function buildDevelopment(assetGraph, cb) {
        var query = assetGraph.query;
        assetGraph
            .populate({from: {type: 'Html'}, followRelations: {type: 'HtmlScript', to: {url: /^file:/}}})
            .moveAssets({isInitial: true}, function (asset) { return asset.url.replace(/\.template$/, ''); })
            .addDataVersionAttributeToHtmlElement({type: 'Html', isInitial: true}, options.version)
            .populate({
                followRelations: query.or({
                    type: ['HtmlScript', 'JavaScriptInclude'],
                    to: {url: assetGraph.query.not(/^https?:/)}
                }, {
                    to: {type: 'I18n'}
                })
            })
            .injectBootstrapper({isInitial: true}, {
                defaultLocaleId: options.defaultLocaleId,
                supportedLocaleIds: options.supportedLocaleIds,
                localeCookieName: options.localeCookieName
            })
            .flattenStaticIncludes({isInitial: true})
            .removeAssets({isLoaded: true, isEmpty: true, type: 'JavaScript'})
            .inlineRelations({type: 'HtmlStyle', from: {isInitial: true, type: 'Html'}, to: {fixedUpExtJS: true, isLoaded: true}})
            .if(options.cssImports)
                .convertHtmlStylesToInlineCssImports()
            .endif()
            .inlineRelations({type: 'HtmlScript', from: {isInitial: true, type: 'Html'}, to: {fixedUpExtJS: true, isLoaded: true}})
            .prettyPrintAssets({type: 'JavaScript', isLoaded: true, incoming: {type: 'HtmlScript', from: {isInitial: true, type: 'Html'}}})
            .prettyPrintAssets({type: 'Css', isLoaded: true, incoming: {type: 'HtmlStyle', from: {isInitial: true, type: 'Html'}}})
            .runJavaScriptConditionalBlocks({type: 'Html', isLoaded: true}, 'BUILDDEVELOPMENT')
            .if(options.inlineUrlWildCard)
                .inlineRelations({to: {isLoaded: true, url: urlTools.makeFileUrlMatcher(options.inlineUrlWildCard)}})
            .endif()
            .run(cb);
    };
};
