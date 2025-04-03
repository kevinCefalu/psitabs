import { TabManager } from '../../services/tab-manager';
import { GroupManager } from '../../services/group-manager';
import { DuplicateDetector, DuplicateGroup } from '../../services/duplicate-detector';
import { LLMService } from '../../services/llm-service';
import { StorageManager } from '../../services/storage-manager';

document.addEventListener('DOMContentLoaded', async () => {
  const tabManager = new TabManager();
  const groupManager = new GroupManager();
  const duplicateDetector = new DuplicateDetector();
  const llmService = new LLMService();
  const storageManager = new StorageManager();

  // DOM elements
  const navItems = document.querySelectorAll('.nav-item');
  const contentPanels = document.querySelectorAll('.content-panel');
  const searchInput = document.getElementById('search-tabs') as HTMLInputElement;
  const clearSearchButton = document.getElementById('clear-search');
  const sortTabsSelect = document.getElementById('sort-tabs') as HTMLSelectElement;
  const refreshTabsBtn = document.getElementById('refresh-tabs-btn');
  const windowTabsContainer = document.querySelector('.window-tabs-container');
  const totalTabsCount = document.getElementById('total-tabs-count');
  const statusMessage = document.getElementById('status-message');
  const optionsBtn = document.getElementById('options-btn');
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const lightThemeIcon = document.getElementById('light-theme-icon');
  const darkThemeIcon = document.getElementById('dark-theme-icon');

  // Group panel elements
  const groupByDomainBtn = document.getElementById('group-by-domain-btn');
  const autoGroupBtn = document.getElementById('auto-group-btn');
  const createGroupBtn = document.getElementById('create-group-btn');
  const groupsContainer = document.querySelector('.groups-container');

  // Duplicates panel elements
  const scanDuplicatesBtn = document.getElementById('scan-duplicates-btn');
  const mergeAllBtn = document.getElementById('merge-all-btn') as HTMLButtonElement;
  const duplicatesContainer = document.querySelector('.duplicates-container');

  // AI panel elements
  const llmStatusElement = document.getElementById('llm-status');
  const configureAiBtn = document.getElementById('configure-ai-btn');
  const summarizeCurrentBtn = document.getElementById('summarize-current-btn') as HTMLButtonElement;
  const groupByTopicBtn = document.getElementById('group-by-topic-btn') as HTMLButtonElement;
  const generateReportBtn = document.getElementById('generate-report-btn') as HTMLButtonElement;

  // Modal elements
  const modal = document.getElementById('modal');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const closeModal = document.querySelector('.close-modal');

  // Theme management
  const initializeTheme = async () => {
    const settings = await storageManager.getSettings();
    const prefersDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

    let theme = settings.theme;

    // If set to 'system', use system preference
    if (theme === 'system') {
      theme = prefersDarkMode ? 'dark' : 'light';
    }

    applyTheme(theme);

    // Update the appearance of the theme toggle button
    updateThemeToggleButton(theme);
  };

  const applyTheme = (theme: 'light' | 'dark') => {
    document.documentElement.setAttribute('data-theme', theme);

    // Show/hide appropriate theme icon
    if (lightThemeIcon && darkThemeIcon) {
      if (theme === 'light') {
        lightThemeIcon.style.display = 'block';
        darkThemeIcon.style.display = 'none';
      } else {
        lightThemeIcon.style.display = 'none';
        darkThemeIcon.style.display = 'block';
      }
    }
  };

  const updateThemeToggleButton = (theme: 'light' | 'dark') => {
    if (lightThemeIcon && darkThemeIcon) {
      if (theme === 'light') {
        lightThemeIcon.style.display = 'block';
        darkThemeIcon.style.display = 'none';
      } else {
        lightThemeIcon.style.display = 'none';
        darkThemeIcon.style.display = 'block';
      }
    }
  };

  const toggleTheme = async () => {
    const settings = await storageManager.getSettings();
    let newTheme: 'light' | 'dark';

    // Determine the current actual theme (not the setting)
    const currentTheme = document.documentElement.getAttribute('data-theme') as 'light' | 'dark' || 'light';

    // Toggle between light and dark
    newTheme = currentTheme === 'light' ? 'dark' : 'light';

    // Apply the theme immediately
    applyTheme(newTheme);

    // Update settings to remember user choice
    await storageManager.saveSettings({ theme: newTheme });
  };

  // Add event listener to the theme toggle button
  themeToggleBtn?.addEventListener('click', toggleTheme);

  // Listen for system preference changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', async (e) => {
    const settings = await storageManager.getSettings();

    // Only auto-change if set to 'system'
    if (settings.theme === 'system') {
      const newTheme = e.matches ? 'dark' : 'light';
      applyTheme(newTheme);
    }
  });

  // Tab navigation
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');

      const tabId = item.getAttribute('data-tab');
      contentPanels.forEach(panel => {
        panel.classList.remove('active');
        if (panel.id === `${tabId}-panel`) {
          panel.classList.add('active');
        }
      });
    });
  });

  // Refresh tabs display
  const refreshTabs = async () => {
    if (!windowTabsContainer) return;

    windowTabsContainer.innerHTML = '<div class="loading">Loading tabs...</div>';
    const tabs = await tabManager.getAllTabs();

    if (totalTabsCount) {
      totalTabsCount.textContent = tabs.length.toString();
    }

    await displayTabs(tabs);
  };

  // Make window headers collapsible in the sidebar
  const toggleWindowCollapse = (windowElement: HTMLElement) => {
    const tabsList = windowElement.querySelector('.tabs-list') as HTMLElement;
    if (!tabsList) return;

    if (tabsList.classList.contains('collapsed')) {
      // Expand the window
      tabsList.classList.remove('collapsed');
      tabsList.style.display = 'block';
      const collapseIcon = windowElement.querySelector('.window-collapse-icon');
      if (collapseIcon) {
        collapseIcon.innerHTML = '−'; // Minus symbol for expanded state
        collapseIcon.setAttribute('title', 'Collapse window');
      }
    } else {
      // Collapse the window
      tabsList.classList.add('collapsed');
      tabsList.style.display = 'none';
      const collapseIcon = windowElement.querySelector('.window-collapse-icon');
      if (collapseIcon) {
        collapseIcon.innerHTML = '+'; // Plus symbol for collapsed state
        collapseIcon.setAttribute('title', 'Expand window');
      }
    }
  };

  // Display tabs in the UI
  const displayTabs = async (tabs: chrome.tabs.Tab[]) => {
    if (!windowTabsContainer) return;

    windowTabsContainer.innerHTML = '';
    // Group tabs by window
    const windowsMap = new Map<number, chrome.tabs.Tab[]>();

    tabs.forEach(tab => {
      if (tab.windowId) {
        if (!windowsMap.has(tab.windowId)) {
          windowsMap.set(tab.windowId, []);
        }
        windowsMap.get(tab.windowId)?.push(tab);
      }
    });

    // Create UI for each window and its tabs
    windowsMap.forEach((windowTabs, windowId) => {
      const windowElement = document.createElement('div');
      windowElement.className = 'window-container';
      windowElement.innerHTML = `
        <div class="window-header">
          <div class="window-title-area">
            <button class="window-collapse-icon" title="Collapse window">−</button>
            <h3 class="window-name">Window ${windowId}</h3>
          </div>
          <span class="window-tab-count">${windowTabs.length} tab${windowTabs.length === 1 ? '' : 's'}</span>
        </div>
        <div class="tabs-list"></div>
      `;

      const tabsList = windowElement.querySelector('.tabs-list');
      const windowHeader = windowElement.querySelector('.window-header');
      const collapseIcon = windowElement.querySelector('.window-collapse-icon');

      // Add click event to the window header for collapse/expand
      windowHeader?.addEventListener('click', (e) => {
        // Only toggle if the click wasn't on a button inside the header
        if (!(e.target as HTMLElement).closest('.tab-actions')) {
          toggleWindowCollapse(windowElement);
        }
      });

      // Add click event specifically to the collapse icon
      collapseIcon?.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent the header click event from firing
        toggleWindowCollapse(windowElement);
      });

      windowTabs.forEach(tab => {
        const tabElement = document.createElement('div');
        tabElement.className = 'tab-item';
        tabElement.dataset.tabId = tab.id?.toString() || '';
        tabElement.dataset.windowId = windowId.toString();

        var tabFavIconUrl = tab.favIconUrl || '../images/default-favicon.svg'; // Fallback to default icon if none provided

        // Choose the appropriate fallback favicon based on theme
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const fallbackFavicon = currentTheme === 'dark'
          ? '../images/default-favicon-dark.svg'
          : '../images/default-favicon.svg';

        // Use the theme-appropriate fallback if no favicon is provided
        tabFavIconUrl = tab.favIconUrl || fallbackFavicon;

        tabElement.innerHTML = `
          <div class="tab-icon">
            <img src="${tabFavIconUrl}" width="16px" height="16px" alt="Tab icon" onerror="this.src='../images/icon-16.png';">
          </div>
          <div class="tab-info">
            <div class="tab-title">${tab.title || 'Untitled'}</div>
            <div class="tab-url">${tab.url || ''}</div>
          </div>
          <div class="tab-actions">
            <button class="tab-close-btn" title="Close tab">✖</button>
          </div>
        `;

        tabsList?.appendChild(tabElement);

        // Add event listeners to tab elements
        tabElement.querySelector('.tab-close-btn')?.addEventListener('click', (e) => {
          e.stopPropagation();
          if (tab.id) {
            tabManager.closeTab(tab.id);
            tabElement.remove();
            updateTabCount();
          }
        });

        tabElement.addEventListener('click', () => {
          if (tab.id) {
            tabManager.focusTab(tab.id);
          }
        });
      });

      windowTabsContainer?.appendChild(windowElement);
    });

    if (windowsMap.size === 0) {
      windowTabsContainer.innerHTML = '<div class="empty-state">No tabs found</div>';
    }
  };

  // Update the total tab count
  const updateTabCount = async () => {
    const tabs = await tabManager.getAllTabs();
    if (totalTabsCount) {
      totalTabsCount.textContent = tabs.length.toString();
    }
  };

  // Search functionality
  if (searchInput) {
    searchInput.addEventListener('input', async () => {
      const searchTerm = searchInput.value.toLowerCase();
      const tabs = await tabManager.getAllTabs();

      const filteredTabs = tabs.filter(tab => {
        return (tab.title?.toLowerCase().includes(searchTerm) ||
                tab.url?.toLowerCase().includes(searchTerm));
      });

      await displayTabs(filteredTabs);
    });
  }

  // Clear search
  clearSearchButton?.addEventListener('click', () => {
    if (searchInput) {
      searchInput.value = '';
      refreshTabs();
    }
  });

  // Sort tabs
  sortTabsSelect?.addEventListener('change', async () => {
    const sortMethod = sortTabsSelect.value;
    const tabs = await tabManager.getAllTabs();
    const currentWindow = await chrome.windows.getCurrent();

    if (!currentWindow.id) {
      return;
    }

    let sortedTabs: chrome.tabs.Tab[] = [];

    // Use the window-based sorting methods
    switch (sortMethod) {
      case 'title':
        await tabManager.sortTabsByTitle(currentWindow.id);
        sortedTabs = await tabManager.getTabsInWindow(currentWindow.id);
        break;
      case 'url':
        await tabManager.sortTabsByUrl(currentWindow.id);
        sortedTabs = await tabManager.getTabsInWindow(currentWindow.id);
        break;
      case 'recent':
        await tabManager.sortTabsByRecent(currentWindow.id);
        sortedTabs = await tabManager.getTabsInWindow(currentWindow.id);
        break;
      default:
        sortedTabs = tabs;
    }

    await displayTabs(sortedTabs);
  });

  // Refresh tabs button
  refreshTabsBtn?.addEventListener('click', refreshTabs);

  // Options button
  optionsBtn?.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Scan for duplicates button
  scanDuplicatesBtn?.addEventListener('click', async () => {
    await scanForDuplicates();
  });

  // Merge all duplicates button
  mergeAllBtn?.addEventListener('click', async () => {
    await mergeAllDuplicates();
  });

  // Function to scan for duplicate tabs
  const scanForDuplicates = async () => {
    if (!duplicatesContainer) return;

    try {
      duplicatesContainer.innerHTML = '<div class="loading">Scanning for duplicates...</div>';

      // Find duplicate tabs across all windows
      const duplicateGroups = await duplicateDetector.findDuplicatesAcrossWindows();

      if (duplicateGroups.length === 0) {
        duplicatesContainer.innerHTML = '<div class="empty-state">No duplicate tabs found</div>';
        if (mergeAllBtn) mergeAllBtn.disabled = true;
        return;
      }

      if (mergeAllBtn) mergeAllBtn.disabled = false;

      // Display the duplicate groups
      let duplicatesHtml = '';
      let totalDuplicates = 0;

      duplicateGroups.forEach((group, index) => {
        totalDuplicates += group.duplicates.length;

        // Create HTML for the duplicate group
        duplicatesHtml += `
          <div class="duplicate-group" data-group-index="${index}">
            <div class="duplicate-group-header">
              <h4>Group ${index + 1}</h4>
              <span class="duplicate-count">${group.duplicates.length} duplicate${group.duplicates.length === 1 ? '' : 's'}</span>
              <button class="merge-group-btn" data-group-index="${index}">Merge</button>
            </div>
            <div class="duplicate-tabs">
              <div class="original-tab tab-item" data-tab-id="${group.original.id}">
                <div class="tab-icon">
                  <img src="${group.original.favIconUrl || '../images/default-favicon.png'}" alt="Tab icon" onerror="this.src='../images/icon-16.png';">
                </div>
                <div class="tab-info">
                  <div class="tab-title">${group.original.title || 'Untitled'}</div>
                  <div class="tab-url">${group.original.url || ''}</div>
                </div>
                <div class="tab-label original-label">Original</div>
              </div>
              <div class="duplicate-list">
        `;

        // Add each duplicate tab
        group.duplicates.forEach(tab => {
          duplicatesHtml += `
            <div class="duplicate-tab tab-item" data-tab-id="${tab.id}">
              <div class="tab-icon">
                <img src="${tab.favIconUrl || '../images/default-favicon.png'}" alt="Tab icon" onerror="this.src='../images/icon-16.png';">
              </div>
              <div class="tab-info">
                <div class="tab-title">${tab.title || 'Untitled'}</div>
                <div class="tab-url">${tab.url || ''}</div>
              </div>
              <div class="tab-actions">
                <button class="close-duplicate-btn" data-tab-id="${tab.id}" title="Close tab">×</button>
              </div>
            </div>
          `;
        });

        duplicatesHtml += `
              </div>
            </div>
          </div>
        `;
      });

      // Display the summary and duplicate groups
      duplicatesContainer.innerHTML = `
        <div class="duplicates-summary">
          <p>Found ${totalDuplicates} duplicate tab${totalDuplicates === 1 ? '' : 's'} in ${duplicateGroups.length} group${duplicateGroups.length === 1 ? '' : 's'}</p>
        </div>
        <div class="duplicate-groups">
          ${duplicatesHtml}
        </div>
      `;

      // Add event listeners for the merge group buttons
      duplicatesContainer.querySelectorAll('.merge-group-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const groupIndex = parseInt((e.currentTarget as HTMLElement).dataset.groupIndex || '0');
          await mergeDuplicateGroup(duplicateGroups[groupIndex]);
          await scanForDuplicates(); // Refresh the list
        });
      });

      // Add event listeners for the close duplicate buttons
      duplicatesContainer.querySelectorAll('.close-duplicate-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const tabId = parseInt((e.currentTarget as HTMLElement).dataset.tabId || '0');
          if (tabId) {
            await chrome.tabs.remove(tabId);
            (e.currentTarget as HTMLElement).closest('.duplicate-tab')?.remove();

            // Check if this was the last duplicate in the group
            const groupElement = (e.currentTarget as HTMLElement).closest('.duplicate-group');
            const duplicatesLeft = groupElement?.querySelectorAll('.duplicate-tab');
            if (duplicatesLeft && duplicatesLeft.length === 0) {
              groupElement?.remove();
            }

            await updateTabCount();
          }
        });
      });

      // Add event listeners for focusing on tabs by clicking on them
      duplicatesContainer.querySelectorAll('.tab-item').forEach(tabItem => {
        tabItem.addEventListener('click', (e) => {
          // Ignore clicks on buttons
          if (!(e.target as HTMLElement).closest('.tab-actions')) {
            const tabId = parseInt((tabItem as HTMLElement).dataset.tabId || '0');
            if (tabId) {
              tabManager.focusTab(tabId);
            }
          }
        });
      });

    } catch (error) {
      console.error('Error scanning for duplicates:', error);
      duplicatesContainer.innerHTML = `<div class="error">Error scanning for duplicates: ${(error as Error).message}</div>`;
    }
  };

  // Function to merge a specific duplicate group
  const mergeDuplicateGroup = async (group: DuplicateGroup) => {
    try {
      // Get IDs of all duplicate tabs in the group
      const duplicateIds = group.duplicates
        .map(tab => tab.id)
        .filter((id): id is number => id !== undefined);

      if (duplicateIds.length === 0) return;

      // Close all duplicate tabs
      await chrome.tabs.remove(duplicateIds);

      // Focus the original tab
      if (group.original.id) {
        await tabManager.focusTab(group.original.id);
      }

      // Show a success message
      if (statusMessage) {
        statusMessage.textContent = `Merged ${duplicateIds.length} duplicate tab${duplicateIds.length === 1 ? '' : 's'}`;
        statusMessage.className = 'status-success';
        setTimeout(() => {
          statusMessage.textContent = '';
          statusMessage.className = '';
        }, 3000);
      }

      await updateTabCount();
    } catch (error) {
      console.error('Error merging duplicate group:', error);
      if (statusMessage) {
        statusMessage.textContent = `Error merging duplicates: ${(error as Error).message}`;
        statusMessage.className = 'status-error';
        setTimeout(() => {
          statusMessage.textContent = '';
          statusMessage.className = '';
        }, 5000);
      }
    }
  };

  // Function to merge all duplicate groups
  const mergeAllDuplicates = async () => {
    try {
      const duplicateGroups = await duplicateDetector.findDuplicatesAcrossWindows();

      if (duplicateGroups.length === 0) {
        if (statusMessage) {
          statusMessage.textContent = 'No duplicate tabs found';
          statusMessage.className = 'status-info';
          setTimeout(() => {
            statusMessage.textContent = '';
            statusMessage.className = '';
          }, 3000);
        }
        return;
      }

      let totalClosed = 0;

      // Merge each group
      for (const group of duplicateGroups) {
        const duplicateIds = group.duplicates
          .map(tab => tab.id)
          .filter((id): id is number => id !== undefined);

        if (duplicateIds.length > 0) {
          await chrome.tabs.remove(duplicateIds);
          totalClosed += duplicateIds.length;
        }
      }

      // Show success message
      if (statusMessage) {
        statusMessage.textContent = `Closed ${totalClosed} duplicate tab${totalClosed === 1 ? '' : 's'}`;
        statusMessage.className = 'status-success';
        setTimeout(() => {
          statusMessage.textContent = '';
          statusMessage.className = '';
        }, 3000);
      }

      await updateTabCount();
      await scanForDuplicates(); // Refresh the duplicates panel
    } catch (error) {
      console.error('Error merging all duplicates:', error);
      if (statusMessage) {
        statusMessage.textContent = `Error merging duplicates: ${(error as Error).message}`;
        statusMessage.className = 'status-error';
        setTimeout(() => {
          statusMessage.textContent = '';
          statusMessage.className = '';
        }, 5000);
      }
    }
  };

  // Initialize the sidepanel
  await initializeTheme();
  await refreshTabs();

  // Automatically scan for duplicates when the sidepanel is opened
  await scanForDuplicates();

  // Listen for tab changes to update duplicate detection
  chrome.tabs.onCreated.addListener(async () => {
    await updateTabCount();
    // Consider checking for duplicates automatically when new tabs are created
    // You can uncomment the line below if you want this behavior
    // await scanForDuplicates();
  });

  chrome.tabs.onRemoved.addListener(async () => {
    await updateTabCount();
  });

  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
    if (changeInfo.status === 'complete') {
      await updateTabCount();
      // Consider checking for duplicates when tabs are fully loaded
      // You can uncomment the line below if you want this behavior
      // await scanForDuplicates();
    }
  });
});