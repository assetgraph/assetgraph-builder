var childProcess = require('child_process'),
    _ = require('underscore'),
    seq = require('seq'),
    urlTools = require('assetgraph/lib/util/urlTools'),
    pipeImageThroughChildProcessAndBuffer = require('../util/pipeImageThroughChildProcessAndBuffer'),
    passError = require('passerror'),
    AssetGraph = require('assetgraph'),
    postProcessPropertyName = AssetGraph.assets.Css.vendorPrefix + '-image-postprocess';

function applyFilters(buffer, filters, cb) {
    if (filters.length === 0) {
        return process.nextTick(function () {
            cb(null, buffer);
        });
    }

    var nextFilterNum = 0;
    function proceed () {
        if (nextFilterNum < filters.length) {
            var nextFilter = filters[nextFilterNum];
            nextFilterNum += 1;
            nextFilter(buffer, passError(cb, function (resultBuffer) {
                buffer = resultBuffer;
                proceed();
            }));
        } else {
            cb(null, buffer);
        }
    }
    proceed();
}

module.exports = function (queryObj) {
    return function postProcessCssImages(assetGraph, cb) {
        var imageInfos = [];
        assetGraph.findRelations(_.extend({type: 'CssImage'}, queryObj)).forEach(function (relation) {
            var postProcessValue = relation.cssRule.style[postProcessPropertyName];
            if (postProcessValue) {
                if (/^_/.test(relation.propertyName)) {
                    console.warn("transforms.postProcessCssImages warning: Skipping " + relation.propertyName);
                } else {
                    var imageInfo = {
                        filters: [],
                        asset: relation.to,
                        incomingRelations: [relation]
                    };
                    postProcessValue.match(/\w+(?:\([^\)]*\))?/g).forEach(function (commandStr) {
                        if (commandStr.toLowerCase() === 'ie6') {
                            imageInfo.ie6 = true;
                        } else {
                            var commandMatch = commandStr.match(/^(pngquant|pngcrush|optipng)(?:\(([^\)]*)\))?/);
                            if (commandMatch) {
                                imageInfo.filters.push(pipeImageThroughChildProcessAndBuffer[commandMatch[1]](commandMatch[2]));
                            }
                        }
                    });
                    imageInfos.push(imageInfo);
                }
            }
        });
        if (imageInfos.length === 0) {
            return process.nextTick(cb);
        }
        seq(imageInfos)
            .parEach(function (imageInfo, i) {
                applyFilters(imageInfo.asset.rawSrc, imageInfo.filters, this.into("" + i));
            })
            .parEach(function (imageInfo, i) {
                var processedAsset = new AssetGraph.assets.Png({
                    rawSrc: this.vars[i]
                });
                processedAsset.url = urlTools.resolveUrl(assetGraph.root, processedAsset.id + processedAsset.defaultExtension);
                assetGraph.addAsset(processedAsset);
                imageInfo.incomingRelations.forEach(function (incomingRelation) {
                    var style = incomingRelation.cssRule.style;
                    style.removeProperty(postProcessPropertyName);
                    if (imageInfo.ie6) {
                        // Designates that the processed image should only be used in IE6
                        // Keep the original relation and use the underscore hack for getting
                        // IE6 to fetch the processed version:
                        if (('_' + incomingRelation.propertyName) in style) {
                            throw new Error("transforms.postProcessCssImages: Underscore hack already in use in Css rule");
                        }
                        style.setProperty('_' + incomingRelation.propertyName, 'url(...)', style.getPropertyPriority(incomingRelation.propertyName));
                        var relation = new AssetGraph.relations.CssImage({
                            propertyName: '_' + incomingRelation.propertyName,
                            cssRule: incomingRelation.cssRule,
                            from: incomingRelation.from,
                            to: processedAsset
                        });
                        assetGraph.addRelation(relation, 'after', incomingRelation);
                        relation.refreshHref();
                    } else {
                        // All browsers should see the processed version, replace the old relation:
                        var relation = new AssetGraph.relations.CssImage({
                            propertyName: incomingRelation.propertyName,
                            cssRule: incomingRelation.cssRule,
                            from: incomingRelation.from,
                            to: processedAsset
                        });
                        assetGraph.addRelation(relation, 'after', incomingRelation);
                        relation.refreshHref();
                        assetGraph.removeRelation(incomingRelation);
                    }
                    incomingRelation.from.markDirty();
                });
                // Remove original asset if it has become orphaned:
                if (!assetGraph.findRelations({to: imageInfo.asset}).length) {
                    assetGraph.removeAsset(imageInfo.asset);
                }
                this();
            })
            .seq(function () {
                cb();
            })
            ['catch'](cb);
    };
};
