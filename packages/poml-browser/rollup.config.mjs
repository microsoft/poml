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

const aliasEntries = [
  { find: '@functions', replacement: path.resolve(__dirname, 'functions') },
  { find: '@ui', replacement: path.resolve(__dirname, 'ui') },
  { find: '@background', replacement: path.resolve(__dirname, 'background') },
  { find: '@contentScript', replacement: path.resolve(__dirname, 'contentScript') },
];

const pomlAliasEntries = [
  { find: 'poml', replacement: path.resolve(__dirname, '../poml') },
  { find: 'fs', replacement: path.resolve(__dirname, 'stubs/fs.ts') },
  { find: 'sharp', replacement: path.resolve(__dirname, 'stubs/sharp.ts') },
  // More specific alias for the exact import path used in pdf.ts
  { find: /^pdfjs-dist\/legacy\/build\/pdf\.js$/, replacement: path.resolve(__dirname, 'stubs/pdfjs-dist.ts') },
  { find: 'pdfjs-dist', replacement: path.resolve(__dirname, 'stubs/pdfjs-dist.ts') },
];

export default [
  {
    input: 'ui/index.ts',
    output: {
      dir: 'dist/ui',
      format: 'iife',
      sourcemap: true
    },
    watch: {
      include: ['ui/**', 'functions/**', '../poml/**'],
      exclude: 'node_modules/**'
    },
    onwarn(warning, warn) {
      // https://github.com/TanStack/query/issues/5175
      if (warning.code === 'MODULE_LEVEL_DIRECTIVE') {
        return;
      }
      // Suppress circular dependency warnings from chevrotain
      // if (
      //   warning.code === 'CIRCULAR_DEPENDENCY' &&
      //   (warning.message.includes('chevrotain') || warning.message.includes('xmlbuilder'))
      // ) {
      //   return;
      // }
      // // Suppress this rewriting warnings
      // if (warning.code === 'THIS_IS_UNDEFINED') {
      //   return;
      // }
      // // Suppress eval warnings
      // if (warning.code === 'EVAL') {
      //   return;
      // }
      warn(warning);
    },
    plugins: [
      alias({
        entries: [...aliasEntries, ...pomlAliasEntries]
      }),
      typescript({
        tsconfig: './tsconfig.json',
        include: [
          'poml-browser/ui/**/*',
          'poml-browser/functions/**/*',
          'poml-browser/stubs/**/*',
          'poml/**/*'
        ],
        exclude: ['poml/node_modules/**/*', 'poml/tests/**/*', 'poml-browser/ui/custom.js']
      }),
      json(),
      replace({
        // https://stackoverflow.com/questions/70368760/react-uncaught-referenceerror-process-is-not-defined
        'process.env.NODE_ENV': JSON.stringify('development'),
        preventAssignment: true
      }),
      postcss({
        extract: true,
        minimize: true
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
        transformMixedEsModules: true
      }),
      copy({
        targets: [
          {
            src: ['ui/*.html', 'ui/custom.css', 'ui/custom.js'],
            dest: 'dist/ui'
          }
        ]
      })
    ]
  },
  {
    input: 'background/index.ts',
    output: {
      file: 'dist/background.js',
      format: 'es',
      sourcemap: true
    },
    watch: {
      include: 'background/**',
      exclude: 'node_modules/**'
    },
    plugins: [
      alias({
        entries: [...aliasEntries]
      }),
      typescript({
        tsconfig: './tsconfig.json',
        include: ['poml-browser/background/**/*', 'poml-browser/functions/**/*', 'poml-browser/stubs/**/*', 'poml/**/*']
      }),
      nodeResolve({
        jsnext: true,
        main: true,
        browser: true
      }),
      commonjs(),
      copy({
        targets: [
          {
            src: ['manifest.json', 'images'],
            dest: 'dist'
          }
        ]
      })
    ]
  },
  {
    input: 'contentScript/index.ts',
    output: {
      file: 'dist/contentScript.js',
      format: 'iife',
      sourcemap: true
    },
    watch: {
      include: 'contentScript/**',
      exclude: 'node_modules/**'
    },
    plugins: [
      alias({
        entries: [...aliasEntries]
      }),
      typescript({
        tsconfig: './tsconfig.json',
        include: ['poml-browser/contentScript/**/*']
      }),
      nodeResolve({
        jsnext: true,
        main: true,
        browser: true
      }),
      commonjs(),
      copy({
        targets: [
          {
            src: 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs',
            dest: 'dist/external'
          }
        ]
      })
    ]
  }
];
