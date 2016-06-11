FROM node:latest

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        graphicsmagick \
        inkscape \
        libcairo2-dev \
        libgif-dev \
        libgsf-1-dev \
        libjpeg-progs \
        libpango1.0-dev \
        libvips-dev \
        optipng \
        pngcrush \
        pngquant \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g \
    assetgraph-builder \
    svgo

ENTRYPOINT ["/usr/local/bin/buildProduction"]
