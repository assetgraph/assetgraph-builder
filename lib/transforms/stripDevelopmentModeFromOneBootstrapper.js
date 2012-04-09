var _ = require('underscore'),
    oneBootstrapper = require('../util/oneBootstrapper');

module.exports = function (queryObj) {
    return function stripDevelopmentModeFromOneBootstrapper(assetGraph) {
        oneBootstrapper.findOneBootstrappersInGraph(assetGraph).forEach(function (javaScript) {
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
