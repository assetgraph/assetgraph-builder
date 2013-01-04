[![build status](https://secure.travis-ci.org/One-com/assetgraph-builder.png)](http://travis-ci.org/One-com/assetgraph-builder)
AssetGraph-builder
==================

AssetGraph-based build system (mostly) for single-page web
applications.

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
 * Adds a cache manifest to each HTML page if `--manifest` is
   specified.
 * Compiles <a href="http://lesscss.org/">less</a> to CSS and strips
   out the in-browser less compiler.
 * Renames JavaScript, CSS, images etc. to a 10-char MD5 prefix + the
   original extension so they can be served with a far-future expiry time.
 * Supports a special syntax for getting the url of static assets from
   JavaScript code (`GETSTATICURL`). These are also modelled as
   relations so the target files will be included in the build and thus
   renamed so they can be served with a far-future expiry time.
 * Helps getting your static assets on a CDN by rewriting the
   references to them (controlled by the `--cdnroot` and
   `--cdnoutroot` switches).
 * Supports internationalization of HTML, JavaScript, and Knockout.js
   templates (support for more template formats will be added on demand).
 * Very customizable, the entire build script is only around 100 lines
   of code due to the reliance on high level <a
   href="https://github.com/One-com/assetgraph">AssetGraph</a>
   transforms.


Installation
------------

Make sure you have node.js and <a href="http://npmjs.org/">npm</a> installed,
then run:

    $ npm install -g assetgraph-builder

Now you'll have the `buildProduction` script in your PATH.


Example usage
-------------

Build a single page application:

    buildProduction --outroot path/to/production --root path/to/dev path/to/dev/index.html

This will load path/to/dev/index.html, follow all local relations to
JavaScript, CSS, etc., perform the above mentioned optimizations, then
output the result to the directory `path/to/production`.

Create a CDN-enabled build:

    buildProduction --outroot path/to/production --root path/to/dev path/to/dev/index.html \
                    --cdnroot http://xxxxxx.cloudfront.net/static/cdn \
                    --cdnoutroot path/to/production/static/cdn

This will produce a build that assumes that the contents of `path/to/production/static/cdn`
are available at `http://xxxxxx.cloudfront.net/static/cdn`. We recommend putting the entire
contents of `path/to/production` online and pointing your CloudFront (or other CDN provider)
distribution at the root of your origin server. As long as you serve `/static` and everything
below it with a far-future expires, you won't need to touch your CDN config or manually
upload anything to your CDN provider.

Image optimization and processing
---------------------------------

The `buildProduction` switches `--pngquant`, `--pngcrush`,
`--optipng`, and `--jpegtran` turn on automatic lossless optimization
of all images of the relevant type in the graph. The
`--optimizeimages` switch is shorthand for all of them.

Additionally, you can specify individual processing instructions for
each image using custom GET parameters. For example you might want to
reduce the palette of an image to a specific number of colors or apply
a specific compression level:

```html
<img src="myImage.png?pngquant=37">
<img src="myOtherImage.png?optipng=-o7&amp;pngcrush=-rem,tEXT">
```

The image processing is supported everywhere you can refer to an
image, including `background-image` properties in CSS, shortcut icon
links etc.

Additionally, all GraphicsMagick operations (as exposed by the <a
href="https://github.com/aheckmann/gm">gm module</a>) are supported:

```css
body {
    background-image: url(foo.png?resize=500,300&flip&magnify&pngcrush);
}
```

This allows you to only check your original images into version
control and have your build system create the scaled/processed/derived
ones dynamically.

The processing instructions are executed using the same engine that
powers <a
href="https://github.com/papandreou/express-processimage">express-processimage</a>
and <a href="https://github.com/One-com/LiveStyle">livestyle with the
--processimage</a> switch. You can use one of those to have the image
processing instructions applied on your development setup.

Internationalization
--------------------

AssetGraph-builder supports internationalization of strings in your
HTML and JavaScript code via a custom syntax. The approach is to do as
much as possible at "compile time". For each language you want to
support, `buildProduction` outputs a separate html file,
eg. `index.en_US.html`, `index.da.html`, and so on. If you're using
the `TR`/`TRPAT` syntax for getting language-specific
strings within JavaScript, `buildProduction` will also output multiple
versions of your JavaScript, one per language, and it will be wired up
so that eg. `index.da.html` will refer to the Danish JavaScript file.

The i18n feature is optional. Enable it by specifying the `--locale`
switch with a comma-separated list of locale ids to compile, for
example `--locale en_US,da,fr,de`.

The translations themselves reside in separate JSON files with an
`i18n` extension. Example syntax (`foo.i18n`):

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

### JavaScript i18n syntax ###

In JavaScript code you can use the `TR` function for getting a
locale string and `TRPAT` for getting a function that accepts
the placeholder values and returns a locale string.

For these functions to work in development, you currently have to use
`buildDevelopment` tool (still to be documented) to inject some
bootstrapper code that implements them. The bootstrapper will be
removed by `buildProduction`.

The second argument for `TR` and `TRPAT` is optional. It
will be used as the default value if the key isn't found in an .i18n
file. This is very useful when you haven't yet translated your
project. That way you don't need to create the .i18n files before you
actually have something to put in them.

JavaScript example:

    INCLUDE('foo.i18n');

    // This alerts "The value in English" or "Værdien på dansk" depending on which build you're running:
    alert(TR('myKeyName', 'the default value'));

    // This alerts "Showing 1-50 of 100 records" or "Der er 100 i alt, viser fra nr. 1 til nr. 50":
    var foo = 1, bar = 50;
    alert(TRPAT('advancedKeyWithPlaceholders', 'the default value')(foo, bar, 100));

    var myRenderer = TRPAT('advancedKeyWithPlaceholders', 'the default value');
    // This also alerts "Showing 1-2 of 3 records" or "Der er 100 i alt, viser fra nr. 1 til nr. 50":
    alert(myRenderer(1, 50, 100));

In production this compiles into (English version):

    alert('The value in English');
    var foo = 1, bar = 50;
    alert('Showing ' + foo + '-' + bar + ' of 100 records');

    var myRenderer = function (a0, a1, a2) {return 'Showing ' + a0 + '-' + a1 + ' of ' + a2 + ' records'};
    alert(myRenderer(1, 50, 100));

And the Danish version:

    alert('Værdien på dansk');
    var foo = 1, bar = 50;
    alert('Der er 100 i alt, viser fra nr. ' + foo + ' til nr. ' + bar);

    var myRenderer = function (a0, a1, a2) {return 'Der er ' + a3 + ' i alt, viser nr. ' + a0 + ' til nr. ' + a1;};
    alert(myRenderer(1, 50, 100));

As the translation files consist of plain JSON, translated values does
not have to be strings. This enables more advanced features, that you
would otherwise have to implement with string concatenation. The
feature is best explained with an example. Let's say we would like to
translate certain e-mail folder names, but otherwise default to their
real name. That could be achieved the following way.

The translation file:

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

The code translating the e-mail folder names:

    var folderTranslations = TR("FolderName", {
        "Inbox" : "Inbox",
        "Draft" : "Draft",
        "Sent" : "Sent Mail"
    });

    return folderTranslations[folderName] || folderName;

The `TR` function call extracts the internationalized `FolderName`
structure or uses the provided default. Then we look for the folder
name in the translation structure, if it is found we return it;
otherwise we just return the folder name.

### HTML i18n syntax ###

Simple example:

    <p><span data-i18n="myKeyName">The default text</span></p>

Span tags that only have a `data-i18n` attribute are removed, so the above compiles to:

    <p>The value in English</p>

If you put the `data-i18n` attribute on a different tag (eg. `<div>`
or `<h2>`) or use a span with additional attributes, the tag itself
will be preserved, and only the `data-i18n` attribute will be removed:

     <span class="foo" data-i18n="myKeyName">The default text</span>

Which compiles into:

     <span class="foo">The value in English</span>

Non-text node elements inside the default text are interpreted as placeholders numbered from left to right:

     <span data-i18n="advancedKeyWithPlaceholders">Showing <span>1</span> to <span>50</span> of <span>100</span></span>

In the Danish version the above compiles to:

     Der er <span>100</span> i alt, viser nr. <span>1</span> til nr. <span>50</span>.

For HTML attributes there's a more elaborate, Knockout.js-ish syntax for the `data-i18n` attribute:

    <div title="The default value" data-i18n="text: 'myKeyName', attr: {title: 'myOtherKeyName'}">The default value</span>

Which compiles to this in English:

    <div title="The other value in English">The value in English</span>


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
