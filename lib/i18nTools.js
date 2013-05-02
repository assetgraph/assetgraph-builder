var vm = require('vm'),
    _ = require('underscore'),
    memoizeSync = require('memoizesync'),
    AssetGraph = require('assetgraph'),
    uglifyJs = AssetGraph.JavaScript.uglifyJs,
    uglifyAst = AssetGraph.JavaScript.uglifyAst,
    i18nTools = {};

 // Replace - with _ and convert to lower case: en-GB => en_gb
i18nTools.normalizeLocaleId = function (localeId) {
    return localeId && localeId.replace(/-/g, '_').toLowerCase();
};

// Helper for getting a prioritized list of relevant locale ids from a specific locale id.
// For instance, "en_US" produces ["en_US", "en"]
i18nTools.expandLocaleIdToPrioritizedList = memoizeSync(function (localeId) {
    var localeIds = [localeId];
    while (/_[^_]+$/.test(localeId)) {
        localeId = localeId.replace(/_[^_]+$/, '');
        localeIds.push(localeId);
    }
    return localeIds;
});

i18nTools.tokenizePattern = function (pattern) {
    if (typeof pattern !== 'string') {
        throw new Error('i18nTools.tokenizePattern: Value must be a string: ' + pattern);
    }
    var tokens = [];
    // Split pattern into tokens (return value of replace isn't used):
    // FIXME: The real ICU syntax uses different escaping rules, either adapt or remove support
    pattern.replace(/\{(\d+)\}|((?:[^\\\{]|\\[\\\{])+)/g, function ($0, placeHolderNumberStr, text) {
        if (placeHolderNumberStr) {
            tokens.push({
                type: 'placeHolder',
                value: parseInt(placeHolderNumberStr, 10)
            });
        } else {
            tokens.push({
                type: 'text',
                value: text.replace(/\\([\{\}])/g, "$1")
            });
        }
    });
    return tokens;
};

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

i18nTools.eachI18nTagInHtmlDocument = function (document, lambda, nestedTemplateLambda) {
    var ELEMENT_NODE = 1,
        TEXT_NODE = 3,
        queue = [document];
    while (queue.length) {
        var node = queue.shift(),
            parentNode = node.parentNode,
            nodeStillInDocument = true;
        if (parentNode && node.nodeType === ELEMENT_NODE) {
            if (node.hasAttribute('data-i18n')) {
                var i18nStr = node.getAttribute('data-i18n'),
                    i18nObj;

                if (i18nStr.indexOf(':') !== -1) {
                    try {
                        i18nObj = eval('({' + i18nStr + '})');
                    } catch(e) {
                        throw new Error('i18nTools.eachI18nTagInHtmlDocument: Error evaluating data-i18n attribute: ' + i18nStr + '\n' + e.stack);
                    }
                } else {
                    i18nObj = {text: i18nStr};
                }

                if (i18nObj.attr) {
                    var attributeNames = Object.keys(i18nObj.attr);
                    for (var i = 0 ; i < attributeNames.length ; i += 1) {
                        var attributeName = attributeNames[i],
                            key = i18nObj.attr[attributeName];
                        if (lambda({type: 'i18nTagAttribute', attributeName: attributeName, node: node, key: key, defaultValue: node.getAttribute(attributeName)}) === false) {
                            return;
                        }
                    }
                }

                if (i18nObj.text) {
                    var defaultValue = '',
                        placeHolders = [],
                        nextPlaceHolderNumber = 0;

                    for (var i = 0 ; i < node.childNodes.length ; i += 1) {
                        var childNode = node.childNodes[i];
                        if (childNode.nodeType === TEXT_NODE) {
                            defaultValue += childNode.nodeValue;
                        } else {
                            defaultValue += '{' + nextPlaceHolderNumber + '}';
                            nextPlaceHolderNumber += 1;
                            placeHolders.push(childNode);
                        }
                    }
                    defaultValue = defaultValue.replace(/^[ \n\t]+|[ \n\t]+$/g, ''); // Trim leading and trailing whitespace, except non-breaking space chars
                    defaultValue = defaultValue.replace(/[ \n\t]+/g, ' '); // Compress and normalize sequences of 1+ spaces to one ' '
                    if (lambda({type: 'i18nTagText', node: node, key: i18nObj.text, defaultValue: defaultValue, placeHolders: placeHolders}) === false) {
                        return;
                    }
                } else {
                    // A tag with a data-i18n tag, but no language key for the text contents.
                    // Give the lambda a chance to clean up the tag anyway:
                    lambda({node: node});
                }
                if (!node.parentNode) {
                    nodeStillInDocument = false;
                    queue.unshift(parentNode);
                }
            }
            // Give the caller a chance to do something about nested <script type="text/html">...</script> templates (used by TRHTML in the browser):
            if (nestedTemplateLambda && node.nodeName.toLowerCase() === 'script' && node.getAttribute('type') === 'text/html') {
                nestedTemplateLambda(node);
            }
        }
        if (nodeStillInDocument && node.childNodes) {
            for (var i = node.childNodes.length - 1 ; i >= 0 ; i -= 1) {
                queue.unshift(node.childNodes[i]);
            }
        }
    }
};

i18nTools.createInfoObjectUpdater = function (infoObject, allKeysForLocale, localeId, defaultLocaleId) {
    infoObject = infoObject || {};
    var localeIdsByMissingKey = (infoObject.localeIdsByMissingKey = infoObject.localeIdsByMissingKey || {}),
        defaultValueMismatchesByKey = (infoObject.defaultValueMismatchesByKey = infoObject.defaultValueMismatchesByKey || {}),
        firstSeenDefaultValueByKey = (infoObject.firstSeenDefaultValueByKey = infoObject.firstSeenDefaultValueByKey || {}),
        whitespaceWarningsByKey = (infoObject.whitespaceWarningsByKey = infoObject.whitespaceWarningsByKey || {}),
        isDefaultLocaleId = localeId && defaultLocaleId && new RegExp('^' + defaultLocaleId + '(?:[\\-_]|$)').test(localeId);

    return function (options, key, value) {
        if ((value === null || typeof value === 'undefined') && (!localeId || !(isDefaultLocaleId && options.defaultValue))) {
            if (localeIdsByMissingKey[key]) {
                if (localeIdsByMissingKey[key].indexOf(localeId) === -1) {
                    localeIdsByMissingKey[key].push(localeId);
                }
            } else {
                localeIdsByMissingKey[key] = [localeId];
            }
        }
        if (value && typeof value === 'string' && /^\s+|\s+$/.test(value)) {
            (whitespaceWarningsByKey[key] = whitespaceWarningsByKey[key] || []).push({
                type: 'value',
                localeId: localeId,
                value: value
            });
        }

        if (isDefaultLocaleId && typeof options.defaultValue !== 'undefined') {
            if (typeof options.defaultValue === 'string' && /^\s+|\s+$/.test(options.defaultValue)) {
                (whitespaceWarningsByKey[key] = whitespaceWarningsByKey[key] || []).push({
                    type: 'defaultValue',
                    localeId: localeId,
                    value: options.defaultValue
                });
            }
            if (typeof value !== 'undefined' && !_.isEqual(options.defaultValue, value)) {
                if (defaultValueMismatchesByKey[key]) {
                    defaultValueMismatchesByKey[key].defaultValues.push(options.defaultValue);
                } else {
                    defaultValueMismatchesByKey[key] = {defaultValues: [options.defaultValue]};
                }
                defaultValueMismatchesByKey[key][localeId] = value;
            }
            if (key in firstSeenDefaultValueByKey && !_.isEqual(firstSeenDefaultValueByKey[key], options.defaultValue)) {
                defaultValueMismatchesByKey[key] = defaultValueMismatchesByKey[key] || {defaultValues: []};
                [firstSeenDefaultValueByKey[key], options.defaultValue].forEach(function (defaultValue) {
                    if (defaultValueMismatchesByKey[key].defaultValues.indexOf(defaultValue) === -1) {
                        defaultValueMismatchesByKey[key].defaultValues.push(defaultValue);
                    }
                });
            }
            firstSeenDefaultValueByKey[key] = firstSeenDefaultValueByKey[key] || options.defaultValue;
        }
    };
};


i18nTools.createI18nTagReplacer = function (options) {
    var ELEMENT_NODE = 1,
        TEXT_NODE = 3,
        allKeysForLocale = options.allKeysForLocale,
        localeId = options.localeId && i18nTools.normalizeLocaleId(options.localeId),
        defaultLocaleId = options.defaultLocaleId && i18nTools.normalizeLocaleId(options.defaultLocaleId),
        infoObject = options.infoObject,
        firstSeenDefaultValueByKey = {},
        infoObjectUpdater = i18nTools.createInfoObjectUpdater(infoObject, allKeysForLocale, localeId, defaultLocaleId);

    return function i18nTagReplacer(options) {
        var node = options.node,
            key = options.key,
            value = allKeysForLocale[options.key],
            removeNode = options.type !== 'i18nTagAttribute' && node.nodeName.toLowerCase() === 'span' && node.attributes.length === 1;

        if (options.type) {
            // Don't update the info object if it's one of the "fake" occurrences output by i18nTools.eachI18nTagInHtmlDocument
            // when there's no i18n of the text contents:
            infoObjectUpdater(options, key, value);
        }

        if (/^i18nTag/.test(options.type) && value === null || typeof value === 'undefined') {
            value = options.defaultValue || '[!' + options.key + '!]';
        }
        if (options.type === 'i18nTagAttribute') {
            node.setAttribute(options.attributeName, value);
        } else if (options.type === 'i18nTagText') {
            while (node.childNodes.length) {
                node.removeChild(node.firstChild);
            }
            i18nTools.tokenizePattern(value).forEach(function (token) {
                var nodeToInsert;
                if (token.type === 'text') {
                    nodeToInsert = node.ownerDocument.createTextNode(token.value);
                } else {
                    var placeHolder = options.placeHolders[token.value];
                    if (placeHolder) {
                        nodeToInsert = placeHolder;
                        if (nodeToInsert.parentNode) {
                            nodeToInsert = nodeToInsert.cloneNode(true);
                        }
                    } else {
                        nodeToInsert = node.ownerDocument.createTextNode('[!{' + token.value + '}!]');
                    }
                }
                if (removeNode) {
                    if (nodeToInsert.nodeType === TEXT_NODE && node.previousSibling && node.previousSibling.nodeType === TEXT_NODE) {
                        // Splice with previous text node
                        node.previousSibling.nodeValue += nodeToInsert.nodeValue;
                    } else {
                        node.parentNode.insertBefore(nodeToInsert, node);
                    }
                } else {
                    node.appendChild(nodeToInsert);
                }
            });
        }
        if (removeNode) {
            node.parentNode.removeChild(node);
        } else if (options.type !== 'i18nTagAttribute') {
            node.removeAttribute('data-i18n');
        }
    };
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

// initialAsset must be Html or JavaScript
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
        defaultLocaleId = options.defaultLocaleId,
        infoObjectUpdater = i18nTools.createInfoObjectUpdater(options.infoObject, allKeysForLocale, localeId, defaultLocaleId);

    return function trReplacer(options) {
        var node = options.node,
            parentNode = options.parentNode,
            type = options.type,
            key = options.key,
            value = allKeysForLocale[key],
            valueAst;

        infoObjectUpdater(options, key, value);

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

// Get a object: key => array of "occurrence" objects that can either represent TR or TRPAT expressions:
//   {asset: ..., type: 'TR'|'TRPAT', node, ..., defaultValue: <ast>}
// or <span data-i18n="keyName">...</span> tags:
//   {asset: ..., type: 'i18nTag', node: ..., placeHolders: [...], defaultValue: <string>)
i18nTools.findOccurrences = function (assetGraph, initialAssets) {
    var trOccurrencesByKey = {};
    initialAssets.forEach(function (htmlAsset) {
        var assets = assetGraph.collectAssetsPostOrder(htmlAsset, {type: assetGraph.query.not('HtmlAnchor')}).forEach(function (asset) {
            if (asset.isLoaded) {
                if (asset.type === 'JavaScript') {
                    i18nTools.eachTrInAst(asset.parseTree, function (occurrence) {
                        occurrence.asset = asset;
                        (trOccurrencesByKey[occurrence.key] = trOccurrencesByKey[occurrence.key] || []).push(occurrence);
                    });
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

_.extend(exports, i18nTools);
