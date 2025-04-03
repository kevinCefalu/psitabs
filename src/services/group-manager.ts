/**
 * Group Manager - Manages tab groups in the browser
 * Provides functionality for creating, updating, and managing tab groups
 */

// Import the LLM service for topic-based grouping
import { LLMService } from './llm-service';

// Define missing Chrome API type definitions
declare namespace chrome {
  namespace events {
    interface Event<T extends Function> {
      addListener(callback: T): void;
      removeListener(callback: T): void;
      hasListener(callback: T): boolean;
    }
  }

  namespace windows {
    const WINDOW_ID_CURRENT: number;
    function update(windowId: number, updateInfo: { focused: boolean }): Promise<chrome.windows.Window>;
    interface Window {
      id?: number;
      focused: boolean;
      incognito: boolean;
      tabs?: chrome.tabs.Tab[];
    }
  }

  namespace tabGroups {
    type Color = 'grey' | 'blue' | 'red' | 'yellow' | 'green' | 'pink' | 'purple' | 'cyan' | 'orange';

    interface TabGroup {
      id: number;
      windowId: number;
      title?: string;
      color: Color;
      collapsed: boolean;
    }

    interface UpdateProperties {
      collapsed?: boolean;
      color?: Color;
      title?: string;
    }

    interface TabGroupRemovedEvent extends chrome.events.Event<(groupId: number, removeInfo: TabGroupRemovedEventDetail) => void> {}

    interface TabGroupRemovedEventDetail {
      windowId: number;
    }

    const TAB_GROUP_ID_NONE: number;

    function query(queryInfo: { windowId?: number }): Promise<TabGroup[]>;
    function update(groupId: number, updateProperties: UpdateProperties): Promise<TabGroup>;
    function move(groupId: number, moveProperties: { index: number }): Promise<TabGroup>;
  }

  namespace tabs {
    interface Tab {
      id?: number;
      index: number;
      windowId?: number;
      url?: string;
      title?: string;
      favIconUrl?: string;
      active: boolean;
      pinned: boolean;
      groupId?: number;
      lastAccessed?: number;
    }

    interface QueryInfo {
      windowId?: number;
      groupId?: number;
      active?: boolean;
      currentWindow?: boolean;
      [key: string]: any;
    }

    function group(options: { tabIds: number[], groupId?: number }): Promise<number>;
    function ungroup(tabIds: number[]): Promise<void>;
    function query(queryInfo: QueryInfo): Promise<Tab[]>;
    function get(tabId: number): Promise<Tab>;
    function remove(tabIds: number | number[]): Promise<void>;
  }
}

interface GroupOptions {
  title?: string;
  color?: chrome.tabGroups.Color;
  collapsed?: boolean;
}

export class GroupManager {
  llmService: LLMService;

  /**
   * Constructor for GroupManager
   */
  constructor() {
    this.llmService = new LLMService();
  }

  /**
   * Get all tab groups in the browser
   * @returns {Promise<chrome.tabGroups.TabGroup[]>} - Array of tab group objects
   */
  async getAllGroups(): Promise<chrome.tabGroups.TabGroup[]> {
    try {
      const allGroups = await chrome.tabGroups.query({});
      return allGroups;
    } catch (error) {
      console.error('Error getting all groups:', error);
      throw error;
    }
  }

  /**
   * Get groups in a specific window
   * @param {number} windowId - ID of the window to get groups from
   * @returns {Promise<chrome.tabGroups.TabGroup[]>} - Array of tab group objects in the window
   */
  async getGroupsInWindow(windowId: number): Promise<chrome.tabGroups.TabGroup[]> {
    try {
      const groups = await chrome.tabGroups.query({ windowId });
      return groups;
    } catch (error) {
      console.error(`Error getting groups in window ${windowId}:`, error);
      throw error;
    }
  }

  /**
   * Get tabs in a specific group
   * @param {number} groupId - ID of the group to get tabs from
   * @returns {Promise<chrome.tabs.Tab[]>} - Array of tab objects in the group
   */
  async getTabsInGroup(groupId: number): Promise<chrome.tabs.Tab[]> {
    try {
      const tabs = await chrome.tabs.query({ groupId });
      return tabs;
    } catch (error) {
      console.error(`Error getting tabs in group ${groupId}:`, error);
      throw error;
    }
  }

  /**
   * Create a new tab group with the specified tabs
   * @param {number[]} tabIds - Array of tab IDs to include in the group
   * @param {GroupOptions} options - Options for the new group
   * @returns {Promise<number>} - ID of the created group
   */
  async createGroup(tabIds: number[], options: GroupOptions = {}): Promise<number> {
    try {
      if (!tabIds || tabIds.length === 0) {
        throw new Error('No tabs specified for group creation');
      }

      // Group the tabs
      const groupId = await chrome.tabs.group({ tabIds });

      // Update the group properties if options are provided
      if (options.title || options.color) {
        const updateProps: chrome.tabGroups.UpdateProperties = {};
        if (options.title) updateProps.title = options.title;
        if (options.color) updateProps.color = options.color;

        await chrome.tabGroups.update(groupId, updateProps);
      }

      return groupId;
    } catch (error) {
      console.error('Error creating group:', error);
      throw error;
    }
  }

  /**
   * Handle tabs with potentially undefined IDs in tab group management
   * @param {number} groupId - The group ID
   * @param {chrome.tabs.Tab[]} tabs - Array of tabs
   * @returns {Promise<void>}
   */
  async addTabsToGroup(groupId: number, tabIds: number[]): Promise<void> {
    try {
      if (!tabIds || tabIds.length === 0) {
        throw new Error('No tabs specified to add to group');
      }

      // Filter out any undefined tab IDs
      const validTabIds = tabIds.filter((id): id is number => id !== undefined);

      if (validTabIds.length === 0) {
        throw new Error('No valid tab IDs specified to add to group');
      }

      await chrome.tabs.group({ tabIds: validTabIds, groupId });
    } catch (error) {
      console.error(`Error adding tabs to group ${groupId}:`, error);
      throw error;
    }
  }

  /**
   * Remove tabs from their current group
   * @param {number[]} tabIds - Array of tab IDs to ungroup
   * @returns {Promise<void>}
   */
  async ungroupTabs(tabIds: number[]): Promise<void> {
    try {
      if (!tabIds || tabIds.length === 0) {
        throw new Error('No tabs specified for ungrouping');
      }

      await chrome.tabs.ungroup(tabIds);
    } catch (error) {
      console.error('Error ungrouping tabs:', error);
      throw error;
    }
  }

  /**
   * Update a tab group's properties
   * @param {number} groupId - ID of the group to update
   * @param {chrome.tabGroups.UpdateProperties} properties - Properties to update
   * @returns {Promise<chrome.tabGroups.TabGroup>} - Updated group object
   */
  async updateGroup(groupId: number, properties: chrome.tabGroups.UpdateProperties): Promise<chrome.tabGroups.TabGroup> {
    try {
      if (!properties || Object.keys(properties).length === 0) {
        throw new Error('No properties specified for group update');
      }

      const updatedGroup = await chrome.tabGroups.update(groupId, properties);
      return updatedGroup;
    } catch (error) {
      console.error(`Error updating group ${groupId}:`, error);
      throw error;
    }
  }

  /**
   * Move a tab group to a specific position in the window
   * @param {number} groupId - ID of the group to move
   * @param {number} index - Position to move the group to
   * @returns {Promise<chrome.tabGroups.TabGroup>} - Moved group object
   */
  async moveGroup(groupId: number, index: number): Promise<chrome.tabGroups.TabGroup> {
    try {
      const movedGroup = await chrome.tabGroups.move(groupId, { index });
      return movedGroup;
    } catch (error) {
      console.error(`Error moving group ${groupId}:`, error);
      throw error;
    }
  }

  /**
   * Group a tab by its domain
   * @param {number} tabId - ID of the tab to group
   * @returns {Promise<number|null>} - ID of the created or updated group, or null if no grouping was performed
   */
  async groupTabByDomain(tabId: number): Promise<number | null> {
    try {
      // Get the tab
      const tab = await chrome.tabs.get(tabId);

      // Skip if the tab is already in a group or is a special page
      if (tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE ||
          !tab.url ||
          tab.url.startsWith('chrome://') ||
          tab.url.startsWith('edge://') ||
          tab.url === 'about:blank') {
        return null;
      }

      // Extract the domain
      const url = new URL(tab.url);
      let domain = url.hostname;

      // Remove 'www.' prefix if present
      if (domain.startsWith('www.')) {
        domain = domain.slice(4);
      }

      // Look for existing groups with the same domain
      const window = tab.windowId;
      const groups = await this.getGroupsInWindow(window!);

      for (const group of groups) {
        if (group.title === domain) {
          // Found a matching group, add the tab to it
          await this.addTabsToGroup(group.id, [tabId]);
          return group.id;
        }
      }

      // Check if there are other tabs with the same domain
      const windowTabs = await chrome.tabs.query({ windowId: window });
      const sameDomainTabs = windowTabs.filter(t => {
        if (!t.url || t.id === tabId || t.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
          return false;
        }

        try {
          const tUrl = new URL(t.url);
          let tDomain = tUrl.hostname;

          if (tDomain.startsWith('www.')) {
            tDomain = tDomain.slice(4);
          }

          return tDomain === domain;
        } catch {
          return false;
        }
      });

      if (sameDomainTabs.length > 0) {
        // Create a new group with all tabs from the same domain
        const groupTabIds = [tabId, ...sameDomainTabs.map(t => t.id)]
          .filter((id): id is number => id !== undefined);

        const groupId = await this.createGroup(groupTabIds, {
          title: domain,
          color: this.getRandomColor()
        });

        return groupId;
      }

      // No other tabs with the same domain, don't create a group for a single tab
      return null;
    } catch (error) {
      console.error(`Error grouping tab ${tabId} by domain:`, error);
      throw error;
    }
  }

  /**
   * Group tabs by domain
   * @param {number[]} tabIds - Array of tab IDs to group
   * @returns {Promise<{message: string}>} - Result of the grouping operation
   */
  async groupTabsByDomain(tabIds: number[]): Promise<{message: string}> {
    try {
      // Get the tabs
      const tabsPromises = tabIds.map(id => chrome.tabs.get(id));
      const tabs = await Promise.all(tabsPromises);

      // Group tabs by domain
      const domainGroups: Record<string, number[]> = {};

      for (const tab of tabs) {
        // Skip tabs that are already in a group or are special pages
        if (tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE ||
            !tab.url ||
            tab.url.startsWith('chrome://') ||
            tab.url.startsWith('edge://') ||
            tab.url === 'about:blank') {
          continue;
        }

        try {
          const url = new URL(tab.url);
          let domain = url.hostname;

          // Remove 'www.' prefix if present
          if (domain.startsWith('www.')) {
            domain = domain.slice(4);
          }

          if (!domainGroups[domain]) {
            domainGroups[domain] = [];
          }

          if (tab.id !== undefined) {
            domainGroups[domain].push(tab.id);
          }
        } catch (error) {
          console.warn(`Skipping tab with invalid URL: ${tab.url}`);
        }
      }

      // Create groups for domains with more than one tab
      const createdGroups = [];

      for (const [domain, groupTabIds] of Object.entries(domainGroups)) {
        if (groupTabIds.length > 1) {
          // Create a group for the domain
          const groupId = await this.createGroup(groupTabIds, {
            title: domain,
            color: this.getRandomColor()
          });

          createdGroups.push({ domain, count: groupTabIds.length, groupId });
        }
      }

      if (createdGroups.length === 0) {
        return { message: 'No groups were created. There were no domains with multiple tabs.' };
      }

      return {
        message: `Created ${createdGroups.length} groups based on domain.`
      };
    } catch (error) {
      console.error('Error grouping tabs by domain:', error);
      throw error;
    }
  }

  /**
   * Group tabs by their topics using the LLM service
   * @param {number[]} tabIds - Array of tab IDs to group
   * @returns {Promise<any[]>} - Array of created groups
   */
  async groupTabsByTopic(tabIds: number[]): Promise<any[]> {
    try {
      // Analyze the tabs using the LLM service
      const tabGroups = await this.llmService.suggestTabGroups(tabIds);

      // Create groups based on the suggestions
      const createdGroups = [];

      for (const group of tabGroups) {
        if (group.tabIds.length > 1) {
          const groupId = await this.createGroup(group.tabIds, {
            title: group.name,
            color: group.color || this.getRandomColor()
          });

          createdGroups.push({
            id: groupId,
            name: group.name,
            tabCount: group.tabIds.length
          });
        }
      }

      return createdGroups;
    } catch (error) {
      console.error('Error grouping tabs by topic:', error);
      throw error;
    }
  }

  /**
   * Group tabs similar to a reference tab
   * @param {number} referenceTabId - ID of the reference tab
   * @returns {Promise<number|null>} - ID of the created group, or null if no group was created
   */
  async groupSimilarTabs(referenceTabId: number): Promise<number | null> {
    try {
      // Get the reference tab
      const tab = await chrome.tabs.get(referenceTabId);

      // Skip if the tab is a special page
      if (!tab.url ||
          tab.url.startsWith('chrome://') ||
          tab.url.startsWith('edge://') ||
          tab.url === 'about:blank') {
        return null;
      }

      // Find similar tabs using the LLM service
      const similarTabIds = await this.llmService.findSimilarTabs(referenceTabId);

      // Include the reference tab if it's not already in the group
      if (!similarTabIds.includes(referenceTabId)) {
        similarTabIds.unshift(referenceTabId);
      }

      // Create a group if there are multiple tabs
      if (similarTabIds.length > 1) {
        // Use the domain of the reference tab as the default title
        const url = new URL(tab.url);
        let domain = url.hostname;

        if (domain.startsWith('www.')) {
          domain = domain.slice(4);
        }

        // Create a group for the similar tabs
        const groupId = await this.createGroup(similarTabIds, {
          title: domain,
          color: this.getRandomColor()
        });

        return groupId;
      }

      return null;
    } catch (error) {
      console.error(`Error grouping tabs similar to ${referenceTabId}:`, error);
      throw error;
    }
  }

  /**
   * Group tabs by URL pattern using regex
   * @param {string} pattern - Regex pattern to match URLs
   * @param {string} groupTitle - Title for the created group
   * @param {number | null} windowId - ID of the window to group tabs in, or null for the current window
   * @returns {Promise<number|null>} - ID of the created group, or null if no group was created
   */
  async groupByUrlPattern(
    pattern: string,
    groupTitle: string,
    windowId: number | null = null
  ): Promise<number | null> {
    try {
      // Create a RegExp object from the pattern
      const regex = new RegExp(pattern);

      // Get tabs in the specified window
      const tabs = await chrome.tabs.query(windowId ? { windowId } : { currentWindow: true });

      // Skip tabs that are already in a group or are special pages
      const eligibleTabs = tabs.filter(tab =>
        tab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE &&
        tab.url &&
        !tab.url.startsWith('chrome://') &&
        !tab.url.startsWith('edge://') &&
        tab.url !== 'about:blank'
      );

      // Find tabs that match the pattern
      const matchingTabIds = eligibleTabs
        .filter(tab => regex.test(tab.url || ''))
        .map(tab => tab.id)
        .filter((id): id is number => id !== undefined);

      // Create a group if there are matching tabs
      if (matchingTabIds.length > 0) {
        const groupId = await this.createGroup(matchingTabIds, {
          title: groupTitle,
          color: this.getRandomColor()
        });

        return groupId;
      }

      return null;
    } catch (error) {
      console.error('Error grouping tabs by URL pattern:', error);
      throw error;
    }
  }

  /**
   * Group tabs by their creation time
   * @param {number} timeWindowInMinutes - Time window in minutes to group tabs by
   * @param {number | null} windowId - ID of the window to group tabs in, or null for the current window
   * @returns {Promise<number[]>} - Array of created group IDs
   */
  async groupByCreationTime(
    timeWindowInMinutes: number,
    windowId: number | null = null
  ): Promise<number[]> {
    try {
      // Get tabs in the specified window
      const tabs = await chrome.tabs.query(windowId ? { windowId } : { currentWindow: true });

      // Skip tabs that are already in a group
      const eligibleTabs = tabs.filter(tab =>
        tab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE
      );

      if (eligibleTabs.length <= 1) {
        return []; // Not enough tabs to group
      }

      // Sort tabs by creation time
      eligibleTabs.sort((a, b) => (a.id || 0) - (b.id || 0)); // Tab IDs are often correlated with creation time

      // Group tabs by time windows
      const timeGroups: chrome.tabs.Tab[][] = [];
      let currentGroup = [eligibleTabs[0]];

      for (let i = 1; i < eligibleTabs.length; i++) {
        const tab = eligibleTabs[i];
        const prevTab = currentGroup[currentGroup.length - 1];

        // Use tab ID difference as a proxy for time difference
        // This isn't perfect, but tab IDs are generally assigned sequentially
        const idDiff = (tab.id || 0) - (prevTab.id || 0);
        const approxTimeDiff = idDiff * 0.1; // Rough approximation

        if (approxTimeDiff <= timeWindowInMinutes * 60) {
          // Tab was created within the time window, add to current group
          currentGroup.push(tab);
        } else {
          // Tab was created outside the time window, start a new group
          if (currentGroup.length > 1) {
            timeGroups.push(currentGroup);
          }
          currentGroup = [tab];
        }
      }

      // Add the last group if it has more than one tab
      if (currentGroup.length > 1) {
        timeGroups.push(currentGroup);
      }

      // Create groups
      const createdGroupIds: number[] = [];

      for (let i = 0; i < timeGroups.length; i++) {
        const groupTabs = timeGroups[i];
        const tabIds = groupTabs
          .map(tab => tab.id)
          .filter((id): id is number => id !== undefined);

        if (tabIds.length <= 1) continue;

        // Format time for the group title
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // Create a group
        const groupId = await this.createGroup(tabIds, {
          title: `Group ${i + 1} (${timestamp})`,
          color: this.getRandomColor()
        });

        createdGroupIds.push(groupId);
      }

      return createdGroupIds;
    } catch (error) {
      console.error('Error grouping tabs by creation time:', error);
      throw error;
    }
  }

  /**
   * Get a random color for a tab group
   * @returns {chrome.tabGroups.Color} - Random color name
   */
  getRandomColor(): chrome.tabGroups.Color {
    const colors: chrome.tabGroups.Color[] = [
      'red', 'blue', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange', 'grey'
    ];
    const randomIndex = Math.floor(Math.random() * colors.length);
    return colors[randomIndex];
  }

  /**
   * Close an entire tab group
   * @param {number} groupId - ID of the group to close
   * @returns {Promise<void>}
   */
  async closeGroup(groupId: number): Promise<void> {
    try {
      const tabs = await this.getTabsInGroup(groupId);
      const tabIds = tabs
        .map(tab => tab.id)
        .filter((id): id is number => id !== undefined);

      if (tabIds.length > 0) {
        await chrome.tabs.remove(tabIds);
      }
    } catch (error) {
      console.error(`Error closing group ${groupId}:`, error);
      throw error;
    }
  }

  /**
   * Collapse all tab groups in a window
   * @param {number | null} windowId - ID of the window to collapse groups in, or null for the current window
   * @returns {Promise<number[]>} - Array of updated group IDs
   */
  async collapseAllGroups(windowId: number | null = null): Promise<number[]> {
    try {
      // Create the proper query object based on whether windowId is provided
      const queryInfo = windowId !== null ?
        { windowId } as {windowId: number} :
        { windowId: chrome.windows.WINDOW_ID_CURRENT };

      const groups = await chrome.tabGroups.query(queryInfo);
      const updatedGroupIds: number[] = [];

      for (const group of groups) {
        if (!group.collapsed) {
          await chrome.tabGroups.update(group.id, { collapsed: true });
          updatedGroupIds.push(group.id);
        }
      }

      return updatedGroupIds;
    } catch (error) {
      console.error('Error collapsing all groups:', error);
      throw error;
    }
  }

  /**
   * Expand all tab groups in a window
   * @param {number | null} windowId - ID of the window to expand groups in, or null for the current window
   * @returns {Promise<number[]>} - Array of updated group IDs
   */
  async expandAllGroups(windowId: number | null = null): Promise<number[]> {
    try {
      // Create the proper query object based on whether windowId is provided
      const queryInfo = windowId !== null ?
        { windowId } as {windowId: number} :
        { windowId: chrome.windows.WINDOW_ID_CURRENT };

      const groups = await chrome.tabGroups.query(queryInfo);
      const updatedGroupIds: number[] = [];

      for (const group of groups) {
        if (group.collapsed) {
          await chrome.tabGroups.update(group.id, { collapsed: false });
          updatedGroupIds.push(group.id);
        }
      }

      return updatedGroupIds;
    } catch (error) {
      console.error('Error expanding all groups:', error);
      throw error;
    }
  }
}