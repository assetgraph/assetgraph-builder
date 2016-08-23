/*global describe, it*/
var childProcess = require('child_process'),
    fs = require('fs'),
    Path = require('path'),
    expect = require('unexpected'),
    temp = require('temp');

describe('applyBabelJob', function () {
    it('should handle a complex test case', function (done) {
        var babelDir = Path.resolve(__dirname, '..', '..', 'testdata', 'bin', 'applyBabelJob', 'complex', 'translationjob'),
            tmpTestCaseCopyDir = temp.mkdirSync(),
            copyCommand = 'cp \'' + __dirname + '/../../testdata/bin/applyBabelJob/complex\'/index.* ' + tmpTestCaseCopyDir;
        childProcess.exec(copyCommand, function (err, stdout, stderr) {
            if (err) {
                return done(new Error(copyCommand + ' failed: STDERR:' + stderr + '\nSTDOUT:' + stdout));
            }
            var applyBabelJobProcess = childProcess.spawn(__dirname + '/../../bin/applyBabelJob', [
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
                    done(new Error('The applyBabelJob process ended with a non-zero exit code: ' + exitCode));
                } else {
                    expect(JSON.parse(fs.readFileSync(tmpTestCaseCopyDir + '/index.i18n')), 'to equal', {
                        ComplexKey: {
                            da: {
                                that: 'også kommer',
                                back: 'det samme'
                            },
                            en: {
                                that: 'also comes',
                                back: 'the same'
                            }
                        },
                        WeirdlyFormattedKey: {
                            da: 'der kommer uændret retur i oversættelsesjobbet',
                            en: 'that comes back the same in the translation job'
                        },
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
                    expect(JSON.parse(fs.readFileSync(tmpTestCaseCopyDir + '/index.someother.i18n')), 'to equal', {
                        KeyInSomeOtherI18nFile: {
                            en: 'Woop',
                            da: 'Jubii'
                        }
                    });
                    expect(fs.readFileSync(tmpTestCaseCopyDir + '/index.html', 'utf-8'), 'to equal',
                        '<!DOCTYPE html><html><head>\n' +
                        '        <title data-i18n="foo">FooProofRead</title>\n' +
                        '    </head>\n' +
                        '    <body>\n' +
                        '        <script>\n' +
                        '            \'index.someother.i18n\'.toString(\'url\');\n' +
                        '            alert(TR(\'bar\', \'BarProofRead\'));\n' +
                        '            alert(TR(\'WeirdlyFormattedKey\', \'that \' + \'comes \' + \'back the same in the translation job\'));\n' +
                        '            alert(TR(\'ComplexKey\', {\n' +
                        '                that: \'also comes\',\n' +
                        '                back: \'the same\'\n' +
                        '            }));\n' +
                        '            alert(TR(\'KeyInSomeOtherI18nFile\', \'Woop\'));\n' +
                        '        </script>\n' +
                        '        <span data-i18n="placeholders">This proofread key has <span>some</span> proofread placeholders</span>\n' +
                        '        <span data-bind="text: foo < 4 && bar > 2"></span>\n' +
                        '        <span data-i18n="WeirdlyFormattedKey">\n' +
                        '            that comes back the same\n' +
                        '            in the translation job\n' +
                        '        </span>\n' +
                        '        <span data-i18n="text: null">data-i18n specifying that the contents of the tag should not be translated</span>\n' +
                        '        <span data-i18n="">data-i18n specifying that the contents of the tag should not be translated</span>\n' +
                        '        <span data-i18n="attr: {title: null}" title="data-i18n specifiying that the title attribute should not be translated"></span>\n' +
                        '    \n' +
                        '\n' +
                        '</body></html>'
                    );
                    done();
                }
            });
        });
    });

    it('should warn about and discard plural cases not supported by a locale', function (done) {
        var babelDir = Path.resolve(__dirname, '..', '..', 'testdata', 'bin', 'applyBabelJob', 'invalidPlurals', 'translationjob'),
            tmpTestCaseCopyDir = temp.mkdirSync(),
            copyCommand = 'cp \'' + __dirname + '/../../testdata/bin/applyBabelJob\'/invalidPlurals/index.* ' + tmpTestCaseCopyDir;
        childProcess.exec(copyCommand, function (err, stdout, stderr) {
            if (err) {
                return done(new Error(copyCommand + ' failed: STDERR:' + stderr + '\nSTDOUT:' + stdout));
            }
            var applyBabelJobProcess = childProcess.spawn(__dirname + '/../../bin/applyBabelJob', [
                '--babeldir', babelDir,
                '--root', tmpTestCaseCopyDir,
                '--defaultlocale', 'en',
                '--locales', 'en,cs',
                '--i18n', tmpTestCaseCopyDir + '/index.i18n',
                '--replace',
                tmpTestCaseCopyDir + '/index.html'
            ]);

            applyBabelJobProcess.on('exit', function (exitCode) {
                if (exitCode) {
                    done(new Error('The applyBabelJob process ended with a non-zero exit code: ' + exitCode));
                } else {
                    expect(JSON.parse(fs.readFileSync(tmpTestCaseCopyDir + '/index.i18n')), 'to equal', {
                        MyPlurals: {
                            en: {
                                one: 'The plural',
                                other: 'The plurals'
                            },
                            cs: {
                                one: 'xxxx',
                                other: 'yyyy',
                                few: 'zzzz',
                                many: 'wwww'
                            }
                        }
                    });
                    expect(fs.readFileSync(tmpTestCaseCopyDir + '/index.html', 'utf-8'), 'to equal',
                        '<!DOCTYPE html>\n' +
                        '<html>\n' +
                        '    <head>\n' +
                        '    </head>\n' +
                        '    <body>\n' +
                        '        <script>\n' +
                        '            \'index.i18n\'.toString(\'url\');\n' +
                        '            alert(TR(\'MyPlurals\', {\n' +
                        '                one: \'The plural\',\n' +
                        '                other: \'The plurals\'\n' +
                        '            }));\n' +
                        '        </script>\n' +
                        '    </body>\n' +
                        '</html>\n'
                    );
                    done();
                }
            });
        });
    });

    it('should update the actual source files when importing into a project that uses system.js', function (done) {
        var babelDir = Path.resolve(__dirname, '..', '..', 'testdata', 'bin', 'applyBabelJob', 'systemJs', 'translationjob'),
            tmpTestCaseCopyDir = temp.mkdirSync(),
            copyCommand = 'cp \'' + __dirname + '/../../testdata/bin/applyBabelJob\'/systemJs/*.* ' + tmpTestCaseCopyDir;
        childProcess.exec(copyCommand, function (err, stdout, stderr) {
            if (err) {
                return done(new Error(copyCommand + ' failed: STDERR:' + stderr + '\nSTDOUT:' + stdout));
            }
            var applyBabelJobProcess = childProcess.spawn(__dirname + '/../../bin/applyBabelJob', [
                '--babeldir', babelDir,
                '--root', tmpTestCaseCopyDir,
                '--defaultlocale', 'en',
                '--locales', 'en,cs',
                '--i18n', tmpTestCaseCopyDir + '/index.i18n',
                '--replace',
                tmpTestCaseCopyDir + '/index.html'
            ]);

            applyBabelJobProcess.on('exit', function (exitCode) {
                if (exitCode) {
                    done(new Error('The applyBabelJob process ended with a non-zero exit code: ' + exitCode));
                } else {
                    expect(JSON.parse(fs.readFileSync(tmpTestCaseCopyDir + '/index.i18n')), 'to equal', {
                        myAlert: {
                            en: 'HelloFoo',
                            cs: 'Ahoj'
                        }
                    });
                    expect(fs.readFileSync(tmpTestCaseCopyDir + '/main.js', 'utf-8'), 'to equal',
                        'alert(TR(\'myAlert\', \'HelloFoo\'));\n'
                    );
                    done();
                }
            });
        });
    });
});
