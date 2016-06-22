AssetGraph-builder
==================
[![NPM version](https://badge.fury.io/js/assetgraph-builder.svg)](http://badge.fury.io/js/assetgraph-builder)
[![Build Status](https://travis-ci.org/assetgraph/assetgraph-builder.svg?branch=master)](https://travis-ci.org/assetgraph/assetgraph-builder)
[![Coverage Status](https://coveralls.io/repos/assetgraph/assetgraph-builder/badge.svg)](https://coveralls.io/r/assetgraph/assetgraph-builder)
[![Dependency Status](https://david-dm.org/assetgraph/assetgraph-builder.svg)](https://david-dm.org/assetgraph/assetgraph-builder)

AssetGraph-based build system (mostly) for single-page web
applications.

Looking for a Grunt integration? Try [grunt-reduce](https://github.com/Munter/grunt-reduce)

Quick start
-----------

# Conventional
```
npm install -g assetgraph-builder
buildProduction path/to/your/index.html --outroot path/to/output/directory
```

# [Docker](https://www.docker.com/)
```
docker run --rm -it  -v "$(pwd)":/app/ -w /app/ assetgraph/assetgraph-builder path/to/your/index.html --outroot path/to/output/directory
```

Congratulations, you just optimized your web page!

Features
--------

 * Requires no build manifest. All information about your project is
   gathered from the HTML/CSS/JavaScript itself. Just tell it where to
   find your HTML file(s), and it will find the referenced JavaScript,
   CSS, etc.
 * Reads your web application from one directory, manipulates and
   optimizes it, then writes the resulting build to a separate
   directory with everything included.
 * Supports a multitude of asset/relation types, even shortcut icons,
   `AlphaImageLoader` images, conditional comments, fonts linked via
   `@font-face { src: url(...) }`, .htc files linked via CSS
   `behavior` properties.
 * Bundles JavaScript and CSS.
 * Removes duplicate images, JavaScript, CSS, etc.
 * Supports automatic optimization and custom processing of images using
   pngquant, pngcrush, optipng, jpegtran, and GraphicsMagick.
 * Minifies/packs JavaScript, CSS, and HTML (uses <a
   href="https://github.com/mishoo/UglifyJS">UglifyJS</a> and <a
   href="https://github.com/jbleuzen/node-cssmin">cssmin</a>, and <a
   href="https://github.com/tmpvar/jsdom">jsdom</a>).
 * Supports require.js `define` and `require` statements, rolls up the
   dependency graph like <a
   href="http://requirejs.org/docs/optimization.html">the require.js
   optimizer</a> does (still missing some features though). Understands
   the require.js config options `baseUrl` and `paths`.
 * Sprites background images (see <a
   href="https://github.com/One-com/assetgraph-sprite">assetgraph-sprite</a>).
 * Inlines CSS `background-image`s less than 8192 bytes and provides an
   alternative stylesheet for older IE versions via conditional comments.
 * Inlines CSS and Javascript with total size less than 4096 bytes to reduce HTTP requests.
 * Adds a cache manifest to each HTML page if `--manifest` is
   specified.
 * Compiles <a href="http://lesscss.org/">less</a> to CSS and strips
   out the in-browser less compiler.
 * Compiles Sass to CSS
 * Renames JavaScript, CSS, images etc. to a 10-char MD5 prefix + the
   original extension so they can be served with a far-future expiry time.
 * Supports a special syntax for getting the url of static assets from
   JavaScript code (`GETSTATICURL`). These are also modelled as
   relations so the target files will be included in the build and thus
   renamed so they can be served with a far-future expiry time.
 * Helps getting your static assets on a CDN by rewriting the
   references to them (controlled by the `--cdnroot` switch).
 * Updates an existing Content-Security-Policy meta tag to reflect the
   changes that happened during the build procedure, including hashing
   of inline scripts and stylesheets.
 * Supports internationalization of HTML, JavaScript, SVG, and Knockout.js
   templates (support for more template formats will be added on demand).
 * Very customizable, the entire build script is only around 100 lines
   of code due to the reliance on high level <a
   href="https://github.com/One-com/assetgraph">AssetGraph</a>
   transforms.
 * Angular annotations with [ng-annotate](https://github.com/olov/ng-annotate) and angular template inlining.


Installation
------------

Optional first step: To take full advantage of the image processing
and optimization features, you need several libraries and command line
utilities installed. On Ubuntu you can grab them all by running:

```
sudo apt-get install -y libcairo2-dev libjpeg8-dev libgif-dev optipng pngcrush pngquant libpango1.0-dev graphicsmagick libjpeg-progs inkscape
```

Or on OS X, with [homebrew](http://brew.sh/):

```
brew install cairo jpeg giflib optipng pngcrush pngquant pango graphicsmagick jpeg-turbo inkscape
export PKG_CONFIG_PATH=/opt/X11/lib/pkgconfig
```


Then make sure you have node.js and <a href="http://npmjs.org/">npm</a> installed,
then run:

```
$ npm install -g assetgraph-builder
```

Now you'll have the `buildProduction` script in your PATH.

Usage
-----

```
$ buildProduction --outroot outputPath [--root webrootPath] [startingAssets]
```

Assetgraph needs a web root to resolve URLs correctly. If you pass in the `--root` option assetgraph will use it, otherwise it will take a best guess based on your `startingAssets`.

The `--outroot` option tells assetgraph-builder where to write the built files to. If the directory does not exist it will be created for you.

Your `startingAssets` can be one or more file paths or minimatch patterns, which will be used as the starting point of assetgraphs automatic discovery process. The default is `index.html`, but you might also want to add any file here that is not linked to by your website, but still has to be a part of the build, for example `robots.txt`, `.htaccess` or `404.html`. If one or more files are missing from your build, check that you are actually linking to them. If you are not, and it is by design, then you should add these files as input paths in `startingAssets`.

There are many more options to assetgraph-builder. We suggest you consult the help with `buildProduction -h`.

Example usage
-------------

Build a single page application:

```
buildProduction --outroot path/to/production --root path/to/dev path/to/dev/index.html
```

This will load path/to/dev/index.html, follow all local relations to
JavaScript, CSS, etc., perform the above mentioned optimizations, then
output the result to the directory `path/to/production`.

Create a CDN-enabled build:

```
buildProduction --outroot path/to/production --root path/to/dev path/to/dev/index.html \
                --cdnroot http://xxxxxx.cloudfront.net/static/cdn \
                --cdnoutroot path/to/production/static/cdn
```

This will produce a build that assumes that the contents of `path/to/production/static/cdn`
are available at `http://xxxxxx.cloudfront.net/static/cdn`. We recommend putting the entire
contents of `path/to/production` online and pointing your CloudFront (or other CDN provider)
distribution at the root of your origin server. As long as you serve `/static` and everything
below it with a far-future expires, you won't need to touch your CDN config or manually
upload anything to your CDN provider.

Specifying which browsers to support
------------------------------------

It's highly recommended that you tell `buildProduction` which browsers you need
to support via the `--browsers` switch. It draws its syntax from the
[browserslist](https://github.com/ai/browserslist) module and governs a wide
range of tweaks and hacks, for example:

* Whether the `screw IE8` option is passed to [UglifyJS](https://github.com/mishoo/UglifyJS2#usage).
* The set of browsers autoprefixer is instructed to support, if autoprefixer is available.
* Whether to add fallback stylesheets referenced via conditional comments when images
  are inlined in CSS (due to IE7 not supporting `data:` urls and IE8's 32 KB `data:` url limit).

The default is to support all browsers, which will cause a heavier build,
especially when IE8 and below are included and inlining of CSS images is active
(which it is by default). If you're lucky enough that you don't need to support
those browsers, you can add `--browsers ">0%, not ie <= 8"` and avoid those hacks.


Replacing require.js with almond.js on build
--------------------------------------------
Simply add a `data-almond`-attribute to the script tag that has `require.js` as its source.
The value should be the path to `almond.js` like so:

``` html
<script data-main="app/main" data-almond="path/to/almond.js" src="path/to/require.js"></script>
```

When you do this you should not use require as an external script loader, since almond does not support this.


Working with Sass (.scss) assets
--------------------------------
Assetgraph will compile your sass assets to CSS, but only if you link in your `.scss`-files like this:

``` html
<link rel="stylesheet" type="text/css" href="path/to/stylesheet.scss">
```

Or using a requirejs css plugin:

``` javascript
// RequireJS AMD syntax
define(['css!path/to/stylesheet.scss'], function () {
  // Your code here
})

// RequireJS CommonJS compatible syntax
define(function (require) {
  require('css!path/to/stylesheet.scss');

  // Your code here
})
```

In order to make this work for you in development you can use [livestyle](https://github.com/One-com/livestyle/) as a static webserver.
It will automatically convert the sass files in the HTTP stream, making your page work out of the box with no configuration.


Working with a Content Security Policy
--------------------------------------

If you add the `--contentsecuritypolicy` switch and one or more of your HTML
files contain a CSP in a meta tag such as:

```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src foo.com">
```

it will be read and updated to reflect the changes that were made during the build.
This includes whitelisting your CDN, adding `image-src data:` if images are inlined,
and generating hashes for inline scripts and stylesheets if your policy does not
allow `'unsafe-inline'`.

You can extract the resulting CSPs from the build and add it to your web server's
config, or use something like
[express-extractheaders](https://github.com/papandreou/express-extractheaders) to
also send the CSP as a response header.

We encourage a workflow like this so that the CSPs of your project are also
in effect in your development setup, as that will help catch bugs early.

Tip: If you want to use inline scripts and stylesheets in your development
setup, yet don't want to allow `'unsafe-inline'` in your policy, you can
use a nonce in development:

```html
<!DOCTYPE html>
<html>
    <head>
        <meta http-equiv="Content-Security-Policy"
              content="script-src 'nonce-yeah', style-src 'nonce-yeah'">
        <style rel="stylesheet" nonce="yeah">
            body { color: red; }
        </style>
    </head>
    <body>
        <script nonce="yeah">
            alert("Hello");
        </script>
    </body>
</html>
```

`buildProduction --contentsecuritypolicy` will upgrade the nonce to a hash
token if the scripts and stylesheets are still inline when the bundling/externalization
steps have been carried out.


Sub resource integrity
----------------------

The `--subresourceintegrity` switch will make `buildProduction` add an `integrity`
attribute to every `<script src=...>` and `<link rel="stylesheet" href=...>`
that points at an asset that is part of the build. Note that this excludes
references to assets that are already located on a CDN, or indeed any http:// url.
If you want to lock down such dependencies, please use the bundled
`addIntegrityToForeignRelations` tool or compute the hash yourself and
add it to your development HTML manually, for instance:

```html
<script src="https://code.jquery.com/jquery-2.2.3.min.js"
     integrity="sha256-a23g1Nt4dtEYOj7bR+vTu7+T8VP13humZFBJNIYoEJo="</script>
```

The reason why this isn't automated is that `buildProduction` cannot know
if a given external resource might change in the future, thus breaking your
production build.


Referring to static files in JavaScript using GETSTATICURL
----------------------------------------------------------

Sometimes you need to load a template or a JSON file from your
JavaScript, and you want the file to be included in the build so it's
renamed to `<md5Prefix>.<extension>` etc. Simply putting something
like `var url = 'foo.json'; $.ajax(url, ...)` in your code won't make
`buildProduction` aware that `foo.json` is a url -- it's
indistinguishable from a regular string.

However, if you wrap `GETSTATICURL(...)` around your url, it will be
modelled as a relation, and the target asset will be included in the
build. Note that relative urls will be resolved from the url of the
containing HTML asset, not the JavaScript asset (otherwise it wouldn't
work without `buildProduction` as there's no way to get retrieve
the url of the JavaScript being executed in a browser).

Example:

```javascript
var url = GETSTATICURL('foo.json');
$.ajax(url, ...);
```

... which will produce something like this after being run through
`buildProduction`:

```javascript
var url = 'static/96b1d5a6ba.json';
$.ajax(url, ...);
```

`GETSTATICURL` includes support for wildcards for cases where you need
to pull in multiple static files in one go:

```javascript
var url = GETSTATICURL('myData/*.json', name);
```

This will glob for `myData/*.json` and include all the found files in
the build. The additional parameters passed to `GETSTATICURL` will be
used as the wildcard values and can be any JavaScript expression. If
`myData` contains `a.json` and `b.json`, the output of
`buildProduction` would look something like this:

```javascript
var url = {a: "static/a65f5a6f5.json", b: "static/c628491b44.json"}[name];
```

The wildcards are expanded using <a
href="https://github.com/isaacs/node-glob">node-glob</a>, so all
constructs supported by <a
href="https://github.com/isaacs/minimatch">minimatch</a> are
supported, except `?`, because it's interpreted as a GET parameter
delimiter.

For `GETSTATICURL` to work in development mode the function needs to
be declared. The `buildDevelopment` script adds a bootstrapper script
that includes `GETSTATICURL`, but you can also put this into your main
HTML before all your other scripts:

```html
<script id="bootstrapper">
    window.GETSTATICURL = function (url) { // , placeHolderValue1, placeHolderValue2, ...
        var placeHolderValues = Array.prototype.slice.call(arguments, 1);
        return url.replace(/\*\*?|\{[^\}]*\}/g, function () {
            return placeHolderValues.shift();
        });
    };
</script>
```

`buildProduction` will remove the script with `id="bootstrapper"` so it
doesn't clutter your production code.

Image optimization and processing
---------------------------------

The `buildProduction` switch `--optimizeimages` turns on automatic lossless
optimization of all images of the relevant type in the graph.

Additionally, you can specify individual processing instructions for
each image using custom GET parameters. For example you might want to
reduce the palette of an image to a specific number of colors or apply
a specific compression level:

```html
<img src="myImage.png?pngquant=37">
<img src="myOtherImage.png?optipng=-o7&amp;pngcrush=-rem+tEXT">
```

The image processing is supported everywhere you can refer to an
image, including `background-image` properties in CSS, shortcut icon
links etc.

Additionally, all GraphicsMagick operations (as exposed by the <a
href="https://github.com/aheckmann/gm">gm module</a>) are supported:

```css
body {
    background-image: url(foo.png?resize=500+300&flip&magnify&pngcrush);
}
```

These are especially useful for responsive images:

```html
<img srcset="bar.jpg 1024w,
             bar.jpg?resize=600 600w,
             bar.jpg?resize=500&amp;gravity=Center&amp;crop=300+300 300w"
     sizes="(min-width: 768px) 50vw, 100vw">
```

They work in JavaScript too:

```js
var img = document.querySelector('.responsive-image');
img.setAttribute('srcset',
  GETSTATICURL('baz.gif') + ' 500w, ' +
  GETSTATICURL('baz.gif?resize=300') + ' 300w');
picturefill({ elements: [img] }); // reload if you're using Picturefill
```

This allows you to only check your original images into version
control and have your build system create the scaled/processed/derived
ones dynamically.

The processing instructions are executed using the same engine that
powers <a
href="https://github.com/papandreou/express-processimage">express-processimage</a>
and <a href="https://github.com/One-com/LiveStyle">livestyle</a> with the
`--processimage` switch. You can use one of those to have the image
processing instructions applied on your development setup.

Internationalization
--------------------

AssetGraph-builder supports internationalization of strings in your
HTML and JavaScript code via a custom syntax. The approach is to do as
much as possible at "compile time". For each language you want to
support, `buildProduction` outputs a separate html file,
eg. `index.en_us.html`, `index.da.html`, and so on. If you're using
the `TR`/`TRPAT` syntax for getting language-specific
strings within JavaScript, `buildProduction` will also output multiple
versions of your JavaScript, one per language, and it will be wired up
so that eg. `index.da.html` will refer to the Danish JavaScript file.

The i18n feature is optional. Enable it by specifying the `--locales`
switch with a comma-separated list of locale ids to compile, for
example `--locales en_us,da,fr,de`.

The translations themselves reside in separate JSON files with an
`i18n` extension. Example syntax (`foo.i18n`):

```json
{
    "myKeyName": {
        "en": "The value in English",
        "da": "Værdien på dansk"
    },
    "myOtherKeyName": {
        "en": "The other value in English",
        "da": "Den anden værdi på dansk"
    },
    "advancedKeyWithPlaceholders": {
        "en": "Showing {0}-{1} of {2} records",
        "da": "Der er {2} i alt, viser fra nr. {0} til nr. {1}"
    },
    "IAmSoXToday": {
        "en": "I am so {0} today",
        "da": "Jeg er så {0} i dag"
    },
    "TheColor": {
        "en": "blue",
        "da": "blå"
    }
}
```

### JavaScript i18n syntax ###

In JavaScript code you can use the `TR` function for getting a
locale string and `TRPAT` for getting a function that accepts
the placeholder values and returns a locale string.

For these functions to work in development, you currently have to use
`buildDevelopment` tool (still to be documented) to inject some
bootstrapper code that implements them. The bootstrapper will be
removed by `buildProduction`.

The second argument for `TR` and `TRPAT` is optional. It
will be used as the default translated value if the key isn't found in an .i18n
file. This is very useful when you haven't yet translated your
project. That way you don't need to create the .i18n files before you
actually have something to put in them.

JavaScript example:

```javascript
INCLUDE('foo.i18n');

// This alerts "The value in English" or "Værdien på dansk" depending on which build you're running:
alert(TR('myKeyName', 'the default value'));

// This alerts "Showing 1-50 of 100 records" or "Der er 100 i alt, viser fra nr. 1 til nr. 50":
var foo = 1, bar = 50;
alert(TRPAT('advancedKeyWithPlaceholders', 'the default value')(foo, bar, 100));

var myRenderer = TRPAT('advancedKeyWithPlaceholders', 'the default value');
// This also alerts "Showing 1-2 of 3 records" or "Der er 100 i alt, viser fra nr. 1 til nr. 50":
alert(myRenderer(1, 50, 100));
```

In production this compiles into (English version):

```javascript
alert('The value in English');
var foo = 1, bar = 50;
alert('Showing ' + foo + '-' + bar + ' of 100 records');

var myRenderer = function (a0, a1, a2) {return 'Showing ' + a0 + '-' + a1 + ' of ' + a2 + ' records'};
alert(myRenderer(1, 50, 100));
```

And the Danish version:

```javascript
alert('Værdien på dansk');
var foo = 1, bar = 50;
alert('Der er 100 i alt, viser fra nr. ' + foo + ' til nr. ' + bar);

var myRenderer = function (a0, a1, a2) {return 'Der er ' + a3 + ' i alt, viser nr. ' + a0 + ' til nr. ' + a1;};
alert(myRenderer(1, 50, 100));
```

As the translation files consist of plain JSON, translated values do
not have to be strings. This enables more advanced features, that you
would otherwise have to implement with string concatenation. The
feature is best explained with an example. Let's say we would like to
translate certain e-mail folder names, but otherwise default to their
real name. That could be achieved the following way.

The translation file:

```json
{
    "FolderName": {
        "en": {
            "Inbox" : "Inbox",
            "Draft" : "Draft",
            "Sent" : "Sent Mail"
        },
        "da": {
            "Inbox" : "Indbakke",
            "Draft" : "Kladder",
            "Trash" : "Sendte e-mails"
        }
    }
}
```

The code translating the e-mail folder names:

```javascript
var folderTranslations = TR("FolderName", {
    "Inbox" : "Inbox",
    "Draft" : "Draft",
    "Sent" : "Sent Mail"
});

return folderTranslations[folderName] || folderName;
```

The `TR` function call extracts the internationalized `FolderName`
structure or uses the provided default. Then we look for the folder
name in the translation structure, if it is found we return it;
otherwise we just return the folder name.

### HTML i18n syntax ###

Simple example:

```html
<p><span data-i18n="myKeyName">The default text</span></p>
```

Span tags that only have a `data-i18n` attribute are removed, so the above compiles to:

```html
<p>The value in English</p>
```

If you put the `data-i18n` attribute on a different tag (eg. `<div>`
or `<h2>`) or use a span with additional attributes, the tag itself
will be preserved, and only the `data-i18n` attribute will be removed:

```html
<span class="foo" data-i18n="myKeyName">The default text</span>
```

Which compiles into:

```html
<span class="foo">The value in English</span>
```

Non-text node elements inside the default text are interpreted as placeholders numbered from left to right:

```html
<span data-i18n="advancedKeyWithPlaceholders">Showing <span>1</span> to <span>50</span> of <span>100</span></span>
```

In the Danish version the above compiles to:

```html
Der er <span>100</span> i alt, viser nr. <span>1</span> til nr. <span>50</span>.
```

For HTML attributes there's a more elaborate, Knockout.js-ish syntax for the `data-i18n` attribute:

```html
<div title="The default value" data-i18n="text: 'myKeyName', attr: {title: 'myOtherKeyName'}">The default value</span>
```

Which compiles to this in English:

```html
<div title="The other value in English">The value in English</span>
```


### I18n of HTML chunks in JavaScript ###

There's a special syntax for handling chunks of translated HTML in JavaScript:

```javascript
var myHtmlString = TRHTML('<div data-i18n="IAmSoXToday">I am so <span data-i18n="TheColor" style="color: blue;">blue</span> today</div>');
```

These HTML chunks behave like described in the "HTML i18n syntax" section above. The above would compile to the following in the Danish production build:

```javascript
var myHtmlString = TRHTML('<div>Jeg er så <span style="color: blue;">blå</span> i dag</div>');
```

It also works in combination with `GETTEXT` in case you prefer to maintain the HTML in a separate file:

```javascript
var myHtmlString = TRHTML(GETTEXT('my/file.html'));
```

License
-------

AssetGraph-builder is licensed under a standard 3-clause BSD license
-- see the `LICENSE`-file for details.
