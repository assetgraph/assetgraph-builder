/*global describe, it*/
var expect = require('../unexpected-with-plugins'),
    AssetGraph = require('../../lib/AssetGraph');

describe('cloneForEachConditionValue', function () {
    it('should fan out based on a single condition', function () {
        return new AssetGraph({root: __dirname + '/../../testdata/transforms/cloneForEachConditionValue/singleCondition/'})
            .loadAssets('index.html')
            .populate()
            .cloneForEachConditionValue({type: 'Html'}, {splitConditions: ['weather']})
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain assets', 'Html', 2);
                expect(assetGraph.findAssets({fileName: 'index.sunny.html'})[0].text, 'to contain', 'sunny')
                    .and('to contain', '<html data-assetgraph-conditions="weather: \'sunny\'">')
                    .and('not to contain', 'rainy');
                expect(assetGraph.findAssets({fileName: 'index.rainy.html'})[0].text, 'to contain', 'rainy')
                    .and('to contain', '<html data-assetgraph-conditions="weather: \'rainy\'">')
                    .and('not to contain', 'sunny');
            });
    });

    it('should fan out based on two independent conditions', function () {
        return new AssetGraph({root: __dirname + '/../../testdata/transforms/cloneForEachConditionValue/twoIndependentConditions/'})
            .loadAssets('index.html')
            .populate()
            .cloneForEachConditionValue({type: 'Html'}, {splitConditions: ['weather', 'mood']})
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain assets', 'Html', 4);
                expect(assetGraph, 'to contain relations', {from: {fileName: 'index.sunny.happy.html'}}, 4);
                expect(assetGraph, 'to contain relations', {from: {fileName: 'index.sunny.sad.html'}}, 4);
                expect(assetGraph, 'to contain relations', {from: {fileName: 'index.rainy.happy.html'}}, 4);
                expect(assetGraph, 'to contain relations', {from: {fileName: 'index.rainy.sad.html'}}, 4);

                expect(assetGraph.findAssets({fileName: 'index.sunny.happy.html'})[0].text, 'to contain', 'sunny')
                    .and('not to contain', 'rainy').and('to contain', 'happy').and('not to contain', 'sad')
                    .and('to contain', '<html data-assetgraph-conditions="weather: \'sunny\', mood: \'happy\'">');
                expect(assetGraph.findAssets({fileName: 'index.sunny.sad.html'})[0].text, 'to contain', 'sunny')
                    .and('not to contain', 'rainy').and('not to contain', 'happy').and('to contain', 'sad');
                expect(assetGraph.findAssets({fileName: 'index.rainy.happy.html'})[0].text, 'not to contain', 'sunny')
                    .and('to contain', 'rainy').and('to contain', 'happy').and('not to contain', 'sad');
                expect(assetGraph.findAssets({fileName: 'index.rainy.sad.html'})[0].text, 'not to contain', 'sunny')
                    .and('to contain', 'rainy').and('not to contain', 'happy').and('to contain', 'sad');
            });
    });

    describe('when no explicit condition values are provided', function () {
        it('should not fan out when there are no relevant data-assetgraph-conditions attributes in the HTML', function () {
            return new AssetGraph({root: __dirname + '/../../testdata/transforms/cloneForEachConditionValue/noConditions/'})
                .loadAssets('index.html')
                .populate()
                .cloneForEachConditionValue({type: 'Html'}, {splitConditions: ['weather']})
                .queue(function (assetGraph) {
                    expect(assetGraph, 'to contain assets', 'Html', 1);
                });
        });
    });

    describe('when explicit condition values are given', function () {
        it('should fan out even when there are no relevant data-assetgraph-conditions attributes in the HTML', function () {
            return new AssetGraph({root: __dirname + '/../../testdata/transforms/cloneForEachConditionValue/noConditions/'})
                .loadAssets('index.html')
                .populate()
                .cloneForEachConditionValue({type: 'Html'}, {splitConditions: ['weather'], conditions: {weather: ['sunny', 'rainy']}})
                .queue(function (assetGraph) {
                    expect(assetGraph, 'to contain assets', 'Html', 2);
                    expect(assetGraph, 'to contain asset', { fileName: 'index.sunny.html' });
                    expect(assetGraph, 'to contain asset', { fileName: 'index.rainy.html' });
                });
        });
    });
});
