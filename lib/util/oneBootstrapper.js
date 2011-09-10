var vm = require('vm'),
    uglify = require('uglify-js'),
    uglifyAst = require('assetgraph/lib/util/uglifyAst'),
    i18nTools = require('../util/i18nTools'),
    oneBootstrapper = module.exports = {};

// Maintained as a function so syntax highlighting works:
function oneBootstrapperCode() {
    window.one = window.one || {};

    one.localeId = document && document.documentElement && document.documentElement.getAttribute('lang');

    one.getStaticUrl = function (url) { // , placeHolderValue1, placeHolderValue2, ...
        var placeHolderValues = Array.prototype.slice.call(arguments, 1);
        return url.replace(/\*/g, function () {
            return placeHolderValues.shift();
        });
    };

    (function installOneDevelopmentMode() {
        one.include = function () {};

        one.localize = true;

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

        var prioritizedLocaleIds = expandLocaleIdToPrioritizedList(one.localeId);

        one.tr = function (key, defaultValue) {
            var keyByLocaleId = one.i18nKeys[key];
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

oneBootstrapper.createAst = function (initialAsset, assetGraph) {
    if (initialAsset.type !== 'Html' && initialAsset.type !== 'JavaScript') {
        throw new Error('oneBootstrapper.createAst: initialAsset must be Html or JavaScript, but got ' + initialAsset);
    }
    var statementAsts = uglifyAst.getFunctionBodyAst(oneBootstrapperCode);
    // Add one.i18nKeys assignment to the end of the installDevelopmentMode function body:
    statementAsts[statementAsts.length - 1][1][1][3].push([
        "stat",
        [
            "assign",
            true,
            [
                "dot",
                [
                    "name",
                    "one"
                ],
                "i18nKeys"
            ],
            uglifyAst.objToAst(i18nTools.extractAllReachableKeys(assetGraph, initialAsset))
        ]
    ]);
    return ['toplevel', statementAsts];
};

oneBootstrapper.createContext = function (initialAsset, assetGraph) {
    var context = vm.createContext();
    context.window = context;
    if (initialAsset.type === 'Html') {
        context.__defineSetter__('document', function () {});
        context.__defineGetter__('document', function () {
            initialAsset.markDirty();
            return initialAsset.parseTree;
        });
    }
    vm.runInContext(uglify.uglify.gen_code(oneBootstrapper.createAst(initialAsset, assetGraph)),
                    context,
                    "bootstrap code for " + (initialAsset.url || "inline"));
    return context;
};
