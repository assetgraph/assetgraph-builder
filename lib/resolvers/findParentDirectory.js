var fsTools = require('assetgraph/lib/util/fsTools'),
    urlTools = require('assetgraph/lib/util/urlTools'),
    passError = require('assetgraph/lib/util/passError');

module.exports = function () {
    return function findParentDirectory(assetConfig, fromUrl, cb) {
        if (/^file:/.test(fromUrl)) {
            var protocol = assetConfig.url.substr(0, assetConfig.url.indexOf(':')),
                pathname = assetConfig.url.replace(/^\w+:(?:\/\/)?/, ""); // Strip protocol and two leading slashes if present
            fsTools.findParentDirCached(urlTools.fileUrlToFsPath(fromUrl), protocol, passError(cb, function (parentPath) {
                assetConfig.url = urlTools.fsFilePathToFileUrl(parentPath + '/' + pathname);
                cb(null, assetConfig);
            }));
        } else {
            process.nextTick(function () {
                cb(new Error("resolvers.findParentDir: fromUrl must be file:"));
            });
        }
    };
};
