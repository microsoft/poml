export function waitForChromeRuntime(): Promise<void> {
  // If we are not on an extension page, this will never resolve — keep the timeout guard.
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const iv = setInterval(() => {
      // console.log(chrome);
      // console.log(chrome.runtime);
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        clearInterval(iv);
        resolve();
      } else if (Date.now() - started > 5000) {
        // 5s guard
        clearInterval(iv);
        console.log(chrome);
        console.log(chrome?.runtime);
        reject(new Error('chrome.runtime not available (timeout)'));
      }
    }, 50);
  });
}
