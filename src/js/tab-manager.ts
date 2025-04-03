/**
 * Tab Manager - Handles tab operations for PsiTabs
 * Provides utilities for querying, manipulating, and organizing tabs
 */

export class TabManager {
  /**
   * Constructor for TabManager
   */
  constructor() {
    // No initialization needed
  }

  /**
   * Get all tabs across all windows
   * @returns {Promise<chrome.tabs.Tab[]>} - Array of all tab objects
   */
  async getAllTabs(): Promise<chrome.tabs.Tab[]> {
    try {
      const tabs = await chrome.tabs.query({});
      return tabs;
    } catch (error) {
      console.error('Error getting all tabs:', error);
      throw error;
    }
  }

  /**
   * Get tabs from a specific window
   * @param {number} windowId - Window ID to get tabs from
   * @returns {Promise<chrome.tabs.Tab[]>} - Array of tab objects in the window
   */
  async getTabsInWindow(windowId: number): Promise<chrome.tabs.Tab[]> {
    try {
      const tabs = await chrome.tabs.query({ windowId });
      return tabs;
    } catch (error) {
      console.error(`Error getting tabs in window ${windowId}:`, error);
      throw error;
    }
  }

  /**
   * Get tabs organized by window
   * @returns {Promise<Record<number, chrome.tabs.Tab[]>>} - Object with windowId keys and arrays of tabs as values
   */
  async getTabsByWindow(): Promise<Record<number, chrome.tabs.Tab[]>> {
    try {
      const allTabs = await this.getAllTabs();
      const windows = await chrome.windows.getAll();

      const tabsByWindow: Record<number, chrome.tabs.Tab[]> = {};

      // Initialize empty arrays for each window
      windows.forEach(window => {
        if (window.id !== undefined) {
          tabsByWindow[window.id] = [];
        }
      });

      // Add tabs to their respective windows
      allTabs.forEach(tab => {
        if (tab.windowId && tabsByWindow[tab.windowId]) {
          tabsByWindow[tab.windowId].push(tab);
        }
      });

      return tabsByWindow;
    } catch (error) {
      console.error('Error getting tabs by window:', error);
      throw error;
    }
  }

  /**
   * Create a new tab
   * @param {chrome.tabs.CreateProperties} createProperties - Properties for the new tab
   * @returns {Promise<chrome.tabs.Tab>} - Created tab object
   */
  async createTab(createProperties: chrome.tabs.CreateProperties): Promise<chrome.tabs.Tab> {
    try {
      const tab = await chrome.tabs.create(createProperties);
      return tab;
    } catch (error) {
      console.error('Error creating tab:', error);
      throw error;
    }
  }

  /**
   * Close a tab
   * @param {number} tabId - ID of the tab to close
   * @returns {Promise<void>}
   */
  async closeTab(tabId: number): Promise<void> {
    try {
      await chrome.tabs.remove(tabId);
    } catch (error) {
      console.error(`Error closing tab ${tabId}:`, error);
      throw error;
    }
  }

  /**
   * Close multiple tabs
   * @param {number[]} tabIds - Array of tab IDs to close
   * @returns {Promise<void>}
   */
  async closeTabs(tabIds: number[]): Promise<void> {
    try {
      await chrome.tabs.remove(tabIds);
    } catch (error) {
      console.error('Error closing multiple tabs:', error);
      throw error;
    }
  }

  /**
   * Update a tab's properties
   * @param {number} tabId - ID of the tab to update
   * @param {chrome.tabs.UpdateProperties} updateProperties - Properties to update
   * @returns {Promise<chrome.tabs.Tab>} - Updated tab object
   */
  async updateTab(tabId: number, updateProperties: chrome.tabs.UpdateProperties): Promise<chrome.tabs.Tab> {
    try {
      const tab = await chrome.tabs.update(tabId, updateProperties);
      return tab! as chrome.tabs.Tab;
    } catch (error) {
      console.error(`Error updating tab ${tabId}:`, error);
      throw error;
    }
  }

  /**
   * Move a tab to a new position
   * @param {number} tabId - ID of the tab to move
   * @param {chrome.tabs.MoveProperties} moveProperties - Properties for the move
   * @returns {Promise<chrome.tabs.Tab>} - Moved tab object
   */
  async moveTab(tabId: number, moveProperties: chrome.tabs.MoveProperties): Promise<chrome.tabs.Tab> {
    try {
      const tab = await chrome.tabs.move(tabId, moveProperties);
      return tab as chrome.tabs.Tab;
    } catch (error) {
      console.error(`Error moving tab ${tabId}:`, error);
      throw error;
    }
  }

  /**
   * Move multiple tabs to new positions
   * @param {number[]} tabIds - Array of tab IDs to move
   * @param {chrome.tabs.MoveProperties} moveProperties - Properties for the move
   * @returns {Promise<chrome.tabs.Tab[]>} - Array of moved tab objects
   */
  async moveTabs(tabIds: number[], moveProperties: chrome.tabs.MoveProperties): Promise<chrome.tabs.Tab[]> {
    try {
      const tabs = await chrome.tabs.move(tabIds, moveProperties);
      return Array.isArray(tabs) ? tabs : [tabs];
    } catch (error) {
      console.error('Error moving multiple tabs:', error);
      throw error;
    }
  }

  /**
   * Reload a tab
   * @param {number} tabId - ID of the tab to reload
   * @param {chrome.tabs.ReloadProperties} [reloadProperties={}] - Properties for the reload
   * @returns {Promise<void>}
   */
  async reloadTab(tabId: number, reloadProperties: chrome.tabs.ReloadProperties = {}): Promise<void> {
    try {
      await chrome.tabs.reload(tabId, reloadProperties);
    } catch (error) {
      console.error(`Error reloading tab ${tabId}:`, error);
      throw error;
    }
  }

  /**
   * Duplicate a tab
   * @param {number} tabId - ID of the tab to duplicate
   * @returns {Promise<chrome.tabs.Tab>} - Duplicated tab object
   */
  async duplicateTab(tabId: number): Promise<chrome.tabs.Tab> {
    try {
      const tab = await chrome.tabs.duplicate(tabId);
      if (!tab) {
        throw new Error(`Failed to duplicate tab ${tabId}`);
      }
      return tab as chrome.tabs.Tab;
    } catch (error) {
      console.error(`Error duplicating tab ${tabId}:`, error);
      throw error;
    }
  }

  /**
   * Focus a specific tab
   * @param {number} tabId - ID of the tab to focus
   * @returns {Promise<void>}
   */
  async focusTab(tabId: number): Promise<void> {
    try {
      await chrome.tabs.update(tabId, { active: true });

      // Also focus the window containing the tab
      const tab = await chrome.tabs.get(tabId);
      if (tab.windowId) {
        await chrome.windows.update(tab.windowId, { focused: true });
      }
    } catch (error) {
      console.error(`Error focusing tab ${tabId}:`, error);
      throw error;
    }
  }

  /**
   * Sort tabs in a window by title, maintaining tabs within their groups
   * @param {number} windowId - ID of the window containing tabs to sort
   * @returns {Promise<chrome.tabs.Tab[]>} - Array of sorted tab objects
   */
  async sortTabsByTitle(windowId: number): Promise<chrome.tabs.Tab[]> {
    try {
      const tabs = await this.getTabsInWindow(windowId);

      // Separate tabs by group ID
      const tabsByGroup = new Map<number | undefined, chrome.tabs.Tab[]>();

      // Group for ungrouped tabs
      tabsByGroup.set(undefined, []);

      // Categorize tabs by their group
      tabs.forEach(tab => {
        const groupId = tab.groupId;
        if (!tabsByGroup.has(groupId)) {
          tabsByGroup.set(groupId, []);
        }
        tabsByGroup.get(groupId)?.push(tab);
      });

      // Sort tabs within each group by title
      tabsByGroup.forEach((groupTabs, groupId) => {
        groupTabs.sort((a, b) => {
          const titleA = a.title || '';
          const titleB = b.title || '';
          return titleA.localeCompare(titleB);
        });
      });

      // Get all group IDs except undefined (for ungrouped tabs)
      const groupIds = Array.from(tabsByGroup.keys()).filter(id => id !== undefined);

      // Move each tab to its new position, maintaining group structure
      const movedTabs: chrome.tabs.Tab[] = [];
      let currentIndex = 0;

      // First, handle ungrouped tabs
      const ungroupedTabs = tabsByGroup.get(undefined) || [];
      for (const tab of ungroupedTabs) {
        if (tab.id !== undefined) {
          const movedTab = await this.moveTab(tab.id, { index: currentIndex++ });
          movedTabs.push(movedTab);
        }
      }

      // Then, handle each group of tabs
      for (const groupId of groupIds) {
        const groupTabs = tabsByGroup.get(groupId) || [];
        for (const tab of groupTabs) {
          if (tab.id !== undefined) {
            const movedTab = await this.moveTab(tab.id, { index: currentIndex++ });
            movedTabs.push(movedTab);
          }
        }
      }

      return movedTabs;
    } catch (error) {
      console.error(`Error sorting tabs in window ${windowId}:`, error);
      throw error;
    }
  }

  /**
   * Sort tabs in a window by URL, maintaining tabs within their groups
   * @param {number} windowId - ID of the window containing tabs to sort
   * @returns {Promise<chrome.tabs.Tab[]>} - Array of sorted tab objects
   */
  async sortTabsByUrl(windowId: number): Promise<chrome.tabs.Tab[]> {
    try {
      const tabs = await this.getTabsInWindow(windowId);

      // Separate tabs by group ID
      const tabsByGroup = new Map<number | undefined, chrome.tabs.Tab[]>();

      // Group for ungrouped tabs
      tabsByGroup.set(undefined, []);

      // Categorize tabs by their group
      tabs.forEach(tab => {
        const groupId = tab.groupId;
        if (!tabsByGroup.has(groupId)) {
          tabsByGroup.set(groupId, []);
        }
        tabsByGroup.get(groupId)?.push(tab);
      });

      // Sort tabs within each group by URL
      tabsByGroup.forEach((groupTabs, groupId) => {
        groupTabs.sort((a, b) => {
          const urlA = a.url || '';
          const urlB = b.url || '';
          return urlA.localeCompare(urlB);
        });
      });

      // Get all group IDs except undefined (for ungrouped tabs)
      const groupIds = Array.from(tabsByGroup.keys()).filter(id => id !== undefined);

      // Move each tab to its new position, maintaining group structure
      const movedTabs: chrome.tabs.Tab[] = [];
      let currentIndex = 0;

      // First, handle ungrouped tabs
      const ungroupedTabs = tabsByGroup.get(undefined) || [];
      for (const tab of ungroupedTabs) {
        if (tab.id !== undefined) {
          const movedTab = await this.moveTab(tab.id, { index: currentIndex++ });
          movedTabs.push(movedTab);
        }
      }

      // Then, handle each group of tabs
      for (const groupId of groupIds) {
        const groupTabs = tabsByGroup.get(groupId) || [];
        for (const tab of groupTabs) {
          if (tab.id !== undefined) {
            const movedTab = await this.moveTab(tab.id, { index: currentIndex++ });
            movedTabs.push(movedTab);
          }
        }
      }

      return movedTabs;
    } catch (error) {
      console.error(`Error sorting tabs in window ${windowId}:`, error);
      throw error;
    }
  }

  /**
   * Sort tabs in a window by access time (most recent first), maintaining tabs within their groups
   * @param {number} windowId - ID of the window containing tabs to sort
   * @returns {Promise<chrome.tabs.Tab[]>} - Array of sorted tab objects
   */
  async sortTabsByRecent(windowId: number): Promise<chrome.tabs.Tab[]> {
    try {
      const tabs = await this.getTabsInWindow(windowId);

      // Separate tabs by group ID
      const tabsByGroup = new Map<number | undefined, chrome.tabs.Tab[]>();

      // Group for ungrouped tabs
      tabsByGroup.set(undefined, []);

      // Categorize tabs by their group
      tabs.forEach(tab => {
        const groupId = tab.groupId;
        if (!tabsByGroup.has(groupId)) {
          tabsByGroup.set(groupId, []);
        }
        tabsByGroup.get(groupId)?.push(tab);
      });

      // Define a type that includes the Chrome tab with the optional lastAccessed property
      interface ExtendedTab extends chrome.tabs.Tab {
        lastAccessed?: number;
      }

      // Sort tabs within each group by recent activity
      tabsByGroup.forEach((groupTabs, groupId) => {
        groupTabs.sort((a, b) => {
          const aExtended = a as ExtendedTab;
          const bExtended = b as ExtendedTab;

          // First, sort by active state (active tab first)
          if (a.active && !b.active) return -1;
          if (!a.active && b.active) return 1;

          // If lastAccessed is available, use it
          if (aExtended.lastAccessed && bExtended.lastAccessed) {
            return (bExtended.lastAccessed || 0) - (aExtended.lastAccessed || 0);
          }

          // Fallback to index (position in the window)
          return (a.index || 0) - (b.index || 0);
        });
      });

      // Get all group IDs except undefined (for ungrouped tabs)
      const groupIds = Array.from(tabsByGroup.keys()).filter(id => id !== undefined);

      // Move each tab to its new position, maintaining group structure
      const movedTabs: chrome.tabs.Tab[] = [];
      let currentIndex = 0;

      // First, handle ungrouped tabs
      const ungroupedTabs = tabsByGroup.get(undefined) || [];
      for (const tab of ungroupedTabs) {
        if (tab.id !== undefined) {
          const movedTab = await this.moveTab(tab.id, { index: currentIndex++ });
          movedTabs.push(movedTab);
        }
      }

      // Then, handle each group of tabs
      for (const groupId of groupIds) {
        const groupTabs = tabsByGroup.get(groupId) || [];
        for (const tab of groupTabs) {
          if (tab.id !== undefined) {
            const movedTab = await this.moveTab(tab.id, { index: currentIndex++ });
            movedTabs.push(movedTab);
          }
        }
      }

      return movedTabs;
    } catch (error) {
      console.error(`Error sorting tabs in window ${windowId}:`, error);
      throw error;
    }
  }

  /**
   * Get the favicon URL for a tab
   * @param {chrome.tabs.Tab} tab - Tab object
   * @returns {string} - URL of the favicon
   */
  getFaviconUrl(tab: chrome.tabs.Tab): string {
    // If tab has a favIconUrl, use it
    if (tab.favIconUrl) {
      return tab.favIconUrl;
    }

    // Otherwise, generate a favicon URL using the domain
    try {
      if (tab.url) {
        const url = new URL(tab.url);
        return `https://www.google.com/s2/favicons?domain=${url.hostname}`;
      }
      // Return a default favicon if the URL is missing
      return 'images/icon.svg';
    } catch (error) {
      // Return a default favicon if the URL is invalid
      return 'images/icon.svg';
    }
  }

  /**
   * Extract the domain from a URL
   * @param {string} url - URL to extract domain from
   * @returns {string} - Domain of the URL
   */
  getDomainFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      let domain = urlObj.hostname;

      // Remove 'www.' prefix if present
      if (domain.startsWith('www.')) {
        domain = domain.slice(4);
      }

      return domain;
    } catch (error) {
      console.error('Error extracting domain from URL:', error);
      return '';
    }
  }

  /**
   * Get a readable title for a window
   * @param {chrome.windows.Window} window - Window object
   * @param {number} index - Index of the window in the list
   * @returns {string} - Readable title for the window
   */
  getWindowTitle(window: chrome.windows.Window, index: number): string {
    if (window.incognito) {
      return `Incognito Window ${index + 1}`;
    } else {
      return `Window ${index + 1}`;
    }
  }
}