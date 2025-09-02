import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import copy from 'rollup-plugin-copy';
import replace from '@rollup/plugin-replace';
import postcss from 'rollup-plugin-postcss';
import alias from '@rollup/plugin-alias';
import json from '@rollup/plugin-json';
import nodePolyfills from 'rollup-plugin-polyfill-node';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const __BUILD_TYPE__ = process.env.BUILD_TYPE || 'dev'; // 'dev' | 'prod' | 'test'
if (!['dev', 'prod', 'test'].includes(__BUILD_TYPE__)) {
  throw new Error(`Invalid BUILD_TYPE: ${__BUILD_TYPE__}`);
}
const __TEST_BUILD__ = __BUILD_TYPE__ === 'test';
const __DEV_BUILD__ = __BUILD_TYPE__ === 'dev';
const __PROD_BUILD__ = __BUILD_TYPE__ === 'prod';

const replaceValues = {
  // https://stackoverflow.com/questions/70368760/react-uncaught-referenceerror-process-is-not-defined
  'process.env.NODE_ENV': JSON.stringify('development'),
  '__TEST_BUILD__': JSON.stringify(__TEST_BUILD__),
  '__DEV_BUILD__': JSON.stringify(__DEV_BUILD__),
  '__PROD_BUILD__': JSON.stringify(__PROD_BUILD__),
  '__BUILD_TYPE__': JSON.stringify(__BUILD_TYPE__),
};

const aliasEntries = [
  { find: '@common', replacement: path.resolve(__dirname, 'common') },
  { find: '@ui', replacement: path.resolve(__dirname, 'ui') },
  { find: '@background', replacement: path.resolve(__dirname, 'background') },
  { find: '@contentScript', replacement: path.resolve(__dirname, 'contentScript') },
];

const pomlAliasEntries = [
  { find: 'poml', replacement: path.resolve(__dirname, '../poml') },
  { find: 'fs', replacement: path.resolve(__dirname, 'stubs/fs.ts') },
  { find: 'sharp', replacement: path.resolve(__dirname, 'stubs/sharp.ts') },
  { find: 'mammoth', replacement: path.resolve(__dirname, 'stubs/mammoth.ts') },
  { find: 'xmlbuilder2', replacement: path.resolve(__dirname, 'stubs/xmlbuilder2.ts') },
  { find: '@xml-tools/ast', replacement: path.resolve(__dirname, 'stubs/xml-tools-ast.ts') },
  { find: '@xml-tools/parser', replacement: path.resolve(__dirname, 'stubs/xml-tools-parser.ts') },
  // Replace xmlContentAssist.js with browser-safe stub
  { find: /\.\/util\/xmlContentAssist$/, replacement: path.resolve(__dirname, 'stubs/xmlContentAssist.ts') },
  // More specific alias for the exact import path used in pdf.ts
  { find: /^pdfjs-dist\/legacy\/build\/pdf\.js$/, replacement: path.resolve(__dirname, 'stubs/pdfjs-dist.ts') },
  { find: 'pdfjs-dist', replacement: path.resolve(__dirname, 'stubs/pdfjs-dist.ts') },
];

// For debugging purposes, you can uncomment the trace plugin to log the build process
// const trace = (name) => ({
//   name,
//   buildStart() { console.log(`[${name}] buildStart`); },
//   watchChange(id) { console.log(`[${name}] watchChange`, id); },
//   resolveId(id) { console.log(`[${name}] resolveId`, id); },
//   load(id) { console.log(`[${name}] load`, id); },
//   transform(code, id) { console.log(`[${name}] transform`, id); },
//   generateBundle() { console.log(`[${name}] generateBundle`); },
//   writeBundle() { console.log(`[${name}] writeBundle`); }
// });

export default [
  {
    input: 'ui/index.ts',
    output: {
      dir: 'dist/ui',
      format: 'iife',
      sourcemap: true,
    },
    watch: {
      include: ['ui/**', 'common/**', 'poml/**'],
      exclude: 'node_modules/**',
    },
    onwarn(warning, warn) {
      // https://github.com/TanStack/query/issues/5175
      if (warning.code === 'MODULE_LEVEL_DIRECTIVE') {
        return;
      }
      // Suppress circular dependency warnings from chevrotain
      if (
        warning.code === 'CIRCULAR_DEPENDENCY' &&
        (warning.message.includes('chevrotain') ||
          warning.message.includes('xmlbuilder') ||
          warning.message.includes('zod') ||
          warning.message.includes('polyfill-node'))
      ) {
        return;
      }
      // // Suppress this rewriting warnings
      // if (warning.code === 'THIS_IS_UNDEFINED') {
      //   return;
      // }
      // // Suppress eval warnings
      // if (warning.code === 'EVAL') {
      //   return;
      // }

      // In CI environment, treat warnings as errors
      if (process.env.CI || process.env.WARNINGS_AS_ERRORS) {
        throw new Error(`Build warning treated as error: ${warning.message}`);
      }

      warn(warning);
    },
    plugins: [
      // trace('trace'),
      alias({
        entries: [...aliasEntries, ...pomlAliasEntries],
      }),
      replace({
        values: replaceValues,
        preventAssignment: true,
      }),
      typescript({
        tsconfig: './tsconfig.json',
        include: ['poml-browser/ui/**/*', 'poml-browser/common/**/*', 'poml-browser/stubs/**/*', 'poml/**/*'],
        exclude: [
          'poml/node_modules/**/*',
          'poml/tests/**/*',
          'poml-browser/ui/custom.js',
          'poml-browser/ui/theme/style.css',
        ],
      }),
      json(),
      postcss({
        extract: true,
        minimize: true,
      }),
      nodePolyfills({
        include: ['stubs/**/*', '../poml/**/*'],
        // exclude: /node_modules/
      }),
      nodeResolve({
        browser: true,
        preferBuiltins: false,
        rootDir: __dirname,
        modulePaths: [path.resolve(__dirname, 'node_modules')],
        moduleDirectories: [],
        // dedupe: ['entities']
      }),
      commonjs({
        transformMixedEsModules: true,
      }),
      copy({
        targets: [
          {
            src: ['ui/*.html', 'ui/custom.css', 'ui/custom.js'],
            dest: 'dist/ui',
          },
        ],
      }),
    ],
  },
  {
    input: 'background/index.ts',
    output: {
      file: 'dist/background.js',
      format: 'es',
      sourcemap: true,
    },
    watch: {
      include: ['background/**', 'common/**'],
      exclude: 'node_modules/**',
    },
    plugins: [
      alias({
        entries: [...aliasEntries],
      }),
      replace({
        values: replaceValues,
        preventAssignment: true,
      }),
      typescript({
        tsconfig: './tsconfig.json',
        include: ['poml-browser/background/**/*', 'poml-browser/common/**/*', 'poml-browser/stubs/**/*', 'poml/**/*'],
      }),
      json(),
      nodeResolve({
        jsnext: true,
        main: true,
        browser: true,
      }),
      commonjs(),
      copy({
        targets: [
          {
            src: ['manifest.json', 'images'],
            dest: 'dist',
          },
        ],
      }),
    ],
  },
  {
    input: 'contentScript/index.ts',
    output: {
      file: 'dist/contentScript.js',
      format: 'iife',
      sourcemap: true,
    },
    watch: {
      include: ['contentScript/**', 'common/**'],
      exclude: 'node_modules/**',
    },
    plugins: [
      alias({
        entries: [...aliasEntries],
      }),
      replace({
        values: replaceValues,
        preventAssignment: true,
      }),
      typescript({
        tsconfig: './tsconfig.json',
        include: ['poml-browser/contentScript/**/*', 'poml-browser/common/**/*'],
      }),
      json(),
      nodeResolve({
        jsnext: true,
        main: true,
        browser: true,
      }),
      commonjs(),
      copy({
        targets: [
          {
            src: 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs',
            dest: 'dist/external',
          },
        ],
      }),
    ],
  },
];
