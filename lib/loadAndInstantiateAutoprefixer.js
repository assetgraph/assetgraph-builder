var semver = require('semver');

module.exports = function loadAndInstantiateAutoprefixer(browsers, errorMessageIfUnavailable) {
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
};
