var vm = require('vm'),
    _ = require('underscore'),
    uglifyJs = require('uglify-js-papandreou'),
    uglifyAst = require('uglifyast'),
    i18nTools = require('./i18nTools'),
    oneBootstrapper = module.exports = {};

// Maintained as a function so syntax highlighting works:
function oneBootstrapperCode() {
    (function () {
        window.one = window.one || {};

        one.include = function () {};

        one.getStaticUrl = function (url) { // , placeHolderValue1, placeHolderValue2, ...
            var placeHolderValues = Array.prototype.slice.call(arguments, 1);
            return url.replace(/\*\*?/g, function ($0) {
                return placeHolderValues.shift();
            });
        };

        window.LOCALEID = document && document.documentElement && document.documentElement.getAttribute('lang') || (window.SUPPORTEDLOCALEIDS && SUPPORTEDLOCALEIDS[0]) || window.DEFAULTLOCALEID || 'en_US';

        if ((!document.documentElement || !document.documentElement.lang) && window.LOCALECOOKIENAME) {
            // Make sure that window.LOCALEID is correct in development mode:
            var matchLocaleCookieValue = document.cookie && document.cookie.match(new RegExp("\\b" + LOCALECOOKIENAME.replace(/[\.\+\*\{\}\[\]\(\)\?\^\$]/g, '\\$&') + "=([\\w]+)"));
            if (matchLocaleCookieValue) {
                var cookieLocaleId = matchLocaleCookieValue[1],
                    isSupported = true; // Assume that all locales are supported if SUPPORTEDLOCALEIDS isn't defined

                if (window.SUPPORTEDLOCALEIDS) {
                    isSupported = false;
                    for (var i = 0 ; i < SUPPORTEDLOCALEIDS.length ; i += 1) {
                        if (SUPPORTEDLOCALEIDS[i] === cookieLocaleId) {
                            isSupported = true;
                            break;
                        }
                    }
                }
                if (isSupported) {
                    window.LOCALEID = cookieLocaleId;
                }
            }
        }

        // Helper for getting a prioritized list of relevant locale ids from a specific locale id.
        // For instance, "en_US" produces ["en_US", "en"]
        function expandLocaleIdToPrioritizedList(localeId) {
            if (!localeId) {
                return [];
            }
            var localeIds = [localeId];
            while (/_[^_]+$/.test(localeId)) {
                localeId = localeId.replace(/_[^_]+$/, '');
                localeIds.push(localeId);
            }
            return localeIds;
        }

        // Returns the canonical id of the best matching supported locale, or
        // false if no suitable supported locale could be found
        function resolveLocaleId(localeId) {
            localeId = localeId.replace(/-/g, '_'); // en-US => en_US
            for (var i = 0 ; i < SUPPORTEDLOCALEIDS.length ; i += 1) {
                var supportedLocaleId = SUPPORTEDLOCALEIDS[i];
                if (supportedLocaleId === localeId) {
                    // Exact match
                    return supportedLocaleId;
                }
            }
            // No exact match found, if the locale id contains variants, try looking for a more general variant:
            var prioritizedLocaleIds = expandLocaleIdToPrioritizedList(localeId);
            if (prioritizedLocaleIds.length > 1) {
                return resolveLocaleId(prioritizedLocaleIds[1]);
            }
            return false;
        };

        window.LOCALIZE = true;

        // Compute on the first use so the application has a chance to change window.LOCALEID before one.tr is used for the first time:
        var prioritizedLocaleIds;
        function getPrioritizedLocaleIds() {
            if (!prioritizedLocaleIds) {
                prioritizedLocaleIds = expandLocaleIdToPrioritizedList(LOCALEID);
            }
            return prioritizedLocaleIds;
        };

        one.tr = function (key, defaultValue) {
            var prioritizedLocaleIds = getPrioritizedLocaleIds(),
                keyByLocaleId = I18NKEYS[key];
            if (keyByLocaleId) {
                for (var i = 0 ; i < prioritizedLocaleIds.length ; i += 1) {
                    if (typeof keyByLocaleId[prioritizedLocaleIds[i]] !== 'undefined') {
                        return keyByLocaleId[prioritizedLocaleIds[i]];
                    }
                }
            }
            return defaultValue || '[!' + key + '!]';
        };

        one.trPattern = function (key, defaultPattern) {
            var pattern = one.tr(key, defaultPattern);
            if (typeof pattern !== 'string') {
                throw new Error('one.trPattern: Value must be a string: ' + pattern);
            }
            return function () { // placeHolderValue, ...
                var placeHolderValues = arguments;
                // FIXME: The real ICU syntax uses different escaping rules, either adapt or remove support
                return pattern.replace(/\{(\d+)\}|((?:[^\{\\]|\\[\\\{])+)/g, function ($0, placeHolderNumberStr, text) {
                    if (placeHolderNumberStr) {
                        return placeHolderValues[placeHolderNumberStr];
                    } else {
                        return text.replace(/\\([\\\{])/g, "$1");
                    }
                });
            };
        };

        one.getText = function (url) {
            // Do a synchronous XHR in development mode:
            var xhr;
            try {
                xhr = new XMLHttpRequest();
            } catch (e) {
                try {
                    xhr = new ActiveXObject('Microsoft.XmlHTTP');
                } catch (e) {}
            }
            if (!xhr) {
                throw new Error("one.getText: Couldn't initialize an XMLHttpRequest object.");
            }
            xhr.open('GET', url, false);
            xhr.send();
            if (xhr.status && xhr.status >= 200 && xhr.status < 400) {
                return xhr.responseText;
            } else {
                throw new Error("one.getText: Unexpected response from the server: " + (xhr && xhr.status));
            }
        };
    }());
}

oneBootstrapper.createAst = function (initialAsset, assetGraph, options) {
    options = options || {};
    if (initialAsset.type !== 'Html' && initialAsset.type !== 'JavaScript') {
        throw new Error('oneBootstrapper.createAst: initialAsset must be Html or JavaScript, but got ' + initialAsset);
    }
    var statementAsts = [],
        globalValueByName = {
            I18NKEYS: i18nTools.extractAllKeys(assetGraph)
        };

    // Add window.SUPPORTEDLOCALEIDS, window.DEFAULTLOCALEID, and window.LOCALECOOKIENAME if provided in the options object:
    ['supportedLocaleIds', 'defaultLocaleId', 'localeCookieName'].forEach(function (optionName) {
        if (options[optionName]) {
            globalValueByName[optionName.toUpperCase()] = options[optionName];
        }
    });

    Object.keys(globalValueByName).forEach(function (globalName) {
        statementAsts.push(
            [
                'stat',
                [
                    'assign',
                    true,
                    [
                        'dot',
                        [
                            'name',
                            'window'
                        ],
                        globalName
                    ],
                    uglifyAst.objToAst(globalValueByName[globalName])
                ]
            ]
        );
    });

    Array.prototype.push.apply(statementAsts, uglifyAst.getFunctionBodyAst(oneBootstrapperCode));

    return ['toplevel', statementAsts];
};

oneBootstrapper.createContext = function (initialAsset, assetGraph) {
    var context = vm.createContext();
    context.window = context;
    context.assetGraph = assetGraph;
    if (initialAsset.type === 'Html') {
        context.initialAsset = initialAsset;
        context.__defineSetter__('document', function () {});
        context.__defineGetter__('document', function () {
            initialAsset.markDirty();
            return initialAsset.parseTree;
        });
    }
    vm.runInContext(uglifyJs.uglify.gen_code(oneBootstrapper.createAst(initialAsset, assetGraph)),
                    context,
                    'bootstrap code for ' + (initialAsset.url || 'inline'));
    return context;
};
