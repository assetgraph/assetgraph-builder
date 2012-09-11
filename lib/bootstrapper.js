var vm = require('vm'),
    _ = require('underscore'),
    uglifyJs = require('uglify-js-papandreou'),
    uglifyAst = require('uglifyast'),
    i18nTools = require('./i18nTools'),
    bootstrapper = module.exports = {};

// Maintained as a function so syntax highlighting works:
function bootstrapperCode() {
    (function () {
        window.INCLUDE = function () {};

        window.GETSTATICURL = function (url) { // , placeHolderValue1, placeHolderValue2, ...
            var placeHolderValues = Array.prototype.slice.call(arguments, 1);
            return url.replace(/\*\*?/g, function ($0) {
                return placeHolderValues.shift();
            });
        };

        var documentElement = document && document.documentElement,
            documentElementLang = documentElement && documentElement.getAttribute('lang');

        window.LOCALEID = documentElementLang || (window.SUPPORTEDLOCALEIDS && SUPPORTEDLOCALEIDS[0]) || window.DEFAULTLOCALEID || 'en_US';

        if ((!documentElement || !documentElementLang) && window.LOCALECOOKIENAME) {
            // Make sure that LOCALEID is correct in development mode:
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
                    LOCALEID = cookieLocaleId;
                }
            }
        }

        // Set <html lang="..."> to the actual value so per-locale CSS can work, eg.: html[lang='en'] .myClass {...}
        if (!window.BUILDDEVELOPMENT && documentElement && documentElementLang !== LOCALEID) {
            documentElement.setAttribute('lang', LOCALEID);
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

        // Compute on the first use so the application has a chance to change LOCALEID before TR is used for the first time:
        var prioritizedLocaleIds;
        function getPrioritizedLocaleIds() {
            if (!prioritizedLocaleIds) {
                prioritizedLocaleIds = expandLocaleIdToPrioritizedList(LOCALEID);
            }
            return prioritizedLocaleIds;
        };

        window.TR = function (key, defaultValue) {
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

        window.TRPAT = function (key, defaultPattern) {
            var pattern = TR(key, defaultPattern);
            if (typeof pattern !== 'string') {
                throw new Error('TRPAT: Value must be a string: ' + pattern);
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

        window.GETTEXT = function (url) {
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
                throw new Error("GETTEXT: Couldn't initialize an XMLHttpRequest object.");
            }
            xhr.open('GET', url, false);
            xhr.send();
            if (xhr.status && xhr.status >= 200 && xhr.status < 400) {
                return xhr.responseText;
            } else {
                throw new Error("GETTEXT: Unexpected response from the server: " + (xhr && xhr.status));
            }
        };
    }());
}

bootstrapper.createAst = function (initialAsset, assetGraph, options) {
    options = options || {};
    if (initialAsset.type !== 'Html' && initialAsset.type !== 'JavaScript') {
        throw new Error('bootstrapper.createAst: initialAsset must be Html or JavaScript, but got ' + initialAsset);
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

    Array.prototype.push.apply(statementAsts, uglifyAst.getFunctionBodyAst(bootstrapperCode));

    return ['toplevel', statementAsts];
};

bootstrapper.createContext = function (initialAsset, assetGraph, contextProperties) {
    var context = vm.createContext();
    context.window = context;
    context.assetGraph = assetGraph;
    if (contextProperties) {
        _.extend(context, contextProperties);
    }
    if (initialAsset.type === 'Html') {
        context.initialAsset = initialAsset;
        context.__defineSetter__('document', function () {});
        context.__defineGetter__('document', function () {
            initialAsset.markDirty();
            return initialAsset.parseTree;
        });
    }
    vm.runInContext(uglifyJs.uglify.gen_code(bootstrapper.createAst(initialAsset, assetGraph)),
                    context,
                    'bootstrap code for ' + (initialAsset.url || 'inline'));
    return context;
};
