/*global describe, it*/
var expect = require('../unexpected-with-plugins'),
    childProcess = require('child_process'),
    fs = require('fs'),
    Path = require('path'),
    temp = require('temp');

describe('makeBabelJob', function () {
    it('should extract a translation job and set null values in the correct places in the existing i18n files', function (done) {
        var babelDir = temp.mkdirSync(),
            tmpTestCaseCopyDir = temp.mkdirSync(),
            copyCommand = 'cp \'' + __dirname + '/../../testdata/bin\'/makeBabelJob/* ' + tmpTestCaseCopyDir;

        childProcess.exec(copyCommand, function (err, stdout, stderr) {
            if (err) {
                return done(new Error(copyCommand + ' failed: STDERR:' + stderr + '\nSTDOUT:' + stdout));
            }

            var makeBabelJobProcess = childProcess.spawn(__dirname + '/../../bin/makeBabelJob', [
                    '--babeldir', babelDir,
                    '--root', tmpTestCaseCopyDir,
                    '--i18n', Path.resolve(tmpTestCaseCopyDir, 'index.i18n'),
                    Path.resolve(tmpTestCaseCopyDir, 'index.html'),
                    '--defaultlocale', 'en',
                    '--locales', 'en,pl,da,de,cs'
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

                expect(fs.readdirSync(babelDir).sort(), 'to equal', ['cs.txt', 'da.txt', 'de.txt', 'en.txt', 'pl.txt']);

                expect(fs.readFileSync(Path.resolve(babelDir, 'en.txt'), 'utf-8'), 'to equal', [
                    'KeyAlreadyPartiallyTranslatedInIndexI18n=Key already partially translated in index.i18n',
                    'KeyAlreadyPartiallyTranslatedInOtherI18n=Key already partially translated in other.i18n',
                    'KeyAlreadyTranslatedToCzech[one]=foo',
                    'KeyAlreadyTranslatedToCzech[other]=foo',
                    '# NOTE: The language pl needs these additional keys to cover all plural forms:',
                    '# KeyAlreadyTranslatedToCzech[few]=',
                    '# KeyAlreadyTranslatedToCzech[many]=',
                    'KeyDestinedForIndexI18n=Key destined for index.i18n',
                    'NotYetTranslatedKeyWithPluralCases[one]=one week',
                    'NotYetTranslatedKeyWithPluralCases[other]={0} weeks',
                    '# NOTE: The languages cs, pl need these additional keys to cover all plural forms:',
                    '# NotYetTranslatedKeyWithPluralCases[few]=',
                    '# NotYetTranslatedKeyWithPluralCases[many]=',
                    'NotYetTranslatedKeyWithPluralCasesInNestedStructure[foo][one]=one week',
                    'NotYetTranslatedKeyWithPluralCasesInNestedStructure[foo][other]={0} weeks',
                    '# NOTE: The languages cs, pl need these additional keys to cover all plural forms:',
                    '# NotYetTranslatedKeyWithPluralCasesInNestedStructure[foo][few]=',
                    '# NotYetTranslatedKeyWithPluralCasesInNestedStructure[foo][many]=',
                    ''
                ].join('\n'));

                expect(fs.readFileSync(Path.resolve(babelDir, 'da.txt'), 'utf-8'), 'to equal', [
                    'KeyAlreadyPartiallyTranslatedInIndexI18n=',
                    'KeyAlreadyPartiallyTranslatedInOtherI18n=',
                    'KeyAlreadyTranslatedToCzech[one]=',
                    'KeyAlreadyTranslatedToCzech[other]=',
                    'KeyDestinedForIndexI18n=',
                    'NotYetTranslatedKeyWithPluralCases[one]=',
                    'NotYetTranslatedKeyWithPluralCases[other]=',
                    'NotYetTranslatedKeyWithPluralCasesInNestedStructure[foo][one]=',
                    'NotYetTranslatedKeyWithPluralCasesInNestedStructure[foo][other]=',
                    ''
                ].join('\n'));

                expect(fs.readFileSync(Path.resolve(babelDir, 'de.txt'), 'utf-8'), 'to equal', [
                    'KeyAlreadyPartiallyTranslatedInIndexI18n=Existing translation to German',
                    'KeyAlreadyPartiallyTranslatedInOtherI18n=Existing translation to German',
                    'KeyAlreadyTranslatedToCzech[one]=',
                    'KeyAlreadyTranslatedToCzech[other]=',
                    'KeyDestinedForIndexI18n=',
                    'NotYetTranslatedKeyWithPluralCases[one]=',
                    'NotYetTranslatedKeyWithPluralCases[other]=',
                    'NotYetTranslatedKeyWithPluralCasesInNestedStructure[foo][one]=',
                    'NotYetTranslatedKeyWithPluralCasesInNestedStructure[foo][other]=',
                    ''
                ].join('\n'));

                expect(fs.readFileSync(Path.resolve(babelDir, 'cs.txt'), 'utf-8'), 'to equal', [
                    'KeyAlreadyPartiallyTranslatedInIndexI18n=',
                    'KeyAlreadyPartiallyTranslatedInOtherI18n=',
                    'KeyAlreadyTranslatedToAllLanguages[few]=fzd',
                    'KeyAlreadyTranslatedToAllLanguages[many]=fzd',
                    'KeyAlreadyTranslatedToCzech[few]=fzd',
                    'KeyAlreadyTranslatedToCzech[many]=fzd',
                    'KeyAlreadyTranslatedToCzech[one]=fzd',
                    'KeyAlreadyTranslatedToCzech[other]=fzd',
                    'KeyDestinedForIndexI18n=',
                    'NotYetTranslatedKeyWithPluralCases[few]=',
                    'NotYetTranslatedKeyWithPluralCases[many]=',
                    'NotYetTranslatedKeyWithPluralCases[one]=',
                    'NotYetTranslatedKeyWithPluralCases[other]=',
                    'NotYetTranslatedKeyWithPluralCasesInNestedStructure[foo][few]=',
                    'NotYetTranslatedKeyWithPluralCasesInNestedStructure[foo][many]=',
                    'NotYetTranslatedKeyWithPluralCasesInNestedStructure[foo][one]=',
                    'NotYetTranslatedKeyWithPluralCasesInNestedStructure[foo][other]=',
                    ''
                ].join('\n'));

                expect(fs.readFileSync(Path.resolve(babelDir, 'pl.txt'), 'utf-8'), 'to equal', [
                    'KeyAlreadyPartiallyTranslatedInIndexI18n=',
                    'KeyAlreadyPartiallyTranslatedInOtherI18n=',
                    'KeyAlreadyTranslatedToAllLanguages[few]=fzz',
                    'KeyAlreadyTranslatedToAllLanguages[many]=fzz',
                    'KeyAlreadyTranslatedToCzech[few]=',
                    'KeyAlreadyTranslatedToCzech[many]=',
                    'KeyAlreadyTranslatedToCzech[one]=',
                    'KeyAlreadyTranslatedToCzech[other]=',
                    'KeyDestinedForIndexI18n=',
                    'NotYetTranslatedKeyWithPluralCases[few]=',
                    'NotYetTranslatedKeyWithPluralCases[many]=',
                    'NotYetTranslatedKeyWithPluralCases[one]=',
                    'NotYetTranslatedKeyWithPluralCases[other]=',
                    'NotYetTranslatedKeyWithPluralCasesInNestedStructure[foo][few]=',
                    'NotYetTranslatedKeyWithPluralCasesInNestedStructure[foo][many]=',
                    'NotYetTranslatedKeyWithPluralCasesInNestedStructure[foo][one]=',
                    'NotYetTranslatedKeyWithPluralCasesInNestedStructure[foo][other]=',
                    ''
                ].join('\n'));

                expect(JSON.parse(fs.readFileSync(Path.resolve(tmpTestCaseCopyDir, 'index.i18n'), 'utf-8')), 'to equal', {
                    KeyDestinedForIndexI18n: {
                        cs: null,
                        en: 'Key destined for index.i18n',
                        de: null,
                        da: null,
                        pl: null
                    },
                    KeyAlreadyPartiallyTranslatedInIndexI18n: {
                        cs: null,
                        en: 'Key already partially translated in index.i18n',
                        de: 'Existing translation to German',
                        da: null,
                        pl: null
                    },
                    NotYetTranslatedKeyWithPluralCases: {
                        cs: { one: null, few: null, many: null, other: null },
                        da: { one: null, other: null },
                        de: { one: null, other: null },
                        en: { one: 'one week', other: '{0} weeks' },
                        pl: { one: null, few: null, many: null, other: null }
                    },
                    NotYetTranslatedKeyWithPluralCasesInNestedStructure: {
                        cs: { foo: { one: null, few: null, many: null, other: null } },
                        da: { foo: { one: null, other: null } },
                        de: { foo: { one: null, other: null } },
                        en: { foo: { one: 'one week', other: '{0} weeks' } },
                        pl: { foo: { few: null, many: null, one: null, other: null } }
                    },
                    KeyAlreadyTranslatedToAllLanguages: {
                        cs: { one: 'fzd', few: 'fzd', many: 'fzd', other: 'fzd' },
                        da: { one: 'føø', other: 'føø' },
                        de: { one: 'voo', other: 'voo' },
                        en: { one: 'foo', other: 'foo' },
                        pl: { one: 'fzz', few: 'fzz', many: 'fzz', other: 'fzz' },
                    },
                    KeyAlreadyTranslatedToCzech: {
                        cs: { one: 'fzd', few: 'fzd', many: 'fzd', other: 'fzd' },
                        da: { one: null, other: null },
                        de: { one: null, other: null },
                        en: { one: 'foo', other: 'foo' },
                        pl: { few: null, many: null, one: null, other: null }
                    }
                });

                expect(JSON.parse(fs.readFileSync(Path.resolve(tmpTestCaseCopyDir, 'other.i18n'), 'utf-8')), 'to equal', {
                    KeyAlreadyPartiallyTranslatedInOtherI18n: {
                        cs: null,
                        en: 'Key already partially translated in other.i18n',
                        de: 'Existing translation to German',
                        da: null,
                        pl: null
                    }
                });

                done();
            });
        });
    });
});
