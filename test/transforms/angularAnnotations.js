/*global describe, it*/
var expect = require('../unexpected-with-plugins');
var AssetGraph = require('../../lib/AssetGraph');

describe('angularAnnotations', function () {
    it('should annotate a basic example', function (done) {
        new AssetGraph({ root: __dirname + '/../../testdata/transforms/angularAnnotations' })
            .loadAssets('basic.js')
            .populate()
            .angularAnnotations()
            .minifyAssets()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain assets', 'JavaScript', 1);

                var asset = assetGraph.findAssets()[0];

                expect(asset.text, 'to be', 'angular.module(\'MyMod\').controller(\'MyCtrl\',[\'$scope\',\'$timeout\',function($scope,$timeout){return[$scope,$timeout]}]);');
            })
            .run(done);
    });
});
