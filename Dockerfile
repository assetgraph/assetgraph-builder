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

ENV NPM_CONFIG_PREFIX=/home/node/.npm-global
ENV PATH=$NPM_CONFIG_PREFIX/bin:$PATH
USER node

RUN npm --loglevel=warn install -g \
    assetgraph-builder \
    svgo

ENTRYPOINT ["buildProduction"]
