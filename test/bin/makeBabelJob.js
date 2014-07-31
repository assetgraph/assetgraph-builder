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
                    '--locales', 'en,da,de'
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
                    'KeyAlreadyPartiallyTranslatedInIndexI18n=Key already partially translated in index.i18n',
                    'KeyAlreadyPartiallyTranslatedInOtherI18n=Key already partially translated in other.i18n',
                    'KeyDestinedForIndexI18n=Key destined for index.i18n',
                    ''
                ]);

                expect(fs.readFileSync(Path.resolve(babelDir, 'da.txt'), 'utf-8').split(/\n/), 'to equal', [
                    'KeyAlreadyPartiallyTranslatedInIndexI18n=',
                    'KeyAlreadyPartiallyTranslatedInOtherI18n=',
                    'KeyDestinedForIndexI18n=',
                    ''
                ]);

                expect(fs.readFileSync(Path.resolve(babelDir, 'de.txt'), 'utf-8').split(/\n/), 'to equal', [
                    'KeyAlreadyPartiallyTranslatedInIndexI18n=Existing translation to German',
                    'KeyAlreadyPartiallyTranslatedInOtherI18n=Existing translation to German',
                    'KeyDestinedForIndexI18n=',
                    ''
                ]);

                expect(JSON.parse(fs.readFileSync(Path.resolve(tmpTestCaseCopyDir, 'index.i18n'), 'utf-8')), 'to equal', {
                    KeyDestinedForIndexI18n: {
                        en: 'Key destined for index.i18n',
                        de: null,
                        da: null
                    },
                    KeyAlreadyPartiallyTranslatedInIndexI18n: {
                        en: 'Key already partially translated in index.i18n',
                        de: 'Existing translation to German',
                        da: null
                    }
                });

                expect(JSON.parse(fs.readFileSync(Path.resolve(tmpTestCaseCopyDir, 'other.i18n'), 'utf-8')), 'to equal', {
                    KeyAlreadyPartiallyTranslatedInOtherI18n: {
                        en: 'Key already partially translated in other.i18n',
                        de: 'Existing translation to German',
                        da: null
                    }
                });

                done();
            });
        });
    });
});
