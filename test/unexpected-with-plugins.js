module.exports = require('unexpected')
  .clone()
  .installPlugin(require('unexpected-sinon'))
  .installPlugin(require('unexpected-dom'))
  .installPlugin(require('unexpected-color'))
  .installPlugin(require('unexpected-image'))
  .installPlugin(require('assetgraph/test/unexpectedAssetGraph'));
