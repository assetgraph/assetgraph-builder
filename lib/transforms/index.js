var _ = require('underscore');

// Start with AssetGraph's built-in transforms:

var builtIn = require('assetgraph').transforms;

Object.keys(builtIn).forEach(function (transformName) {
    exports.__defineGetter__(transformName, function () {
        return builtIn[transformName];
    });
});

// Install getters for all transforms in this directory:

require('fs').readdirSync(__dirname).forEach(function (fileName) {
    if (/\.js$/.test(fileName) && fileName !== 'index.js') {
        exports.__defineGetter__(fileName.replace(/\.js$/, ''), function () {
            return require('./' + fileName);
        });
    }
});
