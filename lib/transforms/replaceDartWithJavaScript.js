var seq = require('seq');

module.exports = function () {
    return function replaceDartWithJavaScript(assetGraph, cb) {
        seq(assetGraph.findRelations({type: 'HtmlDart'}))
            .parEach(function (dartRelation) {
                var self = this,
                    url = dartRelation.to.url + '.js';

                assetGraph.resolveAssetConfig(url, assetGraph.root, function (err, config) {
                    var jsAsset = assetGraph.createAsset(config),
                        jsRelation = new assetGraph.HtmlScript({
                            from: dartRelation.from,
                            to: jsAsset
                        });

                    assetGraph.addAsset(jsAsset);
                    jsRelation.attach(dartRelation.from, 'after', dartRelation);
                    dartRelation.detach();

                    jsAsset.load(self);
                });
            })
            .seq(function () {
                cb();
            })
            .catch(cb);
    };
};
