var semver = require('semver');

module.exports = function loadAndInstantiateAutoprefixer(browsersOrAutoprefixerInstance, errorMessageIfUnavailable) {
    if (browsersOrAutoprefixerInstance && browsersOrAutoprefixerInstance.process) {
        return browsersOrAutoprefixerInstance;
    } else if (browsersOrAutoprefixerInstance && !Array.isArray(browsersOrAutoprefixerInstance)) {
        browsersOrAutoprefixerInstance = String(browsersOrAutoprefixerInstance).split(/,\s*/);
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
        autoprefixer = autoprefixer(browsersOrAutoprefixerInstance ? {browsers: browsersOrAutoprefixerInstance} : {});
    } else {
        autoprefixer = autoprefixer(browsersOrAutoprefixerInstance);
    }
    return autoprefixer;
};
