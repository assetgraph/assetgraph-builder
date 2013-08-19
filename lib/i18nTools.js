var vm = require('vm'),
    _ = require('underscore'),
    memoizeSync = require('memoizesync'),
    AssetGraph = require('./AssetGraph'),
    uglifyJs = AssetGraph.JavaScript.uglifyJs,
    uglifyAst = AssetGraph.JavaScript.uglifyAst,
    i18nTools = module.exports = _.extend({}, require('./devMode').i18nTools);

i18nTools.patternToAst = function (pattern, placeHolderAsts) {
    var ast;
    i18nTools.tokenizePattern(pattern).forEach(function (token) {
        var term;
        if (token.type === 'placeHolder') {
            term = placeHolderAsts[token.value];
        } else {
            term = new uglifyJs.AST_String({value: token.value});
        }
        if (ast) {
            ast = new uglifyJs.AST_Binary({operator: '+', left: ast, right: term});
        } else {
            ast = term;
        }
    });
    return ast || new uglifyJs.AST_String({value: ''});
};

function extractKeyAndDefaultValueFromCallNode(callNode) {
    var argumentAsts = callNode.args;

    if (argumentAsts.length === 0) {
        console.warn("Invalid " + callNode.expression.print_to_string() + " syntax: " + callNode.print_to_string());
    } else {
        var keyNameAst = argumentAsts.length > 0 && uglifyAst.foldConstant(argumentAsts[0]),
            defaultValueAst = argumentAsts.length > 1 && uglifyAst.foldConstant(argumentAsts[1]),
            keyAndDefaultValue = {};
        if (keyNameAst && keyNameAst instanceof uglifyJs.AST_String) {
            keyAndDefaultValue.key = keyNameAst.value;
            if (defaultValueAst) {
                try {
                    keyAndDefaultValue.defaultValue = uglifyAst.astToObj(uglifyAst.foldConstant(defaultValueAst));
                } catch (e) {
                    console.warn('i18nTools.eachTrInAst: Invalid ' + callNode.expression.print_to_string() + ' default value syntax: ' + callNode.print_to_string());
                }
            }
            return keyAndDefaultValue;
        } else {
            console.warn('i18nTools.eachTrInAst: Invalid ' + callNode.expression.print_to_string() + ' key name syntax: ' + callNode.print_to_string());
        }
    }
}

i18nTools.eachTrInAst = function (ast, lambda) {
    var ended = false, // Would be better if uglifyJs.TreeWalker supported aborting the traversal
        walker = new uglifyJs.TreeWalker(function (node) {
            if (ended) {
                return;
            }
            if (node instanceof uglifyJs.AST_Call &&
                node.expression instanceof uglifyJs.AST_Call &&
                node.expression.expression instanceof uglifyJs.AST_SymbolRef &&
                node.expression.expression.name === 'TRPAT') {

                var keyAndDefaultValue = extractKeyAndDefaultValueFromCallNode(node.expression);
                if (keyAndDefaultValue) {
                    if (lambda(_.extend(keyAndDefaultValue, {type: 'callTRPAT', node: node, parentNode: walker.parent()})) === false) {
                        ended = true;
                        return;
                    }
                }
            } else if (node instanceof uglifyJs.AST_Call &&
                       node.expression instanceof uglifyJs.AST_SymbolRef &&
                       (node.expression.name === 'TR' || node.expression.name === 'TRPAT')) {
                var keyAndDefaultValue = extractKeyAndDefaultValueFromCallNode(node);
                if (keyAndDefaultValue) {
                    if (lambda(_.extend(keyAndDefaultValue, {type: node.expression.name, node: node, parentNode: walker.parent()})) === false) {
                        ended = true;
                        return;
                    }
                }
            }
        });
    ast.walk(walker);
};

i18nTools.eachOccurrenceInAsset = function (asset, lambda) {
    if (asset.type === 'JavaScript') {
        i18nTools.eachTrInAst(asset.parseTree, lambda);
    } else if (asset.isHtml || asset.type === 'Svg') {
        i18nTools.eachI18nTagInHtmlDocument(asset.parseTree, lambda);
    }
};

i18nTools.extractAllKeys = function (assetGraph) {
    var allKeys = {};
    assetGraph.findAssets({type: 'I18n'}).forEach(function (i18nAsset) {
        Object.keys(i18nAsset.parseTree).forEach(function (key) {
            allKeys[key] = allKeys[key] || {};
            Object.keys(i18nAsset.parseTree[key]).forEach(function (localeId) {
                allKeys[key][i18nTools.normalizeLocaleId(localeId)] = i18nAsset.parseTree[key][localeId];
            });
        });
    });
    return allKeys;
};

// initialAsset must be Html or JavaScript
i18nTools.extractAllKeysForLocale = function (assetGraph, localeId) {
    localeId = i18nTools.normalizeLocaleId(localeId);
    var allKeys = i18nTools.extractAllKeys(assetGraph),
        prioritizedLocaleIds = i18nTools.expandLocaleIdToPrioritizedList(localeId),
        allKeysForLocale = {};
    Object.keys(allKeys).forEach(function (key) {
        var found = false;
        for (var i = 0 ; i < prioritizedLocaleIds.length ; i += 1) {
            if (prioritizedLocaleIds[i] in allKeys[key]) {
                allKeysForLocale[key] = allKeys[key][prioritizedLocaleIds[i]];
                found = true;
                break;
            }
        }
    });
    return allKeysForLocale;
};

i18nTools.createTrReplacer = function (options) {
    var allKeysForLocale = options.allKeysForLocale,
        localeId = options.localeId,
        defaultLocaleId = options.defaultLocaleId;

    return function trReplacer(options) {
        var node = options.node,
            parentNode = options.parentNode,
            type = options.type,
            key = options.key,
            value = allKeysForLocale[key],
            valueAst;

        if (value === null || typeof value === 'undefined') {
            if (options.defaultValue) {
                valueAst = uglifyAst.objToAst(options.defaultValue);
            } else {
                valueAst = new uglifyJs.AST_String({value: '[!' + key + '!]'});
            }
        } else {
            valueAst = uglifyAst.objToAst(value);
        }
        if (type === 'callTRPAT') {
            // Replace TRPAT('keyName')(placeHolderValue, ...) with a string concatenation:
            if (!(valueAst instanceof uglifyJs.AST_String)) {
                console.warn("trReplacer: Invalid TRPAT syntax: " + node.print_to_string());
                return;
            }
            uglifyAst.replaceDescendantNode(parentNode, node, i18nTools.patternToAst(valueAst.value, node.args));
        } else if (type === 'TR') {
            uglifyAst.replaceDescendantNode(parentNode, node, valueAst);
        } else if (type === 'TRPAT') {
            if (!(valueAst instanceof uglifyJs.AST_String)) {
                console.warn("trReplacer: Invalid TRPAT syntax: " + value);
                return;
            }
            var highestPlaceHolderNumber;
            i18nTools.tokenizePattern(valueAst.value).forEach(function (token) {
                if (token.type === 'placeHolder' && (!highestPlaceHolderNumber || token.value > highestPlaceHolderNumber)) {
                    highestPlaceHolderNumber = token.value;
                }
            });
            var argumentNameAsts = [],
                placeHolderAsts = [];
            for (var j = 0 ; j <= highestPlaceHolderNumber ; j += 1) {
                var argumentName = 'a' + j;
                placeHolderAsts.push(new uglifyJs.AST_SymbolRef({name: argumentName}));
                argumentNameAsts.push(new uglifyJs.AST_SymbolFunarg({name: argumentName}));
            }
            uglifyAst.replaceDescendantNode(parentNode, node, new uglifyJs.AST_Function({
                argnames: argumentNameAsts,
                body: [
                    new uglifyJs.AST_Return({value: i18nTools.patternToAst(valueAst.value, placeHolderAsts)})
                ]
            }));
        }
    };
};

function isBootstrapperRelation(relation) {
    return relation.type === 'HtmlScript' && relation.node && relation.node.getAttribute('id') === 'bootstrapper';
}

// Get a object: key => array of "occurrence" objects that can either represent TR or TRPAT expressions:
//   {asset: ..., type: 'TR'|'TRPAT', node, ..., defaultValue: <ast>}
// or <span data-i18n="keyName">...</span> tags:
//   {asset: ..., type: 'i18nTag', node: ..., placeHolders: [...], defaultValue: <string>)
i18nTools.findOccurrences = function (assetGraph, initialAssets) {
    var trOccurrencesByKey = {};
    initialAssets.forEach(function (htmlAsset) {
        var assets = assetGraph.collectAssetsPostOrder(htmlAsset, {type: assetGraph.query.not(['HtmlAnchor', 'SvgAnchor'])}).forEach(function (asset) {
            if (asset.isLoaded) {
                if (asset.type === 'JavaScript') {
                    if (!asset.incomingRelations.every(isBootstrapperRelation)) {
                        i18nTools.eachTrInAst(asset.parseTree, function (occurrence) {
                            occurrence.asset = asset;
                            (trOccurrencesByKey[occurrence.key] = trOccurrencesByKey[occurrence.key] || []).push(occurrence);
                        });
                    }
                } else if (asset.type === 'Html') {
                    i18nTools.eachI18nTagInHtmlDocument(asset.parseTree, function (occurrence) {
                        if (occurrence.key) {
                            occurrence.asset = asset;
                            (trOccurrencesByKey[occurrence.key] = trOccurrencesByKey[occurrence.key] || []).push(occurrence);
                        }
                    });
                }
            }
        });
    });
    return trOccurrencesByKey;
};

i18nTools.getOrCreateI18nAssetForKey = function (assetGraph, key, occurrencesByKey) {
    var i18nAssetsWithTheKey = [];
    assetGraph.findAssets({type: 'I18n'}).forEach(function (i18nAsset) {
        if (key in i18nAsset.parseTree) {
            i18nAssetsWithTheKey.push(i18nAsset);
        }
    });
    if (i18nAssetsWithTheKey.length > 1) {
        throw new Error("i18nTools.getOrCreateI18nAssetForKey (" + key + "): Key is found in multiple I18n assets, cannot proceed\n" + i18nAssetsWithTheKey.map(function (asset) {return asset.toString();}).join("\n"));
    }
    if (i18nAssetsWithTheKey.length === 1) {
        return i18nAssetsWithTheKey[0];
    } else {
        // Key isn't present in any I18n asset, try to work out from the TR/TRPAT/data-i18n occurrences where to put it
        var addToI18nForJavaScriptAsset,
            includingAssetsById = {};
        if (!(key in occurrencesByKey)) {
            throw new Error("i18nTools.getOrCreateI18nAssetForKey (" + key + "): Key isn't used anywhere, cannot work out which .i18n file to add it to!");
        }
        occurrencesByKey[key].forEach(function (occurrence) {
            includingAssetsById[occurrence.asset.id] = occurrence.asset;
        });
        var includingAssets = _.values(includingAssetsById);
        if (includingAssets.length === 0) {
            throw new Error("i18nTools.getOrCreateI18nAssetForKey (" + key + "): Key isn't found in any I18n asset and isn't used in any TR statements or data-i18n attributes");
        }
        if (includingAssets.length === 1) {
            addToI18nForJavaScriptAsset = includingAssets[0];
        } else {
            // Multiple including assets, prefer JavaScript assets:
            var includingJavaScriptAssets = includingAssets.filter(function (asset) {return asset.type === 'JavaScript';});
            if (includingJavaScriptAssets.length === 1) {
                addToI18nForJavaScriptAsset = includingJavaScriptAssets[0];
                console.warn("i18nTools.getOrCreateI18nAssetForKey (" + key + "): Key occurs in multiple assets, choosing the only JavaScript asset among them: " + addToI18nForJavaScriptAsset);
            } else if (includingJavaScriptAssets.length > 1) {
                addToI18nForJavaScriptAsset = includingJavaScriptAssets[includingJavaScriptAssets.length - 1];
                console.warn("i18nTools.getOrCreateI18nAssetForKey (" + key + "): Key occurs in multiple JavaScript assets, arbitrarily choosing the last one seen: " + addToI18nForJavaScriptAsset);
            } else {
                // Only non-JavaScript assets
                addToI18nForJavaScriptAsset = includingAssets[includingAssets.length - 1];
                console.warn("i18nTools.getOrCreateI18nAssetForKey (" + key + "): Key occurs in multiple assets, arbitrarily choosing the last one seen: " + addToI18nForJavaScriptAsset);
            }
        }

        if (addToI18nForJavaScriptAsset.type === 'Html' && !addToI18nForJavaScriptAsset.isFragment) {
            // See if any referenced JavaScript assets has an outgoing I18n relation:
            var referencedJavaScriptAssets = assetGraph.findAssets({type: 'JavaScript', incoming: {from: addToI18nForJavaScriptAsset}});
            if (referencedJavaScriptAssets.length === 0) {
                throw new Error(addToI18nForJavaScriptAsset + " doesn't reference any JavaScript, giving up");
            }
            var referencedJavaScriptAssetsWithI18n = referencedJavaScriptAssets.filter(function (asset) {
                return assetGraph.findRelations({to: {type: 'I18n'}, from: asset}).length > 0;
            });
            if (referencedJavaScriptAssetsWithI18n.length === 1) {
                console.warn("i18nTools.getOrCreateI18nAssetForKey (" + key + "): " + addToI18nForJavaScriptAsset + " references a single JavaScript with I18n, choosing that one: " + referencedJavaScriptAssetsWithI18n[0]);
                addToI18nForJavaScriptAsset = referencedJavaScriptAssetsWithI18n[0];
            } else if (referencedJavaScriptAssetsWithI18n.length > 1) {
                console.warn("i18nTools.getOrCreateI18nAssetForKey (" + key + "): " + addToI18nForJavaScriptAsset + " references multiple JavaScript assets with I18n, arbitrarily choosing the last one seen: " + referencedJavaScriptAssetsWithI18n[referencedJavaScriptAssetsWithI18n.length - 1]);
                addToI18nForJavaScriptAsset = referencedJavaScriptAssetsWithI18n[referencedJavaScriptAssetsWithI18n.length - 1];
            } else if (referencedJavaScriptAssets.length === 1) {
                addToI18nForJavaScriptAsset = referencedJavaScriptAssets[0];
                console.warn("i18nTools.getOrCreateI18nAssetForKey (" + key + "): " + addToI18nForJavaScriptAsset + " references a single JavaScript, choosing that one: " + referencedJavaScriptAssets[0]);
            } else {
                // referencedJavaScriptAssets.length > 1
                console.warn("i18nTools.getOrCreateI18nAssetForKey (" + key + "): " + addToI18nForJavaScriptAsset + " references multiple JavaScript, arbitrarily choosing the last one seen: " + referencedJavaScriptAssets[referencedJavaScriptAssets.length - 1]);
                addToI18nForJavaScriptAsset = referencedJavaScriptAssets[referencedJavaScriptAssets.length - 1];
            }
        } else if (addToI18nForJavaScriptAsset.type === 'Html' && addToI18nForJavaScriptAsset.isFragment) {
            var referringJavaScriptAssets = assetGraph.findAssets({outgoing: {to: addToI18nForJavaScriptAsset}});
            if (referringJavaScriptAssets.length === 0) {
                throw new Error(addToI18nForJavaScriptAsset + " isn't referenced from any JavaScript assets, giving up (key: " + key + ")");
            }
            var referringJavaScriptAssetsWithI18n = referringJavaScriptAssets.filter(function (asset) {
                return assetGraph.findRelations({to: {type: 'I18n'}, from: asset}).length > 0;
            });
            if (referringJavaScriptAssetsWithI18n.length === 1) {
                console.warn("i18nTools.getOrCreateI18nAssetForKey (" + key + "): " + addToI18nForJavaScriptAsset + " is referenced by a single JavaScript with I18n, choosing that one: " + referringJavaScriptAssetsWithI18n[0]);
                addToI18nForJavaScriptAsset = referringJavaScriptAssetsWithI18n[0];
            } else if (referringJavaScriptAssetsWithI18n.length > 1) {
                console.warn("i18nTools.getOrCreateI18nAssetForKey (" + key + "): " + addToI18nForJavaScriptAsset + " is referenced by multiple JavaScript assets with I18n, arbitrarily choosing the last one seen: " + referringJavaScriptAssetsWithI18n[referringJavaScriptAssetsWithI18n.length - 1]);
                addToI18nForJavaScriptAsset = referringJavaScriptAssetsWithI18n[referringJavaScriptAssetsWithI18n.length - 1];
            } else if (referringJavaScriptAssets.length === 1) {
                addToI18nForJavaScriptAsset = referringJavaScriptAssets[0];
                console.warn("i18nTools.getOrCreateI18nAssetForKey (" + key + "): " + addToI18nForJavaScriptAsset + " is referenced by a single JavaScript, choosing that one: " + referringJavaScriptAssets[0]);
            } else {
                // referringJavaScriptAssets.length > 1
                console.warn("i18nTools.getOrCreateI18nAssetForKey (" + key + "): " + addToI18nForJavaScriptAsset + " is referenced by multiple JavaScript assets with I18n, arbitrarily choosing the last one seen: " + referringJavaScriptAssets[referringJavaScriptAssets.length - 1]);
                addToI18nForJavaScriptAsset = referringJavaScriptAssets[referringJavaScriptAssets.length - 1];
            }
        }

        var existingI18nRelations = assetGraph.findRelations({from: addToI18nForJavaScriptAsset, to: {type: 'I18n'}}),
            i18nAsset;
        if (existingI18nRelations.length === 0) {
            i18nAsset = new assetGraph.I18n({
                isDirty: true,
                parseTree: {}
            });
            var relation = new assetGraph.JavaScriptInclude({
                from: addToI18nForJavaScriptAsset,
                to: i18nAsset
            });
            i18nAsset.url = (addToI18nForJavaScriptAsset.url || relation.baseAsset).replace(/(?:\.js|\.html)?$/, ".i18n");
            console.warn("i18nTools.getOrCreateI18nAssetForKey: Creating new I18n asset: " + i18nAsset.url);
            assetGraph.addAsset(i18nAsset);
            var existingJavaScriptIncludeRelations = assetGraph.findRelations({from: addToI18nForJavaScriptAsset, type: 'JavaScriptInclude'});
            if (existingJavaScriptIncludeRelations.length > 0) {
                relation.attach(addToI18nForJavaScriptAsset, 'after', existingJavaScriptIncludeRelations[existingJavaScriptIncludeRelations.length - 1]);
            } else {
                relation.attach(addToI18nForJavaScriptAsset, 'first');
            }
        } else {
            i18nAsset = existingI18nRelations[0].to;
            if (existingI18nRelations.length > 1) {
                console.warn("i18nTools.getOrCreateI18nAssetForKey: " + addToI18nForJavaScriptAsset + " has multiple I18n relations, choosing the first one pointing at " + i18nAsset);
            }
        }
        return i18nAsset;
    }
};
