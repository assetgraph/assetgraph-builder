var childProcess = require('child_process'),
    fs = require('fs'),
    vows = require('vows'),
    assert = require('assert'),
    temp = require('temp'),
    AssetGraph = require('assetgraph'),
    transforms = require('../lib/transforms');

vows.describe('bin/makeBabelJob test').addBatch({
    'After running makeBabelJob on the test case': {
        topic: function () {
            var babelDir = temp.mkdirSync(),
                cb = this.callback,
                makeBabelJobProcess = childProcess.spawn(__dirname + '/../bin/makeBabelJob', [
                    '--babeldir', babelDir,
                    '--root', __dirname + '/makeBabelJobAndApplyBabelJob/',
                    __dirname + '/makeBabelJobAndApplyBabelJob/index.html',
                    '--locale', 'en,da,de'
                ]);
            makeBabelJobProcess.on('exit', function (exitCode) {
                if (exitCode) {
                    cb(new Error("The makeBabelJob process ended with a non-zero exit code: " + exitCode));
                } else {
                    cb(null, babelDir);
                }
            });
        },
        'there should be a .txt for each target locale in babelDir': function (babelDir) {
            assert.deepEqual(fs.readdirSync(babelDir).sort(),
                             ['da.txt', 'de.txt', 'en.txt']);
        },
        'en.txt should have the correct contents': function (babelDir) {
            var lines = fs.readFileSync(babelDir + '/en.txt', 'utf-8').split(/\n/);
            assert.equal(lines.length, 10);
            assert.equal(lines.shift(), 'stringvalue=value');
            assert.equal(lines.shift(), 'arrayvalue[0]=5');
            assert.equal(lines.shift(), 'arrayvalue[1]=items');
            assert.equal(lines.shift(), 'arrayvalue[2]=in');
            assert.equal(lines.shift(), 'arrayvalue[3]=an');
            assert.equal(lines.shift(), 'arrayvalue[4]=array');
            assert.equal(lines.shift(), 'objectvalue[key1]=value1');
            assert.equal(lines.shift(), 'objectvalue[key2]=value2');
            assert.equal(lines.shift(), 'withexistingkeys=the English value');
            assert.equal(lines.shift(), '');
        },
        'da.txt should have the correct contents': function (babelDir) {
            var lines = fs.readFileSync(babelDir + '/da.txt', 'utf-8').split(/\n/);
            assert.equal(lines.length, 2);
            assert.equal(lines.shift(), 'withexistingkeys=the Danish value');
            assert.equal(lines.shift(), '');
        },
        'de.txt should have the correct contents': function (babelDir) {
            var lines = fs.readFileSync(babelDir + '/de.txt', 'utf-8').split(/\n/);
            assert.equal(lines.length, 2);
            assert.equal(lines.shift(), 'withexistingkeys=the German value');
            assert.equal(lines.shift(), '');
        },
        'then add translations to da.txt, duplicate the test case and run applyBabelJob on it': {
            topic: function (babelDir) {
                var cb = this.callback,
                    tmpTestCaseCopyDir = temp.mkdirSync(),
                    daTxtLines = [
                        'stringvalue=the Danish stringvalue',
                        'arrayvalue[0]=5',
                        'arrayvalue[1]=elementer',
                        'arrayvalue[2]=i',
                        'arrayvalue[3]=et',
                        'arrayvalue[4]=array',
                        'objectvalue[key1]=værdi1',
                        'objectvalue[key2]=værdi2',
                        'withexistingkeys=den opdaterede danske værdi'
                    ],
                    copyCommand = "cp '" + __dirname + "/makeBabelJobAndApplyBabelJob'/* " + tmpTestCaseCopyDir;
                fs.writeFileSync(babelDir + '/da.txt', daTxtLines.join("\n"), 'utf-8');
                childProcess.exec(copyCommand, function (err, stdout, stderr) {
                    if (err) {
                        return cb(new Error(copyCommand + " failed: STDERR:" + stderr + "\nSTDOUT:" + stdout));
                    }
                    var applyBabelJobProcess = childProcess.spawn(__dirname + '/../bin/applyBabelJob', [
                        '--babeldir', babelDir,
                        '--root', tmpTestCaseCopyDir,
                        '--locale', 'en,da,de',
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
            'thething.i18n should be updated with the translations': function (tmpTestCaseCopyDir) {
                var i18n = JSON.parse(fs.readFileSync(tmpTestCaseCopyDir + '/thething.i18n'));
                assert.deepEqual(i18n, {
                    stringvalue: {
                        en: 'value',
                        da: 'the Danish stringvalue'
                    },
                    arrayvalue: {
                        en: [5, 'items', 'in', 'an', 'array'],
                        da: [5, 'elementer', 'i', 'et', 'array']
                    },
                    objectvalue: {
                        en: {
                            key1: 'value1',
                            key2: 'value2'
                        },
                        da: {
                            key1: 'værdi1',
                            key2: 'værdi2'
                        }
                    },
                    withexistingkeys: {
                        en: 'the English value',
                        da: 'den opdaterede danske værdi',
                        de: 'the German value'
                    }
                });
            }
       }
   }
})['export'](module);
