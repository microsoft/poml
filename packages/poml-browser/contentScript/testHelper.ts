import { pingPong } from './registry';

// @ts-ignore
if (__TEST_BUILD__) {
  // Add test buttons in a collapsible menu
  const buttonsHtml = `
    <div style="position: fixed; bottom: 10px; right: 10px; z-index: 99999;">
      <div id="pomlDevMenu" style="border: 1px solid #888; border-radius: 4px; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">
        <button id="openSidePanel" style="display: block; width: 100%; padding: 5px 10px; margin-bottom: 5px; cursor: pointer;">Open POML Sidebar</button>
        <button id="pingPongContent" style="display: block; width: 100%; padding: 5px 10px; margin-bottom: 5px; cursor: pointer;">Ping Content</button>
        <button id="pingPongBackground" style="display: block; width: 100%; padding: 5px 10px; margin-bottom: 5px; cursor: pointer;">Ping Background</button>
        <button id="pingPongSidebar" style="display: block; width: 100%; padding: 5px 10px; cursor: pointer;">Ping Sidebar</button>
        <button id="pingPongContentSidebar" style="display: block; width: 100%; padding: 5px 10px; margin-top: 5px; cursor: pointer;">Ping Content & Sidebar</button>
      </div>
    </div>
  `;

  const buttonsContainer = new DOMParser().parseFromString(buttonsHtml, 'text/html').body
    .firstElementChild as HTMLElement;

  // Add event listeners
  buttonsContainer.querySelector('#openSidePanel')?.addEventListener('click', function () {
    chrome.runtime.sendMessage({ action: 'devSidePanel' });
  });

  buttonsContainer.querySelector('#pingPongContent')?.addEventListener('click', async function (e) {
    const button = e.target as HTMLButtonElement;
    try {
      button.textContent = 'Pinging...';
      const result = await pingPong.content('Hello from content', 100);
      console.log('PingPong Content result:', result);
      button.textContent = `Result: ${result}`;
    } catch (error) {
      console.error('PingPong Content error:', error);
      button.textContent = `Error: ${error}`;
    }
  });

  buttonsContainer.querySelector('#pingPongBackground')?.addEventListener('click', async function (e) {
    const button = e.target as HTMLButtonElement;
    try {
      button.textContent = 'Pinging...';
      const result = await pingPong.background('Hello from content', 100);
      console.log('PingPong Background result:', result);
      button.textContent = `Result: ${result}`;
    } catch (error) {
      console.error('PingPong Background error:', error);
      button.textContent = `Error: ${error}`;
    }
  });

  buttonsContainer.querySelector('#pingPongSidebar')?.addEventListener('click', async function (e) {
    const button = e.target as HTMLButtonElement;
    try {
      button.textContent = 'Pinging...';
      const result = await pingPong.sidebar('Hello from content', 100);
      console.log('PingPong Sidebar result:', result);
      button.textContent = `Result: ${result}`;
    } catch (error) {
      console.error('PingPong Sidebar error:', error);
      button.textContent = `Error: ${error}`;
    }
  });

  buttonsContainer.querySelector('#pingPongContentSidebar')?.addEventListener('click', async function (e) {
    const button = e.target as HTMLButtonElement;
    try {
      button.textContent = 'Pinging...';
      const result = await pingPong.contentSidebar('Hello from content', 100);
      console.log('PingPong Content & Sidebar result:', result);
      button.textContent = `Result: ${result}`;
    } catch (error) {
      console.error('PingPong Content & Sidebar error:', error);
      button.textContent = `Error: ${error}`;
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      document.body.append(buttonsContainer);
    });
  } else {
    // DOM is already loaded
    document.body.append(buttonsContainer);
  }
}
