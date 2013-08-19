(function (root, factory) {
    if (typeof exports === 'object') {
        module.exports = factory();
    } else if (typeof define === 'function' && define.amd) {
        define(factory);
    } else {
        root.devMode = factory();
    }
}(this, function () {
    var i18nTools = {},
        i18nKeys = {},
        devMode = {
            i18nTools: i18nTools
        },
        globalObj = typeof window === 'object' ? window : {}, // TODO: Remove and put everything on the devMode object
        ELEMENT_NODE = 1,
        TEXT_NODE = 3;

    function deepExtend(target) { // ...
        if (!target || typeof target !== 'object') {
            return;
        }
        for (var i = 1 ; i < arguments.length ; i += 1) {
            for (var propertyName in arguments[i]) {
                var srcValue = arguments[i][propertyName],
                    targetValue = target[propertyName],
                    isCopy = false; // A little housekeeping to avoid creating superfluous copies of the target object when adding to it.
                if (srcValue && typeof srcValue === 'object' && targetValue && typeof targetValue === 'object') {
                    if (isCopy) {
                        deepExtend(targetValue, srcValue);
                    } else {
                        target[propertyName] = deepExtend({}, targetValue, srcValue);
                        isCopy = true;
                    }
                } else {
                    target[propertyName] = arguments[i][propertyName];
                }
            }
        }
        return target;
    }

    // Replace - with _ and convert to lower case: en-GB => en_gb
    i18nTools.normalizeLocaleId = function (localeId) {
        return localeId && localeId.replace(/-/g, '_').toLowerCase();
    };

    // Helper for getting a prioritized list of relevant locale ids from a specific locale id.
    // For instance, "en_US" produces ["en_US", "en"]
    i18nTools.expandLocaleIdToPrioritizedList = function (localeId) {
        var localeIds = [localeId];
        while (/_[^_]+$/.test(localeId)) {
            localeId = localeId.replace(/_[^_]+$/, '');
            localeIds.push(localeId);
        }
        return localeIds;
    };

    i18nTools.tokenizePattern = function (pattern) {
        if (typeof pattern !== 'string') {
            throw new Error('i18nTools.tokenizePattern: Value must be a string: ' + pattern);
        }
        var tokens = [],
            fragments = pattern.split(/(\{\d+\})/);
        for (var i = 0 ; i < fragments.length ; i += 1) {
            var fragment = fragments[i];
            if (fragment.length > 0) {
                var matchPlaceHolder = fragment.match(/^\{(\d+)\}$/);
                if (matchPlaceHolder) {
                    tokens.push({
                        type: 'placeHolder',
                        value: parseInt(matchPlaceHolder[1], 10)
                    });
                } else {
                    tokens.push({
                        type: 'text',
                        value: fragment
                    });
                }
            }
        }
        return tokens;
    };

    i18nTools.eachI18nTagInHtmlDocument = function (document, lambda, nestedTemplateLambda) {
        var queue = [document];
        while (queue.length) {
            var node = queue.shift(),
                parentNode = node.parentNode,
                nodeStillInDocument = true;
            if (parentNode && node.nodeType === ELEMENT_NODE) {
                if (node.hasAttribute && node.hasAttribute('data-i18n')) { // In IE7 the HTML node doesn't have a hasAttribute method?
                    var i18nStr = node.getAttribute('data-i18n'),
                        i18nObj;

                    if (i18nStr.indexOf(':') !== -1) {
                        try {
                            i18nObj = eval('({' + i18nStr + '})');
                        } catch(e) {
                            throw new Error('i18nTools.eachI18nTagInHtmlDocument: Error evaluating data-i18n attribute: ' + i18nStr + '\n' + e.stack);
                        }
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
                            if (childNode.nodeType === TEXT_NODE) {
                                defaultValue += childNode.nodeValue;
                            } else {
                                defaultValue += '{' + nextPlaceHolderNumber + '}';
                                nextPlaceHolderNumber += 1;
                                placeHolders.push(childNode);
                            }
                        }
                        defaultValue = defaultValue.replace(/^[ \n\t]+|[ \n\t]+$/g, ''); // Trim leading and trailing whitespace, except non-breaking space chars
                        defaultValue = defaultValue.replace(/[ \n\t]+/g, ' '); // Compress and normalize sequences of 1+ spaces to one ' '
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
                // Give the caller a chance to do something about nested <script type="text/html">...</script> templates (used by TRHTML in the browser):
                if (nestedTemplateLambda && node.nodeName.toLowerCase() === 'script' && node.getAttribute('type') === 'text/html') {
                    nestedTemplateLambda(node);
                }
            }
            if (nodeStillInDocument && node.childNodes) {
                for (var i = node.childNodes.length - 1 ; i >= 0 ; i -= 1) {
                    queue.unshift(node.childNodes[i]);
                }
            }
        }
    };

    // From underscore:
    // Internal recursive comparison function for `isEqual`.
    var hasOwnProperty  = Object.prototype.hasOwnProperty;

    function has(obj, key) {
      return hasOwnProperty.call(obj, key);
    };

    var eq = function(a, b, aStack, bStack) {
      // Identical objects are equal. `0 === -0`, but they aren't identical.
      // See the Harmony `egal` proposal: http://wiki.ecmascript.org/doku.php?id=harmony:egal.
      if (a === b) return a !== 0 || 1 / a == 1 / b;
      // A strict comparison is necessary because `null == undefined`.
      if (a == null || b == null) return a === b;
      // Compare `[[Class]]` names.
      var className = toString.call(a);
      if (className != toString.call(b)) return false;
      switch (className) {
        // Strings, numbers, dates, and booleans are compared by value.
        case '[object String]':
          // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
          // equivalent to `new String("5")`.
          return a == String(b);
        case '[object Number]':
          // `NaN`s are equivalent, but non-reflexive. An `egal` comparison is performed for
          // other numeric values.
          return a != +a ? b != +b : (a == 0 ? 1 / a == 1 / b : a == +b);
        case '[object Date]':
        case '[object Boolean]':
          // Coerce dates and booleans to numeric primitive values. Dates are compared by their
          // millisecond representations. Note that invalid dates with millisecond representations
          // of `NaN` are not equivalent.
          return +a == +b;
        // RegExps are compared by their source patterns and flags.
        case '[object RegExp]':
          return a.source == b.source &&
                 a.global == b.global &&
                 a.multiline == b.multiline &&
                 a.ignoreCase == b.ignoreCase;
      }
      if (typeof a != 'object' || typeof b != 'object') return false;
      // Assume equality for cyclic structures. The algorithm for detecting cyclic
      // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.
      var length = aStack.length;
      while (length--) {
        // Linear search. Performance is inversely proportional to the number of
        // unique nested structures.
        if (aStack[length] == a) return bStack[length] == b;
      }
      // Add the first object to the stack of traversed objects.
      aStack.push(a);
      bStack.push(b);
      var size = 0, result = true;
      // Recursively compare objects and arrays.
      if (className == '[object Array]') {
        // Compare array lengths to determine if a deep comparison is necessary.
        size = a.length;
        result = size == b.length;
        if (result) {
          // Deep compare the contents, ignoring non-numeric properties.
          while (size--) {
            if (!(result = eq(a[size], b[size], aStack, bStack))) break;
          }
        }
      } else {
        // Objects with different constructors are not equivalent, but `Object`s
        // from different frames are.
        var aCtor = a.constructor, bCtor = b.constructor;
        if (aCtor !== bCtor && !(typeof aCtor === 'function' && (aCtor instanceof aCtor) &&
                                 typeof bCtor === 'function' && (bCtor instanceof bCtor))) {
          return false;
        }
        // Deep compare objects.
        for (var key in a) {
          if (has(a, key)) {
            // Count the expected number of properties.
            size++;
            // Deep compare each member.
            if (!(result = has(b, key) && eq(a[key], b[key], aStack, bStack))) break;
          }
        }
        // Ensure that both objects contain the same number of properties.
        if (result) {
          for (key in b) {
            if (has(b, key) && !(size--)) break;
          }
          result = !size;
        }
      }
      // Remove the first object from the stack of traversed objects.
      aStack.pop();
      bStack.pop();
      return result;
    };

    // Perform a deep comparison to check if two objects are equal.
    function isEqual(a, b) {
      return eq(a, b, [], []);
    };

    i18nTools.eachI18nTagInHtmlDocument = function (document, lambda, nestedTemplateLambda) {
        var ELEMENT_NODE = 1,
            TEXT_NODE = 3,
            queue = [document];
        while (queue.length) {
            var node = queue.shift(),
                parentNode = node.parentNode,
                nodeStillInDocument = true;
            if (parentNode && node.nodeType === ELEMENT_NODE) {
                if (node.hasAttribute && node.hasAttribute('data-i18n')) { // In IE7 the HTML node doesn't have a hasAttribute method?
                    var i18nStr = node.getAttribute('data-i18n'),
                        i18nObj;

                    if (i18nStr.indexOf(':') !== -1) {
                        try {
                            i18nObj = eval('({' + i18nStr + '})');
                        } catch(e) {
                            throw new Error('i18nTools.eachI18nTagInHtmlDocument: Error evaluating data-i18n attribute: ' + i18nStr + '\n' + e.stack);
                        }
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
                            if (childNode.nodeType === TEXT_NODE) {
                                defaultValue += childNode.nodeValue;
                            } else {
                                defaultValue += '{' + nextPlaceHolderNumber + '}';
                                nextPlaceHolderNumber += 1;
                                placeHolders.push(childNode);
                            }
                        }
                        defaultValue = defaultValue.replace(/^[ \n\t]+|[ \n\t]+$/g, ''); // Trim leading and trailing whitespace, except non-breaking space chars
                        defaultValue = defaultValue.replace(/[ \n\t]+/g, ' '); // Compress and normalize sequences of 1+ spaces to one ' '
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
                // Give the caller a chance to do something about nested <script type="text/html">...</script> templates (used by TRHTML in the browser):
                if (nestedTemplateLambda && node.nodeName.toLowerCase() === 'script' && node.getAttribute('type') === 'text/html') {
                    nestedTemplateLambda(node);
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
        var ELEMENT_NODE = 1,
            TEXT_NODE = 3,
            allKeysForLocale = options.allKeysForLocale,
            localeId = options.localeId && i18nTools.normalizeLocaleId(options.localeId),
            defaultLocaleId = options.defaultLocaleId && i18nTools.normalizeLocaleId(options.defaultLocaleId),
            firstSeenDefaultValueByKey = {},
            keepI18nAttributes = options.keepI18nAttributes,
            keepSpans = options.keepSpans;

        return function i18nTagReplacer(options) {
            var node = options.node,
                key = options.key,
                value = allKeysForLocale[options.key],
                removeNode = !keepSpans && options.type !== 'i18nTagAttribute' && node.nodeName.toLowerCase() === 'span' && node.attributes.length === 1;

            if (/^i18nTag/.test(options.type) && value === null || typeof value === 'undefined') {
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
                        var placeHolder = options.placeHolders[token.value];
                        if (placeHolder) {
                            nodeToInsert = placeHolder;
                            if (nodeToInsert.parentNode) {
                                nodeToInsert = nodeToInsert.cloneNode(true);
                            }
                        } else {
                            nodeToInsert = node.ownerDocument.createTextNode('[!{' + token.value + '}!]');
                        }
                    }
                    if (removeNode) {
                        if (nodeToInsert.nodeType === TEXT_NODE && node.previousSibling && node.previousSibling.nodeType === TEXT_NODE) {
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
            } else if (!keepI18nAttributes && options.type !== 'i18nTagAttribute') {
                node.removeAttribute('data-i18n');
            }
        };
    };

    // Deprecated
    globalObj.INCLUDE = function (url) {};

    devMode.GETSTATICURL = globalObj.GETSTATICURL = function (url) { // , placeHolderValue1, placeHolderValue2, ...
        var placeHolderValues = Array.prototype.slice.call(arguments, 1);
        return url.replace(/\*\*?|\{[^\}]*\}/g, function () {
            return placeHolderValues.shift();
        });
    };

    devMode.GETTEXT = globalObj.GETTEXT = function (url) {
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

    function getJson(url) { // Expose as devMode.GETJSON?
        return JSON.parse(globalObj.GETTEXT(url));
    }

    var documentElement = typeof document !== 'undefined' && document && document.documentElement,
        documentElementLang = documentElement && i18nTools.normalizeLocaleId(documentElement.getAttribute('lang')),
        configUrl = documentElement && documentElement.getAttribute('data-assetgraph-config'),
        config = {};

    if (configUrl) {
        config = getJson(configUrl);
    }
    if (config.i18n) {
        var i18nUrls = Object.prototype.toString.call(config.i18n) === '[object Array]' ? config.i18n : [config.i18n];
        for (var i = 0 ; i < i18nUrls.length ; i += 1) {
            deepExtend(i18nKeys, getJson(i18nUrls[i]));
        }
    }
    globalObj.LOCALECOOKIENAME = config.localeCookieName;
    globalObj.DEFAULTLOCALEID =
        (config.defaultLocaleId && i18nTools.normalizeLocaleId(config.defaultLocaleId)) ||
        (config.supportedLocaleIds && i18nTools.normalizeLocaleId(config.supportedLocaleIds[0])) ||
        'en_us';
    if (config.supportedLocaleIds) {
        globalObj.SUPPORTEDLOCALEIDS = new Array(config.supportedLocaleIds.length);
        for (var i = 0 ; i < config.supportedLocaleIds.length ; i += 1) {
            globalObj.SUPPORTEDLOCALEIDS[i] = i18nTools.normalizeLocaleId(config.supportedLocaleIds[i]);
        }
    } else {
        globalObj.SUPPORTEDLOCALEIDS = [config.defaultLocaleId];
    }
    var isSupportedByLocaleId = {};

    if (globalObj.SUPPORTEDLOCALEIDS) {
        for (var i = 0 ; i < globalObj.SUPPORTEDLOCALEIDS.length ; i += 1) {
            isSupportedByLocaleId[i18nTools.normalizeLocaleId(globalObj.SUPPORTEDLOCALEIDS[i])] = true;
        }
    }

    function findActiveLocaleId() {
        function isSupportedLocaleId(localeId) {
            // Assume that all locales are supported if globalObj.SUPPORTEDLOCALEIDS isn't defined
            return !globalObj.SUPPORTEDLOCALEIDS || isSupportedByLocaleId[i18nTools.normalizeLocaleId(localeId)];
        }
        if (documentElementLang && isSupportedLocaleId(documentElementLang)) {
            return documentElementLang;
        }

        // Check the query string for a locale= parameter.
        if (globalObj.location && location.href) {
            var matchLocationHref = location.href.match(/\?(?:|[^#]*&)locale=([\w\-_]+)(?:[&#]|$)/);
            if (matchLocationHref) {
                var queryStringLocaleId = i18nTools.normalizeLocaleId(matchLocationHref[1]);
                if (isSupportedLocaleId(queryStringLocaleId)) {
                    return queryStringLocaleId;
                }
            }
        }

        if (globalObj.LOCALECOOKIENAME) {
            var matchLocaleCookieValue = document.cookie && document.cookie.match(new RegExp("\\b" + globalObj.LOCALECOOKIENAME.replace(/[\.\+\*\{\}\[\]\(\)\?\^\$]/g, '\\$&') + "=([\\w\\-]+)"));
            if (matchLocaleCookieValue) {
                var cookieLocaleId = i18nTools.normalizeLocaleId(matchLocaleCookieValue[1]);
                if (isSupportedLocaleId(cookieLocaleId)) {
                    return cookieLocaleId;
                }
            }
        }

        if (globalObj.navigator && navigator.language && isSupportedLocaleId(navigator.language)) {
            return i18nTools.normalizeLocaleId(navigator.language);
        }

        if (globalObj.DEFAULTLOCALEID) {
            return globalObj.DEFAULTLOCALEID;
        }

        if (globalObj.SUPPORTEDLOCALEIDS && globalObj.SUPPORTEDLOCALEIDS.length > 0) {
            return globalObj.SUPPORTEDLOCALEIDS[0];
        }

        return 'en_us';
    }

    globalObj.LOCALEID = findActiveLocaleId();

    // Set <html lang="..."> to the actual value so per-locale CSS can work, eg.: html[lang='en'] .myClass {...}
    if (!globalObj.BUILDDEVELOPMENT && documentElement && documentElementLang !== globalObj.LOCALEID) {
        documentElement.setAttribute('lang', globalObj.LOCALEID);
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
        for (var i = 0 ; i < globalObj.SUPPORTEDLOCALEIDS.length ; i += 1) {
            var supportedLocaleId = globalObj.SUPPORTEDLOCALEIDS[i];
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
    function getAllKeysForActiveLocale() {
        if (!allKeysForLocale) {
            allKeysForLocale = {};
            var prioritizedLocaleIds = expandLocaleIdToPrioritizedList(globalObj.LOCALEID);
            for (var key in i18nKeys) {
                if (i18nKeys.hasOwnProperty(key)) {
                    for (var i = 0 ; i < prioritizedLocaleIds.length ; i += 1) {
                        if (prioritizedLocaleIds[i] in i18nKeys[key]) {
                            allKeysForLocale[key] = i18nKeys[key][prioritizedLocaleIds[i]];
                            break;
                        }
                    }
                }
            }
        }
        return allKeysForLocale;
    }

    devMode.LOCALIZE = globalObj.LOCALIZE = true;

    devMode.TR = globalObj.TR = function (key, defaultValue) {
        return getAllKeysForActiveLocale()[key] || defaultValue || '[!' + key + '!]';
    };

    devMode.TRPAT = globalObj.TRPAT = function (key, defaultPattern) {
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

    devMode.TRHTML = globalObj.TRHTML = function (htmlString) {
        var div = document.createElement('div');
        div.innerHTML = htmlString;
        i18nTools.eachI18nTagInHtmlDocument(div, i18nTools.createI18nTagReplacer({
            allKeysForLocale: getAllKeysForActiveLocale(),
            localeId: globalObj.LOCALEID
        }), function nestedTemplateHandler(node) {
            if (node.firstChild && node.firstChild.nodeType === TEXT_NODE) {
                // Use globalObj.TRHTML instead of TRHTML to prevent the recursive call from being recognized as a relation:
                node.firstChild.nodeValue = globalObj.TRHTML(node.firstChild.nodeValue);
            }
        });
        return div.innerHTML;
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

                // A fallback to globalObj.onload, that will always work
                globalObj.addEventListener("load", ready, false);

            // If IE event model is used
            } else {
                // Ensure firing before onload, maybe late but safe also for iframes
                document.attachEvent("onreadystatechange", DOMContentLoaded);

                // A fallback to globalObj.onload, that will always work
                globalObj.attachEvent("onload", ready);

                // If IE and not a frame
                // continually check to see if the document is ready
                var top = false;

                try {
                    top = globalObj.frameElement == null && document.documentElement;
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
        i18nTools.eachI18nTagInHtmlDocument(document, i18nTools.createI18nTagReplacer({allKeysForLocale: getAllKeysForLocale()}));
    }

    // Give scripts a chance to turn off translation altogether:
    if (typeof document !== 'undefined' && document && document.childNodes && globalObj.TRANSLATE !== false && !globalObj.BUILDDEVELOPMENT) {
        if (!globalObj.setTimeout || (!document.addEventListener && !document.attachEvent)) {
            // Assume we're running in an environment where the document is already loaded (jsdom?)
            translateDocument();
        } else {
            onReady(translateDocument);
        }
    }

    return devMode;
}));
