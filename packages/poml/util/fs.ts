import * as fs from 'fs';

export const readFileSync = fs.readFileSync;
export const writeFileSync = fs.writeFileSync;
export const existsSync = fs.existsSync;
export const mkdirSync = fs.mkdirSync;
export const openSync = fs.openSync;
export const closeSync = fs.closeSync;
export const writeSync = fs.writeSync;
export const symlinkSync = fs.symlinkSync;
export const readdirSync = fs.readdirSync;

export default fs;
