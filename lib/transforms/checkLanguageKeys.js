var i18nTools = require('../i18nTools'),
    _ = require('underscore'),
    util = require('util'),
    AssetGraph = require('../AssetGraph');

function normalizeToObject(arrayOrStringOrUndefined) {
    var obj = {};
    if (typeof arrayOrStringOrUndefined !== 'undefined') {
        if (Array.isArray(arrayOrStringOrUndefined)) {
            arrayOrStringOrUndefined.forEach(function (str) {
                obj[str] = true;
            });
        } else {
            obj[arrayOrStringOrUndefined] = true;
        }
    }
    return obj;
}

function isBootstrapperRelation(relation) {
    return relation.type === 'HtmlScript' && relation.node && relation.node.getAttribute('id') === 'bootstrapper';
}

var ignoreByAttributeName = {};

[
    'accesskey', 'class', 'contenteditable', 'contextmenu', 'dir', 'draggable', 'dropzone', 'hidden', 'id', 'lang', 'spellcheck', 'style', 'tabindex', 'unselectable', 'checked',
    'translate',
    'seamless', 'src', 'href', 'width', 'height', 'cellspacing', 'cellpadding',
    'scrolling', 'allowtransparency',
    'media',
    'sizes', 'type', 'rel', 'charset', 'for', 'name', 'content', 'rows', 'cols', 'maxlength', 'data-dropdown', 'target', 'disabled', 'enctype', 'action', 'method', 'http-equiv',
    'data-toggle',
    'data-tooltip-placement', // One.com specific
    'frameborder', 'visible', 'role', 'hidefocus', 'autocomplete', 'data-elastic',
    'data-i18n', 'data-version',
    'data-bind', 'params' // Knockout.js specific
].forEach(function (attributeName) {
    ignoreByAttributeName[attributeName] = true;
});

var ignoreByTagName = {};

[
    'style',
    'script',
    'applet', 'param',
    'public:attach', 'public:component' // Htc
].forEach(function (tagName) {
    ignoreByTagName[tagName] = true;
});

module.exports = function (options) {
    var defaultLocaleId = options.defaultLocaleId,
        supportedLocaleIds = options.supportedLocaleIds,
        ignoreByMessageType = normalizeToObject(options.ignoreMessageTypes),
        warnByMessageType = normalizeToObject(options.warnMessageTypes);

    return function checkLanguageKeys(assetGraph) {
        var localeIdsByMissingKey = {},
            localeIdsByUntranslatedKey = {},
            defaultValueInfosByKey = {},
            allKeysByLocaleId = {},
            whitespaceWarningsByKey = {},
            isSeenByKey = {},
            occurrencesByKey = {}; // FIXME: Will end up containing a duplicate for each locale

        supportedLocaleIds.forEach(function (localeId) {
            var isDefaultLocaleId = defaultLocaleId === localeId,
                allKeysForLocale = allKeysByLocaleId[localeId] = i18nTools.extractAllKeysForLocale(assetGraph, localeId);

            assetGraph.findAssets({type: ['Html', 'Svg', 'Htc', 'JavaScript'], isLoaded: true}).forEach(function (asset) {
                if (asset.type === 'JavaScript' && asset.incomingRelations.every(isBootstrapperRelation)) {
                    return;
                }
                i18nTools.eachOccurrenceInAsset(asset, function (options) {
                    options.asset = asset;
                    var key = options.key,
                        value = allKeysForLocale[key];

                    if (key === null || !options.type) {
                        // Ignore if it's an instruction to not translate or one of the "fake" occurrences output by
                        // i18nTools.eachI18nTagInHtmlDocument when there's no i18n of the text contents:
                        return;
                    }

                    (occurrencesByKey[key] = occurrencesByKey[key] || []).push(options);
                    isSeenByKey[key] = true;
                    if (!localeId || !(isDefaultLocaleId && options.defaultValue)) {
                        if (typeof value === 'undefined') {
                            if (localeIdsByMissingKey[key]) {
                                if (localeIdsByMissingKey[key].indexOf(localeId) === -1) {
                                    localeIdsByMissingKey[key].push(localeId);
                                }
                            } else {
                                localeIdsByMissingKey[key] = [localeId];
                            }
                        } else if (value === null) {
                            // Flagged for translation
                            if (localeIdsByUntranslatedKey[key]) {
                                if (localeIdsByUntranslatedKey[key].indexOf(localeId) === -1) {
                                    localeIdsByUntranslatedKey[key].push(localeId);
                                }
                            } else {
                                localeIdsByUntranslatedKey[key] = [localeId];
                            }
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
                                asset: asset,
                                localeId: localeId,
                                value: options.defaultValue
                            });
                        }
                        if (options.type !== 'callTRPAT') { // callTRPAT nodes will also be reported as TRPAT, so avoid dupes
                            (defaultValueInfosByKey[key] = defaultValueInfosByKey[key] || []).push({value: options.defaultValue, asset: asset, occurrence: options});
                        }
                    }
                });
            });
        });

        function emitEvent(messageType, err) {
            if (!ignoreByMessageType[messageType]) {
                assetGraph.emit(warnByMessageType[messageType] ? 'warn' : 'info', err);
            }
        }

        function getAssetUrlStringForKey(key) {
            var occurrences = occurrencesByKey[key];
            return _.unique(occurrences.map(function (occurrence) {
                return occurrence.asset.urlOrDescription;
            })).join(' ');
        }

        Object.keys(localeIdsByMissingKey).forEach(function (missingKey) {
            emitEvent('missing', new Error('Language key ' + missingKey + ' is missing in ' +  localeIdsByMissingKey[missingKey].join(',') + ' (used in ' + getAssetUrlStringForKey(missingKey) + ')'));
        });

        Object.keys(localeIdsByUntranslatedKey).forEach(function (untranslatedKey) {
            emitEvent('untranslated', new Error('Language key ' + untranslatedKey + ' is flagged for translation, but not yet translated into ' + localeIdsByUntranslatedKey[untranslatedKey].join(',') + ' (used in ' + getAssetUrlStringForKey(untranslatedKey) + ')'));
        });

        Object.keys(whitespaceWarningsByKey).forEach(function (whitespaceWarningKey) {
            emitEvent('whitespace', new Error('Language key ' + whitespaceWarningKey + ' has leading or trailing whitespace: ' + util.inspect(_.pluck(whitespaceWarningsByKey[whitespaceWarningKey], 'value').join(', ')) + ' (used in ' + getAssetUrlStringForKey(whitespaceWarningKey) + ')'));
        });

        var allKeys = {},
            i18nAssetByKey = {};

        assetGraph.findAssets({type: 'I18n', isLoaded: true}).forEach(function (i18nAsset) {
            Object.keys(i18nAsset.parseTree).forEach(function (key) {
                if (key in i18nAssetByKey) {
                    emitEvent('duplicate', new Error('Language key ' + key + ' defined again in ' + i18nAsset.urlOrDescription + ' (first seen in ' + i18nAssetByKey[key].urlOrDescription + ')'));
                } else {
                    allKeys[key] = i18nAsset.parseTree[key];
                    i18nAssetByKey[key] = i18nAsset;
                }
            });
            var numUnusedKeysRemoved = 0;
            Object.keys(i18nAsset.parseTree).forEach(function (key) {
                if (!isSeenByKey[key]) {
                    emitEvent('unused', new Error('Unused language key in ' + i18nAsset.urlOrDescription + ': ' + key));
                    if (options.removeUnused) {
                        numUnusedKeysRemoved += 1;
                        delete i18nAsset.parseTree[key];
                        i18nAsset.markDirty();
                    }
                }
            });
            if (numUnusedKeysRemoved > 0) {
                assetGraph.emit('info', new Error('Removed ' + numUnusedKeysRemoved + ' unused language key' + (numUnusedKeysRemoved > 1 ? 's' : '') + ' from ' + i18nAsset.urlOrDescription));
            }
        });

        if (defaultLocaleId) {
            Object.keys(defaultValueInfosByKey).forEach(function (key) {
                var defaultValueInfos = defaultValueInfosByKey[key],
                    valueInDefaultLocale = allKeysByLocaleId[defaultLocaleId] && allKeysByLocaleId[defaultLocaleId][key];
                if (typeof valueInDefaultLocale !== 'undefined') {
                    defaultValueInfos.push({
                        asset: i18nAssetByKey[key],
                        value: valueInDefaultLocale
                    });
                }
                var allValuesAreIdentical = true;
                for (var i = 0 ; i < defaultValueInfos.length - 1 ; i += 1) {
                    if (!_.isEqual(defaultValueInfos[i].value, defaultValueInfos[i + 1].value)) {
                        allValuesAreIdentical = false;
                        break;
                    }
                }
                if (!allValuesAreIdentical) {
                    // Group by the value so it's easy to produce a warning where each unique value is only mentioned once:
                    var defaultValueInfosByStringifiedValue = {};
                    defaultValueInfos.forEach(function (defaultValueInfo) {
                        var stringifiedValue = util.inspect(defaultValueInfo.value, false, 99);
                        (defaultValueInfosByStringifiedValue[stringifiedValue] = defaultValueInfosByStringifiedValue[stringifiedValue] || []).push(defaultValueInfo);
                    });

                    emitEvent('defaultValueMismatch', new Error('Language key ' + key + ' has mismatching default and/or ' + defaultLocaleId + ' values:\n' +
                        Object.keys(defaultValueInfosByStringifiedValue).map(function (stringifiedValue) {
                            return stringifiedValue + ' (' + defaultValueInfosByStringifiedValue[stringifiedValue].map(function (defaultValueInfo) {
                                var urlOrDescription = defaultValueInfo.asset.urlOrDescription,
                                    asset = defaultValueInfo.asset;
                                if (asset.type === 'JavaScript' && !asset.isInline) {
                                    var token = defaultValueInfo.occurrence.node && defaultValueInfo.occurrence.node.start;
                                    if (token) {
                                        urlOrDescription += ':' + token.line + ':' + (1 + token.col);
                                    }
                                }
                                return urlOrDescription;
                            }).join(' ') + ')';
                        }).join('\n')
                    ));
                }
            });
        }

        assetGraph.findAssets({isHtml: true, isLoaded: true}).forEach(function (htmlAsset) {
            var document = htmlAsset.parseTree;
            // https://github.com/dperini/nwmatcher/pull/66#issuecomment-12388670
            if (!document.body) {
                document = new AssetGraph.Html({text: '<html><body>' + document.outerHTML + '</body></html>'}).parseTree;
            }
            var occurrences = [];
            i18nTools.eachI18nTagInHtmlDocument(document, function (occurrence) {
                occurrences.push(occurrence);
            });

            Array.prototype.slice.call(document.querySelectorAll('*')).forEach(function (element) {
                var elementName = element.nodeName.toLowerCase();
                if (ignoreByTagName[elementName]) {
                    return;
                }

                var hasNonWhitespaceChildNodes = Array.prototype.slice.call(element.childNodes).some(function (childNode) {
                    return childNode.nodeType === childNode.TEXT_NODE && !/^[\s\n]*$|^\d+$/.test(childNode.nodeValue);
                });
                var i18nAttributes = _.toArray(element.attributes).filter(function (attribute) {
                    var attributeName = attribute.nodeName.toLowerCase(),
                        attributeValue = attribute.nodeValue;
                    if (/^on/i.test(attributeName)) {
                        return false;
                    }
                    if (attributeName === 'value' && (elementName === 'option' || (elementName === 'input' && /^(?:radio|checkbox|hidden)$/i.test(element.getAttribute('type'))))) {
                        return false;
                    }
                    if (elementName === 'meta' && attributeName === 'property') {
                        return false;
                    }
                    return attributeValue !== '' && !ignoreByAttributeName[attributeName];
                });

                if (hasNonWhitespaceChildNodes || i18nAttributes.length > 0) {
                    var matchingOccurrences = occurrences.filter(function (occurrence) {
                        return occurrence.node === element;
                    });
                    if (hasNonWhitespaceChildNodes && !matchingOccurrences.some(function (matchingOccurrence) {
                        return matchingOccurrence.type === 'i18nTagText';
                    })) {
                        emitEvent('noLanguageKey', new Error('Missing data-i18n attribute for tag contents (' + htmlAsset.urlOrDescription + '):\n' + element.outerHTML));
                    }
                    i18nAttributes.forEach(function (i18nAttribute) {
                        if (!matchingOccurrences.some(function (matchingOccurrence) {
                            return matchingOccurrence.type === 'i18nTagAttribute' &&
                                matchingOccurrence.attributeName.toLowerCase() === i18nAttribute.nodeName.toLowerCase();
                        })) {
                            emitEvent('noLanguageKey', new Error('No data-i18n attribute for \'' + i18nAttribute.nodeName + '\' attribute (' + htmlAsset.urlOrDescription + '):\n' + element.outerHTML));
                        }
                    });
                }
            });
        });
    };
};
