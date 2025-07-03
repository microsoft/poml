import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['index.ts'],        // or './src/index.ts' – your main entry
  format: ['esm', 'cjs'],     // emit both module systems
  dts: true,                  // bundle *.d.ts as well
  sourcemap: true,
  target: 'es2022',
  splitting: false,           // libraries rarely need code‐splitting
  outDir: 'dist',
  clean: true                 // wipe dist/ before each build
});