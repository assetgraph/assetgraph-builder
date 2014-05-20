/*global setImmediate:true*/
// node 0.8 compat
if (typeof setImmediate === 'undefined') {
    setImmediate = process.nextTick;
}

var urlTools = require('urltools'),
    passError = require('passerror'),
    fs = require('fs'),
    seq = require('seq');

// FIXME: Make flushable
var dirExistsCache = {},
    dirExistsWaitingQueue = {};

function dirExistsCached(fsPath, cb) {
    if (fsPath in dirExistsCache) {
        setImmediate(function () {
            cb(null, dirExistsCache[fsPath]);
        });
    } else if (fsPath in dirExistsWaitingQueue) {
        dirExistsWaitingQueue[fsPath].push(cb);
    } else {
        dirExistsWaitingQueue[fsPath] = [cb];
        fs.stat(fsPath, function (err, stats) {
            var isDirectory = !err && stats.isDirectory();
            dirExistsCache[fsPath] = isDirectory;
            dirExistsWaitingQueue[fsPath].forEach(function (waitingCallback) {
                waitingCallback(null, isDirectory);
            });
            delete dirExistsWaitingQueue[fsPath];
        });
    }
}

function findParentDirCached(fromPath, parentDirName, cb) {
    var candidatePaths = [],
        fromPathFragments = fromPath.replace(/\/$/, '').split('/');

    seq(fromPathFragments)
        .parMap(function (fromPathFragment, i) {
            // FIXME: Stop at caller's definition of root?
            var candidatePath = fromPathFragments.slice(0, i + 1).concat(parentDirName).join('/');
            candidatePaths.push(candidatePath);
            dirExistsCached(candidatePath, this);
        })
        .unflatten()
        .seq(function (dirExistsResults) {
            var bestCandidateIndex = dirExistsResults.lastIndexOf(true);
            if (bestCandidateIndex === -1) {
                return cb(new Error('findParentDirCached: Couldn\'t find a parent dir named ' + parentDirName + ' from ' + fromPath));
            }
            cb(null, candidatePaths[bestCandidateIndex]);
        })['catch'](cb);
}

module.exports = function () {
    return function findParentDirectory(assetConfig, fromUrl, cb) {
        if (/^file:/.test(fromUrl)) {
            var protocol = assetConfig.url.substr(0, assetConfig.url.indexOf(':')),
                pathname = assetConfig.url.replace(/^\w+:(?:\/\/)?/, ''); // Strip protocol and two leading slashes if present
            findParentDirCached(urlTools.fileUrlToFsPath(fromUrl), protocol, passError(cb, function (parentPath) {
                assetConfig.url = urlTools.fsFilePathToFileUrl(parentPath + '/' + pathname);
                cb(null, assetConfig);
            }));
        } else {
            setImmediate(function () {
                cb(new Error('resolvers.findParentDir: fromUrl must be file: ' + fromUrl));
            });
        }
    };
};
