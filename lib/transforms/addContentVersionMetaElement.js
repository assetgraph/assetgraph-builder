var _ = require('underscore');

module.exports = function (queryObj, version) {
    if (typeof version === 'undefined') {
        throw new Error("transforms.addContentVersionMetaTag: The 'version' parameter is mandatory.");
    }
    return function addContentVersionMetaElement(assetGraph) {
        assetGraph.findAssets(_.extend({type: 'Html'}, queryObj)).forEach(function (htmlAsset) {
            var document = htmlAsset.parseTree;
            if (document.head) {
                var contentVersionMetaElement = document.createElement('meta');
                contentVersionMetaElement.setAttribute('http-equiv', 'Content-Version');
                contentVersionMetaElement.setAttribute('content', version);
                var lastExistingMetaElement;
                for (var i = 0 ; i < document.head.childNodes.length ; i += 1) {
                    if (document.head.childNodes[i].nodeName.toLowerCase() === 'meta') {
                        lastExistingMetaElement = document.head.childNodes[i];
                    }
                }
                // element.insertBefore(newElement, null) works as element.appendChild(newElement) if there is no nextSibling:
                if (lastExistingMetaElement) {
                    document.head.insertBefore(contentVersionMetaElement, lastExistingMetaElement.nextSibling);
                } else {
                    document.head.insertBefore(contentVersionMetaElement, document.head.firstChild);
                }
                document.head.appendChild(contentVersionMetaElement);
                htmlAsset.markDirty();
            }
        });
    };
};
