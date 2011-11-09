var fs = require('fs'),
    path = require('path'),
    URL = require('url'),
    urlTools = require('assetgraph/lib/util/urlTools'),
    clientsByFileName = {};

module.exports = function (app, dirName, sio) {
    var io = sio.listen(app);
    io.sockets.on('connection', function (client) {
        client.on('watch', function (assetUrls, pageUrl) {
            client.baseDir = dirName.replace(/\/$/, "") + path.dirname(URL.parse(pageUrl).pathname);
            assetUrls.forEach(function (assetUrl) {
                var rootRelativePath = URL.parse(URL.resolve(pageUrl, assetUrl)).pathname,
                    fileName = path.resolve(dirName, rootRelativePath.substr(1));
                if (fileName in clientsByFileName) {
                    clientsByFileName[fileName].push(client);
                } else {
                    clientsByFileName[fileName] = [client];
                    fs.watchFile(fileName, function (currStat, prevStat) {
                        if (currStat.mtime.getTime() !== prevStat.mtime.getTime()) {
                            clientsByFileName[fileName].forEach(function (client) {
                                var relativeUrl = urlTools.buildRelativeUrl('file://' + client.baseDir,
                                                                            'file://' + fileName);
                                client.emit('change', relativeUrl);
                            });
                        }
                    });
                }
            });
        }).on('disconnect', function () {
            Object.keys(clientsByFileName).forEach(function (fileName) {
                var clients = clientsByFileName[fileName],
                    clientIndex = clients.indexOf(client);
                if (clientIndex !== -1) {
                    clients.splice(clientIndex, 1);
                }
            });
        });
    });
};
