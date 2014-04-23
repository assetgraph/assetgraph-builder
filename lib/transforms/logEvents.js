var chalk = require('chalk'),
    _ = require('underscore'),
    AssetGraph = require('../AssetGraph');

module.exports = function (options) {
    var startReplRegExp;

    if (options.repl) {
        startReplRegExp = new RegExp(_.flatten(_.flatten([options.repl]).map(function (transformName) {
            return transformName.split(",");
        })).map(function (transformName) {
            return transformName.replace(/[\.\+\{\}\[\]\(\)\?\^\$]/g, '\\$&');
        }).join('|'));
    }

    return function logEvents(assetGraph) {
        assetGraph
            .on('afterTransform', function (transform, elapsedTime) {
                console.log(chalk.green(' ✔ ') + (elapsedTime / 1000).toFixed(3) + " secs: " + transform.name);
                if (startReplRegExp && startReplRegExp.test(transform.name)) {
                    this.transformQueue.transforms.unshift(AssetGraph.transforms.startRepl());
                }
            })
            .on('info', function (info) {
                console.warn(chalk.cyan(' ℹ ' + (info.asset ? info.asset.urlOrDescription + ': ' : '') + info.message));
            })
            .on('warn', function (err) {
                // These are way too noisy
                if (options.suppressJavaScriptCommonJsRequireWarnings && err.relationType === 'JavaScriptCommonJsRequire') {
                    return;
                }
                console.warn(chalk.yellow(' ⚠ ' + (err.asset ? err.asset.urlOrDescription + ': ' : '') + err.message));
                if (startReplRegExp && startReplRegExp.test('warn')) {
                    this.transformQueue.transforms.unshift(AssetGraph.transforms.startRepl());
                } else if (options.stopOnWarning) {
                    process.exit(1);
                }
            })
            .on('error', function (err) {
                console.error(chalk.red(' ✘ ' + (err.asset ? err.asset.urlOrDescription + ': ' : '') + err.stack));
                if (startReplRegExp && startReplRegExp.test('error')) {
                    this.transformQueue.transforms.unshift(AssetGraph.transforms.startRepl());
                } else {
                    process.exit(1);
                }
            });
    };
};
