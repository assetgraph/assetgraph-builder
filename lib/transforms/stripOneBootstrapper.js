var _ = require('underscore'),
    oneBootstrapper = require('../util/oneBootstrapper');

module.exports = function (queryObj) {
    return function stripDevelopmentModeFromOneBootstrapper(assetGraph) {
        oneBootstrapper.findOneBootstrappersInGraph(assetGraph).forEach(function (javaScript) {
            assetGraph.removeAsset(javaScript, true);
        });
    };
};
