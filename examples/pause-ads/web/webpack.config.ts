import * as path from 'path'
import * as webpack from 'webpack'
import HtmlWebpackPlugin from 'html-webpack-plugin'
// in case you run into any typescript error when configuring `devServer`
import 'webpack-dev-server'

const controller = require('./controller.json')

const versions = `SmartLib ${require('@broadpeak/smartlib/package.json').version} · Shaka ${require('shaka-player/package.json').version} · SIMID controller ${controller.ref.slice(0, 12)}`

const config: webpack.Configuration = {
  mode: 'development', // npm run build overrides this with --mode production
  entry: {
    main: './src/main.ts'
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: [
          /node_modules/,
          /\.deps/
        ]
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.(woff2|svg)$/,
        type: 'asset/resource'
      },
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
  devtool: 'source-map',
  devServer: {
    static: path.resolve(__dirname, 'public'),
    port: 8081,
    open: true,
    compress: true,
  },
  plugins: [
    new HtmlWebpackPlugin({ template: 'src/index.html' }),
    new webpack.DefinePlugin({ __EXAMPLE_VERSIONS__: JSON.stringify(versions) }),
  ],
  performance: { hints: false },
}

export default config
