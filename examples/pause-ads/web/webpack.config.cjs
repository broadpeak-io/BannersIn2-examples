const path = require('path')
const webpack = require('webpack')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const controller = require('./controller.json')

const versions = `SmartLib ${require('@broadpeak/smartlib/package.json').version} · Shaka ${require('shaka-player/package.json').version} · SIMID controller ${controller.ref.slice(0, 12)}`

module.exports = {
  mode: 'development', // npm run build overrides this with --mode production
  entry: './src/main.ts',
  module: {
    rules: [
      { test: /\.ts$/, use: 'ts-loader', exclude: /node_modules|\.deps/ },
      { test: /\.css$/, use: ['style-loader', 'css-loader'] },
      { test: /\.(woff2|svg)$/, type: 'asset/resource' },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      // Built by `npm run setup` from the ref pinned in controller.json
      '@broadpeak-tv/simid-controller': path.resolve(__dirname, '.deps/simid-controller/web/controller/dist/index.js'),
    },
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].[contenthash].js',
    clean: true,
  },
  plugins: [
    new HtmlWebpackPlugin({ template: 'src/index.html' }),
    new webpack.DefinePlugin({ __EXAMPLE_VERSIONS__: JSON.stringify(versions) }),
  ],
  devtool: 'source-map',
  devServer: { static: path.resolve(__dirname, 'public'), port: 8081, open: true },
  performance: { hints: false },
}
