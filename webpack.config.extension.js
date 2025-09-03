/* eslint-disable @typescript-eslint/no-require-imports */
const path = require('path');
const webpack = require('webpack');

module.exports = [
  // Main extension bundle
  {
    name: 'extension',
    mode: 'production',
    target: 'node',
    entry: './packages/poml-vscode/extension.ts',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'extension.js',
      libraryTarget: 'commonjs2',
    },
    externals: {
      vscode: 'commonjs vscode', // the vscode-module is created on-the-fly and must be excluded
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js'],
      alias: {
        'poml': path.resolve(__dirname, 'packages/poml'),
        'poml-vscode': path.resolve(__dirname, 'packages/poml-vscode'),
      },
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          exclude: /node_modules/,
          use: [
            {
              loader: 'ts-loader',
              options: {
                configFile: path.resolve(__dirname, 'tsconfig.json'),
                transpileOnly: true,
              },
            },
          ],
        },
      ],
    },
    plugins: [],
    optimization: {
      minimize: false, // Keep readable for debugging
    },
    devtool: 'source-map',
  },

  // LSP Server bundle
  {
    name: 'server',
    mode: 'production',
    target: 'node',
    entry: './packages/poml-vscode/lsp/server.ts',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'server.js',
      libraryTarget: 'commonjs2',
    },
    externals: {
      'vscode': 'commonjs vscode',
      'sharp': 'commonjs sharp',
      'pdf-parse': 'commonjs pdf-parse',
      'pdfjs-dist': 'commonjs pdfjs-dist',
      'canvas': 'commonjs canvas',
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js'],
      alias: {
        'poml': path.resolve(__dirname, 'packages/poml'),
        'poml-vscode': path.resolve(__dirname, 'packages/poml-vscode'),
      },
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          exclude: /node_modules/,
          use: [
            {
              loader: 'ts-loader',
              options: {
                configFile: path.resolve(__dirname, 'tsconfig.json'),
                transpileOnly: true,
              },
            },
          ],
        },
      ],
    },
    plugins: [],
    optimization: {
      minimize: false, // Keep readable for debugging
    },
    devtool: 'source-map',
  },
];
