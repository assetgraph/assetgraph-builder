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
 * Discovers and optimizes Web Workers and Service Workers.
 * Removes duplicate images, JavaScript, CSS, etc.
 * Supports automatic optimization and custom processing of images using
   pngquant, pngcrush, optipng, jpegtran, <a href="https://github.com/lovell/sharp">sharp</a>, and GraphicsMagick.
 * Minifies/packs JavaScript, CSS, and HTML (uses <a
   href="https://github.com/mishoo/UglifyJS">UglifyJS</a>, <a
   href="https://github.com/ben-eb/cssnano">cssnano</a>, <a
   href="https://github.com/tmpvar/jsdom">jsdom</a>,
   and <a href="https://github.com/kangax/html-minifier">html-minifier</a>).
 * Supports the <a
   href="http://requirejs.org/docs/optimization.html">the require.js
   optimizer</a> and <a href="https://github.com/systemjs/builder">systemjs-builder</a>.
 * Sprites background images (see <a
   href="https://github.com/One-com/assetgraph-sprite">assetgraph-sprite</a>).
 * Inlines CSS `background-image`s less than 8192 bytes and provides an
   alternative stylesheet for older IE versions via conditional comments.
 * Inlines CSS and Javascript with total size less than 4096 bytes to reduce HTTP requests.
 * Adds a cache manifest to each HTML page if `--manifest` is
   specified.
 * Renames JavaScript, CSS, images etc. to a 10-char MD5 prefix + the
   original extension so they can be served with a far-future expiry time.
 * Helps getting your static assets on a CDN by rewriting the
   references to them (controlled by the `--cdnroot` switch).
 * Updates an existing Content-Security-Policy meta tag to reflect the
   changes that happened during the build procedure, including hashing
   of inline scripts and stylesheets.
 * Very customizable, the entire build script is only around 100 lines
   of code due to the reliance on high level <a
   href="https://github.com/One-com/assetgraph">AssetGraph</a>
   transforms.
 * Automatically adds `rel="noopener"` to cross domain anchors opening in new windows ([The performance benefits of rel=noopener](https://jakearchibald.com/2016/performance-benefits-of-rel-noopener/))


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
brew install cairo jpeg giflib optipng pngcrush pngquant pango graphicsmagick jpeg-turbo homebrew/gui/inkscape
brew install homebrew/science/vips --with-webp --with-graphicsmagick
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


Excluding assets from your build
--------------------------------

If you want `buildProduction` to avoid including specific assets, paths or entire parts of
your page, you can use the `--exclude` option.

This could come in handy if you have multiple different sections on your site, where
assetgraph-builder only handles a subset of them. If the assetgraph-builder covered section
of site links to sections that it shouldn't handle, this is where you use `--exclude`

`--exclude` can be used multiple times in the same command line to specify more than one pattern.

Exclude patterns are always prefixed with `process.cwd()`, making the path addressable in the same
manner as the entry point arguments.

You may use `*` for wildcards.


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
  'baz.gif'.toString('url') + ' 500w, ' +
  'baz.gif?resize=300'.toString('url') + ' 300w');
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


License
-------

AssetGraph-builder is licensed under a standard 3-clause BSD license
-- see the `LICENSE`-file for details.
