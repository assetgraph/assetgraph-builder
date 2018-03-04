const pathModule = require('path');
const AssetGraph = (module.exports = require('assetgraph'));

// Get the spriteBackgroundImages transform from assetgraph-sprite if available:
var spriteBackgroundImages;
try {
  spriteBackgroundImages = require('assetgraph-sprite');
} catch (e) {
  spriteBackgroundImages = function() {
    console.warn(
      'assetgraph-sprite is not available, skipping the spriteBackgroundImages transform'
    );
    return function spriteBackgroundImagesDisabled(assetGraph) {};
  };
}
AssetGraph.registerTransform(spriteBackgroundImages, 'spriteBackgroundImages');

// Register ./transforms/*:

for (const fileName of require('fs').readdirSync(
  pathModule.resolve(__dirname, 'transforms')
)) {
  AssetGraph.registerTransform(
    pathModule.resolve(__dirname, 'transforms', fileName)
  );
}
