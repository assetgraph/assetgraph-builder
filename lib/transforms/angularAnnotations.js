var annotate;

module.exports = function (options) {
    options = options || {};

    return function angularAnnotations(assetGraph, cb) {
        if (!annotate) {
            try {
                annotate = require('ng-annotate');
            } catch (err) {
                assetGraph.emit('warn', new Error('angularAnnotations: ng-annotate not installed. Please install it to get angular annotations'));
                return cb();
            }
        }

        assetGraph.findAssets({
            type: 'JavaScript'
        }).forEach(function (asset) {
            var res = annotate(asset.text, {
                add: true
            });

            if (res.errors) {
                var err = new Error('ng-annotate: ' + res.errors);
                err.asset = asset;

                assetGraph.emit('warn', err);
            } else {
                asset.text = res.src;
            }
        });

        return cb();
    };
};
