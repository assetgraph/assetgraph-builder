var expect = require('../unexpected-with-plugins');
var pathModule = require('path');
var Promise = require('bluebird');
var rimrafAsync = Promise.promisify(require('rimraf'));
var fs = Promise.promisifyAll(require('fs'));
var getTemporaryFilePath = require('gettemporaryfilepath');
var childProcess = Promise.promisifyAll(require('child_process'), {
  multiArgs: true
});

async function run(commandAndArgs) {
  if (typeof commandAndArgs !== 'undefined' && !Array.isArray(commandAndArgs)) {
    commandAndArgs = [commandAndArgs];
  }
  const command = commandAndArgs
    .map(
      arg => (/[^\w./-]/.test(arg) ? "'" + arg.replace(/'/g, "\\'") + "'" : arg)
    )
    .join(' ');

  return await Promise.fromNode(cb => childProcess.exec(command, cb), {
    multiArgs: true
  });
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
  it('should honor --browsers "IE 8" when serializing Javascript', async function() {
    const tmpDir = getTemporaryFilePath();
    await expect(
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
    );

    const builtIndexHtml = await fs.readFileAsync(
      pathModule.resolve(tmpDir, 'index.html'),
      'utf-8'
    );

    try {
      expect(builtIndexHtml, 'to contain', "foo['catch']=123");
    } finally {
      await rimrafAsync(tmpDir);
    }
  });

  it('should pick up the browserslist configuration from package.json', async function() {
    const dir = pathModule.resolve(
      __dirname,
      '..',
      '..',
      'testdata',
      'bin',
      'buildProduction',
      'browserslistInPackageJson'
    );
    const tmpDir = getTemporaryFilePath();
    const originalDir = process.cwd();
    process.chdir(dir);
    await expect(
      [
        pathModule.resolve(__dirname, '..', '..', 'bin', 'buildProduction'),
        '--root',
        dir,
        '--outroot',
        tmpDir,
        pathModule.resolve(dir, 'index.html')
      ],
      'run as a shell command'
    );

    const builtIndexHtml = await fs.readFileAsync(
      pathModule.resolve(tmpDir, 'index.html'),
      'utf-8'
    );

    try {
      expect(builtIndexHtml, 'to contain', 'foo.catch=123');
    } finally {
      await rimrafAsync(tmpDir);
      process.chdir(originalDir);
    }
  });

  it('should assume that IE 8 compatibility is wanted when no --browsers switch is passed and no .browserslistrc etc. is found', async function() {
    const tmpDir = getTemporaryFilePath();
    await expect(
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
    );

    const builtIndexHtml = await fs.readFileAsync(
      pathModule.resolve(tmpDir, 'index.html'),
      'utf-8'
    );

    try {
      expect(builtIndexHtml, 'to contain', "foo['catch']=123");
    } finally {
      await rimrafAsync(tmpDir);
    }
  });
});
