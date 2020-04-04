const expect = require('../unexpected-with-plugins');
const pathModule = require('path');
const { promisify } = require('util');
const rimraf = promisify(require('rimraf'));
const readFile = promisify(require('fs').readFile);
const getTemporaryFilePath = require('gettemporaryfilepath');
const childProcess = require('child_process');

function run(commandAndArgs) {
  if (typeof commandAndArgs !== 'undefined' && !Array.isArray(commandAndArgs)) {
    commandAndArgs = [commandAndArgs];
  }
  const command = commandAndArgs
    .map((arg) =>
      /[^\w./-]/.test(arg) ? "'" + arg.replace(/'/g, "\\'") + "'" : arg
    )
    .join(' ');

  return Promise.fromNode((cb) => childProcess.exec(command, cb), {
    multiArgs: true,
  });
}

expect.addAssertion(
  '<string|array> [when] run as a shell command <assertion?>',
  function (expect, subject) {
    return run(subject).then((stdout) => expect.shift(stdout));
  }
);

describe('buildProduction', function () {
  it('should honor --browsers "IE 8" when serializing JavaScript', async function () {
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
        '-o',
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
        ),
      ],
      'run as a shell command'
    );

    const builtIndexHtml = await readFile(
      pathModule.resolve(tmpDir, 'index.html'),
      'utf-8'
    );

    try {
      expect(builtIndexHtml, 'to contain', "foo['catch']=123");
    } finally {
      await rimraf(tmpDir);
    }
  });

  it('should pick up the browserslist configuration from package.json', async function () {
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
        '-o',
        tmpDir,
        pathModule.resolve(dir, 'index.html'),
      ],
      'run as a shell command'
    );

    const builtIndexHtml = await readFile(
      pathModule.resolve(tmpDir, 'index.html'),
      'utf-8'
    );

    try {
      expect(builtIndexHtml, 'to contain', 'foo.catch=123');
    } finally {
      await rimraf(tmpDir);
      process.chdir(originalDir);
    }
  });

  it('should assume that IE 8 compatibility is wanted when no --browsers switch is passed and no .browserslistrc etc. is found', async function () {
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
        '-o',
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
        ),
      ],
      'run as a shell command'
    );

    const builtIndexHtml = await readFile(
      pathModule.resolve(tmpDir, 'index.html'),
      'utf-8'
    );

    try {
      expect(builtIndexHtml, 'to contain', "foo['catch']=123");
    } finally {
      await rimraf(tmpDir);
    }
  });

  it('should run autoprefixer when no --browsers is passed', async function () {
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
          'autoprefixer'
        ),
        '-o',
        tmpDir,
        pathModule.resolve(
          __dirname,
          '..',
          '..',
          'testdata',
          'bin',
          'buildProduction',
          'autoprefixer',
          'index.html'
        ),
      ],
      'run as a shell command'
    );

    const builtIndexHtml = await readFile(
      pathModule.resolve(tmpDir, 'index.html'),
      'utf-8'
    );

    try {
      expect(builtIndexHtml, 'to contain', '::-ms-input-placeholder');
    } finally {
      await rimraf(tmpDir);
    }
  });
});
