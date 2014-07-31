/*global describe, it*/
var expect = require('../unexpected-with-plugins'),
    childProcess = require('child_process'),
    fs = require('fs'),
    Path = require('path'),
    temp = require('temp');

describe('makeBabelJob and applyBabelJob', function () {
    it('should extract and reimport a translation job', function (done) {
        var babelDir = temp.mkdirSync(),
            tmpTestCaseCopyDir = temp.mkdirSync(),
            copyCommand = 'cp \'' + __dirname + '/../../testdata/bin\'/makeBabelJobAndApplyBabelJob/* ' + tmpTestCaseCopyDir;

        childProcess.exec(copyCommand, function (err, stdout, stderr) {
            if (err) {
                return done(new Error(copyCommand + ' failed: STDERR:' + stderr + '\nSTDOUT:' + stdout));
            }

            var makeBabelJobProcess = childProcess.spawn(Path.resolve(__dirname, '..', '..', 'bin', 'makeBabelJob'), [
                    '--babeldir', babelDir,
                    '--root', tmpTestCaseCopyDir,
                    '--locales', 'en,da,de',
                    Path.resolve(tmpTestCaseCopyDir, 'index.html')
                ]),
                buffersByStreamName = {},
                streamNames = ['stdout', 'stderr'];

            streamNames.forEach(function (streamName) {
                buffersByStreamName[streamName] = [];
                makeBabelJobProcess[streamName].on('data', function (chunk) {
                    buffersByStreamName[streamName].push(chunk);
                });
            });

            function getStreamOutputText() {
                var outputText = '';
                streamNames.forEach(function (streamName) {
                    if (buffersByStreamName[streamName].length > 0) {
                        outputText += '\n' + streamName.toUpperCase() + ': ' + Buffer.concat(buffersByStreamName[streamName]).toString('utf-8') + '\n';
                    }
                });
                return outputText;
            }

            makeBabelJobProcess.on('exit', function (exitCode) {
                if (exitCode) {
                    return done(new Error('The makeBabelJob process ended with a non-zero exit code: ' + exitCode + getStreamOutputText()));
                }

                expect(fs.readdirSync(babelDir).sort(), 'to equal', ['da.txt', 'de.txt', 'en.txt']);

                expect(fs.readFileSync(Path.resolve(babelDir, 'en.txt'), 'utf-8').split(/\n/), 'to equal', [
                    'alreadyPartiallyTranslatedKey[theNotYetTranslatedOne]=yup',
                    'arrayvalue[0]=5',
                    'arrayvalue[1]=items',
                    'arrayvalue[2]=in',
                    'arrayvalue[3]=an',
                    'arrayvalue[4]=array',
                    'keywithplaceholdersinhtml=Key with {0} placeholders in HTML, English',
                    'objectvalue[key1]=value1',
                    'objectvalue[key2]=value2',
                    'objectvaluewithsomemissingkeysinthestructure[foo][bar]=baz',
                    'objectvaluewithsomemissingkeysinthestructure[foo][quux]=blah',
                    'simplekeyinhtml=Simple key in HTML, English',
                    'simplekeyinhtmlattribute=Simple key in HTML attribute, English',
                    'simplekeyinknockoutjstemplate=Simple key in a Knockout.js template',
                    'stringvalue=value',
                    'withexistingkeys=the English value',
                    ''
                ]);

                expect(fs.readFileSync(Path.resolve(babelDir, 'da.txt'), 'utf-8').split(/\n/), 'to equal', [
                    'alreadyPartiallyTranslatedKey[theNotYetTranslatedOne]=',
                    'arrayvalue[0]=',
                    'arrayvalue[1]=',
                    'arrayvalue[2]=',
                    'arrayvalue[3]=',
                    'arrayvalue[4]=',
                    'keywithplaceholdersinhtml=',
                    'objectvalue[key1]=',
                    'objectvalue[key2]=',
                    'objectvaluewithsomemissingkeysinthestructure[foo][bar]=baz',
                    'objectvaluewithsomemissingkeysinthestructure[foo][quux]=',
                    'simplekeyinhtml=',
                    'simplekeyinhtmlattribute=',
                    'simplekeyinknockoutjstemplate=',
                    'stringvalue=',
                    'withexistingkeys=the Danish value',
                    ''
                ]);

                expect(fs.readFileSync(Path.resolve(babelDir, 'de.txt'), 'utf-8').split(/\n/), 'to equal', [
                    'alreadyPartiallyTranslatedKey[theNotYetTranslatedOne]=',
                    'arrayvalue[0]=',
                    'arrayvalue[1]=',
                    'arrayvalue[2]=',
                    'arrayvalue[3]=',
                    'arrayvalue[4]=',
                    'keywithplaceholdersinhtml=',
                    'objectvalue[key1]=',
                    'objectvalue[key2]=',
                    'objectvaluewithsomemissingkeysinthestructure[foo][bar]=',
                    'objectvaluewithsomemissingkeysinthestructure[foo][quux]=',
                    'simplekeyinhtml=',
                    'simplekeyinhtmlattribute=',
                    'simplekeyinknockoutjstemplate=',
                    'stringvalue=',
                    'withexistingkeys=',
                    ''
                ]);

                // Add translations to da.txt, duplicate the test case and run applyBabelJob on it:

                fs.writeFileSync(Path.resolve(babelDir, 'da.txt'), [
                    'alreadyPartiallyTranslatedKey[theNotYetTranslatedOne]=nowItIsTranslated',
                    'simplekeyinknockoutjstemplate=Simpel nøgle i en Knockout.js-skabelon',
                    'stringvalue=the Danish stringvalue',
                    'arrayvalue[0]=5',
                    'arrayvalue[1]=elementer',
                    'arrayvalue[2]=i',
                    'arrayvalue[3]=et',
                    'arrayvalue[4]=array',
                    'objectvalue[key1]=værdi1',
                    'objectvalue[key2]=værdi2',
                    'objectvaluewithsomemissingkeysinthestructure[foo][bar]=bazbaz',
                    'objectvaluewithsomemissingkeysinthestructure[foo][quux]=fuzfuz',
                    'withexistingkeys=den opdaterede danske værdi',
                    'simplekeyinhtml=Simpel nøgle på dansk',
                    'simplekeyinhtmlattribute=Simpel nøgle i HTML-attribut på dansk',
                    'keywithplaceholdersinhtml=Nøgle med pladsholdere på dansk'
                ].join('\n'), 'utf-8');

                var applyBabelJobProcess = childProcess.spawn(Path.resolve(__dirname, '..', '..', 'bin', 'applyBabelJob'), [
                    '--babeldir', babelDir,
                    '--root', tmpTestCaseCopyDir,
                    '--locales', 'en,da,de',
                    Path.resolve(tmpTestCaseCopyDir, 'index.html')
                ]);
                applyBabelJobProcess.on('exit', function (exitCode) {
                    if (exitCode) {
                        return done(new Error('The applyBabelJob process ended with a non-zero exit code: ' + exitCode));
                    }

                    expect(JSON.parse(fs.readFileSync(Path.resolve(tmpTestCaseCopyDir, 'thething.i18n'), 'utf-8')), 'to equal', {
                        stringvalue: {
                            en: 'value',
                            da: 'the Danish stringvalue',
                            de: ''
                        },
                        arrayvalue: {
                            en: [5, 'items', 'in', 'an', 'array'],
                            da: [5, 'elementer', 'i', 'et', 'array'],
                            de: ['', '', '', '', '']
                        },
                        objectvalue: {
                            en: {
                                key1: 'value1',
                                key2: 'value2'
                            },
                            da: {
                                key1: 'værdi1',
                                key2: 'værdi2'
                            },
                            de: {
                                key1: '',
                                key2: ''
                            }
                        },
                        objectvaluewithsomemissingkeysinthestructure: {
                            da: {
                                foo: { quux: 'fuzfuz', bar: 'bazbaz' }
                            },
                            de: {
                                foo: { quux: '', bar: '' }
                            },
                            en: {
                                foo: { quux: 'blah', bar: 'baz' }
                            }
                        },
                        withexistingkeys: {
                            en: 'the English value',
                            da: 'den opdaterede danske værdi',
                            de: ''
                        },
                        simplekeyinhtml: {
                            en: 'Simple key in HTML, English',
                            da: 'Simpel nøgle på dansk',
                            de: ''
                        },
                        simplekeyinhtmlattribute: {
                            en: 'Simple key in HTML attribute, English',
                            da: 'Simpel nøgle i HTML-attribut på dansk',
                            de: ''
                        },
                        keywithplaceholdersinhtml: {
                            en: 'Key with {0} placeholders in HTML, English',
                            da: 'Nøgle med pladsholdere på dansk',
                            de: ''
                        },
                        simplekeyinknockoutjstemplate: {
                            en: 'Simple key in a Knockout.js template',
                            da: 'Simpel nøgle i en Knockout.js-skabelon',
                            de: ''
                        },
                        alreadyPartiallyTranslatedKey: {
                            en: {
                                theTranslatedOne: 'yep',
                                theNotYetTranslatedOne: 'yup'
                            },
                            da: {
                                theTranslatedOne: 'ja',
                                theNotYetTranslatedOne: 'nowItIsTranslated'
                            },
                            de: {
                                theTranslatedOne: 'Ja',
                                theNotYetTranslatedOne: ''
                            }
                        }
                    });
                    done();
                });
            });
        });
    });
});
