/// <reference types="chrome-types" />

interface FileData {
  name: string;
  content: string;
  type: string;
}

interface MessageRequest {
  action: string;
  filePath?: string;
  tabId?: number;
  prompt?: string;
  files?: FileData[];
  binary?: boolean;
}

interface MessageResponse {
  success: boolean;
  content?: string;
  base64Data?: string;
  error?: string;
}

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") {
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: true })
      .catch((error) => console.error(error));
  }
});

// Handle messages from content script/sidepanel
chrome.runtime.onMessage.addListener(
  (
    request: MessageRequest,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse) => void
  ): boolean => {
    if (request.action === "readFile") {
      if (!request.filePath) {
        sendResponse({ success: false, error: "No file path provided" });
        return true;
      }

      readFileContent(request.filePath, request.binary)
        .then((result) => {
          if (request.binary) {
            // Convert ArrayBuffer to base64 for message passing
            const arrayBuffer = result as ArrayBuffer;
            const uint8Array = new Uint8Array(arrayBuffer);
            
            // Convert to base64 in chunks to avoid call stack overflow
            let binaryString = '';
            const chunkSize = 8192;
            for (let i = 0; i < uint8Array.length; i += chunkSize) {
              const chunk = uint8Array.subarray(i, i + chunkSize);
              binaryString += String.fromCharCode(...chunk);
            }
            const base64 = btoa(binaryString);
            
            sendResponse({ success: true, base64Data: base64 });
          } else {
            sendResponse({ success: true, content: result as string });
          }
        })
        .catch((error) => {
          console.error("Error reading file:", error);
          sendResponse({ success: false, error: error.message });
        });

      // Return true to indicate we will send a response asynchronously
      return true;
    } else if (request.action === "extractPageContent") {
      if (!request.tabId) {
        sendResponse({ success: false, error: "No tab ID provided" });
        return true;
      }

      extractPageContent(request.tabId)
        .then((content) => {
          sendResponse({ success: true, content: content });
        })
        .catch((error) => {
          console.error("Error extracting page content:", error);
          sendResponse({ success: false, error: error.message });
        });

      // Return true to indicate we will send a response asynchronously
      return true;
    } else if (request.action === "extractMsWordContent") {
      if (!request.tabId) {
        sendResponse({ success: false, error: "No tab ID provided" });
        return true;
      }

      extractMsWordContent(request.tabId)
        .then((content) => {
          sendResponse({ success: true, content: content });
        })
        .catch((error) => {
          console.error("Error extracting MS Word content:", error);
          sendResponse({ success: false, error: error.message });
        });

      // Return true to indicate we will send a response asynchronously
      return true;
    } else if (request.action === "sendToChatGPT") {
      if (!request.tabId || !request.prompt) {
        sendResponse({ success: false, error: "Missing required parameters (tabId, prompt)" });
        return true;
      }

      // Convert FileData objects back to File objects
      const files = (request.files || []).map(fileData => 
        new File([fileData.content], fileData.name, { type: fileData.type })
      );
      
      sendToChatGPT(request.tabId, request.prompt, files)
        .then(() => {
          sendResponse({ success: true });
        })
        .catch((error) => {
          console.error("Error sending to ChatGPT:", error);
          sendResponse({ success: false, error: error.message });
        });

      // Return true to indicate we will send a response asynchronously
      return true;
    }

    return false;
  }
);

async function readFileContent(filePath: string, binary: boolean = false): Promise<string | ArrayBuffer> {
  try {
    // Normalize the file path
    let normalizedPath = filePath.trim();

    // Handle different path formats
    if (normalizedPath.startsWith("~/")) {
      // Cannot resolve ~ in browser extension context
      throw new Error("Cannot resolve ~ path in extension context");
    }

    // Ensure path starts with file:// protocol
    if (!normalizedPath.startsWith("file://")) {
      if (normalizedPath.startsWith("/")) {
        normalizedPath = "file://" + normalizedPath;
      } else {
        throw new Error("Invalid file path format");
      }
    }

    // Attempt to fetch the file
    const response = await fetch(normalizedPath);

    if (!response.ok) {
      throw new Error(`File not found or access denied: ${response.status}`);
    }

    if (binary) {
      const arrayBuffer = await response.arrayBuffer();
      return arrayBuffer;
    } else {
      const content = await response.text();
      return content;
    }
  } catch (error) {
    // If fetch fails, try alternative approaches or provide helpful error
    if (
      error instanceof Error &&
      error.message.includes("Not allowed to load local resource")
    ) {
      throw new Error(
        "Browser security policy prevents reading local files. Try using a local server or file input instead."
      );
    }
    throw error;
  }
}

async function extractPageContent(tabId: number): Promise<string> {
  try {
    if (!chrome.scripting) {
      throw new Error("Chrome scripting API not available");
    }

    console.log(`[DEBUG] Starting content extraction for tab ${tabId}`);

    // Inject the content extractor script that includes Readability
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ["contentScript.js"],
    });

    console.log(`[DEBUG] Content extractor script injected`);

    // Now execute the extraction function
    const extractionResults = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: () => {
        // The content-extractor.js should have made extractContent available globally
        if (typeof (window as any).extractContent === "function") {
          return (window as any).extractContent();
        } else if (
          typeof (window as any).ContentExtractor !== "undefined" &&
          (window as any).ContentExtractor.extractContent
        ) {
          return (window as any).ContentExtractor.extractContent();
        } else {
          console.error("[DEBUG] extractContent function not found");
          // Fallback
          return {
            title: document.title || "Untitled",
            content: document.body
              ? document.body.innerText || document.body.textContent || ""
              : "",
            excerpt: "",
            debug:
              "extractContent function not available, used emergency fallback",
          };
        }
      },
    });

    console.log("[DEBUG] Script execution completed");
    console.log("[DEBUG] Extraction results:", extractionResults);

    if (
      extractionResults &&
      extractionResults[0] &&
      extractionResults[0].result
    ) {
      const article = extractionResults[0].result;
      console.log("[DEBUG] Article debug info:", article.debug);

      if (!article.content.trim()) {
        console.log("[DEBUG] No content found in article result");
        throw new Error(
          `No readable content found on this page. Debug: ${article.debug}`
        );
      }

      let extractedText = "";
      if (article.title) {
        extractedText += `# ${article.title}\n\n`;
      }
      extractedText += article.content;

      console.log(
        "[DEBUG] Successfully extracted",
        extractedText.length,
        "characters"
      );
      return extractedText;
    } else {
      console.log("[DEBUG] No results returned from script execution");
      throw new Error(
        "Could not extract readable content from page - no results returned"
      );
    }
  } catch (error) {
    console.error("[DEBUG] Error in background extractPageContent:", error);
    throw error;
  }
}

async function extractMsWordContent(tabId: number): Promise<string> {
  try {
    if (!chrome.scripting) {
      throw new Error("Chrome scripting API not available");
    }

    console.log(`[DEBUG] Starting MS Word content extraction for tab ${tabId}`);

    // First, try to find all frames in the tab
    const frames = await chrome.webNavigation.getAllFrames({ tabId: tabId });
    console.log(`[DEBUG] Found ${frames?.length || 0} frames in tab`);

    let wordFrameId: number | undefined;
    
    // Look for the Word iframe frame
    if (frames) {
      for (const frame of frames) {
        console.log(`[DEBUG] Frame ${frame.frameId}: ${frame.url}`);
        if (frame.url && (
          frame.url.includes('word-edit.officeapps.live.com') ||
          frame.url.includes('word-view.officeapps.live.com') ||
          frame.url.includes('officeapps.live.com') ||
          frame.url.includes('WopiFrame')
        )) {
          wordFrameId = frame.frameId;
          console.log(`[DEBUG] Found Word frame with ID: ${wordFrameId}`);
          break;
        }
      }
    }

    if (wordFrameId === undefined) {
      console.log(`[DEBUG] No Word frame found, trying main frame`);
      wordFrameId = 0; // Main frame
    }

    // Inject the content extractor script into the Word frame
    await chrome.scripting.executeScript({
      target: { tabId: tabId, frameIds: [wordFrameId] },
      files: ["contentScript.js"],
    });

    console.log(`[DEBUG] Content extractor script injected into frame ${wordFrameId}`);

    // Now execute the convertDomToMarkup function in the Word frame
    const extractionResults = await chrome.scripting.executeScript({
      target: { tabId: tabId, frameIds: [wordFrameId] },
      func: () => {
        console.log('[DEBUG] Executing convertDomToMarkup in frame');
        console.log('[DEBUG] Current document URL:', document.location.href);
        console.log('[DEBUG] Document title:', document.title);
        
        // The contentScript.js should have made convertDomToMarkup available globally
        if (typeof (window as any).convertDomToMarkup === "function") {
          const blocks = (window as any).convertDomToMarkup();
          
          console.log(`[DEBUG] convertDomToMarkup returned ${blocks.length} blocks`);
          
          // Convert blocks to markdown text
          let content = '';
          
          for (const block of blocks) {
            switch (block.type) {
              case 'header':
                content += '#'.repeat(block.level) + ' ' + block.content + '\n\n';
                break;
              case 'paragraph':
                content += block.content + '\n\n';
                break;
              case 'image':
                content += `![${block.alt}](${block.src})\n\n`;
                break;
            }
          }
          
          return {
            title: document.title || "MS Word Document",
            content: content.trim(),
            excerpt: "",
            debug: `Extracted ${blocks.length} blocks from MS Word document in frame`
          };
        } else {
          console.error("[DEBUG] convertDomToMarkup function not found in frame");
          // Fallback - try to get any text content from the document
          const fallbackContent = document.body
            ? document.body.innerText || document.body.textContent || ""
            : "";
          
          return {
            title: document.title || "MS Word Document",
            content: fallbackContent,
            excerpt: "",
            debug: "convertDomToMarkup function not available in frame, used fallback text extraction",
          };
        }
      },
    });

    console.log("[DEBUG] MS Word script execution completed");
    console.log("[DEBUG] MS Word extraction results:", extractionResults);

    if (
      extractionResults &&
      extractionResults[0] &&
      extractionResults[0].result
    ) {
      const article = extractionResults[0].result;
      console.log("[DEBUG] MS Word article debug info:", article.debug);

      if (!article.content.trim()) {
        console.log("[DEBUG] No content found in MS Word document result");
        throw new Error(
          `No readable content found in MS Word document. Debug: ${article.debug}`
        );
      }

      let extractedText = "";
      if (article.title && !article.title.includes("Word")) {
        extractedText += `# ${article.title}\n\n`;
      }
      extractedText += article.content;

      console.log(
        "[DEBUG] Successfully extracted MS Word content:",
        extractedText.length,
        "characters"
      );
      return extractedText;
    } else {
      console.log("[DEBUG] No results returned from MS Word script execution");
      throw new Error(
        "Could not extract readable content from MS Word document - no results returned"
      );
    }
  } catch (error) {
    console.error("[DEBUG] Error in background extractMsWordContent:", error);
    throw error;
  }
}

async function sendToChatGPT(
  tabId: number,
  prompt: string,
  files: File[] = []
): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: async () => {
      // 1.  Focus the textarea and inject the text
      const ta =
        document.querySelector('textarea[name="prompt-textarea"]') ||
        document.querySelector("form textarea");

      if (ta) {
        console.log("[DEBUG] Textarea found for prompt injection", ta);
        (ta as any).focus();
        (ta as any).value = prompt;
        ta.dispatchEvent(new Event("input", { bubbles: true }));
      } else {
        console.error("[DEBUG] Textarea not found for prompt injection");
        throw new Error("Textarea not found for prompt injection");
      }

      // 2.  Attach files (works for images, PDFs, anything ChatGPT UI accepts)
      if (files.length) {
        // ChatGPT uses a hidden <input type="file"> behind the 📎 button.
        const hiddenInput = document.querySelector(
          'input[type="file"][multiple]'
        );
        if (hiddenInput) {
          console.log("[DEBUG] Hidden file input found for file attachment");
          // Trick: create a DataTransfer so the input thinks the user selected files
          const dt = new DataTransfer();
          files.forEach((f) => dt.items.add(f));
          (hiddenInput as any).files = dt.files;

          // Trigger the "change" event so React sees it
          hiddenInput.dispatchEvent(new Event("change", { bubbles: true }));
        } else {
          console.error("[DEBUG] Hidden file input not found for file attachment");
          throw new Error("Hidden file input not found for file attachment");
        }
      }
    },
  });
}
