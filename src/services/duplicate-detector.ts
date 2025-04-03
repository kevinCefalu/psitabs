/**
 * Duplicate Detector - Identifies and manages duplicate tabs
 * Uses various criteria to determine duplicate status
 */

// Export the DuplicateGroup interface so it can be imported elsewhere
export interface DuplicateGroup {
  original: chrome.tabs.Tab;
  duplicates: chrome.tabs.Tab[];
}

interface MergeResult {
  originalTab: chrome.tabs.Tab;
  closedCount: number;
}

export class DuplicateDetector {
  /**
   * Constructor for DuplicateDetector
   */
  constructor() {
    // No initialization needed
  }

  /**
   * Find duplicate tabs across all windows
   * @returns {Promise<DuplicateGroup[]>} - Array of duplicate groups, where each group has an original tab and its duplicates
   */
  async findDuplicatesAcrossWindows(): Promise<DuplicateGroup[]> {
    try {
      const allTabs = await chrome.tabs.query({});
      const duplicateGroups = this.identifyDuplicateGroups(allTabs);
      return duplicateGroups;
    } catch (error) {
      console.error('Error finding duplicates across windows:', error);
      throw error;
    }
  }

  /**
   * Find duplicate tabs within a specific window
   * @param {number} windowId - ID of the window to check for duplicates
   * @returns {Promise<DuplicateGroup[]>} - Array of duplicate groups in the window
   */
  async findDuplicatesInWindow(windowId: number): Promise<DuplicateGroup[]> {
    try {
      const tabs = await chrome.tabs.query({ windowId });
      const duplicateGroups = this.identifyDuplicateGroups(tabs);
      return duplicateGroups;
    } catch (error) {
      console.error(`Error finding duplicates in window ${windowId}:`, error);
      throw error;
    }
  }

  /**
   * Find all duplicates of a specific tab
   * @param {number} tabId - ID of the tab to find duplicates for
   * @returns {Promise<chrome.tabs.Tab[]>} - Array of tabs that are duplicates of the specified tab
   */
  async findDuplicatesForTab(tabId: number): Promise<chrome.tabs.Tab[]> {
    try {
      const tab = await chrome.tabs.get(tabId);
      const allTabs = await chrome.tabs.query({});

      // Filter out the target tab itself
      const otherTabs = allTabs.filter(t => t.id !== tabId);

      // Find duplicates of the target tab
      const duplicates = otherTabs.filter(t => this.areTabsDuplicate(tab, t));

      return duplicates;
    } catch (error) {
      console.error(`Error finding duplicates for tab ${tabId}:`, error);
      throw error;
    }
  }

  /**
   * Identify groups of duplicate tabs from an array of tabs
   * @param {chrome.tabs.Tab[]} tabs - Array of tab objects to check for duplicates
   * @returns {DuplicateGroup[]} - Array of duplicate groups, where each group has an original tab and its duplicates
   */
  identifyDuplicateGroups(tabs: chrome.tabs.Tab[]): DuplicateGroup[] {
    // Map to track which tabs have been assigned to a duplicate group
    const assignedTabs = new Set<number>();

    // Array to hold the duplicate groups
    const duplicateGroups: DuplicateGroup[] = [];

    // Process each tab
    for (let i = 0; i < tabs.length; i++) {
      const tab = tabs[i];

      // Skip tabs that have already been assigned to a duplicate group or don't have an ID
      if (!tab.id || assignedTabs.has(tab.id)) {
        continue;
      }

      // Array to hold duplicates of the current tab
      const duplicates: chrome.tabs.Tab[] = [];

      // Check all other unassigned tabs for duplicates
      for (let j = 0; j < tabs.length; j++) {
        const otherTab = tabs[j];

        // Skip the current tab itself and tabs that have already been assigned or don't have an ID
        if (!otherTab.id || otherTab.id === tab.id || assignedTabs.has(otherTab.id)) {
          continue;
        }

        // Check if the tabs are duplicates
        if (this.areTabsDuplicate(tab, otherTab)) {
          duplicates.push(otherTab);
          assignedTabs.add(otherTab.id);
        }
      }

      // If duplicates were found, create a duplicate group
      if (duplicates.length > 0) {
        duplicateGroups.push({
          original: tab,
          duplicates: duplicates
        });

        // Mark the original tab as assigned
        assignedTabs.add(tab.id);
      }
    }

    return duplicateGroups;
  }

  /**
   * Check if two tabs are duplicates based on URL comparison
   * @param {chrome.tabs.Tab} tab1 - First tab to compare
   * @param {chrome.tabs.Tab} tab2 - Second tab to compare
   * @returns {boolean} - Whether the tabs are duplicates
   */
  areTabsDuplicate(tab1: chrome.tabs.Tab, tab2: chrome.tabs.Tab): boolean {
    // Skip tabs without URLs
    if (!tab1.url || !tab2.url) {
      return false;
    }

    // Skip chrome:// and edge:// URLs as they are system pages
    if (tab1.url.startsWith('chrome://') || tab1.url.startsWith('edge://') ||
        tab2.url.startsWith('chrome://') || tab2.url.startsWith('edge://')) {
      return false;
    }

    // Skip new tab pages
    if (tab1.url === 'about:blank' || tab2.url === 'about:blank' ||
        tab1.url === 'chrome://newtab/' || tab2.url === 'chrome://newtab/' ||
        tab1.url === 'edge://newtab/' || tab2.url === 'edge://newtab/') {
      return false;
    }

    // Compare the normalized URLs
    return this.normalizeUrl(tab1.url) === this.normalizeUrl(tab2.url);
  }

  /**
   * Normalize a URL for comparison purposes
   * @param {string} url - URL to normalize
   * @returns {string} - Normalized URL
   */
  normalizeUrl(url: string): string {
    try {
      // Create a URL object to parse the URL
      const urlObj = new URL(url);

      // Convert hostname to lowercase
      let normalized = urlObj.protocol + '//' + urlObj.hostname.toLowerCase();

      // Add port if it's not the default for the protocol
      if (urlObj.port &&
          !(urlObj.protocol === 'http:' && urlObj.port === '80') &&
          !(urlObj.protocol === 'https:' && urlObj.port === '443')) {
        normalized += ':' + urlObj.port;
      }

      // Add pathname
      normalized += urlObj.pathname;

      // Add search parameters (query string)
      if (urlObj.search) {
        // Sort the search parameters to ensure consistent ordering
        const searchParams = new URLSearchParams(urlObj.search);
        const sortedParams = Array.from(searchParams.entries()).sort();

        const sortedSearchParams = new URLSearchParams();
        for (const [key, value] of sortedParams) {
          sortedSearchParams.append(key, value);
        }

        normalized += '?' + sortedSearchParams.toString();
      }

      // Optional: Ignore hash (fragment identifier) as it often just points to a section on the same page
      // If you want to include the hash, uncomment the line below
      // normalized += urlObj.hash;

      return normalized;
    } catch (error) {
      console.error('Error normalizing URL:', error);
      return url; // Return the original URL if normalization fails
    }
  }

  /**
   * Close all duplicate tabs, keeping only the original
   * @param {DuplicateGroup[]} duplicateGroups - Array of duplicate groups to process
   * @returns {Promise<number[]>} - Array of closed tab IDs
   */
  async closeDuplicates(duplicateGroups: DuplicateGroup[]): Promise<number[]> {
    try {
      const closedTabIds: number[] = [];

      for (const group of duplicateGroups) {
        // Get IDs of all duplicate tabs in the group
        const duplicateIds = group.duplicates
          .map(tab => tab.id)
          .filter((id): id is number => id !== undefined);

        if (duplicateIds.length === 0) continue;

        // Close all duplicate tabs
        await chrome.tabs.remove(duplicateIds);

        // Add the closed tab IDs to the result array
        closedTabIds.push(...duplicateIds);
      }

      return closedTabIds;
    } catch (error) {
      console.error('Error closing duplicates:', error);
      throw error;
    }
  }

  /**
   * Group duplicate tabs together in tab groups
   * @param {DuplicateGroup[]} duplicateGroups - Array of duplicate groups to process
   * @returns {Promise<number[]>} - Array of created tab group IDs
   */
  async groupDuplicates(duplicateGroups: DuplicateGroup[]): Promise<number[]> {
    try {
      const createdGroupIds: number[] = [];

      for (const group of duplicateGroups) {
        // Skip if there are no duplicates
        if (group.duplicates.length === 0 || !group.original.id) {
          continue;
        }

        // Get IDs of all tabs in the group, including the original
        const tabIds = [group.original.id, ...group.duplicates
          .map(tab => tab.id)
          .filter((id): id is number => id !== undefined)];

        if (tabIds.length <= 1) continue;

        // Create a title for the group based on the original tab's domain
        const url = new URL(group.original.url || '');
        let domain = url.hostname;

        // Remove 'www.' prefix if present
        if (domain.startsWith('www.')) {
          domain = domain.slice(4);
        }

        // Create a tab group for the duplicate tabs
        const groupId = await chrome.tabs.group({ tabIds });

        // Update the tab group's properties
        await chrome.tabGroups.update(groupId, {
          title: domain,
          color: 'red' // Highlight duplicate groups with red color
        });

        createdGroupIds.push(groupId);
      }

      return createdGroupIds;
    } catch (error) {
      console.error('Error grouping duplicates:', error);
      throw error;
    }
  }

  /**
   * Merge duplicate tabs by creating a tab group and closing all but the original tab
   * @param {DuplicateGroup[]} duplicateGroups - Array of duplicate groups to process
   * @returns {Promise<MergeResult[]>} - Array of processed group results
   */
  async mergeDuplicates(duplicateGroups: DuplicateGroup[]): Promise<MergeResult[]> {
    try {
      const results: MergeResult[] = [];

      for (const group of duplicateGroups) {
        // Skip if there are no duplicates
        if (group.duplicates.length === 0) {
          continue;
        }

        // Get IDs of all duplicate tabs in the group
        const duplicateIds = group.duplicates
          .map(tab => tab.id)
          .filter((id): id is number => id !== undefined);

        if (duplicateIds.length === 0) continue;

        // Close all duplicate tabs
        await chrome.tabs.remove(duplicateIds);

        results.push({
          originalTab: group.original,
          closedCount: duplicateIds.length
        });
      }

      return results;
    } catch (error) {
      console.error('Error merging duplicates:', error);
      throw error;
    }
  }
}