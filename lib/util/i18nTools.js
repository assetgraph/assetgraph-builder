var vm = require('vm'),
    _ = require('underscore'),
    memoizer = require('memoizer'),
    uglifyJs = require('uglify-js'),
    uglifyAst = require('uglifyast'),
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

i18nTools.createI18nTagReplacer = function (options) {
    var allKeysForLocale = options.allKeysForLocale,
        localeId = options.localeId,
        defaultLocaleId = options.defaultLocaleId,
        localeIdsByMissingKey = options.localeIdsByMissingKey,
        defaultValueMismatchesByKey = options.defaultValueMismatchesByKey,
        isDefaultLocaleId = new RegExp('^' + defaultLocaleId + '(?:[\\-_]|$)').test(localeId);

    return function i18nTagReplacer(options) {
        var node = options.node,
            key = options.key,
            value = allKeysForLocale[options.key],
            removeNode = options.type !== 'i18nTagAttribute' && node.nodeName.toLowerCase() === 'span' && node.attributes.length === 1;

        if (localeId === defaultLocaleId && typeof value !== 'undefined' && typeof options.defaultValue !== 'undefined' && !_.isEqual(options.defaultValue, value) && defaultValueMismatchesByKey) {
            (defaultValueMismatchesByKey[key] = defaultValueMismatchesByKey[key] || []).push({
                value: value,
                defaultValue: options.defaultValue
            });
        }

        if (/^i18nTag/.test(options.type) && (value === null || typeof value === 'undefined')) {
            if (!localeId || !(isDefaultLocaleId && options.defaultValue)) {
                if (localeIdsByMissingKey) {
                    (localeIdsByMissingKey[key] = localeIdsByMissingKey[key] || []).push(localeId);
                }
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
    });
    return allKeysForLocale;
};

i18nTools.createOneTrReplacer = function (options) {
    var allKeysForLocale = options.allKeysForLocale,
        localeId = options.localeId,
        defaultLocaleId = options.defaultLocaleId,
        localeIdsByMissingKey = options.localeIdsByMissingKey,
        defaultValueMismatchesByKey = options.defaultValueMismatchesByKey,
        isDefaultLocaleIdRegExp = new RegExp('^' + defaultLocaleId + '(?:[\\-_]|$)');

    return function oneTrReplacer(options) {
        var node = options.node,
            type = options.type,
            key = options.key,
            value = allKeysForLocale[key],
            valueAst;

        if (value === null || typeof value === 'undefined') {
            if (!localeId || !(isDefaultLocaleIdRegExp.test(localeId) && options.defaultValue)) {
                if (localeIdsByMissingKey) {
                    (localeIdsByMissingKey[key] = localeIdsByMissingKey[key] || []).push(localeId);
                }
            }
            if (options.defaultValue) {
                valueAst = options.defaultValue;
            } else {
                valueAst = ['string', '[!' + key + '!]'];
            }
        } else {
            valueAst = uglifyAst.objToAst(value);
        }

        if (localeId === defaultLocaleId && typeof value !== 'undefined' && typeof options.defaultValue !== 'undefined' && !_.isEqual(options.defaultValue, valueAst) && defaultValueMismatchesByKey) {
            (defaultValueMismatchesByKey[key] = defaultValueMismatchesByKey[key] || []).push({
                value: uglifyAst.astToObj(valueAst),
                defaultValue: uglifyAst.astToObj(options.defaultValue)
            });
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
        // Key isn't present in any I18n asset, try to work out from the one.tr/data-i18n occurrences where to put it
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
            throw new Error("i18nTools.getOrCreateI18nAssetForKey (" + key + "): Key isn't found in any I18n asset and isn't used in any one.tr statements or data-i18n attributes");
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

        if (addToI18nForJavaScriptAsset.type === 'Html') {
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
        } else if (addToI18nForJavaScriptAsset.type === 'KnockoutJsTemplate') {
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
