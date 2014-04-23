var i18nTools = require('../i18nTools'),
    _ = require('underscore'),
    util = require('util');

function indentLines(str, level) {
    return str.split(/\r\n?|\n\r?/).map(function (line) {
        for (var i = 0 ; i < level ; i += 1) {
            line = ' ' + line;
        }
        return line;
    }).join('\n');
}

module.exports = function (options) {
    var defaultLocaleId = options.defaultLocaleId,
        supportedLocaleIds = options.supportedLocaleIds,
        ignore;

    if (options.ignore) {
        if (Array.isArray(options.ignore)) {
            ignore = options.ignore;
        } else {
            ignore = [options.ignore];
        }
    } else {
        ignore = [];
    }

    return function checkLanguageKeys(assetGraph) {
        var localeIdsByMissingKey = {},
            localeIdsByUntranslatedKey = {},
            defaultValueMismatchesByKey = {},
            firstSeenDefaultValueByKey = {},
            whitespaceWarningsByKey = {},
            isSeenByKey = {},
            occurrencesByKey = {}; // FIXME: Will end up containing a duplicate for each locale

        supportedLocaleIds.forEach(function (localeId) {
            var isDefaultLocaleId = localeId && defaultLocaleId && new RegExp('^' + defaultLocaleId + '(?:[\\-_]|$)').test(localeId),
                allKeysForLocale = i18nTools.extractAllKeysForLocale(assetGraph, localeId);

            assetGraph.findAssets({type: ['Html', 'Svg', 'Htc', 'JavaScript']}).forEach(function (asset) {
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
                });
            });
        });

        function getAssetUrlStringForKey(key) {
            var occurrences = occurrencesByKey[key];
            return _.unique(occurrences.map(function (occurrence) {
                return occurrence.asset.urlOrDescription;
            })).join(' ');
        }

        if (ignore.indexOf('missing') === -1) {
            Object.keys(localeIdsByMissingKey).forEach(function (missingKey) {
                assetGraph.emit('info', new Error('Language key ' + missingKey + ' is missing in ' +  localeIdsByMissingKey[missingKey].join(',') + ' (used in ' + getAssetUrlStringForKey(missingKey) + ')'));
            });
        }

        if (ignore.indexOf('untranslated') === -1) {
            Object.keys(localeIdsByUntranslatedKey).forEach(function (untranslatedKey) {
                assetGraph.emit('info', new Error('Language key ' + untranslatedKey + ' is flagged for translation, but not yet translated into ' + localeIdsByUntranslatedKey[untranslatedKey].join(',') + ' (used in ' + getAssetUrlStringForKey(untranslatedKey) + ')'));
            });
        }

        if (ignore.indexOf('defaultValueMismatch') === -1) {
            Object.keys(defaultValueMismatchesByKey).forEach(function (defaultValueMismatchKey) {
                // Gah, FIXME:
                defaultValueMismatchesByKey[defaultValueMismatchKey].defaultValues = _.unique(defaultValueMismatchesByKey[defaultValueMismatchKey].defaultValues);

                assetGraph.emit('info', new Error('Language key ' + defaultValueMismatchKey + ' has mismatching default and/or ' + defaultLocaleId + ' values:\n' + indentLines(util.inspect(defaultValueMismatchesByKey[defaultValueMismatchKey], false, 99), 2)));
            });
        }

        if (ignore.indexOf('whitespace') === -1) {
            Object.keys(whitespaceWarningsByKey).forEach(function (whitespaceWarningKey) {
                assetGraph.emit('info', new Error('Language key ' + whitespaceWarningKey + ' has leading or trailing whitespace:\n' + indentLines(util.inspect(whitespaceWarningsByKey[whitespaceWarningKey], false, 99), 2)));
            });
        }

        if (ignore.indexOf('unused') === -1) {
            assetGraph.findAssets({type: 'I18n'}).forEach(function (i18nAsset) {
                Object.keys(i18nAsset.parseTree).forEach(function (key) {
                    if (!isSeenByKey[key]) {
                        assetGraph.emit('info', new Error('Unused language key in ' + i18nAsset.urlOrDescription + ': ' + key));
                    }
                });
            });
        }
    };
};
