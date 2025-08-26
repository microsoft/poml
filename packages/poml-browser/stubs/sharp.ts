// Browser-safe sharp stub for poml-browser
// Sharp is a Node.js native module that can't run in browsers
// This stub provides minimal functionality to prevent runtime errors

interface Metadata {
  width?: number;
  height?: number;
  format?: string;
  [key: string]: any;
}

class Sharp {
  constructor(input?: string | Uint8Array) {
    console.warn('Sharp image processing is not available in browser context');
  }

  resize(width?: number, height?: number): Sharp {
    return this;
  }

  toFormat(format: string): Sharp {
    return this;
  }

  async metadata(): Promise<Metadata> {
    return {
      width: 100,
      height: 100,
      format: 'png',
    };
  }

  toBuffer(): Promise<Uint8Array> {
    return Promise.resolve(new Uint8Array(0));
  }
}

function sharp(input?: string | Uint8Array): Sharp {
  return new Sharp(input);
}

sharp.Sharp = Sharp;

export default sharp;
