/**
 * Storage Manager service for PsiTabs
 * Handles storage operations for saving settings and tab data
 */

// Define types for settings and data structures
interface Settings {
  autoDeduplication: boolean;
  autoGrouping: boolean;
  llmProvider: string;
  llmApiKey: string;
  llmEndpoint: string;
  customLLMHeaders: Record<string, string>;
  groupColors: Record<string, string>;
  analyticsOptOut?: boolean;
  theme: 'light' | 'dark' | 'system'; // Added theme setting
}

interface TabData {
  id: number | undefined;
  url: string | undefined;
  title: string | undefined;
  favIconUrl: string | undefined;
}

interface TabGroup {
  id: string;
  name: string;
  created: string;
  tabs: TabData[];
}

interface TabSession {
  id: string;
  name: string;
  created: string;
  data: any;
}

interface ActionLog {
  action: string;
  timestamp: string;
  details: Record<string, any>;
}

interface StorageData {
  sync: any;
  local: any;
}

export class StorageManager {
  defaultSettings: Settings;

  constructor() {
    // Default settings for the extension
    this.defaultSettings = {
      autoDeduplication: true,
      autoGrouping: false,
      llmProvider: 'azure',
      llmApiKey: '',
      llmEndpoint: '',
      customLLMHeaders: {},
      theme: 'system', // Default to system theme
      groupColors: {
        news: '#FF5733',
        shopping: '#33FF57',
        social: '#3357FF',
        work: '#F3FF33',
        entertainment: '#FF33F3',
        research: '#33FFF3',
        other: '#BBBBBB'
      }
    };
  }

  /**
   * Get all settings
   * @returns {Promise<Settings>} Settings object
   */
  async getSettings(): Promise<Settings> {
    try {
      const result = await chrome.storage.sync.get('settings');

      // If no settings found, return defaults
      if (!result.settings) {
        return { ...this.defaultSettings };
      }

      // Merge with defaults to ensure all properties exist
      return { ...this.defaultSettings, ...result.settings };
    } catch (error) {
      console.error('Error getting settings:', error);
      return { ...this.defaultSettings };
    }
  }

  /**
   * Save settings
   * @param {Partial<Settings>} settings - Settings object to save
   * @returns {Promise<void>}
   */
  async saveSettings(settings: Partial<Settings>): Promise<void> {
    try {
      // Merge with existing settings to avoid overwriting
      const existingSettings = await this.getSettings();
      const updatedSettings = { ...existingSettings, ...settings };

      await chrome.storage.sync.set({ settings: updatedSettings });
    } catch (error) {
      console.error('Error saving settings:', error);
      throw error;
    }
  }

  /**
   * Save a tab group
   * @param {string} name - Group name
   * @param {Array<number>} tabIds - Array of tab IDs in the group
   * @returns {Promise<string>} Group ID
   */
  async saveTabGroup(name: string, tabIds: number[]): Promise<string> {
    try {
      // Generate a unique ID
      const groupId = Date.now().toString();

      // Get tab details
      const tabs = await Promise.all(tabIds.map(async (tabId) => {
        try {
          const tab = await chrome.tabs.get(tabId);
          return {
            id: tab.id,
            url: tab.url,
            title: tab.title,
            favIconUrl: tab.favIconUrl || ''
          };
        } catch (error) {
          console.error(`Error getting tab ${tabId}:`, error);
          return null;
        }
      }));

      // Define the interface for tab data from the Chrome API
      interface ChromeTabData {
        id: number | undefined;
        url: string | undefined;
        title: string | undefined;
        favIconUrl: string;
      }

      // Filter out null values
      const validTabs = tabs.filter((tab): tab is ChromeTabData => tab !== null);

      // Convert to TabData array
      const tabDataArray: TabData[] = validTabs.map(tab => ({
        id: tab.id,
        url: tab.url,
        title: tab.title,
        favIconUrl: tab.favIconUrl
      }));

      // Create group object
      const group: TabGroup = {
        id: groupId,
        name,
        created: new Date().toISOString(),
        tabs: tabDataArray
      };

      // Get existing groups
      const result = await chrome.storage.local.get('groups');
      let groups: TabGroup[] = result.groups || [];

      // Add new group
      groups.push(group);

      // Save groups
      await chrome.storage.local.set({ groups });

      return groupId;
    } catch (error) {
      console.error('Error saving tab group:', error);
      throw error;
    }
  }

  /**
   * Get all saved tab groups
   * @returns {Promise<TabGroup[]>} Array of tab group objects
   */
  async getSavedTabGroups(): Promise<TabGroup[]> {
    try {
      const result = await chrome.storage.local.get('groups');
      return result.groups || [];
    } catch (error) {
      console.error('Error getting saved tab groups:', error);
      return [];
    }
  }

  /**
   * Delete a saved tab group
   * @param {string} groupId - Group ID to delete
   * @returns {Promise<boolean>} Success status
   */
  async deleteTabGroup(groupId: string): Promise<boolean> {
    try {
      // Get existing groups
      const result = await chrome.storage.local.get('groups');
      let groups: TabGroup[] = result.groups || [];

      // Filter out the group to delete
      const updatedGroups = groups.filter(group => group.id !== groupId);

      // Save updated groups
      await chrome.storage.local.set({ groups: updatedGroups });

      return true;
    } catch (error) {
      console.error('Error deleting tab group:', error);
      return false;
    }
  }

  /**
   * Save a tab session
   * @param {string} name - Session name
   * @param {any} sessionData - Session data object
   * @returns {Promise<string>} Session ID
   */
  async saveTabSession(name: string, sessionData: any): Promise<string> {
    try {
      // Generate a unique ID
      const sessionId = Date.now().toString();

      // Create session object
      const session: TabSession = {
        id: sessionId,
        name: name || `Session ${new Date().toLocaleString()}`,
        created: new Date().toISOString(),
        data: sessionData
      };

      // Get existing sessions
      const result = await chrome.storage.local.get('sessions');
      let sessions: TabSession[] = result.sessions || [];

      // Add new session
      sessions.push(session);

      // Save sessions
      await chrome.storage.local.set({ sessions });

      return sessionId;
    } catch (error) {
      console.error('Error saving tab session:', error);
      throw error;
    }
  }

  /**
   * Get all saved tab sessions
   * @returns {Promise<TabSession[]>} Array of session objects
   */
  async getSavedTabSessions(): Promise<TabSession[]> {
    try {
      const result = await chrome.storage.local.get('sessions');
      return result.sessions || [];
    } catch (error) {
      console.error('Error getting saved tab sessions:', error);
      return [];
    }
  }

  /**
   * Delete a saved tab session
   * @param {string} sessionId - Session ID to delete
   * @returns {Promise<boolean>} Success status
   */
  async deleteTabSession(sessionId: string): Promise<boolean> {
    try {
      // Get existing sessions
      const result = await chrome.storage.local.get('sessions');
      let sessions: TabSession[] = result.sessions || [];

      // Filter out the session to delete
      const updatedSessions = sessions.filter(session => session.id !== sessionId);

      // Save updated sessions
      await chrome.storage.local.set({ sessions: updatedSessions });

      return true;
    } catch (error) {
      console.error('Error deleting tab session:', error);
      return false;
    }
  }

  /**
   * Log a tab action for analytics
   * @param {string} action - Action type
   * @param {Record<string, any>} details - Action details
   * @returns {Promise<void>}
   */
  async logTabAction(action: string, details: Record<string, any> = {}): Promise<void> {
    try {
      // Don't log if the user has opted out of analytics
      const settings = await this.getSettings();
      if (settings.analyticsOptOut) {
        return;
      }

      // Create log entry
      const logEntry: ActionLog = {
        action,
        timestamp: new Date().toISOString(),
        details
      };

      // Get existing logs
      const result = await chrome.storage.local.get('actionLogs');
      let actionLogs: ActionLog[] = result.actionLogs || [];

      // Add new log
      actionLogs.push(logEntry);

      // Limit logs to last 1000 entries
      if (actionLogs.length > 1000) {
        actionLogs = actionLogs.slice(actionLogs.length - 1000);
      }

      // Save logs
      await chrome.storage.local.set({ actionLogs });
    } catch (error) {
      console.error('Error logging tab action:', error);
      // Don't throw error for logging failures
    }
  }

  /**
   * Clear all stored data
   * @returns {Promise<void>}
   */
  async clearAllData(): Promise<void> {
    try {
      await chrome.storage.local.clear();
      await chrome.storage.sync.clear();
    } catch (error) {
      console.error('Error clearing all data:', error);
      throw error;
    }
  }

  /**
   * Export all data as a JSON string
   * @returns {Promise<string>} JSON string with all data
   */
  async exportAllData(): Promise<string> {
    try {
      // Get all data
      const syncData = await chrome.storage.sync.get(null);
      const localData = await chrome.storage.local.get(null);

      // Combine data
      const allData: StorageData = {
        sync: syncData,
        local: localData
      };

      // Convert to JSON string
      return JSON.stringify(allData, null, 2);
    } catch (error) {
      console.error('Error exporting all data:', error);
      throw error;
    }
  }

  /**
   * Import data from a JSON string
   * @param {string} jsonData - JSON string with data to import
   * @returns {Promise<void>}
   */
  async importData(jsonData: string): Promise<void> {
    try {
      // Parse JSON
      const data = JSON.parse(jsonData) as Partial<StorageData>;

      // Validate data structure
      if (!data || (!data.sync && !data.local)) {
        throw new Error('Invalid data format for import');
      }

      // Import sync data
      if (data.sync) {
        await chrome.storage.sync.clear();
        await chrome.storage.sync.set(data.sync);
      }

      // Import local data
      if (data.local) {
        await chrome.storage.local.clear();
        await chrome.storage.local.set(data.local);
      }
    } catch (error) {
      console.error('Error importing data:', error);
      throw error;
    }
  }

  /**
   * Get the current theme setting and resolve it to either 'light' or 'dark'
   * @returns {Promise<'light' | 'dark'>} The resolved theme
   */
  async getTheme(): Promise<'light' | 'dark'> {
    try {
      const settings = await this.getSettings();
      const prefersDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      
      // If set to 'system', use system preference
      if (settings.theme === 'system') {
        return prefersDarkMode ? 'dark' : 'light';
      }
      
      return settings.theme;
    } catch (error) {
      console.error('Error getting theme:', error);
      // Default to light theme if there's an error
      return 'light';
    }
  }
}