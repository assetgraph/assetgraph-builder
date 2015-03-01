var _ = require('lodash');

var annotate;

module.exports = function (queryObj, annotateOptions) {
    queryObj = _.extend({ type: 'JavaScript', isLoaded: true }, queryObj);
    annotateOptions = _.extend(annotateOptions || {}, { add: true });

    return function angularAnnotations(assetGraph, cb) {
        if (!annotate) {
            try {
                annotate = require('ng-annotate');
            } catch (err) {
                assetGraph.emit('warn', new Error('angularAnnotations: ng-annotate not installed. Please install it to get angular annotations'));
                return cb();
            }
        }

        assetGraph.findAssets(queryObj).forEach(function (asset) {
            var res = annotate(asset.text, annotateOptions);

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
