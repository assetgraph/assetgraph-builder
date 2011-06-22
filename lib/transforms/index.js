var _ = require('underscore');

// Start with AssetGraph's built-in transforms:

_.extend(exports, require('assetgraph').transforms);

// Install getters for all transforms in this directory:

require('fs').readdirSync(__dirname).forEach(function (fileName) {
    if (/\.js$/.test(fileName) && fileName !== 'index.js') {
        exports.__defineGetter__(fileName.replace(/\.js$/, ''), function () {
            return require('./' + fileName);
        });
    }
});
