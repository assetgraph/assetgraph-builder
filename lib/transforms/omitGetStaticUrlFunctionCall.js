var _ = require('underscore');

// GETSTATICURL(fileNameOrHash) => fileNameOrHash
// Saves bytes, but makes it impossible to recognize the relation again.

module.exports = function (queryObj) {
    return function omitGetStaticUrlFunctionCall(assetGraph) {
        assetGraph.findRelations(_.extend({type: 'JavaScriptGetStaticUrl'}, queryObj)).forEach(function (javaScriptGetStaticUrl) {
            javaScriptGetStaticUrl.omitFunctionCall = true;
            javaScriptGetStaticUrl.inline();
        });
    };
};
