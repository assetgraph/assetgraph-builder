FROM node:0.10

RUN apt-get update
RUN apt-get install -y --no-install-recommends libcairo2-dev libgif-dev optipng pngcrush pngquant libpango1.0-dev graphicsmagick libjpeg-progs inkscape libvips-dev libgsf-1-dev
RUN npm install -g assetgraph-builder svgo

ENTRYPOINT ["/usr/local/bin/buildProduction"]
