var vows = require('vows'),
    assert = require('assert'),
    AssetGraph = require('../lib/AssetGraph');

vows.describe('transforms.angluarPreMinification').addBatch({
    'After loading test case and running the angularPreMinification transform': {
        topic: function () {
            new AssetGraph({root: __dirname + '/angularPreMinification/'})
                .loadAssets('index.html')
                .populate()
                .angularPreMinification()
                .minifyAssets() // Kill whitespace
                .run(this.callback);
        },
        'the inline JavaScript should have the expected transformations applied': function (assetGraph) {
            assert.deepEqual(assetGraph.findAssets({type: 'JavaScript'})[0].text,
                             'angular.module("myModuleName").service("MyCtrl",["$scope",function($scope){}]).service("MyOtherCtrl",["$scope",function($scope){}])');
        }
    }
})['export'](module);
