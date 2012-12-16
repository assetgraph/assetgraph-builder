var ngmin = require('ngmin'),
    _ = require('underscore'),
    uglifyJs = require('uglify-js-papandreou');

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
                        var walker = uglifyJs.uglify.ast_walker();
                        walker.with_walkers({
                            call: function () {
                                var stack = walker.stack(),
                                    node = stack[stack.length - 1];
                                if (node[1][0] === 'dot' && node[1][1][0] === 'name' && node[1][1][1] === 'angular' && node[1][2] === 'module') {
                                    var stackPosition = stack.length - 1;
                                    while (stack[stackPosition - 1][0] === 'dot' && stack[stackPosition - 2][0] === 'call') {
                                        var argumentNodes = stack[stackPosition - 2][2],
                                            methodName = stack[stackPosition - 1][2];

                                        if (/^(controller|directive|filter|service|factory|decorator|config|provider)$/.test(methodName) &&
                                            argumentNodes.length === 2 && argumentNodes[1][0] === 'function' && argumentNodes[1][2].length > 0) {

                                            argumentNodes[1] = [
                                                'array',
                                                argumentNodes[1][2].map(function (argumentName) {
                                                    return ['string', argumentName];
                                                }).concat([argumentNodes[1]])
                                            ];
                                            asset.markDirty();
                                        }
                                        stackPosition -= 2;
                                    }
                                }
                            }
                        }, function () {
                            walker.walk(asset.parseTree);
                        });
                    }
                });
            }
        });
    };
};
