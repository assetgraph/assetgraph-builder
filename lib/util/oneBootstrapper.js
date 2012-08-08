var vm = require('vm'),
    _ = require('underscore'),
    uglifyJs = require('uglify-js'),
    uglifyAst = require('uglifyast'),
    i18nTools = require('../util/i18nTools'),
    oneBootstrapper = module.exports = {};

// Maintained as a function so syntax highlighting works:
function oneBootstrapperCode() {
    window.one = window.one || {};

    // The application can override this in development mode
    // (eg. based on a cookie) by updating one.localeId before one.tr
    // is used for the first time:
    one.localeId = document && document.documentElement && document.documentElement.getAttribute('lang') || (one.supportedLocaleIds && one.supportedLocaleIds[0]) || 'en_US';

    // Helper for getting a prioritized list of relevant locale ids from a specific locale id.
    // For instance, "en_US" produces ["en_US", "en"]
    one.expandLocaleIdToPrioritizedList = function (localeId) {
        if (!localeId) {
            return [];
        }
        var localeIds = [localeId];
        while (/_[^_]+$/.test(localeId)) {
            localeId = localeId.replace(/_[^_]+$/, '');
            localeIds.push(localeId);
        }
        return localeIds;
    };

    // Returns the canonical id of the best matching supported locale, or
    // false if no suitable supported locale could be found
    one.resolveLocaleId = function (localeId) {
        localeId = localeId.replace(/-/g, '_'); // en-US => en_US
        for (var i = 0 ; i < one.supportedLocaleIds.length ; i += 1) {
            var supportedLocaleId = one.supportedLocaleIds[i];
            if (supportedLocaleId === localeId) {
                // Exact match
                return supportedLocaleId;
            }
        }
        // No exact match found, if the locale id contains variants, try looking for a more general variant:
        var prioritizedLocaleIds = one.expandLocaleIdToPrioritizedList(localeId);
        if (prioritizedLocaleIds.length > 1) {
            return one.resolveLocaleId(prioritizedLocaleIds[1]);
        }
        return false;
    };

    (function installOneDevelopmentMode() {
        one.include = function () {};

        if (!document.documentElement.lang && one.localeCookieName) {
            // Make sure that one.localeId is correct in development mode:
            var matchLocaleCookieValue = document.cookie.match(new RegExp("\\b" + one.localeCookieName.replace(/[\.\+\*\{\}\[\]\(\)\?\^\$]/g, '\\$&') + "=([\\w]+)"));
            if (matchLocaleCookieValue) {
                var localeId = matchLocaleCookieValue[1],
                    isSupported = true; // Assume that all locales are supported if one.supportedLocaleIds isn't defined

                if (one.supportedLocaleIds) {
                    isSupported = false;
                    for (var i = 0 ; i < one.supportedLocaleIds.length ; i += 1) {
                        if (one.supportedLocaleIds[i] === localeId) {
                            isSupported = true;
                            break;
                        }
                    }
                }
                if (isSupported) {
                    one.localeId = localeId;
                }
            }
        }

        window.LOCALEID = one.localeId; // UglifyJS doesn't support defines with dot notation

        one.getStaticUrl = function (url) { // , placeHolderValue1, placeHolderValue2, ...
            var placeHolderValues = Array.prototype.slice.call(arguments, 1);
            return url.replace(/\*\*?/g, function ($0) {
                return placeHolderValues.shift();
            });
        };

        one.localize = true;

        // Compute on the first use so the application has a chance to change one.localeId before one.tr is used for the first time:
        var prioritizedLocaleIds;
        function getPrioritizedLocaleIds() {
            if (!prioritizedLocaleIds) {
                prioritizedLocaleIds = one.expandLocaleIdToPrioritizedList(one.localeId);
            }
            return prioritizedLocaleIds;
        };

        one.tr = function (key, defaultValue) {
            var prioritizedLocaleIds = getPrioritizedLocaleIds(),
                keyByLocaleId = one.i18nKeys[key];
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
    var statementAsts = uglifyAst.getFunctionBodyAst(oneBootstrapperCode);

    // Add one.supportedLocaleIds and one.localeCookieName if provided in the options object:
    ['supportedLocaleIds', 'localeCookieName'].forEach(function (optionName) {
        if (options[optionName]) {
            statementAsts.splice(1, 0,
                ['stat',
                    [
                        'assign',
                        true,
                        [
                            'dot',
                            [
                                'name',
                                'one'
                            ],
                            optionName
                        ],
                        uglifyAst.objToAst(options[optionName])
                    ]
                ]
            );
        }
    });

    var developmentModeStatements = statementAsts[statementAsts.length - 1][1][1][3];
    // Add one.i18nKeys assignment to the end of the installDevelopmentMode function body:
    developmentModeStatements.push(
        [
            'stat',
            [
                'assign',
                true,
                [
                    'dot',
                    [
                        'name',
                        'one'
                    ],
                    'i18nKeys'
                ],
                uglifyAst.objToAst(i18nTools.extractAllKeys(assetGraph))
            ]
        ]
    );
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

oneBootstrapper.findOneBootstrappersInGraph = function (assetGraph, queryObj) {
    var bootstrappersById = {};
    assetGraph.findAssets(_.extend({type: 'Html'}, queryObj)).forEach(function (htmlAsset) {
        assetGraph.findRelations({type: 'HtmlScript', from: htmlAsset, node: {id: 'oneBootstrapper'}}).forEach(function (htmlScript) {
            bootstrappersById[htmlScript.to.id] = htmlScript.to;
        });
    });
    return _.values(bootstrappersById);
};
