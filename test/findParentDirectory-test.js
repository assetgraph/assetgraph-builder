var vows = require('vows'),
    assert = require('assert'),
    AssetGraph = require('../lib/AssetGraph'),
    resolvers = require('../lib/resolvers'),
    assetGraphRoot = __dirname + '/findParentDirectory/';

function resolveAssetConfig(assetConfig, fromUrl, cb) {
    return function () {
        var assetGraph = new AssetGraph({root: assetGraphRoot});
        assetGraph.defaultResolver = resolvers.findParentDir();
        assetGraph.resolveAssetConfig(assetConfig, fromUrl || assetGraph.root, cb || this.callback);
    };
}

vows.describe('findParentDirectory').addBatch({
    'Resolving url with an unknown protocol': {
        topic: resolveAssetConfig('directory:quux.png'),
        'should look for a directory of that name starting from the current directory and find the directory named "directory" with the sought-after file in it': function (resolvedAssetConfig) {
            assert.isObject(resolvedAssetConfig);
            assert.equal(resolvedAssetConfig.url, 'file://' + assetGraphRoot + 'directory/quux.png');
        }
    },
    'Resolving url with an unknown protocol and a wildcard': {
        topic: resolveAssetConfig('otherdirectory:onemorelevel/*.png', 'file://' + assetGraphRoot + 'directory'),
        'should resolve to two Pngs': function (resolvedAssetConfigs) {
            assert.isArray(resolvedAssetConfigs);
            assert.equal(resolvedAssetConfigs.length, 2);
            assert.isObject(resolvedAssetConfigs[0]);
            assert.equal(resolvedAssetConfigs[0].type, 'Png');
            assert.isObject(resolvedAssetConfigs[1]);
            assert.equal(resolvedAssetConfigs[1].type, 'Png');
        }
    }
})['export'](module);
