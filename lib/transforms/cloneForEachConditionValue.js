var _ = require('lodash');
var assetGraphConditions = require('assetgraph/lib/assetGraphConditions');

module.exports = function (queryObj, options) {
    options = options || {};
    var splitConditions = options.splitConditions || [];
    if (typeof splitConditions === 'string') {
        splitConditions = [splitConditions];
    }

    return function cloneForEachConditionValue(assetGraph) {
        // Discover all condition values:
        splitConditions.forEach(function (splitCondition) {
            var isSeenByConditionValue = {};
            assetGraph.findAssets(_.extend({type: 'Html', isInline: false}, queryObj)).forEach(function (htmlAsset) {
                assetGraph.findRelations({from: htmlAsset}).forEach(function (relation) {
                    var dataSystemJsConditions = relation.node && assetGraphConditions.parse(relation.node);
                    if (dataSystemJsConditions) {
                        var key = splitCondition + '.js|default';
                        var value = dataSystemJsConditions[key];
                        if (!value) {
                            key = splitCondition + '|default';
                            value = dataSystemJsConditions[key];
                        }
                        if (value) {
                            isSeenByConditionValue[value] = true;
                        }
                    }
                });
                var conditionValues = (options.conditions && options.conditions[splitCondition]) || Object.keys(isSeenByConditionValue);
                if (typeof conditionValues === 'string') {
                    conditionValues = [conditionValues];
                }
                if (conditionValues.length > 0) {
                    conditionValues.forEach(function (conditionValue) {
                        var clonedHtmlAsset = htmlAsset.clone();
                        var documentElement = clonedHtmlAsset.parseTree.documentElement;
                        if (documentElement) {
                            var htmlSystemJsConditionals = assetGraphConditions.parse(documentElement) || {};
                            htmlSystemJsConditionals[splitCondition] = conditionValue;
                            documentElement.setAttribute('data-assetgraph-conditions', assetGraphConditions.stringify(htmlSystemJsConditionals));
                            clonedHtmlAsset.markDirty();
                        }
                        var targetUrl = htmlAsset.url.replace(/(\.\w+)?$/, '.' + conditionValue + '$1');
                        clonedHtmlAsset.url = targetUrl;

                        assetGraph.findRelations({from: clonedHtmlAsset}).forEach(function (relation) {
                            var dataSystemJsConditions = relation.node && assetGraphConditions.parse(relation.node);
                            if (dataSystemJsConditions) {
                                var key = splitCondition + '.js|default';
                                var value = dataSystemJsConditions[key];
                                if (!value) {
                                    key = splitCondition + '|default';
                                    value = dataSystemJsConditions[key];
                                }
                                if (value) {
                                    if (value === conditionValue) {
                                        delete dataSystemJsConditions[key];
                                        if (Object.keys(dataSystemJsConditions).length === 0) {
                                            relation.node.removeAttribute('data-assetgraph-conditions');
                                        } else {
                                            relation.node.setAttribute('data-assetgraph-conditions', assetGraphConditions.stringify(dataSystemJsConditions));
                                        }
                                        relation.from.markDirty();
                                    } else {
                                        relation.detach();
                                    }
                                    return;
                                }
                            }
                        });
                    });
                    assetGraph.removeAsset(htmlAsset);
                }
            });
        });
    };
};
