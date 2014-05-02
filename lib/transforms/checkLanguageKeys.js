var i18nTools = require('../i18nTools'),
    _ = require('underscore'),
    util = require('util');

function leftPad(str, width, padChar) {
    padChar = padChar || ' ';
    str = String(str);
    while (str.length < width) {
        str = padChar + str;
    }
    return str;
}

function indentLines(str, level) {
    return str.split(/\r\n?|\n\r?/).map(function (line) {
        for (var i = 0 ; i < level ; i += 1) {
            line = ' ' + line;
        }
        return line;
    }).join('\n');
}

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

module.exports = function (options) {
    var defaultLocaleId = options.defaultLocaleId,
        supportedLocaleIds = options.supportedLocaleIds,
        ignoreByMessageType = normalizeToObject(options.ignoreMessageTypes),
        warnByMessageType = normalizeToObject(options.warnMessageTypes);

    return function checkLanguageKeys(assetGraph) {
        var localeIdsByMissingKey = {},
            localeIdsByUntranslatedKey = {},
            defaultValueMismatchesByKey = {},
            firstSeenDefaultValueByKey = {},
            whitespaceWarningsByKey = {},
            isSeenByKey = {},
            occurrencesByKey = {}; // FIXME: Will end up containing a duplicate for each locale

        supportedLocaleIds.forEach(function (localeId) {
            var isDefaultLocaleId = defaultLocaleId === localeId,
                allKeysForLocale = i18nTools.extractAllKeysForLocale(assetGraph, localeId);

            assetGraph.findAssets({type: ['Html', 'Svg', 'Htc', 'JavaScript'], isLoaded: true}).forEach(function (asset) {
                if (asset.type === 'JavaScript' && asset.incomingRelations.every(isBootstrapperRelation)) {
                    return;
                }
                i18nTools.eachOccurrenceInAsset(asset, function (options) {
                    options.asset = asset;
                    var key = options.key,
                        value = allKeysForLocale[key];

                    if (!options.type) {
                        // Ignore if it's one of the "fake" occurrences output by i18nTools.eachI18nTagInHtmlDocument
                        // when there's no i18n of the text contents:
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
                        if (typeof value !== 'undefined' && !_.isEqual(options.defaultValue, value)) {
                            if (defaultValueMismatchesByKey[key]) {
                                var existingEntryWithIdenticalDefaultValue;
                                for (var i = 0 ; i < defaultValueMismatchesByKey[key].length ; i += 1) {
                                    if (_.isEqual(defaultValueMismatchesByKey[key][i].defaultValue, options.defaultValue)) {
                                        existingEntryWithIdenticalDefaultValue = defaultValueMismatchesByKey[key][i];
                                        break;
                                    }
                                }
                                if (existingEntryWithIdenticalDefaultValue) {
                                    if (existingEntryWithIdenticalDefaultValue.assets.indexOf(asset) === -1) {
                                        existingEntryWithIdenticalDefaultValue.assets.push(asset);
                                    }
                                } else {
                                    defaultValueMismatchesByKey[key].push({defaultValue: options.defaultValue, assets: [asset]});
                                }
                            } else {
                                defaultValueMismatchesByKey[key] = [{defaultValue: options.defaultValue, assets: [asset]}];
                            }
                        }
                        if (key in firstSeenDefaultValueByKey && !_.isEqual(firstSeenDefaultValueByKey[key], options.defaultValue)) {
                            defaultValueMismatchesByKey[key] = defaultValueMismatchesByKey[key] || [];
                            [firstSeenDefaultValueByKey[key], options.defaultValue].forEach(function (defaultValue) {
                                if (!defaultValueMismatchesByKey[key].some(function (item) {
                                    return _.isEqual(item.defaultValue, options.defaultValue);
                                })) {
                                    defaultValueMismatchesByKey[key].push({defaultValue: defaultValue, assets: [asset]});
                                }
                            });
                        }
                        firstSeenDefaultValueByKey[key] = firstSeenDefaultValueByKey[key] || options.defaultValue;
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
            emitEvent('whitespace', new Error('Language key ' + whitespaceWarningKey + ' has leading or trailing whitespace:\n' + indentLines(util.inspect(whitespaceWarningsByKey[whitespaceWarningKey], false, 99), 2)));
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

        Object.keys(defaultValueMismatchesByKey).forEach(function (defaultValueMismatchKey) {
            var translationInDefaultLocale;
            if (defaultLocaleId && allKeys[defaultValueMismatchKey]) {
                i18nTools.expandLocaleIdToPrioritizedList(defaultLocaleId).some(function (localeId) {
                    if (localeId in allKeys[defaultValueMismatchKey]) {
                        translationInDefaultLocale = allKeys[defaultValueMismatchKey][localeId];
                        // Short circuit out of the 'some':
                        return true;
                    }
                });
            }

            emitEvent('defaultValueMismatch', new Error('Language key ' + defaultValueMismatchKey + ' has mismatching default and/or ' + defaultLocaleId + ' values:\n' +
                defaultValueMismatchesByKey[defaultValueMismatchKey].map(function (entry) {
                    return 'Default value: ' + util.inspect(entry.defaultValue, false, 99) + ' (' + _.pluck(entry.assets, 'urlOrDescription').join(' ') + ')';
                }).join('\n') +
                (typeof translationInDefaultLocale !== 'undefined' ? '\n' + leftPad(defaultLocaleId, 'Default value'.length) + ': ' + util.inspect(translationInDefaultLocale, false, 99) : '')
            ));
        });
    };
};
