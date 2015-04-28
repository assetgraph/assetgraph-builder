var vm = require('vm'),
    _ = require('lodash'),
    AssetGraph = require('./AssetGraph'),
    uglifyJs = AssetGraph.JavaScript.uglifyJs,
    uglifyAst = AssetGraph.JavaScript.uglifyAst,
    i18nTools = require('./i18nTools'),
    bootstrapper = module.exports = {};

// Maintained as a function so syntax highlighting works:
/* global bootstrapperCode */
/* jshint ignore:start */
/* istanbul ignore next */
function bootstrapperCode() {
    window.INCLUDE = function () {};

    window.GETSTATICURL = function (url) { // , placeHolderValue1, placeHolderValue2, ...
        var placeHolderValues = Array.prototype.slice.call(arguments, 1);
        return url.replace(/\*\*?|\{[^\}]*\}/g, function () {
            return placeHolderValues.shift();
        });
    };

    var documentElement = document && document.documentElement,
        documentElementLang = documentElement && i18nTools.normalizeLocaleId(documentElement.getAttribute('lang'));

    function findActiveLocaleId() {
        var isSupportedByLocaleId = {};

        if (window.SUPPORTEDLOCALEIDS) {
            for (var i = 0 ; i < SUPPORTEDLOCALEIDS.length ; i += 1) {
                isSupportedByLocaleId[i18nTools.normalizeLocaleId(SUPPORTEDLOCALEIDS[i])] = true;
            }
        }
        function isSupportedLocaleId(localeId) {
            // Assume that all locales are supported if window.SUPPORTEDLOCALEIDS isn't defined
            return !window.SUPPORTEDLOCALEIDS || isSupportedByLocaleId[i18nTools.normalizeLocaleId(localeId)];
        }
        if (documentElementLang && isSupportedLocaleId(documentElementLang)) {
            return documentElementLang;
        }

        // Check the query string for a locale= parameter.
        if (window.location && location.href) {
            var matchLocationHref = location.href.match(/\?(?:|[^#]*&)locale=([\w\-_]+)(?:[&#]|$)/);
            if (matchLocationHref) {
                var queryStringLocaleId = i18nTools.normalizeLocaleId(matchLocationHref[1]);
                if (isSupportedLocaleId(queryStringLocaleId)) {
                    return queryStringLocaleId;
                }
            }
        }

        if (window.LOCALECOOKIENAME) {
            var matchLocaleCookieValue = document.cookie && document.cookie.match(new RegExp("\\b" + LOCALECOOKIENAME.replace(/[\.\+\*\{\}\[\]\(\)\?\^\$]/g, '\\$&') + "=([\\w\\-]+)"));
            if (matchLocaleCookieValue) {
                var cookieLocaleId = i18nTools.normalizeLocaleId(matchLocaleCookieValue[1]);
                if (isSupportedLocaleId(cookieLocaleId)) {
                    return cookieLocaleId;
                }
            }
        }

        if (window.navigator && navigator.language && isSupportedLocaleId(navigator.language)) {
            return i18nTools.normalizeLocaleId(navigator.language);
        }

        if (window.DEFAULTLOCALEID) {
            return DEFAULTLOCALEID;
        }

        if (window.SUPPORTEDLOCALEIDS && SUPPORTEDLOCALEIDS.length > 0) {
            return SUPPORTEDLOCALEIDS[0];
        }

        return 'en_us';
    }

    window.LOCALEID = findActiveLocaleId();

    // Set <html lang="..."> to the actual value so per-locale CSS can work, eg.: html[lang='en'] .myClass {...}
    if (!window.BUILDDEVELOPMENT && documentElement && documentElementLang !== LOCALEID) {
        documentElement.setAttribute('lang', LOCALEID);
    }

    // Helper for getting a prioritized, normalized list of relevant locale ids from a specific locale id.
    // For instance, "en_US" produces ["en_us", "en"]
    function expandLocaleIdToPrioritizedList(localeId) {
        if (!localeId) {
            return [];
        }
        localeId = i18nTools.normalizeLocaleId(localeId);
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
        localeId = i18nTools.normalizeLocaleId(localeId);
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
    }

    // Compute on the first use so the application has a chance to change LOCALEID before TR is used for the first time:
    var allKeysForLocale;
    function getAllKeysForLocale() {
        if (!allKeysForLocale) {
            allKeysForLocale = {};
            var prioritizedLocaleIds = expandLocaleIdToPrioritizedList(LOCALEID);
            for (var key in I18NKEYS) {
                if (I18NKEYS.hasOwnProperty(key)) {
                    for (var i = 0 ; i < prioritizedLocaleIds.length ; i += 1) {
                        if (prioritizedLocaleIds[i] in I18NKEYS[key]) {
                            allKeysForLocale[key] = I18NKEYS[key][prioritizedLocaleIds[i]];
                            break;
                        }
                    }
                }
            }
        }
        return allKeysForLocale;
    }

    window.LOCALIZE = true;

    window.TR = function (key, defaultValue) {
        return getAllKeysForLocale()[key] || defaultValue || '[!' + key + '!]';
    };

    window.TRPAT = function (key, defaultPattern) {
        var pattern = TR(key, defaultPattern),
            tokens = i18nTools.tokenizePattern(pattern);
        return function () { // placeHolderValue, ...
            var placeHolderValues = arguments,
                renderedString = '';
            for (var i = 0 ; i < tokens.length ; i += 1) {
                var token = tokens[i];
                if (token.type === 'placeHolder') {
                    renderedString += placeHolderValues[token.value];
                } else {
                    // token.type === 'text'
                    renderedString += token.value;
                }
            }
            return renderedString;
        };
    };

    window.TRHTML = function (htmlString) {
        var div = document.createElement('div');
        div.innerHTML = htmlString;
        i18nTools.eachI18nTagInHtmlDocument(div, i18nTools.createI18nTagReplacer({
            allKeysForLocale: getAllKeysForLocale(),
            localeId: LOCALEID,
            keepI18nAttributes: true,
            keepSpans: true
        }), function nestedTemplateHandler(node) {
            if (node.firstChild && node.firstChild.nodeType === node.TEXT_NODE) {
                // Use window.TRHTML instead of TRHTML to prevent the recursive call from being recognized as a relation:
                node.firstChild.nodeValue = window.TRHTML(node.firstChild.nodeValue);
            }
        });
        return div.innerHTML;
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

    // Taken from jQuery 1.8.3:

    var isReady = false, // Is the DOM ready to be used? Set to true once it occurs.
        readyWait = 1, // A counter to track how many items to wait for before the ready event fires. See #6781
        readyList;

    // The ready event handler and self cleanup method
    function DOMContentLoaded() {
        if (document.addEventListener) {
            document.removeEventListener("DOMContentLoaded", DOMContentLoaded, false);
            ready();
        } else if (document.readyState === "complete") {
            // we're here because readyState === "complete" in oldIE
            // which is good enough for us to call the dom ready!
            document.detachEvent("onreadystatechange", DOMContentLoaded);
            ready();
        }
    }

    // Handle when the DOM is ready
    function ready(wait) {
        // Abort if there are pending holds or we're already ready
        if (wait === true ? --readyWait : isReady) {
            return;
        }

        // Make sure body exists, at least, in case IE gets a little overzealous (ticket #5443).
        if (!document.body) {
            return setTimeout(ready, 1);
        }

        // Remember that the DOM is ready
        isReady = true;

        // If a normal DOM Ready event fired, decrement, and wait if need be
        if (wait !== true && --readyWait > 0) {
            return;
        }

        if (readyList) {
            for (var i = 0 ; i < readyList.length ; i += 1) {
                readyList[i]();
            }
            readyList = [];
        }
    }

    function onReady(fn) {
        if (!readyList) {
            readyList = [];

            // Catch cases where $(document).ready() is called after the browser event has already occurred.
            // we once tried to use readyState "interactive" here, but it caused issues like the one
            // discovered by ChrisS here: http://bugs.jquery.com/ticket/12282#comment:15
            if (document.readyState === "complete") {
                // Handle it asynchronously to allow scripts the opportunity to delay ready
                setTimeout(ready, 1);

            // Standards-based browsers support DOMContentLoaded
            } else if (document.addEventListener) {
                // Use the handy event callback
                document.addEventListener("DOMContentLoaded", DOMContentLoaded, false);

                // A fallback to window.onload, that will always work
                window.addEventListener("load", ready, false);

            // If IE event model is used
            } else {
                // Ensure firing before onload, maybe late but safe also for iframes
                document.attachEvent("onreadystatechange", DOMContentLoaded);

                // A fallback to window.onload, that will always work
                window.attachEvent("onload", ready);

                // If IE and not a frame
                // continually check to see if the document is ready
                var top = false;

                try {
                    top = window.frameElement == null && document.documentElement;
                } catch(e) {}

                if (top && top.doScroll) {
                    (function doScrollCheck() {
                        if (!isReady) {
                            try {
                                // Use the trick by Diego Perini
                                // http://javascript.nwbox.com/IEContentLoaded/
                                top.doScroll("left");
                            } catch(e) {
                                return setTimeout(doScrollCheck, 50);
                            }

                            // and execute any waiting functions
                            ready();
                        }
                    })();
                }
            }
        }
        readyList.push(fn);
    }

    function translateDocument() {
        i18nTools.eachI18nTagInHtmlDocument(document, i18nTools.createI18nTagReplacer({
            allKeysForLocale: getAllKeysForLocale(),
            keepI18nAttributes: true,
            keepSpans: true
        }));
    }

    // Give scripts a chance to turn off translation altogether:
    if (document && document.childNodes && window.TRANSLATE !== false && !window.BUILDDEVELOPMENT) {
        if (!window.setTimeout || (!document.addEventListener && !document.attachEvent)) {
            // Assume we're running in an environment where the document is already loaded (jsdom?)
            translateDocument();
        } else {
            onReady(translateDocument);
        }
    }
}
/* jshint ignore:end */

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
        statementAsts.push(new uglifyJs.AST_SimpleStatement({
            body: new uglifyJs.AST_Assign({
                operator: '=',
                left: new uglifyJs.AST_Dot({
                    property: globalName,
                    expression: new uglifyJs.AST_SymbolRef({name: 'window'})
                }),
                right: uglifyAst.objToAst(globalValueByName[globalName])
            })
        }));
    });

    statementAsts.push(new uglifyJs.AST_Var({
        definitions: [
            new uglifyJs.AST_VarDef({
                name: new uglifyJs.AST_SymbolVar({name: 'i18nTools'}),
                value: new uglifyJs.AST_Object({properties: []})
            })
        ]
    }));

    ['normalizeLocaleId', 'tokenizePattern', 'eachI18nTagInHtmlDocument', 'createI18nTagReplacer'].forEach(function (i18nToolsFunctionName) {
        statementAsts.push(new uglifyJs.AST_SimpleStatement({
            body: new uglifyJs.AST_Assign({
                operator: '=',
                left: new uglifyJs.AST_Dot({
                    property: i18nToolsFunctionName,
                    expression: new uglifyJs.AST_SymbolRef({name: 'i18nTools'})
                }),
                right: uglifyAst.objToAst(i18nTools[i18nToolsFunctionName])
            })
        }));
    });

    Array.prototype.push.apply(statementAsts, uglifyAst.getFunctionBodyAst(bootstrapperCode));

    // Wrap in immediately invoked function:

    return new uglifyJs.AST_Toplevel({
        body: [
            new uglifyJs.AST_SimpleStatement({
                body: new uglifyJs.AST_Call({
                    expression: new uglifyJs.AST_Function({
                        argnames: [],
                        body: statementAsts
                    }),
                    args: []
                })
            })
        ]
    });
};

bootstrapper.createContext = function (initialAsset, assetGraph, contextProperties) {
    var context = vm.createContext();
    context.window = context;
    context.assetGraph = assetGraph;
    context.console = console;
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
    vm.runInContext(bootstrapper.createAst(initialAsset, assetGraph).print_to_string(),
                    context,
                    'bootstrap code for ' + initialAsset.urlOrDescription);

    return context;
};
