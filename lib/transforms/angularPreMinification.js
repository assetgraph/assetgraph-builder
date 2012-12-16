var ngmin = require('ngmin'),
    _ = require('underscore');

module.exports = function (queryObj) {
    return function angularPreMinification(assetGraph) {
        var query = assetGraph.query;

        assetGraph.findAssets(_.extend({
            type: 'Html',
            isInline: false
        }, queryObj)).forEach(function (htmlAsset) {
            // FIXME: This should be unnessessary when initial templates
            // are demoted when they are a target of a template relation
            if (assetGraph.findRelations({
                to: htmlAsset,
                from: {
                    type: 'JavaScript'
                }
            }).length) {
                return;
            }

            var document = htmlAsset.parseTree;

            if (document.querySelector('[ng-app]')
                || document.querySelector('[class~="ng-app:"]')) {
                assetGraph.eachAssetPostOrder(htmlAsset, {type: query.not('HtmlAnchor')}, function (asset) {
                    if (asset.type === 'JavaScript') {
                        var newAsset = new assetGraph.JavaScript({
                                text: ngmin.annotate(asset.text)
                            });
                        asset.replaceWith(newAsset);
                    }
                });
            }
        });
    };
};
