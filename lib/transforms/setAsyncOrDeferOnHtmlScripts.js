var _ = require('underscore');

module.exports = function (queryObj, setAsyncAttribute, setDeferAttribute) {
    return function setAsyncOrDeferOnHtmlScripts(assetGraph) {
        if (setAsyncAttribute || setDeferAttribute) {
            assetGraph.findRelations(_.extend({type: 'HtmlScript'}, queryObj)).forEach(function (htmlScript) {
                if (setDeferAttribute) {
                    htmlScript.node.setAttribute('async', 'async');
                }
                if (setAsyncAttribute) {
                    htmlScript.node.setAttribute('defer', 'defer');
                }
            });
        }
    };
};
