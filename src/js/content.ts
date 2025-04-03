/**
 * Content script for PsiTabs
 * Runs in the context of web pages to extract content and perform tab-specific operations
 */

interface DuplicateTabRequest {
  action: string;
  originalTab?: chrome.tabs.Tab;
}

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((
  request: DuplicateTabRequest, 
  sender: chrome.runtime.MessageSender, 
  sendResponse: (response: any) => void
) => {
  console.log('Content script received message:', request);

  switch (request.action) {
    case 'GET_PAGE_CONTENT':
      sendResponse({ content: extractPageContent() });
      break;

    case 'DUPLICATE_DETECTED':
      if (request.originalTab) {
        showDuplicateNotification(request.originalTab);
      }
      sendResponse({ success: true });
      break;

    default:
      sendResponse({ error: 'Unknown action' });
  }

  // Return true to indicate that the response will be sent asynchronously
  return true;
});

/**
 * Extract the main content from the current page
 * @returns {string} Extracted content
 */
function extractPageContent(): string {
  // Try to extract the main content
  let content = '';

  // Get the main content element if it exists
  const mainElement = document.querySelector('main') || 
                     document.querySelector('article') ||
                     document.querySelector('#content') ||
                     document.querySelector('.content');

  if (mainElement) {
    content = mainElement.innerText;
  } else {
    // Fallback to extracting all text content
    // Exclude some common non-content elements
    const exclusionSelectors = [
      'header', 'footer', 'nav', 'aside',
      '.navigation', '.menu', '.sidebar', '.ads', '.comments',
      'script', 'style', 'noscript'
    ];

    // Clone the body to avoid modifying the actual DOM
    const bodyClone = document.body.cloneNode(true) as HTMLBodyElement;

    // Remove excluded elements from the clone
    exclusionSelectors.forEach(selector => {
      const elements = bodyClone.querySelectorAll(selector);
      elements.forEach(el => el.remove());
    });

    // Get the text content
    content = bodyClone.innerText;
  }

  // Remove extra whitespace
  content = content.replace(/\s+/g, ' ').trim();

  return content;
}

/**
 * Show a notification when a duplicate tab is detected
 * @param {chrome.tabs.Tab} originalTab - The original tab that this tab duplicates
 */
function showDuplicateNotification(originalTab: chrome.tabs.Tab): void {
  // Create a notification element
  const notification = document.createElement('div');
  notification.id = 'psi-tab-mgr-duplicate-notification';
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background-color: #f0f0f0;
    border: 1px solid #ccc;
    border-left: 4px solid #f44336;
    border-radius: 4px;
    padding: 15px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    z-index: 9999;
    max-width: 350px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    transition: opacity 0.3s ease-in-out;
  `;

  notification.innerHTML = `
    <div style="display: flex; align-items: flex-start;">
      <div style="flex-grow: 1;">
        <div style="font-weight: bold; margin-bottom: 8px;">Duplicate Tab Detected</div>
        <div style="margin-bottom: 10px;">
          This page is already open in another tab: 
          <strong>${originalTab.title || 'Untitled'}</strong>
        </div>
        <div style="display: flex; gap: 10px;">
          <button id="psi-tab-mgr-switch-tab" style="
            background-color: #0078d4;
            color: white;
            border: none;
            padding: 5px 10px;
            border-radius: 4px;
            cursor: pointer;
          ">Switch to Tab</button>
          <button id="psi-tab-mgr-close-tab" style="
            background-color: #f44336;
            color: white;
            border: none;
            padding: 5px 10px;
            border-radius: 4px;
            cursor: pointer;
          ">Close This Tab</button>
        </div>
      </div>
      <button id="psi-tab-mgr-dismiss" style="
        background: none;
        border: none;
        font-size: 16px;
        cursor: pointer;
        padding: 0 5px;
        color: #666;
      ">×</button>
    </div>
  `;

  // Add to the page
  document.body.appendChild(notification);

  // Add event listeners
  const switchTabButton = document.getElementById('psi-tab-mgr-switch-tab');
  if (switchTabButton) {
    switchTabButton.addEventListener('click', () => {
      if (originalTab.id) {
        chrome.runtime.sendMessage({
          action: 'FOCUS_TAB',
          tabId: originalTab.id
        });
      }
      closeNotification();
    });
  }

  const closeTabButton = document.getElementById('psi-tab-mgr-close-tab');
  if (closeTabButton) {
    closeTabButton.addEventListener('click', () => {
      chrome.runtime.sendMessage({
        action: 'CLOSE_THIS_TAB'
      });
    });
  }

  const dismissButton = document.getElementById('psi-tab-mgr-dismiss');
  if (dismissButton) {
    dismissButton.addEventListener('click', closeNotification);
  }

  // Auto-hide after 10 seconds
  setTimeout(closeNotification, 10000);

  function closeNotification() {
    notification.style.opacity = '0';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }
}