const path = require('path');
const fs = require('fs');
const CopyPlugin = require('copy-webpack-plugin');

const vscodeignorePath = path.resolve(__dirname, '.vscodeignore');
// The destination for our new node_modules folder
const outputNodeModulesPath = path.resolve(__dirname, 'python', 'poml', 'node_modules');
// The source of all node_modules
const sourceNodeModulesPath = path.resolve(__dirname, 'node_modules');

let copyPatterns = [];
try {
  const vscodeignoreContent = fs.readFileSync(vscodeignorePath, 'utf8');
  const lines = vscodeignoreContent.split('\n');

  copyPatterns = lines
    .map(line => line.trim())
    .filter(line => line.startsWith('!node_modules/'))
    .map(line => {
      // 1. Get the path relative to node_modules
      // e.g., '!node_modules/sharp/package.json' becomes 'sharp/package.json'
      let subPath = line.substring('!node_modules/'.length);

      // 2. Check if the path points to a directory (and isn't already a glob)
      const absolutePath = path.join(sourceNodeModulesPath, subPath);
      if (fs.existsSync(absolutePath) && fs.lstatSync(absolutePath).isDirectory() && !subPath.endsWith('/**')) {
        // If it's a directory, append `/**` to copy its contents recursively
        // while preserving the parent directory name.
        subPath = `${subPath}/**`;
      }

      // 3. Return the corrected pattern object for the plugin
      return {
        // 'from' is now relative to the context (the root node_modules)
        from: subPath,
        // The destination is the new node_modules folder we want to create
        to: outputNodeModulesPath,
        // The context tells the plugin where to find the 'from' files
        context: sourceNodeModulesPath,
        noErrorOnMissing: true,
      };
    });

  console.log(`[Webpack] Found ${copyPatterns.length} patterns to copy from .vscodeignore.`);

} catch (error) {
  console.error('[Webpack] Could not read or parse .vscodeignore file. No dependencies will be copied.', error);
}

module.exports = {
  mode: 'development',
  entry: {
    cli: './packages/poml/cli.ts'
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  plugins: [
    new CopyPlugin({
      patterns: copyPatterns,
    }),
  ],
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    alias: {
      poml: path.resolve(__dirname, 'packages/poml'),
    }
  },
  externals: {
    'sharp': 'commonjs sharp',
    'pdf-parse': 'commonjs pdf-parse'
  },
  devtool: 'inline-source-map',
  target: 'node',
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'python', 'poml', 'js')
  }
};
