/**
 * Popup TypeScript for PsiTabs
 * Handles the UI interactions in the extension popup
 */

import { TabManager } from '../../services/tab-manager';
import { DuplicateDetector, DuplicateGroup } from '../../services/duplicate-detector';
import { GroupManager } from '../../services/group-manager';
import { LLMService } from '../../services/llm-service';
import { StorageManager } from '../../services/storage-manager';

// Initialize services
const tabManager = new TabManager();
const duplicateDetector = new DuplicateDetector();
const groupManager = new GroupManager();
const llmService = new LLMService();
const storageManager = new StorageManager();

// DOM Elements
const tabsContainer = document.getElementById('tabs-container') as HTMLElement;
const tabCount = document.getElementById('tab-count') as HTMLElement;
const groupsContainer = document.getElementById('groups-container') as HTMLElement;
const llmStatusMessage = document.querySelector('.llm-status-message') as HTMLElement;
const summaryModal = document.getElementById('summary-modal') as HTMLElement;
const summaryContent = document.getElementById('summary-content') as HTMLElement;

// Event listeners for the main buttons
document.getElementById('refresh-tabs-btn')?.addEventListener('click', loadTabs);
document.getElementById('options-btn')?.addEventListener('click', openOptions);
document.getElementById('open-sidebar-btn')?.addEventListener('click', openSidebar);
document.getElementById('sort-url-btn')?.addEventListener('click', sortTabsByUrl);
document.getElementById('sort-title-btn')?.addEventListener('click', sortTabsByTitle);
document.getElementById('find-duplicates-btn')?.addEventListener('click', findDuplicates);
document.getElementById('group-by-topic-btn')?.addEventListener('click', groupTabsByTopic);
document.getElementById('summarize-tab-btn')?.addEventListener('click', summarizeCurrentTab);
document.getElementById('configure-llm-btn')?.addEventListener('click', openOptions);
document.getElementById('save-groups-btn')?.addEventListener('click', saveCurrentGroups);
document.getElementById('save-session-btn')?.addEventListener('click', saveCurrentSession);
document.getElementById('view-sessions-btn')?.addEventListener('click', openSessionsPage);

// Modal close button
document.querySelector('.close-modal')?.addEventListener('click', () => {
  if (summaryModal) {
    summaryModal.style.display = 'none';
  }
});

// Initialize the popup
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Initialize theme before doing anything else
    await initializeTheme();

    await loadTabs();
    await loadGroups();
    await checkLLMStatus();
  } catch (error) {
    console.error('Error initializing popup:', error);
  }
});

/**
 * Load all tabs in the current window
 */
async function loadTabs(): Promise<void> {
  try {
    if (!tabsContainer) return;
    tabsContainer.innerHTML = '<div class="loading">Loading tabs...</div>';

    // Get the current window
    const currentWindow = await chrome.windows.getCurrent();
    // Check if windowId exists
    if (!currentWindow.id) {
      tabsContainer.innerHTML = '<div class="error">Could not determine window ID</div>';
      return;
    }

    // Get tabs in the current window
    const tabs = await tabManager.getTabsInWindow(currentWindow.id);

    if (tabs.length === 0) {
      tabsContainer.innerHTML = '<div class="no-tabs">No tabs in this window</div>';
      if (tabCount) tabCount.textContent = '0 tabs';
      return;
    }

    if (tabCount) {
      tabCount.textContent = `${tabs.length} tab${tabs.length === 1 ? '' : 's'}`;
    }

    let tabsHtml = '';
    for (const tab of tabs) {
      tabsHtml += createTabHtml(tab);
    }

    tabsContainer.innerHTML = tabsHtml;

    // Add event listeners to the tab action buttons
    document.querySelectorAll('.close-tab').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation(); // Prevent triggering parent click events
        const element = e.currentTarget as HTMLElement;
        const tabId = parseInt(element.dataset.tabId || '0');
        if (tabId) {
          await tabManager.closeTab(tabId);
          await loadTabs();
        }
      });
    });

    /**
     * Fix tab focus functionality to properly handle undefined tab IDs
     */
    document.querySelectorAll('.focus-tab').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation(); // Prevent triggering parent click events
        const element = e.currentTarget as HTMLElement;
        const tabIdStr = element.dataset.tabId || '0';
        const tabId = parseInt(tabIdStr, 10);

        if (tabId) {
          await tabManager.focusTab(tabId);
        }
      });
    });

    /**
     * Fix tab click functionality to properly handle undefined tab IDs
     */
    document.querySelectorAll('.tab-item').forEach(item => {
      item.addEventListener('click', async (e) => {
        if (!(e.target as HTMLElement).closest('.tab-buttons')) {
          const element = item as HTMLElement;
          const tabIdStr = element.dataset.tabId || '0';
          const tabId = parseInt(tabIdStr, 10);

          if (tabId) {
            await tabManager.focusTab(tabId);
          }
        }
      });
    });
  } catch (error) {
    console.error('Error loading tabs:', error);
    if (tabsContainer) {
      tabsContainer.innerHTML = `<div class="error">Error loading tabs: ${(error as Error).message}</div>`;
    }
  }
}

/**
 * Create HTML for a tab item
 * @param {chrome.tabs.Tab} tab - Tab object
 * @returns {string} HTML for the tab
 */
function createTabHtml(tab: chrome.tabs.Tab): string {
  const favIconUrl = tab.favIconUrl || '../images/icon.svg';
  const active = tab.active ? 'active-tab' : '';
  const title = tab.title || 'Untitled';
  const url = tab.url || '';
  const tabId = tab.id || 0;

  return `
    <div class="tab-item ${active}" data-tab-id="${tabId}">
      <img class="tab-favicon" src="${favIconUrl}" alt="Favicon">
      <div class="tab-info">
        <div class="tab-title">${escapeHtml(title)}</div>
        <div class="tab-url">${escapeHtml(url)}</div>
      </div>
      <div class="tab-buttons">
        <button class="focus-tab" data-tab-id="${tabId}" title="Focus tab">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
        </button>
        <button class="close-tab" data-tab-id="${tabId}" title="Close tab">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </div>
  `;
}

/**
 * Load all tab groups in the current window
 */
async function loadGroups(): Promise<void> {
  try {
    if (!groupsContainer) return;

    // Get the current window
    const currentWindow = await chrome.windows.getCurrent();

    if (!currentWindow.id) {
      groupsContainer.innerHTML = '<div class="error">Could not determine window ID</div>';
      return;
    }

    // Get all tab groups in the current window
    const groups = await chrome.tabGroups.query({ windowId: currentWindow.id });

    if (groups.length === 0) {
      groupsContainer.innerHTML = '<div class="no-groups">No active tab groups</div>';
      return;
    }

    let groupsHtml = '';

    for (const group of groups) {
      // Get tabs in this group
      const tabs = await chrome.tabs.query({ groupId: group.id });

      groupsHtml += `
        <div class="group-item" data-group-id="${group.id}">
          <div class="group-color" style="background-color: ${group.color}"></div>
          <div class="group-title">${escapeHtml(group.title || 'Unnamed Group')}</div>
          <div class="group-tab-count">${tabs.length}</div>
          <div class="group-actions">
            <button class="summarize-group" data-group-id="${group.id}" title="Summarize group">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="21" y1="10" x2="3" y2="10"></line>
                <line x1="21" y1="6" x2="3" y2="6"></line>
                <line x1="21" y1="14" x2="3" y2="14"></line>
                <line x1="21" y1="18" x2="7" y2="18"></line>
              </svg>
            </button>
            <button class="close-group" data-group-id="${group.id}" title="Close group">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>
      `;
    }

    groupsContainer.innerHTML = groupsHtml;

    // Add event listeners for group actions
    document.querySelectorAll('.summarize-group').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const element = e.currentTarget as HTMLElement;
        const groupId = parseInt(element.dataset.groupId || '0');
        if (groupId) {
          await summarizeGroup(groupId);
        }
      });
    });

    document.querySelectorAll('.close-group').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const element = e.currentTarget as HTMLElement;
        const groupId = parseInt(element.dataset.groupId || '0');
        if (groupId) {
          await groupManager.closeGroup(groupId);
          await loadGroups();
        }
      });
    });
  } catch (error) {
    console.error('Error loading groups:', error);
    if (groupsContainer) {
      groupsContainer.innerHTML = `<div class="error">Error loading groups: ${(error as Error).message}</div>`;
    }
  }
}

/**
 * Check if the LLM service is configured
 */
async function checkLLMStatus(): Promise<void> {
  try {
    const isConfigured = await llmService.isConfigured();

    if (!llmStatusMessage) return;

    if (isConfigured) {
      llmStatusMessage.textContent = 'LLM Configured ✓';
      llmStatusMessage.style.color = 'var(--success-color)';

      // Enable LLM-related buttons
      const groupByTopicBtn = document.getElementById('group-by-topic-btn') as HTMLButtonElement | null;
      const summarizeTabBtn = document.getElementById('summarize-tab-btn') as HTMLButtonElement | null;

      if (groupByTopicBtn) groupByTopicBtn.disabled = false;
      if (summarizeTabBtn) summarizeTabBtn.disabled = false;
    } else {
      llmStatusMessage.textContent = 'LLM Not Configured';
      llmStatusMessage.style.color = 'var(--light-text)';

      // Disable LLM-related buttons
      const groupByTopicBtn = document.getElementById('group-by-topic-btn') as HTMLButtonElement | null;
      const summarizeTabBtn = document.getElementById('summarize-tab-btn') as HTMLButtonElement | null;

      if (groupByTopicBtn) groupByTopicBtn.disabled = true;
      if (summarizeTabBtn) summarizeTabBtn.disabled = true;
    }
  } catch (error) {
    console.error('Error checking LLM status:', error);
    if (llmStatusMessage) {
      llmStatusMessage.textContent = 'Error checking LLM status';
      llmStatusMessage.style.color = 'var(--error-color)';
    }
  }
}

/**
 * Sort tabs by URL
 */
async function sortTabsByUrl(): Promise<void> {
  try {
    const currentWindow = await chrome.windows.getCurrent();
    if (currentWindow.id) {
      await tabManager.sortTabsByUrl(currentWindow.id);
      await loadTabs();
    } else {
      showError("Could not determine current window ID");
    }
  } catch (error) {
    console.error('Error sorting tabs by URL:', error);
    showError(`Failed to sort tabs by URL. ${(error as Error).message}`);
  }
}

/**
 * Sort tabs by title
 */
async function sortTabsByTitle(): Promise<void> {
  try {
    const currentWindow = await chrome.windows.getCurrent();
    if (currentWindow.id) {
      await tabManager.sortTabsByTitle(currentWindow.id);
      await loadTabs();
    } else {
      showError("Could not determine current window ID");
    }
  } catch (error) {
    console.error('Error sorting tabs by title:', error);
    showError(`Failed to sort tabs by title. ${(error as Error).message}`);
  }
}

/**
 * Find and show duplicate tabs
 */
async function findDuplicates(): Promise<void> {
  try {
    const duplicateGroups = await duplicateDetector.findDuplicatesAcrossWindows();

    if (duplicateGroups.length === 0) {
      showInfo('No duplicate tabs found.');
      return;
    }

    // Show a modal or update UI with duplicates
    showDuplicatesModal(duplicateGroups);
  } catch (error) {
    console.error('Error finding duplicates:', error);
    showError(`Failed to find duplicate tabs. ${(error as Error).message}`);
  }
}

/**
 * Group tabs by topic using LLM
 */
async function groupTabsByTopic(): Promise<void> {
  try {
    const currentWindow = await chrome.windows.getCurrent();
    const tabs = await tabManager.getTabsInWindow(currentWindow.id!);

    // Filter tabs that are not in a group
    const ungroupedTabs = tabs.filter(tab => {
      // TAB_GROUP_ID_NONE is -1 in Chrome API
      return tab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE || tab.groupId === -1;
    });

    if (ungroupedTabs.length === 0) {
      showInfo('No ungrouped tabs to organize.');
      return;
    }

    const tabIds = ungroupedTabs
      .map(tab => tab.id)
      .filter((id): id is number => typeof id === 'number');

    // Show loading state
    const groupByTopicBtn = document.getElementById('group-by-topic-btn') as HTMLButtonElement | null;
    if (groupByTopicBtn) {
      groupByTopicBtn.disabled = true;
      groupByTopicBtn.textContent = 'Grouping...';
    }

    try {
      const groups = await groupManager.groupTabsByTopic(tabIds);

      if (groups.length > 0) {
        showSuccess(`Created ${groups.length} tab groups.`);
      } else {
        showInfo('No groups were created.');
      }

      await loadGroups();
    } finally {
      // Reset button
      if (groupByTopicBtn) {
        groupByTopicBtn.disabled = false;
        groupByTopicBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
            <line x1="12" y1="22.08" x2="12" y2="12"></line>
          </svg>
          Group by Topic
        `;
      }
    }
  } catch (error) {
    console.error('Error grouping tabs by topic:', error);
    showError(`Failed to group tabs by topic. ${(error as Error).message}`);
  }
}

/**
 * Summarize the current tab using LLM
 */
async function summarizeCurrentTab(): Promise<void> {
  try {
    // Get the current active tab
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!activeTab || !activeTab.id) {
      showError('No active tab found.');
      return;
    }

    // Show the modal with loading state
    if (summaryContent && summaryModal) {
      summaryContent.innerHTML = '<div class="loading">Generating summary...</div>';
      summaryModal.style.display = 'block';
    }

    // Get the summary
    const summary = await llmService.summarizeTab(activeTab.id);

    // Update the modal content
    if (summaryContent) {
      summaryContent.textContent = summary;
    }
  } catch (error) {
    console.error('Error summarizing tab:', error);
    if (summaryContent) {
      summaryContent.innerHTML = `<div class="error">Failed to generate summary: ${(error as Error).message}</div>`;
    }
  }
}

/**
 * Summarize a tab group using LLM
 * @param {number} groupId - Group ID to summarize
 */
async function summarizeGroup(groupId: number): Promise<void> {
  try {
    // Show the modal with loading state
    if (summaryContent && summaryModal) {
      summaryContent.innerHTML = '<div class="loading">Generating group summary...</div>';
      summaryModal.style.display = 'block';
    }

    // Get the summary
    const summary = await llmService.summarizeGroup(groupId);

    // Update the modal content
    if (summaryContent) {
      summaryContent.textContent = summary;
    }
  } catch (error) {
    console.error('Error summarizing group:', error);
    if (summaryContent) {
      summaryContent.innerHTML = `<div class="error">Failed to generate group summary: ${(error as Error).message}</div>`;
    }
  }
}

/**
 * Save the current tab groups configuration
 */
async function saveCurrentGroups(): Promise<void> {
  try {
    const currentWindow = await chrome.windows.getCurrent();
    const groups = await chrome.tabGroups.query({ windowId: currentWindow.id });

    if (groups.length === 0) {
      showInfo('No tab groups to save.');
      return;
    }

    // Collect tab information for each group
    const groupsToSave = [];

    for (const group of groups) {
      const tabs = await chrome.tabs.query({ groupId: group.id });

      groupsToSave.push({
        title: group.title,
        color: group.color,
        tabs: tabs.map(tab => ({
          title: tab.title || 'Untitled',
          url: tab.url || '',
          favIconUrl: tab.favIconUrl || ''
        }))
      });

      // Save groups to storage using StorageManager
      if (tabs.length > 0) {
        const tabIds = tabs
          .map(tab => tab.id)
          .filter((id): id is number => id !== undefined);

        if (tabIds.length > 0) {
          await storageManager.saveTabGroup(
            group.title || `Group ${new Date().toLocaleString()}`,
            tabIds
          );
        }
      }
    }

    showSuccess('Tab groups saved successfully.');
  } catch (error) {
    console.error('Error saving groups:', error);
    showError(`Failed to save tab groups. ${(error as Error).message}`);
  }
}

/**
 * Save the current session (all windows and tabs)
 */
async function saveCurrentSession(): Promise<void> {
  try {
    const windows = await chrome.windows.getAll({ populate: true });

    if (windows.length === 0) {
      showInfo('No windows to save.');
      return;
    }

    const sessionData = {
      windows: windows.map(window => ({
        tabs: window.tabs?.map(tab => ({
          title: tab.title || 'Untitled',
          url: tab.url || '',
          active: tab.active || false,
          pinned: tab.pinned || false,
          groupId: tab.groupId
        })) || []
      }))
    };

    // Save session to storage
    await storageManager.saveTabSession(`Session ${new Date().toLocaleString()}`, sessionData);

    showSuccess('Session saved successfully.');
  } catch (error) {
    console.error('Error saving session:', error);
    showError(`Failed to save session. ${(error as Error).message}`);
  }
}

/**
 * Show a modal with duplicate tabs information
 * @param {DuplicateGroup[]} duplicateGroups - Groups of duplicate tabs
 */
function showDuplicatesModal(duplicateGroups: DuplicateGroup[]): void {
  // Get total number of duplicates
  const count = duplicateGroups.reduce((sum, group) => sum + group.duplicates.length, 0);

  // Create modal content
  const modalTitle = document.createElement('div');
  modalTitle.className = 'modal-title';
  modalTitle.textContent = 'Duplicate Tabs Found';

  const modalContent = document.createElement('div');
  modalContent.className = 'modal-content';

  if (count === 0) {
    modalContent.innerHTML = '<p>No duplicate tabs found.</p>';
  } else {
    // Create summary
    const summary = document.createElement('div');
    summary.className = 'duplicate-summary';
    summary.textContent = `Found ${count} duplicate tab${count === 1 ? '' : 's'} across ${duplicateGroups.length} group${duplicateGroups.length === 1 ? '' : 's'}.`;
    modalContent.appendChild(summary);

    // Create action buttons
    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'duplicate-actions';

    const mergeAllBtn = document.createElement('button');
    mergeAllBtn.className = 'merge-all-btn';
    mergeAllBtn.textContent = 'Merge All Duplicates';
    mergeAllBtn.addEventListener('click', async () => {
      await duplicateDetector.closeDuplicates(duplicateGroups);
      showSuccess(`Closed ${count} duplicate tab${count === 1 ? '' : 's'}`);
      closeModal();
    });
    actionsContainer.appendChild(mergeAllBtn);

    const groupAllBtn = document.createElement('button');
    groupAllBtn.className = 'group-all-btn';
    groupAllBtn.textContent = 'Group Duplicates';
    groupAllBtn.addEventListener('click', async () => {
      await duplicateDetector.groupDuplicates(duplicateGroups);
      showSuccess(`Grouped ${duplicateGroups.length} sets of duplicate tabs`);
      closeModal();
    });
    actionsContainer.appendChild(groupAllBtn);

    modalContent.appendChild(actionsContainer);

    // Create list of duplicate groups
    const groupsList = document.createElement('div');
    groupsList.className = 'duplicate-groups-list';

    duplicateGroups.forEach((group, groupIndex) => {
      const groupContainer = document.createElement('div');
      groupContainer.className = 'duplicate-group';

      const groupHeader = document.createElement('div');
      groupHeader.className = 'group-header';
      groupHeader.innerHTML = `
        <h4>Group ${groupIndex + 1}</h4>
        <span class="duplicate-count">${group.duplicates.length} duplicate${group.duplicates.length === 1 ? '' : 's'}</span>
        <button class="merge-group-btn">Merge Group</button>
      `;

      // Add event listener to merge this specific group
      groupHeader.querySelector('.merge-group-btn')?.addEventListener('click', async () => {
        await duplicateDetector.closeDuplicates([group]);
        groupContainer.remove();

        // Check if there are any groups left
        const remainingGroups = groupsList.querySelectorAll('.duplicate-group');
        if (remainingGroups.length === 0) {
          closeModal();
        } else {
          // Update the summary
          const remainingCount = Array.from(duplicateGroups)
            .filter((_, i) => i !== groupIndex)
            .reduce((sum, g) => sum + g.duplicates.length, 0);
          summary.textContent = `Found ${remainingCount} duplicate tab${remainingCount === 1 ? '' : 's'} across ${remainingGroups.length} group${remainingGroups.length === 1 ? '' : 's'}.`;
        }
      });

      groupContainer.appendChild(groupHeader);

      // Add the original tab
      const tabsList = document.createElement('div');
      tabsList.className = 'tabs-list';

      const originalTabElem = document.createElement('div');
      originalTabElem.className = 'tab-item original-tab';
      originalTabElem.innerHTML = `
        <img class="tab-favicon" src="${group.original.favIconUrl || '../images/icon.svg'}" alt="Favicon">
        <div class="tab-info">
          <div class="tab-title">${escapeHtml(group.original.title || 'Untitled')}</div>
          <div class="tab-url">${escapeHtml(group.original.url || '')}</div>
        </div>
        <div class="tab-label original-label">Original</div>
      `;
      tabsList.appendChild(originalTabElem);

      // Original tab click focuses that tab
      originalTabElem.addEventListener('click', () => {
        if (group.original.id) {
          tabManager.focusTab(group.original.id);
        }
      });

      // Add the duplicate tabs
      group.duplicates.forEach(tab => {
        const duplicateTabElem = document.createElement('div');
        duplicateTabElem.className = 'tab-item duplicate-tab';
        duplicateTabElem.innerHTML = `
          <img class="tab-favicon" src="${tab.favIconUrl || '../images/icon.svg'}" alt="Favicon">
          <div class="tab-info">
            <div class="tab-title">${escapeHtml(tab.title || 'Untitled')}</div>
            <div class="tab-url">${escapeHtml(tab.url || '')}</div>
          </div>
          <div class="tab-buttons">
            <button class="close-tab" data-tab-id="${tab.id}" title="Close tab">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        `;

        // Add event listener to close this specific tab
        duplicateTabElem.querySelector('.close-tab')?.addEventListener('click', async (e) => {
          e.stopPropagation();
          const element = e.currentTarget as HTMLElement;
          const tabId = parseInt(element.dataset.tabId || '0');
          if (tabId) {
            await tabManager.closeTab(tabId);
            duplicateTabElem.remove();

            // Update the duplicate count for this group
            const duplicateTabsCount = tabsList.querySelectorAll('.duplicate-tab').length;
            const countElem = groupHeader.querySelector('.duplicate-count');
            if (countElem) {
              countElem.textContent = `${duplicateTabsCount} duplicate${duplicateTabsCount === 1 ? '' : 's'}`;
            }

            // If no duplicates left in this group, remove the group
            if (duplicateTabsCount === 0) {
              groupContainer.remove();

              // Check if there are any groups left
              const remainingGroups = groupsList.querySelectorAll('.duplicate-group');
              if (remainingGroups.length === 0) {
                closeModal();
              }
            }
          }
        });

        // Tab click focuses that tab
        duplicateTabElem.addEventListener('click', (e) => {
          // Don't trigger if clicking the close button
          if (!(e.target as HTMLElement).closest('.tab-buttons')) {
            if (tab.id) {
              tabManager.focusTab(tab.id);
            }
          }
        });

        tabsList.appendChild(duplicateTabElem);
      });

      groupContainer.appendChild(tabsList);
      groupsList.appendChild(groupContainer);
    });

    modalContent.appendChild(groupsList);
  }

  // Create or use existing modal
  const modal = document.getElementById('duplicate-modal') || document.createElement('div');
  modal.id = 'duplicate-modal';
  modal.className = 'modal';
  modal.innerHTML = '';

  const modalClose = document.createElement('button');
  modalClose.className = 'close-modal';
  modalClose.innerHTML = '&times;';
  modalClose.addEventListener('click', closeModal);

  const modalHeader = document.createElement('div');
  modalHeader.className = 'modal-header';
  modalHeader.appendChild(modalTitle);
  modalHeader.appendChild(modalClose);

  const modalBody = document.createElement('div');
  modalBody.className = 'modal-body';
  modalBody.appendChild(modalContent);

  modal.appendChild(modalHeader);
  modal.appendChild(modalBody);

  // Add to document if not already there
  if (!document.getElementById('duplicate-modal')) {
    document.body.appendChild(modal);
  }

  // Show modal
  modal.style.display = 'block';

  // Function to close the modal
  function closeModal() {
    modal.style.display = 'none';
  }

  // Close when clicking outside the modal
  window.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });
}

/**
 * Open the options page
 */
function openOptions(): void {
  chrome.runtime.openOptionsPage();
}

/**
 * Open the sidebar
 */
function openSidebar(): void {
  // Get the actual window ID first, then open the side panel
  chrome.windows.getCurrent().then(window => {
    if (window.id) {
      chrome.sidePanel.open({ windowId: window.id });
    } else {
      console.error("Could not determine current window ID");
    }
  });
}

/**
 * Open the sessions page
 */
function openSessionsPage(): void {
  // Open a new tab with the sessions page
  chrome.tabs.create({ url: 'views/sessions.html' });
}

/**
 * Show a success message
 * @param {string} message - Message to show
 */
function showSuccess(message: string): void {
  // Implementation depends on the UI design
  alert(message);
}

/**
 * Show an info message
 * @param {string} message - Message to show
 */
function showInfo(message: string): void {
  // Implementation depends on the UI design
  alert(message);
}

/**
 * Show an error message
 * @param {string} message - Message to show
 */
function showError(message: string): void {
  // Implementation depends on the UI design
  alert(message);
}

/**
 * Escape HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Initialize theme for the popup
 */
async function initializeTheme(): Promise<void> {
  try {
    const theme = await storageManager.getTheme();
    document.documentElement.setAttribute('data-theme', theme);
    
    // Apply theme-specific CSS variables to match sidebar styling
    if (theme === 'dark') {
      document.documentElement.style.setProperty('--background-color', '#1e1e1e');
      document.documentElement.style.setProperty('--text-color', '#ffffff');
      document.documentElement.style.setProperty('--border-color', '#444444');
      document.documentElement.style.setProperty('--hover-background', '#333333');
      document.documentElement.style.setProperty('--active-color', '#2a7fff');
      document.documentElement.style.setProperty('--light-text', '#cccccc');
      document.documentElement.style.setProperty('--success-color', '#4caf50');
      document.documentElement.style.setProperty('--error-color', '#f44336');
    } else {
      document.documentElement.style.setProperty('--background-color', '#ffffff');
      document.documentElement.style.setProperty('--text-color', '#333333');
      document.documentElement.style.setProperty('--border-color', '#dddddd');
      document.documentElement.style.setProperty('--hover-background', '#f5f5f5');
      document.documentElement.style.setProperty('--active-color', '#2a7fff');
      document.documentElement.style.setProperty('--light-text', '#666666');
      document.documentElement.style.setProperty('--success-color', '#4caf50');
      document.documentElement.style.setProperty('--error-color', '#f44336');
    }

    // Apply theme to body element as well
    document.body.setAttribute('data-theme', theme);
  } catch (error) {
    console.error('Error initializing theme:', error);
  }
}