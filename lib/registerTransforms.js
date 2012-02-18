var Path = require('path'),
    AssetGraph = require('assetgraph');

// Get the spriteBackgroundImages transform from assetgraph-sprite:

AssetGraph.registerTransform(require('assetgraph-sprite'), 'spriteBackgroundImages');

// Register ./transforms/*:

require('fs').readdirSync(Path.resolve(__dirname, 'transforms')).forEach(function (fileName) {
    AssetGraph.registerTransform(Path.resolve(__dirname, 'transforms', fileName));
});
