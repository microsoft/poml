// Browser-safe fs stub for poml-browser
// These functions are no-ops or return safe defaults in browser context

export const readFileSync = () => {
  throw new Error('readFileSync is not available in browser context');
};

export const writeFileSync = () => {
  throw new Error('writeFileSync is not available in browser context');
};

export const existsSync = () => false;

export const mkdirSync = () => {
  throw new Error('mkdirSync is not available in browser context');
};

export const openSync = () => {
  throw new Error('openSync is not available in browser context');
};

export const closeSync = () => {
  throw new Error('closeSync is not available in browser context');
};

export const writeSync = () => {
  throw new Error('writeSync is not available in browser context');
};

export const symlinkSync = () => {
  throw new Error('symlinkSync is not available in browser context');
};

export const statSync = () => {
  throw new Error('statSync is not available in browser context');
};

export const readdirSync = () => {
  throw new Error('readdirSync is not available in browser context');
};

export default {
  readFileSync,
  writeFileSync,
  existsSync,
  statSync,
  mkdirSync,
  openSync,
  closeSync,
  writeSync,
  symlinkSync,
  readdirSync,
};
