var _ = require('underscore');

// one.getStaticUrl(fileNameOrHash) => fileNameOrHash
// Saves bytes, but makes it impossible to recognize the relation again.

module.exports = function (queryObj) {
    return function omitGetStaticUrlFunctionCall(assetGraph) {
        assetGraph.findRelations(_.extend({type: 'JavaScriptOneGetStaticUrl'}, queryObj)).forEach(function (javaScriptOneGetStaticUrl) {
            javaScriptOneGetStaticUrl.omitFunctionCall = true;
            javaScriptOneGetStaticUrl.inline();
        });
    };
};
