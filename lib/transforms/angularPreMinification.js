var ngmin = require('ngmin'),
    seq = require('seq');

module.exports = function () {
    return function angularPreMinification(assetGraph, cb) {
        var query = assetGraph.query,
            htmlAssets = [],
            isAngular = false,
            ngminRenderer = function (javaScript, cb) {
                process.nextTick(function () {
                    cb(null, new assetGraph.JavaScript({
                        text: ngmin.annotate(javaScript.text)
                    }));
                });
            };

        assetGraph.findAssets({
            isHtml: true,
            isInitial: true,
            isInline: false
        }).forEach(function (htmlAsset) {
            var relationsToAsset = assetGraph.findRelations({
                to: htmlAsset,
                type: query.not('HtmlAnchor')
            });

            if (relationsToAsset.length === 0) {
                htmlAssets.push(htmlAsset);
            }
        });

        htmlAssets.forEach(function (htmlAsset) {
            var document = htmlAsset.parseTree;

            if (document.documentElement && document.querySelector('[ng-app]')
                || document.querySelector('[class~="ng-app:"]')) {
                isAngular = true;
            }
        });

        if (isAngular) {
            console.warn('Angular');
            seq(assetGraph.findAssets({type: 'JavaScript'}))
                .parEach(function (javaScript) {
                    ngminRenderer(javaScript, this.into(javaScript.id));
                })
                .parEach(function (javaScript) {
                    var newAsset = this.vars[javaScript.id];
                    newAsset.minify(); // FIXME: This smells
                    javaScript.replaceWith(newAsset);
                    this()
                })
                .seq(function () {
                    cb();
                })
                ['catch'](cb);
        } else {
            cb();
        }
    };
};
