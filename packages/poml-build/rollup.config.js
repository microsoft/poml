import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import pkg from './package.json' with { type: 'json' };

const peerDependencies = Object.keys(pkg.peerDependencies || {});
const external = [...Object.keys(pkg.dependencies || {}), ...peerDependencies];

export default {
  // The entry point of your library
  input: ['.build/index.js', '.build/cli.js'],
  output: [
    {
      dir: 'dist',
      format: 'esm',
      preserveModules: true, // Keep file structure
      preserveModulesRoot: '.build',
      sourcemap: true, // Turn off source maps for production
      entryFileNames: '[name].js', // Ensure output files have .js extension
    },
    // 2. CommonJS output
    {
      dir: 'dist',
      format: 'cjs',
      preserveModules: true,
      preserveModulesRoot: '.build',
      sourcemap: true,
      entryFileNames: '[name].cjs', // Ensure output files have .cjs extension
    },
  ],
  plugins: [json(), commonjs()],
  external: external,
};
