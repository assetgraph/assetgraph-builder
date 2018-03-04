var expect = require('../unexpected-with-plugins');
var pathModule = require('path');
var Promise = require('bluebird');
var rimrafAsync = Promise.promisify(require('rimraf'));
var fs = Promise.promisifyAll(require('fs'));
var getTemporaryFilePath = require('gettemporaryfilepath');
var childProcess = Promise.promisifyAll(require('child_process'), {
  multiArgs: true
});

function run(commandAndArgs) {
  if (typeof commandAndArgs !== 'undefined' && !Array.isArray(commandAndArgs)) {
    commandAndArgs = [commandAndArgs];
  }
  var command = commandAndArgs
    .map(function(arg) {
      return /[^\w./-]/.test(arg) ? "'" + arg.replace(/'/g, "\\'") + "'" : arg;
    })
    .join(' ');
  return Promise.fromNode(
    function(cb) {
      childProcess.exec(command, cb);
    },
    { multiArgs: true }
  );
}

expect.addAssertion(
  '<string|array> [when] run as a shell command <assertion?>',
  function(expect, subject) {
    return run(subject).then(function(stdout) {
      return expect.shift(stdout);
    });
  }
);

describe('buildProduction', function() {
  it('should honor --browsers "IE 8" when serializing Javascript', function() {
    var tmpDir = getTemporaryFilePath();
    return expect(
      [
        pathModule.resolve(__dirname, '..', '..', 'bin', 'buildProduction'),
        '--root',
        pathModule.resolve(
          __dirname,
          '..',
          '..',
          'testdata',
          'bin',
          'buildProduction',
          'javaScriptWithInternetExplorer8'
        ),
        '--outroot',
        tmpDir,
        '--browsers',
        'IE 8',
        pathModule.resolve(
          __dirname,
          '..',
          '..',
          'testdata',
          'bin',
          'buildProduction',
          'javaScriptWithInternetExplorer8',
          'index.html'
        )
      ],
      'run as a shell command'
    )
      .then(function(stdout) {
        return fs.readFileAsync(
          pathModule.resolve(tmpDir, 'index.html'),
          'utf-8'
        );
      })
      .then(function(builtIndexHtml) {
        expect(builtIndexHtml, 'to contain', "foo['catch']=123");
      })
      .finally(function() {
        return rimrafAsync(tmpDir);
      });
  });

  it('should assume that IE 8 compatibility is wanted when no --browsers switch is passed', function() {
    var tmpDir = getTemporaryFilePath();
    return expect(
      [
        pathModule.resolve(__dirname, '..', '..', 'bin', 'buildProduction'),
        '--root',
        pathModule.resolve(
          __dirname,
          '..',
          '..',
          'testdata',
          'bin',
          'buildProduction',
          'javaScriptWithInternetExplorer8'
        ),
        '--outroot',
        tmpDir,
        pathModule.resolve(
          __dirname,
          '..',
          '..',
          'testdata',
          'bin',
          'buildProduction',
          'javaScriptWithInternetExplorer8',
          'index.html'
        )
      ],
      'run as a shell command'
    )
      .then(function(stdout) {
        return fs.readFileAsync(
          pathModule.resolve(tmpDir, 'index.html'),
          'utf-8'
        );
      })
      .then(function(builtIndexHtml) {
        expect(builtIndexHtml, 'to contain', "foo['catch']=123");
      })
      .finally(function() {
        return rimrafAsync(tmpDir);
      });
  });
});
