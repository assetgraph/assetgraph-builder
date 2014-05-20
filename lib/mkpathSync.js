var fs = require('fs'),
    path = require('path');

function mkpathSync(p, permissions) {
    if (typeof permissions === 'undefined') {
        permissions = '0777';
    }
    if (!/^\//.test(p)) {
        p = process.cwd() + '/' + p;
    }
    p = path.normalize(p).replace(/\/$/, '');
    if (!(fs.existsSync || path.existsSync)(p)) {
        var fragments = p.split('/');
        if (fragments.length > 1) {
            mkpathSync(fragments.slice(0, fragments.length - 1).join('/'), permissions);
            fs.mkdirSync(p, permissions);
        }
    }
}

module.exports = mkpathSync;
