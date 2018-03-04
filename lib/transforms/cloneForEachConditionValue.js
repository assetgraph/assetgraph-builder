var assetGraphConditions = require('assetgraph/lib/assetGraphConditions');

module.exports = function(queryObj, options) {
  options = options || {};
  var splitConditions = options.splitConditions || [];
  if (typeof splitConditions === 'string') {
    splitConditions = [splitConditions];
  }

  return function cloneForEachConditionValue(assetGraph) {
    // Discover all condition values:
    for (const splitCondition of splitConditions) {
      const isSeenByConditionValue = {};
      for (const htmlAsset of assetGraph.findAssets({
        type: 'Html',
        isInline: false,
        ...queryObj
      })) {
        for (const relation of assetGraph.findRelations({ from: htmlAsset })) {
          const dataSystemJsConditions =
            relation.node && assetGraphConditions.parse(relation.node);
          if (dataSystemJsConditions) {
            let key = splitCondition + '.js|default';
            let value = dataSystemJsConditions[key];
            if (!value) {
              key = splitCondition + '|default';
              value = dataSystemJsConditions[key];
            }
            if (value) {
              isSeenByConditionValue[value] = true;
            }
          }
        }
        let conditionValues =
          (options.conditions && options.conditions[splitCondition]) ||
          Object.keys(isSeenByConditionValue);
        if (typeof conditionValues === 'string') {
          conditionValues = [conditionValues];
        }
        if (conditionValues.length > 0) {
          for (const conditionValue of conditionValues) {
            const clonedHtmlAsset = htmlAsset.clone();
            const documentElement = clonedHtmlAsset.parseTree.documentElement;
            if (documentElement) {
              const htmlSystemJsConditionals =
                assetGraphConditions.parse(documentElement) || {};
              htmlSystemJsConditionals[splitCondition] = conditionValue;
              documentElement.setAttribute(
                'data-assetgraph-conditions',
                assetGraphConditions.stringify(htmlSystemJsConditionals)
              );
              clonedHtmlAsset.markDirty();
            }
            const targetUrl = htmlAsset.url.replace(
              /(\.\w+)?$/,
              '.' + conditionValue + '$1'
            );
            clonedHtmlAsset.url = targetUrl;

            for (const relation of assetGraph.findRelations({
              from: clonedHtmlAsset
            })) {
              const dataSystemJsConditions =
                relation.node && assetGraphConditions.parse(relation.node);
              if (dataSystemJsConditions) {
                let key = splitCondition + '.js|default';
                let value = dataSystemJsConditions[key];
                if (!value) {
                  key = splitCondition + '|default';
                  value = dataSystemJsConditions[key];
                }
                if (value) {
                  if (value === conditionValue) {
                    delete dataSystemJsConditions[key];
                    if (Object.keys(dataSystemJsConditions).length === 0) {
                      relation.node.removeAttribute(
                        'data-assetgraph-conditions'
                      );
                    } else {
                      relation.node.setAttribute(
                        'data-assetgraph-conditions',
                        assetGraphConditions.stringify(dataSystemJsConditions)
                      );
                    }
                    relation.from.markDirty();
                  } else {
                    relation.detach();
                  }
                  continue;
                }
              }
            }
          }
          assetGraph.removeAsset(htmlAsset);
        }
      }
    }
  };
};
