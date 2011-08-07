var _ = require('underscore');

module.exports = function (queryObj) {
    return function stripDevelopmentModeFromOneBootstrapper(assetGraph) {
        var bootstrappersById = {};
        assetGraph.findAssets(_.extend({type: 'Html'}, queryObj)).forEach(function (htmlAsset) {
            assetGraph.findRelations({type: 'HtmlScript', from: htmlAsset, node: {id: 'oneBootstrapper'}}).forEach(function (htmlScript) {
                bootstrappersById[htmlScript.to.id] = htmlScript.to;
            });
        });
        _.values(bootstrappersById).forEach(function (javaScript) {
            var topLevelStatements = javaScript.parseTree[1];
            for (var i = 0 ; i < topLevelStatements.length ; i += 1) {
                var statement = topLevelStatements[i];
                if (statement[0] === 'stat' && statement[1][0] === 'call' && statement[1][1][0] === 'function' && statement[1][1][1] === 'installOneDevelopmentMode') {
                    topLevelStatements.splice(i, 1);
                    javaScript.markDirty();
                }
            }
        });
    };
};
