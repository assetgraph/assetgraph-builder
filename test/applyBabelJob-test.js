var childProcess = require('child_process'),
    fs = require('fs'),
    Path = require('path'),
    vows = require('vows'),
    assert = require('assert'),
    temp = require('temp');

vows.describe('applyBabelJob').addBatch({
    'After running applyBabelJob on a test case': {
        topic: function (babelDir) {
            var cb = this.callback,
                babelDir = Path.resolve(__dirname, 'applyBabelJob/translationjob'),
                tmpTestCaseCopyDir = temp.mkdirSync(),
                copyCommand = "cp '" + __dirname + "/applyBabelJob'/index.* " + tmpTestCaseCopyDir;
            childProcess.exec(copyCommand, function (err, stdout, stderr) {
                if (err) {
                    return cb(new Error(copyCommand + " failed: STDERR:" + stderr + "\nSTDOUT:" + stdout));
                }
                var applyBabelJobProcess = childProcess.spawn(__dirname + '/../bin/applyBabelJob', [
                    '--babeldir', babelDir,
                    '--root', tmpTestCaseCopyDir,
                    '--defaultlocale', 'en',
                    '--locales', 'en,da',
                    '--i18n', tmpTestCaseCopyDir + '/index.i18n',
                    '--replace',
                    tmpTestCaseCopyDir + '/index.html'
                ]);
                applyBabelJobProcess.on('exit', function (exitCode) {
                    if (exitCode) {
                        cb(new Error("The applyBabelJob process ended with a non-zero exit code: " + exitCode));
                    } else {
                        cb(null, tmpTestCaseCopyDir);
                    }
                });
            });
        },
        'index.i18n should be updated with the translations': function (tmpTestCaseCopyDir) {
            assert.deepEqual(JSON.parse(fs.readFileSync(tmpTestCaseCopyDir + '/index.i18n')), {
                bar: {
                    da: 'BarOversat',
                    en: 'BarProofRead'
                },
                foo: {
                    da: 'FooOversat',
                    en: 'FooProofRead'
                },
                placeholders: {
                    da: 'Denne oversatte nøgle har {0} pladsholdere',
                    en: 'This proofread key has {0} proofread placeholders'
                }
            });
        },
        'index.html should be updated with the proofread English keys': function (tmpTestCaseCopyDir) {
            assert.equal(fs.readFileSync(tmpTestCaseCopyDir + '/index.html', 'utf-8'),
                '<!DOCTYPE html>\n' +
                '<html>\n' +
                '    <head>\n' +
                '        <title data-i18n="foo">FooProofRead</title>\n' +
                '    </head>\n' +
                '    <body>\n' +
                '        <script>\n' +
                '            alert(TR(\'bar\', \'BarProofRead\'));\n' +
                '        </script>\n' +
                '        <span data-i18n="placeholders">This proofread key has <span>some</span> proofread placeholders</span>\n' +
                '    </body>\n' +
                '</html>\n'
            );
        }
   }
})['export'](module);
