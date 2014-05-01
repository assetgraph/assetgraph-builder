var chalk = require('chalk'),
    _ = require('underscore'),
    Path = require('path'),
    urlTools = require('urltools'),
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
        var assetGraphRootRelativeToCwd = Path.relative(process.cwd(), urlTools.fileUrlToFsPath(assetGraph.root)),
            assetGraphRootRelativeToCwdRegExp = new RegExp('\\b' + assetGraphRootRelativeToCwd.replace(/[$\.^\(\)\[\]\{\}]/g, '\\$&') + '/');
        function prepareErrorMessage(message) {
            return message.replace(assetGraphRootRelativeToCwdRegExp, chalk.gray(assetGraphRootRelativeToCwd + '/')).replace(/\n/g, '\n         ');
        }

        var firstWarningSeenDuringTransform = null,
            transformRunning = false;
        assetGraph
            .on('beforeTransform', function () {
                firstWarningSeenDuringTransform = null;
                transformRunning = true;
            })
            .on('afterTransform', function (transform, elapsedTime) {
                if (firstWarningSeenDuringTransform && options.stopOnWarning) {
                    console.error(chalk.red(' ✘ ERROR: ') + 'A warning was encountered while stopOnWarning is on, exiting with a non-zero exit code');
                    process.exit(1);
                }
                transformRunning = false;

                console.log(chalk.green(' ✔ ') + (elapsedTime / 1000).toFixed(3) + " secs: " + transform.name);
                if (startReplRegExp && startReplRegExp.test(transform.name)) {
                    this.transformQueue.transforms.unshift(AssetGraph.transforms.startRepl());
                }
            })
            .on('info', function (info) {
                console.warn(chalk.cyan(' ℹ INFO: ') + prepareErrorMessage((info.asset ? info.asset.urlOrDescription + ': ' : '') + info.message));
            })
            .on('warn', function (err) {
                // These are way too noisy
                if (options.suppressJavaScriptCommonJsRequireWarnings && err.relationType === 'JavaScriptCommonJsRequire') {
                    return;
                }
                console.warn(chalk.yellow(' ⚠ WARN: ') + prepareErrorMessage((err.asset ? err.asset.urlOrDescription + ': ' : '') + err.message));
                if (startReplRegExp && startReplRegExp.test('warn')) {
                    this.transformQueue.transforms.unshift(AssetGraph.transforms.startRepl());
                }
                if (transformRunning) {
                    firstWarningSeenDuringTransform = firstWarningSeenDuringTransform || err;
                } else {
                    console.error(chalk.red(' ✘ ERROR: ') + 'A warning was encountered while stopOnWarning is on, exiting with a non-zero exit code');
                    process.exit(1);
                }
            })
            .on('error', function (err) {
                console.error(chalk.red(' ✘ ERROR: ') + prepareErrorMessage((err.asset ? err.asset.urlOrDescription + ': ' : '') + err.stack));
                if (startReplRegExp && startReplRegExp.test('error')) {
                    this.transformQueue.transforms.unshift(AssetGraph.transforms.startRepl());
                } else {
                    process.exit(1);
                }
            });
    };
};
