var _ = require('lodash'),
    AssetGraph = require('../AssetGraph'),
    uglifyJs = AssetGraph.JavaScript.uglifyJs,
    uglifyAst = AssetGraph.JavaScript.uglifyAst;

module.exports = function (queryObj) {
    return function stripDebug(assetGraph) {
        assetGraph.findAssets(_.extend({type: 'JavaScript'}, queryObj)).forEach(function (javaScript) {
            javaScript.parseTree.figure_out_scope(); // So that uglifyJs.AST_SymbolRef.undeclared() is available
            var walker = new uglifyJs.TreeWalker(function (node) {
                if (node instanceof uglifyJs.AST_SimpleStatement) {
                    if (node.body instanceof uglifyJs.AST_Call &&
                        node.body.expression instanceof uglifyJs.AST_Dot &&
                        node.body.expression.expression instanceof uglifyJs.AST_SymbolRef &&
                        node.body.expression.expression.name === 'console' &&
                        node.body.expression.expression.undeclared()) {
                        uglifyAst.replaceDescendantNode(walker.parent(), node, new uglifyJs.AST_EmptyStatement());
                    } else if (node instanceof uglifyJs.AST_Debugger) {
                        uglifyAst.replaceDescendantNode(walker.parent(), node, new uglifyJs.AST_EmptyStatement());
                    }
                }
            });
            javaScript.parseTree.walk(walker);
        });
    };
};
