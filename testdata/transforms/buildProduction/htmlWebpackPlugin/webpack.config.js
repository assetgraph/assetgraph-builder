var webpack = require('webpack');
var HtmlWebpackPlugin = require('html-webpack-plugin');

// Note: defined here because it will be used more than once.
const cssFilename = 'static/css/[name].[contenthash:8].css';

// This is the production configuration.
// It compiles slowly and is focused on producing a fast and minimal bundle.
// The development configuration is different and lives in a separate file.
module.exports = {
  entry: __dirname + '/src/index.js',
  output: {
    path: __dirname + '/build/',
    filename: 'static/js/[name].[chunkhash:8].js',
    chunkFilename: 'static/js/[name].[chunkhash:8].chunk.js'
  },
  plugins: [
    new HtmlWebpackPlugin({
      inject: true,
      template: __dirname + '/public/index.html'
    })
  ]
};
