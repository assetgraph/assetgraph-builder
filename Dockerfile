FROM node:14

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        graphicsmagick \
        inkscape \
    && rm -rf /var/lib/apt/lists/*

ENV NPM_CONFIG_PREFIX=/home/node/.npm-global
ENV PATH=$NPM_CONFIG_PREFIX/bin:$PATH
USER node

RUN npm --loglevel=warn install -g \
        assetgraph-builder \
        svgo \
    && npm cache clean --force

ENTRYPOINT ["buildProduction"]
