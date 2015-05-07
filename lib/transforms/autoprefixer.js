/**
 * autoprefixer transform
 *
 * - Runs autoprefixer with the supplied options on each css asset
 */

var semver = require('semver');

function loadAndInstantiateAutoprefixer(browsers, errorMessageIfUnavailable) {
    if (browsers && !Array.isArray(browsers)) {
        browsers = String(browsers).split(/,\s*/);
    }

    var autoprefixer;
    try {
        autoprefixer = require('autoprefixer');
    } catch (e) {
        if (errorMessageIfUnavailable) {
            e.message = errorMessageIfUnavailable + '\n' + e.message;
            throw e;
        }
    }

    if (semver.satisfies(require('autoprefixer/package.json').version, '>= 3.0.0')) {
        autoprefixer = autoprefixer(browsers ? {browsers: browsers} : {});
    } else {
        autoprefixer = autoprefixer(browsers);
    }
    return autoprefixer;
}

module.exports = function (browsers) {
    return function autoprefixer_(assetGraph) {
        var cssAssets = assetGraph.findAssets({type: 'Css'});

        if (cssAssets.length > 0) {
            var autoprefixer = loadAndInstantiateAutoprefixer(browsers, 'autoprefixer transform: Found ' + cssAssets.length + ' css asset(s) while --browsers option is active, but no autoprefixer module is available. Please use npm to install autoprefixer in your project so the autoprefixer transform can require it.');

            cssAssets.forEach(function (cssAsset) {
                try {
                    cssAsset.text = autoprefixer.process(cssAsset.text).css;
                } catch (err) {
                    console.log(cssAsset.urlOrDescription, err);
                    err.asset = cssAsset;

                    assetGraph.emit('warn', err);
                }
            });
        }
    };
};
