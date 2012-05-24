var Path = require('path'),
    AssetGraph = require('assetgraph');

// Get the spriteBackgroundImages transform from assetgraph-sprite if available:
var spriteBackgroundImages;
try {
    spriteBackgroundImages = require('assetgraph-sprite');
} catch (e) {
    spriteBackgroundImages = function () {
        console.warn("assetgraph-sprite is not available, skipping the spriteBackgroundImages transform");
        return function spriteBackgroundImagesDisabled(assetGraph) {};
    };
}
AssetGraph.registerTransform(spriteBackgroundImages, 'spriteBackgroundImages');

// Register ./transforms/*:

require('fs').readdirSync(Path.resolve(__dirname, 'transforms')).forEach(function (fileName) {
    AssetGraph.registerTransform(Path.resolve(__dirname, 'transforms', fileName));
});
