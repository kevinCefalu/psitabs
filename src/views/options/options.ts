/**
 * Options TypeScript for PsiTabs
 * Handles settings management for the extension
 */

import { StorageManager } from '../../services/storage-manager';
import { LLMService } from '../../services/llm-service';

interface GroupColors {
  [key: string]: string;
}

interface Settings {
  autoDeduplication: boolean;
  autoGrouping: boolean;
  llmProvider: string;
  llmApiKey: string;
  llmEndpoint: string;
  customLLMHeaders?: Record<string, string>;
  groupColors: GroupColors;
}

// Initialize services
const storageManager = new StorageManager();
const llmService = new LLMService();

// DOM Elements
const autoDeduplicationToggle = document.getElementById('auto-deduplication') as HTMLInputElement;
const autoGroupingToggle = document.getElementById('auto-grouping') as HTMLInputElement;
const llmProviderSelect = document.getElementById('llm-provider') as HTMLSelectElement;
const llmApiKeyInput = document.getElementById('llm-api-key') as HTMLInputElement;
const llmEndpointInput = document.getElementById('llm-endpoint') as HTMLInputElement;
const customHeadersTextarea = document.getElementById('custom-headers') as HTMLTextAreaElement;
const customHeadersContainer = document.getElementById('custom-headers-container') as HTMLElement;
const testLLMButton = document.getElementById('test-llm-btn') as HTMLButtonElement;
const saveSettingsButton = document.getElementById('save-settings-btn') as HTMLButtonElement;
const resetSettingsButton = document.getElementById('reset-settings-btn') as HTMLButtonElement;
const statusMessage = document.getElementById('status-message') as HTMLElement;
const colorInputs = document.querySelectorAll('.color-item input[type="color"]');
const clearSessionsButton = document.getElementById('clear-sessions-btn') as HTMLButtonElement;
const clearGroupsButton = document.getElementById('clear-groups-btn') as HTMLButtonElement;
const viewSessionsButton = document.getElementById('view-sessions-btn') as HTMLButtonElement;
const viewGroupsButton = document.getElementById('view-groups-btn') as HTMLButtonElement;

// Default settings
const DEFAULT_SETTINGS: Settings = {
  autoDeduplication: true,
  autoGrouping: false,
  llmProvider: 'azure',
  llmApiKey: '',
  llmEndpoint: '',
  customLLMHeaders: {},
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

// Initialize the options page
document.addEventListener('DOMContentLoaded', async () => {
  // Load current settings
  await loadSettings();

  // Set up event listeners
  setupEventListeners();
});

/**
 * Load settings from storage and populate the form
 */
async function loadSettings(): Promise<void> {
  try {
    const settings = await storageManager.getSettings();

    // Apply settings to form fields or use defaults
    const currentSettings = { ...DEFAULT_SETTINGS, ...settings };

    // General settings
    autoDeduplicationToggle.checked = currentSettings.autoDeduplication;
    autoGroupingToggle.checked = currentSettings.autoGrouping;

    // LLM settings
    llmProviderSelect.value = currentSettings.llmProvider || 'azure';
    llmApiKeyInput.value = currentSettings.llmApiKey || '';
    llmEndpointInput.value = currentSettings.llmEndpoint || '';

    // Show/hide custom headers based on provider
    toggleCustomHeadersVisibility();

    // Custom LLM headers
    if (currentSettings.customLLMHeaders) {
      customHeadersTextarea.value = JSON.stringify(currentSettings.customLLMHeaders, null, 2);
    }

    // Group colors
    if (currentSettings.groupColors) {
      Object.entries(currentSettings.groupColors).forEach(([key, value]) => {
        const colorInput = document.getElementById(`color-${key}`) as HTMLInputElement | null;
        if (colorInput) {
          colorInput.value = value;
        }
      });
    }
  } catch (error) {
    console.error('Error loading settings:', error);
    showStatus(`Error loading settings: ${(error as Error).message}`, 'error');
  }
}

/**
 * Set up event listeners for the form elements
 */
function setupEventListeners(): void {
  // LLM provider change
  llmProviderSelect.addEventListener('change', toggleCustomHeadersVisibility);

  // Test LLM connection
  testLLMButton.addEventListener('click', testLLMConnection);

  // Save settings
  saveSettingsButton.addEventListener('click', saveSettings);

  // Reset settings
  resetSettingsButton.addEventListener('click', resetSettings);

  // Clear storage data
  clearSessionsButton.addEventListener('click', clearSessions);
  clearGroupsButton.addEventListener('click', clearGroups);

  // View saved data
  viewSessionsButton.addEventListener('click', viewSessions);
  viewGroupsButton.addEventListener('click', viewGroups);
}

/**
 * Show/hide custom headers based on provider selection
 */
function toggleCustomHeadersVisibility(): void {
  if (llmProviderSelect.value === 'custom') {
    customHeadersContainer.style.display = 'flex';
  } else {
    customHeadersContainer.style.display = 'none';
  }
}

/**
 * Test LLM connection with current settings
 */
async function testLLMConnection(): Promise<void> {
  try {
    testLLMButton.disabled = true;
    testLLMButton.textContent = 'Testing...';

    // Get current form values
    const provider = llmProviderSelect.value;
    const apiKey = llmApiKeyInput.value;
    const endpoint = llmEndpointInput.value;

    // Validate inputs
    if (!apiKey) {
      throw new Error('API key is required');
    }

    if ((provider === 'azure' || provider === 'custom') && !endpoint) {
      throw new Error('Endpoint URL is required for Azure and Custom providers');
    }

    // Create temporary settings for test
    const testSettings: Partial<Settings> = {
      llmProvider: provider,
      llmApiKey: apiKey,
      llmEndpoint: endpoint
    };

    // Add custom headers if applicable
    if (provider === 'custom' && customHeadersTextarea.value.trim()) {
      try {
        testSettings.customLLMHeaders = JSON.parse(customHeadersTextarea.value);
      } catch (jsonError) {
        throw new Error('Invalid JSON format for custom headers');
      }
    }

    // Save temporary settings for the test
    await storageManager.saveSettings(testSettings);

    // Test the connection
    const testResult = await llmService.isConfigured();

    if (testResult) {
      showStatus('LLM connection successful!', 'success');
    } else {
      showStatus('LLM connection failed. Check your settings.', 'error');
    }
  } catch (error) {
    console.error('Error testing LLM connection:', error);
    showStatus(`Error: ${(error as Error).message}`, 'error');
  } finally {
    testLLMButton.disabled = false;
    testLLMButton.textContent = 'Test Connection';
  }
}

/**
 * Save all settings to storage
 */
async function saveSettings(): Promise<void> {
  try {
    saveSettingsButton.disabled = true;
    saveSettingsButton.textContent = 'Saving...';

    // Collect settings from form
    const settings: Partial<Settings> = {
      autoDeduplication: autoDeduplicationToggle.checked,
      autoGrouping: autoGroupingToggle.checked,
      llmProvider: llmProviderSelect.value,
      llmApiKey: llmApiKeyInput.value,
      llmEndpoint: llmEndpointInput.value,
      groupColors: {}
    };

    // Parse custom headers if applicable
    if (llmProviderSelect.value === 'custom' && customHeadersTextarea.value.trim()) {
      try {
        settings.customLLMHeaders = JSON.parse(customHeadersTextarea.value);
      } catch (jsonError) {
        throw new Error('Invalid JSON format for custom headers');
      }
    }

    // Collect group colors
    const groupColors: GroupColors = {};
    colorInputs.forEach((input: Element) => {
      const colorInput = input as HTMLInputElement;
      const key = colorInput.id.replace('color-', '');
      groupColors[key] = colorInput.value;
    });

    settings.groupColors = groupColors;

    // Save all settings
    await storageManager.saveSettings(settings);

    showStatus('Settings saved successfully!', 'success');
  } catch (error) {
    console.error('Error saving settings:', error);
    showStatus(`Error saving settings: ${(error as Error).message}`, 'error');
  } finally {
    saveSettingsButton.disabled = false;
    saveSettingsButton.textContent = 'Save Settings';
  }
}

/**
 * Reset settings to defaults
 */
async function resetSettings(): Promise<void> {
  if (confirm('Are you sure you want to reset all settings to defaults?')) {
    try {
      await storageManager.saveSettings(DEFAULT_SETTINGS);
      await loadSettings();
      showStatus('Settings reset to defaults.', 'success');
    } catch (error) {
      console.error('Error resetting settings:', error);
      showStatus(`Error resetting settings: ${(error as Error).message}`, 'error');
    }
  }
}

/**
 * Clear all saved sessions
 */
async function clearSessions(): Promise<void> {
  if (confirm('Are you sure you want to delete all saved sessions?')) {
    try {
      const sessions = await storageManager.getSavedTabSessions();

      for (const session of sessions) {
        await storageManager.deleteTabSession(session.id);
      }

      showStatus('All sessions cleared successfully.', 'success');
    } catch (error) {
      console.error('Error clearing sessions:', error);
      showStatus(`Error clearing sessions: ${(error as Error).message}`, 'error');
    }
  }
}

/**
 * Clear all saved groups
 */
async function clearGroups(): Promise<void> {
  if (confirm('Are you sure you want to delete all saved tab groups?')) {
    try {
      const groups = await storageManager.getSavedTabGroups();

      for (const group of groups) {
        await storageManager.deleteTabGroup(group.id);
      }

      showStatus('All tab groups cleared successfully.', 'success');
    } catch (error) {
      console.error('Error clearing groups:', error);
      showStatus(`Error clearing groups: ${(error as Error).message}`, 'error');
    }
  }
}

/**
 * Navigate to sessions view
 */
function viewSessions(): void {
  chrome.tabs.create({ url: chrome.runtime.getURL('views/sessions.html') });
}

/**
 * Navigate to groups view
 */
function viewGroups(): void {
  chrome.tabs.create({ url: chrome.runtime.getURL('views/groups.html') });
}

/**
 * Show a status message
 * @param {string} message - Message to show
 * @param {string} type - Type of message ('success' or 'error')
 */
function showStatus(message: string, type: 'success' | 'error'): void {
  statusMessage.textContent = message;
  statusMessage.className = 'status-message ' + type;

  // Auto-hide success messages after 3 seconds
  if (type === 'success') {
    setTimeout(() => {
      statusMessage.className = 'status-message';
    }, 3000);
  }
}