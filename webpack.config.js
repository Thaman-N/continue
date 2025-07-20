const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const HtmlPlugin = require('html-webpack-plugin');

module.exports = {
  mode: 'development',
  devtool: 'inline-source-map',
  entry: {
    popup: path.resolve('./src/popup/index.tsx'),
    background: path.resolve('./src/background/index.ts'),
    contentScript: path.resolve('./src/content/index.ts'),
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              configFile: 'tsconfig.json',
            },
          },
        ],
        exclude: [
          /node_modules/,
          /core\/(?!index\.d\.ts|config\/(?:default|types)\.ts)/
        ],
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader', 'postcss-loader'],
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.jsx'],
    alias: {
      '@': path.resolve('./src'),
    },
  },
  output: {
    path: path.resolve('./dist'),
    filename: '[name].js',
    clean: true,
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: path.resolve('./public'),
          to: path.resolve('./dist'),
        },
      ],
    }),
    new HtmlPlugin({
      template: path.resolve('./src/popup/index.html'),
      filename: 'popup.html',
      chunks: ['popup'],
    }),
  ],
  optimization: {
    splitChunks: false, // Disable code splitting for browser extension
  },
};
