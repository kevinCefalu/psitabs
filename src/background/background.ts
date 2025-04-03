/**
 * Background Service Worker for PsiTabs
 * Handles events and core functionality for the extension
 */

import { TabManager } from '../services/tab-manager';
import { DuplicateDetector, DuplicateGroup } from '../services/duplicate-detector';
import { GroupManager } from '../services/group-manager';
import { StorageManager } from '../services/storage-manager';

// Initialize services
const tabManager = new TabManager();
const duplicateDetector = new DuplicateDetector();
const groupManager = new GroupManager();
const storageManager = new StorageManager();

// Register event handlers
chrome.runtime.onInstalled.addListener(handleInstalled);
chrome.tabs.onCreated.addListener(handleTabCreated);
chrome.tabs.onRemoved.addListener(handleTabRemoved);
chrome.tabs.onUpdated.addListener(handleTabUpdated);
chrome.tabs.onMoved.addListener(handleTabMoved);
chrome.tabGroups.onCreated.addListener(handleGroupCreated);
chrome.tabGroups.onUpdated.addListener(handleGroupUpdated);

// Register handler for tabGroups.onRemoved
chrome.tabGroups.onRemoved.addListener((group: chrome.tabGroups.TabGroup) => {
  handleGroupRemoved(group.id, { windowId: group.windowId });
});

chrome.commands.onCommand.addListener(handleCommand);
chrome.runtime.onMessage.addListener(handleMessage);
chrome.contextMenus.onClicked.addListener(handleContextMenu);

/**
 * Handle installation or update of the extension
 * @param {chrome.runtime.InstalledDetails} details - Installation details
 */
async function handleInstalled(details: chrome.runtime.InstalledDetails): Promise<void> {
  console.log('PsiTabs installed/updated:', details.reason);

  // Set up context menu items
  chrome.contextMenus.create({
    id: 'psi-tab-mgr',
    title: 'PsiTabs',
    contexts: ['page']
  });

  chrome.contextMenus.create({
    id: 'summarize-tab',
    parentId: 'psi-tab-mgr',
    title: 'Summarize this tab',
    contexts: ['page']
  });

  chrome.contextMenus.create({
    id: 'group-similar',
    parentId: 'psi-tab-mgr',
    title: 'Group similar tabs',
    contexts: ['page']
  });

  chrome.contextMenus.create({
    id: 'find-duplicates',
    parentId: 'psi-tab-mgr',
    title: 'Find duplicate tabs',
    contexts: ['page']
  });

  chrome.contextMenus.create({
    id: 'sort-tabs',
    parentId: 'psi-tab-mgr',
    title: 'Sort tabs by title',
    contexts: ['page']
  });

  // Initialize storage with default settings if it's a new installation
  if (details.reason === 'install') {
    const defaultSettings = {
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

    await storageManager.saveSettings(defaultSettings);
    console.log('Default settings initialized');
  }
}

/**
 * Handle creation of a new tab
 * @param {chrome.tabs.Tab} tab - The newly created tab
 */
async function handleTabCreated(tab: chrome.tabs.Tab): Promise<void> {
  console.log('Tab created:', tab.id);

  try {
    const settings = await storageManager.getSettings();

    // Check if auto-deduplication is enabled
    if (settings.autoDeduplication) {
      // Wait for the tab to fully load before checking for duplicates
      setTimeout(async () => {
        try {
          // Only check for duplicates if the tab has a URL (not a new tab page)
          if (tab.id && tab.url && !tab.url.startsWith('chrome://')) {
            const duplicates = await duplicateDetector.findDuplicatesForTab(tab.id);

            if (duplicates.length > 0) {
              // If there are duplicates, show a notification or prompt for action
              notifyDuplicateFound(tab, duplicates);
            }
          }
        } catch (error) {
          console.error('Error in auto-deduplication:', error);
        }
      }, 1500); // Wait for 1.5 seconds to allow the tab to load
    }

    // Check if auto-grouping is enabled
    if (settings.autoGrouping) {
      // Wait for the tab to fully load before trying to group it
      setTimeout(async () => {
        try {
          // Only try to group if the tab has a URL (not a new tab page)
          if (tab.id && tab.url && !tab.url.startsWith('chrome://')) {
            await groupManager.groupTabByDomain(tab.id);
          }
        } catch (error) {
          console.error('Error in auto-grouping:', error);
        }
      }, 1500); // Wait for 1.5 seconds to allow the tab to load
    }
  } catch (error) {
    console.error('Error handling new tab:', error);
  }
}

/**
 * Handle removal of a tab
 * @param {number} tabId - ID of the closed tab
 * @param {chrome.tabs.TabRemoveInfo} removeInfo - Information about the removal
 */
function handleTabRemoved(tabId: number, removeInfo: chrome.tabs.TabRemoveInfo): void {
  console.log('Tab removed:', tabId);
  // Cleanup or additional logic can be added here
}

/**
 * Handle updates to a tab (URL changes, loading states, etc.)
 * @param {number} tabId - ID of the updated tab
 * @param {chrome.tabs.TabChangeInfo} changeInfo - Information about what changed
 * @param {chrome.tabs.Tab} tab - The updated tab
 */
function handleTabUpdated(
  tabId: number,
  changeInfo: chrome.tabs.TabChangeInfo,
  tab: chrome.tabs.Tab
): void {
  // Only log when the URL changes or the tab finishes loading
  if (changeInfo.url || changeInfo.status === 'complete') {
    console.log('Tab updated:', tabId, changeInfo);
  }
}

/**
 * Handle tab being moved within a window
 * @param {number} tabId - ID of the moved tab
 * @param {chrome.tabs.TabMoveInfo} moveInfo - Information about the move
 */
function handleTabMoved(tabId: number, moveInfo: chrome.tabs.TabMoveInfo): void {
  console.log('Tab moved:', tabId, moveInfo);
}

/**
 * Handle creation of a tab group
 * @param {chrome.tabGroups.TabGroup} group - The newly created group
 */
function handleGroupCreated(group: chrome.tabGroups.TabGroup): void {
  console.log('Group created:', group);
}

/**
 * Handle updates to a tab group (title, color, etc.)
 * @param {chrome.tabGroups.TabGroup} group - The updated group
 */
function handleGroupUpdated(group: chrome.tabGroups.TabGroup): void {
  console.log('Group updated:', group);
}

/**
 * Handle removal of a tab group
 * @param {number} groupId - ID of the removed group
 * @param {object} removeInfo - Information about the removal
 * @param {number} removeInfo.windowId - ID of the window containing the group
 */
function handleGroupRemoved(groupId: number, removeInfo: {windowId: number}): void {
  console.log('Group removed:', groupId);
}

/**
 * Handle keyboard commands
 * @param {string} command - The command that was executed
 */
async function handleCommand(command: string): Promise<void> {
  console.log('Command received:', command);

  try {
    switch (command) {
      case 'open-side-panel':
        // Fix error TS2554: Expected 1-2 arguments, but got 0
        if (chrome.sidePanel && chrome.sidePanel.open) {
          await chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT });
        } else {
          console.warn('Side panel API is not available in this environment.');
        }
        break;
      case 'find-duplicates':
        await findAndHandleDuplicates();
        break;
      case 'sort-tabs':
        const currentWindow = await chrome.windows.getCurrent();
        if (currentWindow.id) {
          await tabManager.sortTabsByTitle(currentWindow.id);
        }
        break;
      case 'group-tabs':
        await groupTabsByDomain();
        break;
      default:
        console.log('Unhandled command:', command);
    }
  } catch (error) {
    console.error('Error handling command:', error);
  }
}

interface Message {
  action: string;
  tabId?: number;
  tabIds?: number[];
}

/**
 * Handle messages from other parts of the extension
 * @param {Message} message - The message that was sent
 * @param {chrome.runtime.MessageSender} sender - Information about the sender
 * @param {Function} sendResponse - Function to send a response
 * @returns {boolean} - Whether the response will be sent asynchronously
 */
function handleMessage(
  message: Message,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
): boolean {
  console.log('Message received:', message.action);

  try {
    switch (message.action) {
      case 'findDuplicates':
        findAndHandleDuplicates().then(duplicateGroups => {
          sendResponse({ success: true, duplicateGroups });
        });
        break;
      case 'groupTabsByDomain':
        groupTabsByDomain().then(result => {
          sendResponse({ success: true, result });
        });
        break;
      case 'groupTabsByTopic':
        if (message.tabIds) {
          groupTabsByTopic(message.tabIds).then(groups => {
            sendResponse({ success: true, groups });
          });
        } else {
          sendResponse({ success: false, error: 'No tab IDs provided' });
        }
        break;
      case 'summarizeTab':
        if (message.tabId !== undefined) {
          summarizeTab(message.tabId).then(summary => {
            sendResponse({ success: true, summary });
          });
        } else {
          sendResponse({ success: false, error: 'No tab ID provided' });
        }
        break;
      case 'getSettings':
        storageManager.getSettings().then(settings => {
          sendResponse({ success: true, settings });
        });
        break;
      default:
        console.log('Unhandled message action:', message.action);
        sendResponse({ success: false, error: 'Unknown action' });
    }
    return true; // Will respond asynchronously
  } catch (error) {
    console.error('Error handling message:', error);
    sendResponse({ success: false, error: (error as Error).message });
    return false;
  }
}

/**
 * Handle context menu clicks
 * @param {chrome.contextMenus.OnClickData} info - Information about the clicked item
 * @param {chrome.tabs.Tab | undefined} tab - The tab where the click occurred
 */
async function handleContextMenu(
  info: chrome.contextMenus.OnClickData,
  tab?: chrome.tabs.Tab
): Promise<void> {
  console.log('Context menu clicked:', info.menuItemId);

  if (!tab) return;

  try {
    switch (info.menuItemId) {
      case 'summarize-tab':
        if (tab.id !== undefined) {
          const summary = await summarizeTab(tab.id);
          showSummaryNotification(tab, summary);
        }
        break;
      case 'group-similar':
        if (tab.id !== undefined) {
          await groupSimilarTabs(tab);
        }
        break;
      case 'find-duplicates':
        await findAndHandleDuplicates();
        break;
      case 'sort-tabs':
        if (tab.windowId) {
          await tabManager.sortTabsByTitle(tab.windowId);
        }
        break;
      default:
        console.log('Unhandled context menu item:', info.menuItemId);
    }
  } catch (error) {
    console.error('Error handling context menu click:', error);
  }
}

/**
 * Find and handle duplicate tabs
 * @returns {Promise<DuplicateGroup[]>} - Array of duplicate tab groups
 */
async function findAndHandleDuplicates(): Promise<DuplicateGroup[]> {
  try {
    const duplicateGroups = await duplicateDetector.findDuplicatesAcrossWindows();

    if (duplicateGroups.length > 0) {
      // Notify the user about duplicates
      const count = duplicateGroups.reduce((sum, group) => sum + group.duplicates.length, 0);

      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'images/icon-128.png',
        title: 'Duplicate Tabs Found',
        message: `Found ${count} duplicate tabs across ${duplicateGroups.length} groups.`,
        buttons: [
          { title: 'Merge All' },
          { title: 'View Duplicates' }
        ],
        priority: 2
      });
    } else {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'images/icon-128.png',
        title: 'No Duplicates Found',
        message: 'No duplicate tabs were found.',
        priority: 1
      });
    }

    return duplicateGroups;
  } catch (error) {
    console.error('Error finding duplicates:', error);
    throw error;
  }
}

/**
 * Group tabs by domain
 * @returns {Promise<{message: string}>} - Result of the grouping operation
 */
async function groupTabsByDomain(): Promise<{message: string}> {
  try {
    const currentWindow = await chrome.windows.getCurrent();
    if (!currentWindow.id) {
      return { message: 'Could not determine current window.' };
    }

    const tabs = await chrome.tabs.query({ windowId: currentWindow.id });

    // Filter tabs that are not in a group
    const ungroupedTabs = tabs.filter(tab =>
      tab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE
    );

    if (ungroupedTabs.length === 0) {
      return { message: 'No ungrouped tabs to organize.' };
    }

    const tabIds = ungroupedTabs.map(tab => tab.id).filter((id): id is number => id !== undefined);
    const result = await groupManager.groupTabsByDomain(tabIds);
    return result;
  } catch (error) {
    console.error('Error grouping tabs by domain:', error);
    throw error;
  }
}

/**
 * Group tabs by topic using LLM
 * @param {number[]} tabIds - Array of tab IDs to group
 * @returns {Promise<any[]>} - Array of created groups
 */
async function groupTabsByTopic(tabIds: number[]): Promise<any[]> {
  try {
    const groups = await groupManager.groupTabsByTopic(tabIds);
    return groups;
  } catch (error) {
    console.error('Error grouping tabs by topic:', error);
    throw error;
  }
}

/**
 * Summarize a tab using LLM
 * @param {number} tabId - ID of the tab to summarize
 * @returns {Promise<string>} - Summary of the tab content
 */
async function summarizeTab(tabId: number): Promise<string> {
  try {
    const summary = await groupManager.llmService.summarizeTab(tabId);
    return summary;
  } catch (error) {
    console.error('Error summarizing tab:', error);
    throw error;
  }
}

/**
 * Group tabs similar to the given tab
 * @param {chrome.tabs.Tab} tab - The reference tab
 */
async function groupSimilarTabs(tab: chrome.tabs.Tab): Promise<void> {
  try {
    if (tab.id !== undefined) {
      await groupManager.groupSimilarTabs(tab.id);
    }
  } catch (error) {
    console.error('Error grouping similar tabs:', error);
    throw error;
  }
}

/**
 * Notify the user about duplicate tabs
 * @param {chrome.tabs.Tab} tab - The current tab
 * @param {chrome.tabs.Tab[]} duplicates - Array of duplicate tabs
 */
function notifyDuplicateFound(tab: chrome.tabs.Tab, duplicates: chrome.tabs.Tab[]): void {
  // Check if notifications API is available before trying to use it
  if (!chrome.notifications) {
    console.warn('Notifications API not available');
    return;
  }

  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'images/icon-128.png',
    title: 'Duplicate Tab Detected',
    message: `"${tab.title}" is a duplicate of ${duplicates.length} other tab(s)`,
    buttons: [
      { title: 'Close Duplicate' },
      { title: 'Show All' }
    ],
    priority: 2
  });
}

/**
 * Show a notification with a tab summary
 * @param {chrome.tabs.Tab} tab - The summarized tab
 * @param {string} summary - The summary text
 */
function showSummaryNotification(tab: chrome.tabs.Tab, summary: string): void {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'images/icon-128.png',
    title: `Summary: ${tab.title}`,
    message: summary.length > 200 ? summary.substring(0, 197) + '...' : summary,
    priority: 1
  });
}