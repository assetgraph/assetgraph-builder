var _ = require('underscore');

module.exports = function (queryObj) {
    return function inlineJavaScriptGetOneText(assetGraph) {
        assetGraph.findRelations(_.extend({type: 'JavaScriptOneGetText'}, queryObj)).forEach(function (relation) {
            if (!relation.to.isText) {
                throw new Error('transforms.inlineJavaScriptGetOneText: Cannot inline non-text asset: ' + relation.to);
            }
            relation.node.splice(0, relation.node.length, 'string', relation.to.text);
            relation.from.markDirty();
            assetGraph.removeRelation(relation);
            // Remove the inline asset if it just became an orphan:
            if (assetGraph.findRelations({to: relation.to}).length === 0) {
                assetGraph.removeAsset(relation.to);
            }
        });
    };
};
