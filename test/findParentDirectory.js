/*global describe, it*/
var expect = require('./unexpected-with-plugins'),
    passError = require('passerror'),
    AssetGraph = require('../lib/AssetGraph'),
    resolvers = require('../lib/resolvers'),
    Path = require('path'),
    assetGraphRoot = Path.resolve(__dirname, '..', 'testdata', 'findParentDirectory') + '/';

function resolveAssetConfig(assetConfig, fromUrl, cb) {
    var assetGraph = new AssetGraph({root: assetGraphRoot});
    assetGraph.defaultResolver = resolvers.findParentDirectory();
    assetGraph.resolveAssetConfig(assetConfig, fromUrl || assetGraph.root, cb);
}

describe('findParentDirectory', function () {
    it('should resolve an a url with an unknown protocol', function (done) {
        resolveAssetConfig('directory:quux.png', null, passError(done, function (resolvedAssetConfig) {
            expect(resolvedAssetConfig, 'to have properties', {
                url: 'file://' + assetGraphRoot + 'directory/quux.png'
            });
            done();
        }));
    });

    it('should resolving a url with an unknown protocol and a wildcard', function (done) {
        resolveAssetConfig('otherdirectory:onemorelevel/*.png', 'file://' + assetGraphRoot + 'directory', passError(done, function (resolvedAssetConfigs) {
            expect(resolvedAssetConfigs, 'to be an array whose items satisfy', 'to have properties', {type: 'Png'});
            done();
        }));
    });
});
