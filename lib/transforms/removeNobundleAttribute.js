module.exports = function (queryObj) {
    return function removeNobundleAttribute(assetGraph) {
        assetGraph.findRelations(queryObj).forEach(function (relation) {
            if (relation.node.hasAttribute('nobundle')) {
                relation.node.removeAttribute('nobundle');
                relation.from.markDirty();
            }
        });
    };
};
