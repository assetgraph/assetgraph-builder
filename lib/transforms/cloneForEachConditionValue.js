var _ = require('lodash');

function singleQuoteString(str) {
    return "'" + str.replace(/'/g, "\\'") + "'";
}

function getParsedDataSystemJsConditionalsFromRelation(relation) {
    if (relation.type === 'HtmlScript' || relation.type === 'HtmlStyle') {
        var dataCond = relation.node.getAttribute('data-systemjs-conditions');
        if (dataCond) {
            // FIXME: Use object-literal-parse?
            try {
                return eval('({' + dataCond + '})'); // eslint-disable-line no-eval
            } catch (e) {}
        }
    }
}

module.exports = function (queryObj, options) {
    options = options || {};
    var conditions = options.conditions || [];

    return function cloneForEachConditionValue(assetGraph) {
        // Discover all condition values:
        conditions.forEach(function (condition) {
            var isSeenByConditionValue = {};
            assetGraph.findAssets(_.extend({type: 'Html', isInline: false}, queryObj)).forEach(function (htmlAsset) {
                assetGraph.findRelations({from: htmlAsset}).forEach(function (relation) {
                    var dataSystemJsConditions = getParsedDataSystemJsConditionalsFromRelation(relation);
                    if (dataSystemJsConditions) {
                        var key = condition + '.js|default';
                        var value = dataSystemJsConditions[key];
                        if (!value) {
                            key = condition + '|default';
                            value = dataSystemJsConditions[key];
                        }
                        if (value) {
                            isSeenByConditionValue[value] = true;
                        }
                    }
                });
                var conditionValues = Object.keys(isSeenByConditionValue);
                if (conditionValues.length > 0) {
                    conditionValues.forEach(function (conditionValue) {
                        var clonedHtmlAsset = htmlAsset.clone();
                        var targetUrl = htmlAsset.url.replace(/(\.\w+)?$/, '.' + conditionValue + '$1');
                        clonedHtmlAsset.url = targetUrl;

                        assetGraph.findRelations({from: clonedHtmlAsset}).forEach(function (relation) {
                            var dataSystemJsConditions = getParsedDataSystemJsConditionalsFromRelation(relation);
                            if (dataSystemJsConditions) {
                                var key = condition + '.js|default';
                                var value = dataSystemJsConditions[key];
                                if (!value) {
                                    key = condition + '|default';
                                    value = dataSystemJsConditions[key];
                                }
                                if (value) {
                                    if (value === conditionValue) {
                                        delete dataSystemJsConditions[key];
                                        var remainingKeys = Object.keys(dataSystemJsConditions);
                                        if (remainingKeys.length === 0) {
                                            relation.node.removeAttribute('data-systemjs-conditions');
                                        } else {
                                            relation.node.setAttribute('data-systemjs-conditions', remainingKeys.map(function (key) {
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
