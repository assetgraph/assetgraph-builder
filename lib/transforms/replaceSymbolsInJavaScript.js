// Poor man's uglifyjs --define ... intended for use with --nocompress

var _ = require('underscore'),
    uglifyJs = require('../AssetGraph').JavaScript.uglifyJs;

function isLeftHandSideOfAssignment(stack) {
    for (var i = stack.length - 2 ; i >= 0 ; i -= 1) {
        if (stack[i] instanceof uglifyJs.AST_Assign) {
            if (stack[i + 1] === stack[i].left) {
                return true;
            } else {
                break;
            }
        }
    }
    return false;
}

module.exports = function (queryObj, replacementAstBySymbolName) {
    return function replaceSymbolsInJavaScript(assetGraph) {
        assetGraph.findAssets(_.extend({type: 'JavaScript'}, queryObj)).forEach(function (javaScript) {
            var replacementPerformed = false;
            javaScript.parseTree.transform(new uglifyJs.TreeTransformer(function (node) {
                if (node instanceof uglifyJs.AST_SymbolRef && Object.prototype.hasOwnProperty.call(replacementAstBySymbolName, node.name) && !isLeftHandSideOfAssignment(this.stack)) {
                    return replacementAstBySymbolName[node.name];
                }
            }));
            if (replacementPerformed) {
                javaScript.markDirty();
            }
        });
    };
};
