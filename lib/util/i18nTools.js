var vm = require('vm'),
    _ = require('underscore'),
    memoizer = require('memoizer'),
    uglifyJs = require('uglify-js'),
    uglifyAst = require('assetgraph/lib/util/uglifyAst'),
    i18nTools = {};

// Helper for getting a prioritized list of relevant locale ids from a specific locale id.
// For instance, "en_US" produces ["en_US", "en"]
i18nTools.expandLocaleIdToPrioritizedList = memoizer(function (localeId) {
    var localeIds = [localeId];
    while (/_[^_]+$/.test(localeId)) {
        localeId = localeId.replace(/_[^_]+$/, '');
        localeIds.push(localeId);
    }
    return localeIds;
});

i18nTools.tokenizePattern = function (pattern) {
    var tokens = [];
    // Split pattern into tokens (return value of replace isn't used):
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
            term = ['string', token.value];
        }
        if (ast) {
            ast = ['binary', '+', ast, term];
        } else {
            ast = term;
        }
    });
    return ast || ['string', ''];
};

i18nTools.eachI18nTagInHtmlDocument = function (document, lambda) {
    var queue = [document];
    while (queue.length) {
        var node = queue.shift(),
            parentNode = node.parentNode,
            nodeStillInDocument = true;
        if (parentNode && node.nodeType === node.ELEMENT_NODE && node.hasAttribute('data-i18n')) {
            var i18nStr = node.getAttribute('data-i18n'),
                i18nObj;

            if (i18nStr.indexOf(':') !== -1) {
                i18nObj = eval('({' + i18nStr + '})');
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
                    if (childNode.nodeType === childNode.TEXT_NODE) {
                        defaultValue += childNode.nodeValue;
                    } else {
                        defaultValue += '{' + nextPlaceHolderNumber + '}';
                        nextPlaceHolderNumber += 1;
                        placeHolders.push(childNode);
                    }
                }
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
        if (nodeStillInDocument && node.childNodes) {
            for (var i = node.childNodes.length - 1 ; i >= 0 ; i -= 1) {
                queue.unshift(node.childNodes[i]);
            }
        }
    }
};

i18nTools.createI18nTagReplacer = function (allKeys, localeId) {
    return function i18nTagReplacer(options) {
        var node = options.node,
            key = options.key,
            value = allKeys[options.key],
            removeNode = options.type !== 'i18nTagAttribute' && node.nodeName.toLowerCase() === 'span' && node.attributes.length === 1;

        if (/^i18nTag/.test(options.type) && (value === null || typeof value === 'undefined')) {
            // FIXME: Assumes that options.defaultValue is in English, perhaps that should be configurable.
            if (!localeId || !(/^en([\-_]|$)/.test(localeId) && options.defaultValue)) {
                console.warn('oneTrReplacer: Key ' + key + ' not found' + (localeId ? ' for ' + localeId : ''));
            }
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
                    nodeToInsert = options.placeHolders[token.value] || node.ownerDocument.createTextNode('[!{' + token.value + '}!]');
                }
                if (removeNode) {
                    if (nodeToInsert.nodeType === nodeToInsert.TEXT_NODE && node.previousSibling && node.previousSibling.nodeType === nodeToInsert.TEXT_NODE) {
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

i18nTools.eachOneTrInAst = function (ast, lambda) {
    var q = [ast];
    while (q.length) {
        var node = q.pop();
        if (node[0] === 'call' && Array.isArray(node[1]) && node[1][0] === 'call' &&
            Array.isArray(node[1][1]) && node[1][1][0] === 'dot' &&  Array.isArray(node[1][1][1]) &&
            node[1][1][1][0] === 'name' && node[1][1][1][1] === 'one' &&
            (node[1][1][2] === 'trPattern')) {

            if (lambda({type: 'callTrPattern', key: node[1][2][0][1], node: node, defaultValue: node[1][2][1]}) === false) {
                return;
            }
        } else if (node[0] === 'call' && Array.isArray(node[1]) && node[1][0] === 'dot' &&
                   Array.isArray(node[1][1]) && node[1][1][0] === 'name' && node[1][1][1] === 'one' &&
                   (node[1][2] === 'tr' || node[1][2] === 'trPattern')) {

            if (node[2].length === 0 || !Array.isArray(node[2][0]) || node[2][0][0] !== 'string') {
                console.warn("Invalid one." + node[1][2] + " syntax: " + uglifyJs.uglify.gen_code(node));
            }
            if (lambda({type: node[1][2], key: node[2][0][1], node: node, defaultValue: node[2][1]}) === false) {
                return;
            }
        }
        for (var i = node.length - 1 ; i >= 0 ; i -= 1) {
            if (Array.isArray(node[i])) {
                q.push(node[i]);
            }
        }
    }
};

// initialAsset must be Html or JavaScript
i18nTools.extractAllKeys = function (assetGraph) {
    var allKeys = {};
    assetGraph.findAssets({type: 'I18n'}).forEach(function (i18nAsset) {
        _.extend(allKeys, i18nAsset.parseTree);
    });
    return allKeys;
};

// initialAsset must be Html or JavaScript
i18nTools.extractAllKeysForLocale = function (assetGraph, localeId) {
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
        if (!found) {
            console.warn("i18nTools.extractAllKeysForLocale: Key " + key + " not found for " + localeId);
        }
    });
    return allKeysForLocale;
};

i18nTools.createOneTrReplacer = function (allKeys, localeId) { // localeId is optional and will only be used for warning messages
    return function oneTrReplacer(options) {
        var node = options.node,
            type = options.type,
            key = options.key,
            value = allKeys[key],
            valueAst;
        if (value === null || typeof value === 'undefined') {
            // FIXME: Assumes that options.defaultValue is in English, perhaps that should be configurable.
            if (!localeId || !(/^en([\-_]|$)/.test(localeId) && options.defaultValue)) {
                console.warn('oneTrReplacer: Key ' + key + ' not found' + (localeId ? ' for ' + localeId : ''));
            }
            if (options.defaultValue) {
                valueAst = options.defaultValue;
            } else {
                valueAst = ['string', '[!' + key + '!]'];
            }
        } else {
            valueAst = uglifyAst.objToAst(value);
        }
        if (type === 'callTrPattern') {
            // Replace one.trPattern('keyName')(placeHolderValue, ...) with a string concatenation:
            if (!Array.isArray(valueAst) || valueAst[0] !== 'string') {
                console.warn("oneTrReplacer: Invalid one.trPattern syntax: " + value);
                return;
            }
            Array.prototype.splice.apply(node, [0, node.length].concat(i18nTools.patternToAst(valueAst[1], node[2])));
        } else if (type === 'tr') {
            Array.prototype.splice.apply(node, [0, node.length].concat(valueAst));
        } else if (type === 'trPattern') {
            if (!Array.isArray(valueAst) || valueAst[0] !== 'string') {
                console.warn("oneTrReplacer: Invalid one.trPattern syntax: " + value);
                return;
            }
            var highestPlaceHolderNumber;
            i18nTools.tokenizePattern(valueAst[1]).forEach(function (token) {
                if (token.type === 'placeHolder' && (!highestPlaceHolderNumber || token.value > highestPlaceHolderNumber)) {
                    highestPlaceHolderNumber = token.value;
                }
            });
            var argumentNames = [],
                placeHolderAsts = [];
            for (var j = 0 ; j <= highestPlaceHolderNumber ; j += 1) {
                placeHolderAsts.push(['name', 'a' + j]);
                argumentNames.push('a' + j);
            }
            var returnExpressionAst = i18nTools.patternToAst(valueAst[1], placeHolderAsts);
            node.splice(0, node.length, 'function', null, argumentNames, [['return', returnExpressionAst]]);
        }
    };
};

// Get a object: key => array of "occurrence" objects that can either represent one.tr|one.trPattern expressions:
//   {asset: ..., type: 'tr'|'trPattern', node, ..., defaultValue: <ast>}
// or <span data-i18n="keyName">...</span> tags:
//   {asset: ..., type: 'i18nTag', node: ..., placeHolders: [...], defaultValue: <string>)
i18nTools.findOccurrences = function (assetGraph, initialAssets) {
    var oneTrOccurrencesByKey = {};
    initialAssets.forEach(function (htmlAsset) {
        var assets = assetGraph.collectAssetsPostOrder(htmlAsset, {type: ['HtmlScript', 'HtmlRequireJsMain', 'JavaScriptOneInclude', 'JavaScriptAmdDefine', 'JavaScriptAmdRequire', 'JavaScriptOneGetText']}).forEach(function (asset) {
            if (asset.type === 'JavaScript') {
                i18nTools.eachOneTrInAst(asset.parseTree, function (occurrence) {
                    occurrence.asset = asset;
                    (oneTrOccurrencesByKey[occurrence.key] = oneTrOccurrencesByKey[occurrence.key] || []).push(occurrence);
                });
            } else if (asset.type === 'Html' || asset.type === 'KnockoutJsTemplate') {
                i18nTools.eachI18nTagInHtmlDocument(asset.parseTree, function (occurrence) {
                    if (occurrence.key) {
                        occurrence.asset = asset;
                        (oneTrOccurrencesByKey[occurrence.key] = oneTrOccurrencesByKey[occurrence.key] || []).push(occurrence);
                    }
                });
            }
        });
    });
    return oneTrOccurrencesByKey;
};

i18nTools.getOrCreateI18nAssetForKey = function (assetGraph, key, oneTrOccurrencesByKey) {
    var i18nAssetsWithTheKey = [];
    assetGraph.findAssets({type: 'I18n'}).forEach(function (i18nAsset) {
        if (key in i18nAsset.parseTree) {
            i18nAssetsWithTheKey.push(i18nAsset);
        }
    });
    if (i18nAssetsWithTheKey.length > 1) {
        throw new Error("i18nTools.getOrCreateI18nAssetForKey: The key '" + key + "' was found in multiple I18n assets, cannot proceed");
    }
    if (i18nAssetsWithTheKey.length === 1) {
        return i18nAssetsWithTheKey[0];
    } else {
        // Key isn't present in any I18n asset, try to work out from the one.tr occurrences where to put it
        var addToI18nForJavaScriptAsset,
            includingAssetsById = {};
        if (!(key in oneTrOccurrencesByKey)) {
            throw new Error("i18nTools.getOrCreateI18nAssetForKey: The key '" + key + "' isn't used anywhere, cannot work out which .i18n file to add it to!");
        }
        oneTrOccurrencesByKey[key].forEach(function (occurrence) {
            includingAssetsById[occurrence.asset.id] = occurrence.asset;
        });
        var includingAssets = _.values(includingAssetsById);
        if (includingAssets.length === 0) {
            throw new Error("i18nTools.getOrCreateI18nAssetForKey: The key '" + key + "' isn't found in any I18n asset and isn't used in any one.tr statements");
        }
        if (includingAssets.length === 1) {
            addToI18nForJavaScriptAsset = includingAssets[0];
        } else {
            addToI18nForJavaScriptAsset = includingAssets[includingAssets.length - 1];
            console.warn("i18nTools.getOrCreateI18nAssetForKey: The key '" + key + "' occurs in one.tr expressions in multiple JavaScript assets, arbitrarily choosing the last one seen: " + addToI18nForJavaScriptAsset);
        }
        var existingI18nRelations = assetGraph.findRelations({from: addToI18nForJavaScriptAsset, to: {type: 'I18n'}}),
            i18nAsset;
        if (existingI18nRelations.length === 0) {
            i18nAsset = new assetGraph.constructor.assets.I18n({
                isDirty: true,
                parseTree: {}
            });
            var relation = new assetGraph.constructor.relations.JavaScriptOneInclude({
                from: addToI18nForJavaScriptAsset,
                to: i18nAsset
            });
            i18nAsset.url = (addToI18nForJavaScriptAsset.url || relation.baseAsset).replace(/(?:\.js|\.html)?$/, ".i18n");
            console.warn("i18nTools.getOrCreateI18nAssetForKey: Creating new I18n asset: " + i18nAsset.url);
            assetGraph.addAsset(i18nAsset);
            assetGraph.addRelation(relation);
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
