var _ = require('lodash');

function singleQuoteString(str) {
    return "'" + str.replace(/'/g, "\\'") + "'";
}

function getParsedDataSystemJsConditionalsFromHtmlElement(node) {
    var dataCond = node.getAttribute('data-assetgraph-conditions');
    if (dataCond) {
        // FIXME: Use object-literal-parse?
        try {
            return eval('({' + dataCond + '})'); // eslint-disable-line no-eval
        } catch (e) {}
    }
}

function getParsedDataSystemJsConditionalsFromRelation(relation) {
    if (relation.type === 'HtmlScript' || relation.type === 'HtmlStyle') {
        return getParsedDataSystemJsConditionalsFromHtmlElement(relation.node);
    }
}

module.exports = function (queryObj, options) {
    options = options || {};
    var splitConditions = options.splitConditions || [];

    return function cloneForEachConditionValue(assetGraph) {
        // Discover all condition values:
        splitConditions.forEach(function (splitCondition) {
            var isSeenByConditionValue = {};
            assetGraph.findAssets(_.extend({type: 'Html', isInline: false}, queryObj)).forEach(function (htmlAsset) {
                assetGraph.findRelations({from: htmlAsset}).forEach(function (relation) {
                    var dataSystemJsConditions = getParsedDataSystemJsConditionalsFromRelation(relation);
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
                if (conditionValues.length > 0) {
                    conditionValues.forEach(function (conditionValue) {
                        var clonedHtmlAsset = htmlAsset.clone();
                        var documentElement = clonedHtmlAsset.parseTree.documentElement;
                        if (documentElement) {
                            var htmlSystemJsConditionals = getParsedDataSystemJsConditionalsFromHtmlElement(documentElement) || {};
                            htmlSystemJsConditionals[splitCondition] = conditionValue;
                            documentElement.setAttribute('data-assetgraph-conditions', Object.keys(htmlSystemJsConditionals).map(function (key) {
                                return (/[^a-z]/.test(key) ? singleQuoteString(key) : key) + ': ' + singleQuoteString(htmlSystemJsConditionals[key]);
                            }).join(', '));
                            clonedHtmlAsset.markDirty();
                        }
                        var targetUrl = htmlAsset.url.replace(/(\.\w+)?$/, '.' + conditionValue + '$1');
                        clonedHtmlAsset.url = targetUrl;

                        assetGraph.findRelations({from: clonedHtmlAsset}).forEach(function (relation) {
                            var dataSystemJsConditions = getParsedDataSystemJsConditionalsFromRelation(relation);
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
                                        var remainingKeys = Object.keys(dataSystemJsConditions);
                                        if (remainingKeys.length === 0) {
                                            relation.node.removeAttribute('data-assetgraph-conditions');
                                        } else {
                                            relation.node.setAttribute('data-assetgraph-conditions', remainingKeys.map(function (key) {
                                                return (/[^a-z]/.test(key) ? singleQuoteString(key) : key) + ': ' + singleQuoteString(dataSystemJsConditions[key]);
                                            }).join(', '));
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
