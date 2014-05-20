// GETSTATICURL(fileNameOrHash) => fileNameOrHash
// TRHTML(htmlString) => htmlString
// Saves bytes, but makes it impossible to recognize the relations again.

module.exports = function (queryObj) {
    return function omitFunctionCall(assetGraph) {
        assetGraph.findRelations(queryObj).filter(function (relation) {
            return relation.type === 'JavaScriptTrHtml' || relation.type === 'JavaScriptGetStaticUrl';
        }).forEach(function (relation) {
            relation.omitFunctionCall = true;
            relation.inline();
        });
    };
};
