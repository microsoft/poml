import { readFileSync } from "fs";
import path from "path";

export const deepMerge = (target: any, source: any): any => {
  // Object can not be array or class instance (like children).
  const isObject = (item: any) => {
    return (
      item !== undefined &&
      item !== null &&
      typeof item === 'object' &&
      !Array.isArray(item) &&
      !('$$typeof' in item) &&
      // https://stackoverflow.com/questions/57227185/how-to-detect-if-a-variable-is-a-pure-javascript-object
      item.constructor === Object
    );
  };

  if (isObject(target) && isObject(source)) {
    target = { ...target }; // Copy target;
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) {
          Object.assign(target, { [key]: {} });
        }
        if (isObject(target[key])) {
          target[key] = deepMerge(target[key], source[key]);
        } else {
          Object.assign(target, { [key]: source[key] });
        }
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }

  return target;
};

export type AnyValue = 'string' | 'integer' | 'float' | 'boolean' | 'array' | 'object' | 'buffer' | 'null' | 'undefined';

export const readSource = (source: string, directory?: string | undefined, type?: AnyValue): any => {
  // Read file content and convert to type.
  // Check whether path is absolute or relative.
  source = !path.isAbsolute(source) && directory ? path.join(directory, source) : source;
  if (type === 'buffer') {
    const buffer: Buffer = readFileSync(source);
    return buffer;
  } else {
    const text: string = readFileSync(source, 'utf8');
    return parseText(text, type);
  }
}

export const parseText = (object: string | Buffer, type?: AnyValue): any => {
  if (typeof object === 'string') {
    if (type === 'buffer') {
      return Buffer.from(object);
    } else if (type === 'string') {
      return object;
    } else if (!type) {
      return guessStringType(object)[0];
    } else if (type === 'integer') {
      return parseInt(object);
    } else if (type === 'float') {
      return parseFloat(object);
    } else if (type === 'boolean') {
      if (object.toLowerCase() === 'true' || object === '1') {
        return true;
      } else if (object.toLowerCase() === 'false' || object === '0') {
        return false;
      } else {
        throw new Error('Invalid boolean value: ' + object);
      }
    } else if (type === 'array' || type === 'object') {
      return JSON.parse(object);
    } else if (type === 'null') {
      return null;
    } else if (type === 'undefined') {
      return undefined;
    } else {
      throw new Error('Invalid type: ' + type);
    }
  } else if (Buffer.isBuffer(object)) {
    if (type === 'buffer') {
      return object;
    } else {
      return parseText(object.toString(), type);
    }
  } else {
    throw new Error('Invalid object type (expect buffer or string): ' + typeof object);
  }
}

export const guessStringType = (value: string): [any, AnyValue] => {
  if (value.toLowerCase() === 'null' || value === '') {
    return [null, 'null'];
  } else if (value.toLowerCase() === 'undefined') {
    return [undefined, 'undefined'];
  } else if (value.toLowerCase() === 'true') {
    return [true, 'boolean'];
  } else if (value.toLowerCase() === 'false') {
    return [false, 'boolean'];
  } else if (!isNaN(Number(value))) {
    // https://stackoverflow.com/questions/16775547/javascript-guess-data-type-from-string
    if (parseFloat(value) === parseInt(value)) {
      return [parseInt(value), "integer"];
    } else {
      return [parseFloat(value), "float"];
    }
  } else if (/^\d*(\.|,)\d*$/.test(value) || /^(\d{0,3}(,)?)+\.\d*$/.test(value) || /^(\d{0,3}(\.)?)+,\d*$/.test(value)) {
    return [Number(value), "float"];
  } else {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return [parsed, 'array'];
      } else {
        return [parsed, 'object'];
      }
    } catch (e) {
      return [value, 'string'];
    }
  }
}

