/**
 * LLM Service for PsiTabs
 * Handles interactions with Language Learning Models for intelligent tab features
 */

import { StorageManager } from './storage-manager';
import { TabManager } from './tab-manager';

// Define Color enum for chrome.tabGroups if it's not provided
declare namespace chrome.tabGroups {
  type Color = 'grey' | 'blue' | 'red' | 'yellow' | 'green' | 'pink' | 'purple' | 'cyan' | 'orange';
}

interface TabDetail {
  id: number;
  title: string;
  url: string;
  content: string;
}

interface TabSummary {
  title: string;
  url: string;
  content?: string;
  error?: string;
}

interface TabGroup {
  name: string;
  tabIds: number[];
  color?: chrome.tabGroups.Color;
}

interface LLMSettings {
  llmProvider: string;
  llmApiKey: string;
  llmEndpoint: string;
  customLLMHeaders?: Record<string, string>;
}

export class LLMService {
  private storageManager: StorageManager;
  private tabManager: TabManager;

  constructor() {
    this.storageManager = new StorageManager();
    this.tabManager = new TabManager();
  }

  /**
   * Check if the LLM is configured with valid credentials
   * @returns {Promise<boolean>} Whether the LLM is configured
   */
  async isConfigured(): Promise<boolean> {
    try {
      const settings = await this.storageManager.getSettings();

      // Check for required settings based on provider
      switch (settings.llmProvider) {
        case 'azure':
          return !!(settings.llmApiKey && settings.llmEndpoint);
        case 'openai':
          return !!settings.llmApiKey;
        case 'anthropic':
          return !!settings.llmApiKey;
        case 'custom':
          return !!(settings.llmApiKey && settings.llmEndpoint);
        default:
          return false;
      }
    } catch (error) {
      console.error('Error checking LLM configuration:', error);
      return false;
    }
  }

  /**
   * Summarize the content of a tab
   * @param {number} tabId - The tab ID to summarize
   * @returns {Promise<string>} The summary text
   */
  async summarizeTab(tabId: number): Promise<string> {
    try {
      // Check if LLM is configured
      if (!(await this.isConfigured())) {
        throw new Error('LLM is not configured');
      }

      // Get tab details
      const tab = await chrome.tabs.get(tabId);

      // Get tab content through a content script
      const content = await this.getTabContent(tabId);

      if (!content || content.length < 50) {
        return `Unable to generate summary for "${tab.title}". Not enough content available.`;
      }

      // Prepare prompt
      const prompt = `Summarize the following webpage content in 3-5 concise bullet points:

URL: ${tab.url}
Title: ${tab.title}

Content:
${content.slice(0, 10000)} ${content.length > 10000 ? '...(content truncated)' : ''}`;

      // Call LLM
      const summary = await this._callLLM(prompt);

      return summary;
    } catch (error) {
      console.error('Error summarizing tab:', error);
      throw new Error(`Failed to summarize tab: ${(error as Error).message}`);
    }
  }

  /**
   * Get the content of a tab using a content script
   * @param {number} tabId - The tab ID to get content from
   * @returns {Promise<string>} The tab content
   */
  private async getTabContent(tabId: number): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        chrome.scripting.executeScript({
          target: { tabId },
          // Use an IIFE instead of the function property
          func: () => {
            // Simple text extraction from the page
            const bodyText = document.body.innerText || '';
            const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
            const h1Text = Array.from(document.querySelectorAll('h1'))
              .map(h => h.innerText)
              .join('\n');
            const h2Text = Array.from(document.querySelectorAll('h2'))
              .map(h => h.innerText)
              .join('\n');

            return {
              bodyText: bodyText.substring(0, 20000), // Limit size
              metaDescription,
              h1Text,
              h2Text
            };
          }
        }, (results) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          if (!results || results.length === 0 || !results[0].result) {
            resolve('');
            return;
          }

          // Define the expected type structure to avoid property access errors
          interface ScriptResult {
            bodyText?: string;
            metaDescription?: string;
            h1Text?: string;
            h2Text?: string;
          }

          // Cast the result to the expected type
          const content = results[0].result as ScriptResult;

          // Use optional chaining to safely access properties
          const combinedText = `
${content?.metaDescription ? `Description: ${content.metaDescription}\n\n` : ''}
${content?.h1Text ? `Main Headings:\n${content.h1Text}\n\n` : ''}
${content?.h2Text ? `Subheadings:\n${content.h2Text}\n\n` : ''}
Content:
${content?.bodyText || ''}
          `;

          resolve(combinedText);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Summarize the content of a group of tabs
   * @param {number} groupId - The group ID to summarize
   * @returns {Promise<string>} The summary text
   */
  async summarizeGroup(groupId: number): Promise<string> {
    try {
      // Check if LLM is configured
      if (!(await this.isConfigured())) {
        throw new Error('LLM is not configured');
      }

      // Get tabs in the group
      const tabs = await chrome.tabs.query({ groupId });

      if (tabs.length === 0) {
        return 'No tabs found in this group.';
      }

      // Get group details
      const group = await chrome.tabGroups.get(groupId);

      // Prepare tab summaries
      const tabSummaries: TabSummary[] = [];

      for (const tab of tabs) {
        try {
          // Get a short summary of each tab (limit to first 3-5 tabs to avoid excessive API usage)
          if (tabSummaries.length < 5 && tab.id !== undefined) {
            const content = await this.getTabContent(tab.id);

            if (content && content.length > 50) {
              tabSummaries.push({
                title: tab.title || 'Untitled',
                url: tab.url || '',
                content: content.slice(0, 2000) // Limit content size
              });
            } else {
              tabSummaries.push({
                title: tab.title || 'Untitled',
                url: tab.url || '',
                content: 'No significant content available'
              });
            }
          } else {
            // For remaining tabs, just include title and URL
            tabSummaries.push({
              title: tab.title || 'Untitled',
              url: tab.url || ''
            });
          }
        } catch (error) {
          console.error(`Error processing tab ${tab.id}:`, error);
          tabSummaries.push({
            title: tab.title || 'Untitled',
            url: tab.url || '',
            error: 'Failed to process this tab'
          });
        }
      }

      // Prepare prompt
      const prompt = `Provide a summary of this group of related tabs:

Group: "${group.title || 'Unnamed group'}" (${tabs.length} tabs)

Tab details:
${tabSummaries.map((tab, index) => `
Tab ${index + 1}: ${tab.title}
URL: ${tab.url}
${tab.content ? `Content preview: ${tab.content.slice(0, 500)}... (truncated)` : ''}
`).join('\n')}

Please provide:
1. A 1-2 sentence overall summary of what these tabs are about collectively
2. The main theme or purpose of this tab group
3. A suggested name for this group of tabs, if the current name "${group.title || 'Unnamed group'}" could be improved`;

      // Call LLM
      const summary = await this._callLLM(prompt);

      return summary;
    } catch (error) {
      console.error('Error summarizing tab group:', error);
      throw new Error(`Failed to summarize tab group: ${(error as Error).message}`);
    }
  }

  /**
   * Find tabs similar to a reference tab
   * @param {number} tabId - Reference tab ID
   * @returns {Promise<number[]>} Array of similar tab IDs
   */
  async findSimilarTabs(tabId: number): Promise<number[]> {
    try {
      // Check if LLM is configured
      if (!(await this.isConfigured())) {
        throw new Error('LLM is not configured');
      }

      // Get reference tab
      const referenceTab = await chrome.tabs.get(tabId);

      // Get all tabs in the same window
      const allTabs = await chrome.tabs.query({ windowId: referenceTab.windowId });

      // Filter out the reference tab itself and tabs that are already in a group
      const eligibleTabs = allTabs.filter(tab => 
        tab.id !== tabId && 
        tab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE &&
        tab.url && 
        !tab.url.startsWith('chrome://') && 
        !tab.url.startsWith('edge://') && 
        tab.url !== 'about:blank'
      );

      if (eligibleTabs.length === 0) {
        return [];
      }

      // Get content of reference tab
      const referenceContent = referenceTab.id ? await this.getTabContent(referenceTab.id) : '';

      // Prepare tab details for comparison
      const tabDetails = eligibleTabs.map(tab => ({
        id: tab.id,
        title: tab.title || 'Untitled',
        url: tab.url || ''
      }));

      // Prepare prompt
      const prompt = `I have a browser tab that I want to group with similar tabs. Here's the reference tab:

Reference Tab:
Title: ${referenceTab.title}
URL: ${referenceTab.url}
${referenceContent ? `Content snippet: ${referenceContent.slice(0, 1000)}... (truncated)` : ''}

And here are other tabs that might be similar:

${tabDetails.map((tab, index) => `
Tab ${index + 1} (ID: ${tab.id}):
Title: ${tab.title}
URL: ${tab.url}
`).join('\n')}

Based on topic similarity, which of these tabs should be grouped with the reference tab?
Please respond ONLY with the tab IDs that should be grouped with the reference tab, as a comma-separated list (e.g., "123, 456, 789").
If none of the tabs are similar enough to group, respond with "none".`;

      // Call LLM
      const response = await this._callLLM(prompt);

      // Parse the response to extract tab IDs
      if (response.toLowerCase().includes('none')) {
        return [];
      }

      // Extract numbers from the response
      const idMatches = response.match(/\d+/g);
      if (!idMatches) {
        return [];
      }

      // Convert to numbers and validate that they're in the eligible tabs list
      const similarTabIds = idMatches
        .map(idStr => parseInt(idStr, 10))
        .filter(id => eligibleTabs.some(tab => tab.id === id));

      return similarTabIds;
    } catch (error) {
      console.error('Error finding similar tabs:', error);
      return [];
    }
  }

  /**
   * Suggest groupings for tabs based on their content
   * @param {number[]} tabIds - Array of tab IDs to analyze
   * @returns {Promise<TabGroup[]>} Suggested tab groupings
   */
  async suggestTabGroups(tabIds: number[]): Promise<TabGroup[]> {
    try {
      // Check if LLM is configured
      if (!(await this.isConfigured())) {
        throw new Error('LLM is not configured');
      }

      // Get tabs
      const tabDetailsPromises = tabIds.map(async (tabId) => {
        try {
          const tab = await chrome.tabs.get(tabId);

          // Get minimal content to avoid excessive token usage
          let content = '';
          try {
            content = await this.getTabContent(tabId);
            content = content.slice(0, 1000); // Limit to first 1000 characters
          } catch (error) {
            console.error(`Error getting content for tab ${tabId}:`, error);
          }

          return {
            id: tab.id || 0,
            title: tab.title || 'Untitled',
            url: tab.url || '',
            content
          };
        } catch (error) {
          console.error(`Error processing tab ${tabId}:`, error);
          return null;
        }
      });

      const tabDetailsResults = await Promise.all(tabDetailsPromises);
      const tabDetails: TabDetail[] = tabDetailsResults.filter((tab): tab is TabDetail => tab !== null);

      if (tabDetails.length === 0) {
        throw new Error('No valid tabs to analyze');
      }

      // Split into batches if there are many tabs to avoid token limits
      const MAX_TABS_PER_BATCH = 10;
      const tabBatches: TabDetail[][] = [];

      for (let i = 0; i < tabDetails.length; i += MAX_TABS_PER_BATCH) {
        tabBatches.push(tabDetails.slice(i, i + MAX_TABS_PER_BATCH));
      }

      // Process each batch
      const results: TabGroup[] = [];

      for (const batch of tabBatches) {
        // Prepare prompt
        const prompt = `Analyze these browser tabs and suggest how they should be grouped by topic or purpose:

${batch.map((tab, index) => `
Tab ${index + 1} (ID: ${tab.id}):
Title: ${tab.title}
URL: ${tab.url}
Content preview: ${tab.content ? tab.content.slice(0, 200) + '...' : 'No content available'}
`).join('\n')}

Provide your response in this format:
Group 1 Name: [suggested name]
- Tab IDs: [comma-separated list of tab IDs to include]
- Reason: [brief explanation why these tabs belong together]

Group 2 Name: [suggested name] 
- Tab IDs: [comma-separated list of tab IDs to include]
- Reason: [brief explanation why these tabs belong together]

... and so on.

Some guidelines:
- A tab should only belong to one group
- Not every tab needs to be in a group; leave obviously unrelated tabs ungrouped
- Groups should have at least 2 tabs
- Group names should be concise (1-3 words)
- Focus on content similarity, not just domain similarity`;

        try {
          // Call LLM to analyze this batch
          const analysis = await this._callLLM(prompt);

          // Parse the LLM response to extract group information
          const groups = this._parseGroupAnalysis(analysis, batch);

          results.push(...groups);
        } catch (error) {
          console.error('Error analyzing tab batch:', error);
        }
      }

      return results;
    } catch (error) {
      console.error('Error analyzing tabs for grouping:', error);
      throw error;
    }
  }

  /**
   * Parse the LLM response to extract group information
   * @param {string} analysisText - The LLM analysis response
   * @param {TabDetail[]} tabBatch - The batch of tabs that was analyzed
   * @returns {TabGroup[]} Extracted group information
   * @private
   */
  private _parseGroupAnalysis(analysisText: string, tabBatch: TabDetail[]): TabGroup[] {
    const tabIds = tabBatch.map(tab => tab.id);
    const groups: TabGroup[] = [];

    try {
      // Split the text by group
      const groupLines = analysisText.split(/Group \d+ Name:|^[A-Za-z]+ Group:/m);

      for (let i = 1; i < groupLines.length; i++) { // Start from 1 to skip the intro text
        const groupText = groupLines[i].trim();

        // Skip if empty
        if (!groupText) continue;

        // Extract group name (first line)
        const groupNameMatch = groupText.match(/^[^\n]+/);
        if (!groupNameMatch) continue;

        const groupName = groupNameMatch[0].trim();

        // Extract tab IDs
        let tabIdMatch = groupText.match(/Tab IDs:([^\n]+)/);
        if (!tabIdMatch) {
          // Try alternative format
          tabIdMatch = groupText.match(/Tabs?:([^\n]+)/);
        }

        if (!tabIdMatch) continue;

        const tabIdText = tabIdMatch[1].trim();
        let groupTabIds: number[] = [];

        // Parse tab IDs: could be numbers or "Tab 1, Tab 2" format
        if (/Tab \d+/.test(tabIdText)) {
          // Format: "Tab 1, Tab 2, Tab 3"
          const tabNumbers = tabIdText.match(/Tab (\d+)/g)?.map(t => parseInt(t.replace('Tab ', ''), 10) - 1) || [];
          groupTabIds = tabNumbers.map(index => (index >= 0 && index < tabBatch.length) ? tabBatch[index].id : null)
                                 .filter((id): id is number => id !== null);
        } else {
          // Format: "1, 2, 3" or actual tab IDs
          groupTabIds = tabIdText.split(/[,\s]+/)
                                .map(idStr => parseInt(idStr, 10))
                                .filter(id => !isNaN(id) && tabIds.includes(id));
        }

        // Only add valid groups with at least 2 tabs
        if (groupTabIds.length >= 2) {
          groups.push({
            name: groupName,
            tabIds: groupTabIds
          });
        }
      }

      return groups;
    } catch (error) {
      console.error('Error parsing group analysis:', error);
      return [];
    }
  }

  /**
   * Call the LLM API
   * @param {string} prompt - The prompt to send to the LLM
   * @returns {Promise<string>} The LLM response
   * @private
   */
  private async _callLLM(prompt: string): Promise<string> {
    try {
      // Get settings
      const settings = await this.storageManager.getSettings();

      switch (settings.llmProvider) {
        case 'azure':
          return await this._callAzureOpenAI(prompt, settings);
        case 'openai':
          return await this._callOpenAI(prompt, settings);
        case 'anthropic':
          return await this._callAnthropic(prompt, settings);
        case 'custom':
          return await this._callCustomLLM(prompt, settings);
        default:
          throw new Error(`Unsupported LLM provider: ${settings.llmProvider}`);
      }
    } catch (error) {
      console.error('Error calling LLM:', error);
      throw error;
    }
  }

  /**
   * Call Azure OpenAI API
   * @param {string} prompt - The prompt to send
   * @param {LLMSettings} settings - The LLM settings
   * @returns {Promise<string>} The LLM response
   * @private
   */
  private async _callAzureOpenAI(prompt: string, settings: LLMSettings): Promise<string> {
    try {
      // Endpoint is required for Azure
      if (!settings.llmEndpoint) {
        throw new Error('Azure OpenAI endpoint URL is not configured');
      }

      // Ensure the endpoint is properly formatted
      const endpoint = settings.llmEndpoint.endsWith('/') 
        ? settings.llmEndpoint + 'chat/completions'
        : settings.llmEndpoint + '/chat/completions';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': settings.llmApiKey
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: 'You are a helpful browser assistant that helps users manage their tabs.' },
            { role: 'user', content: prompt }
          ],
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Azure OpenAI API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error('Error calling Azure OpenAI:', error);
      throw error;
    }
  }

  /**
   * Call OpenAI API
   * @param {string} prompt - The prompt to send
   * @param {LLMSettings} settings - The LLM settings
   * @returns {Promise<string>} The LLM response
   * @private
   */
  private async _callOpenAI(prompt: string, settings: LLMSettings): Promise<string> {
    try {
      const endpoint = settings.llmEndpoint || 'https://api.openai.com/v1/chat/completions';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.llmApiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: 'You are a helpful browser assistant that helps users manage their tabs.' },
            { role: 'user', content: prompt }
          ],
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error('Error calling OpenAI:', error);
      throw error;
    }
  }

  /**
   * Call Anthropic Claude API
   * @param {string} prompt - The prompt to send
   * @param {LLMSettings} settings - The LLM settings
   * @returns {Promise<string>} The LLM response
   * @private
   */
  private async _callAnthropic(prompt: string, settings: LLMSettings): Promise<string> {
    try {
      const endpoint = settings.llmEndpoint || 'https://api.anthropic.com/v1/messages';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': settings.llmApiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-instant-1',
          messages: [
            { role: 'user', content: prompt }
          ],
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Anthropic API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      return data.content[0].text;
    } catch (error) {
      console.error('Error calling Anthropic:', error);
      throw error;
    }
  }

  /**
   * Call custom LLM API
   * @param {string} prompt - The prompt to send
   * @param {LLMSettings} settings - The LLM settings
   * @returns {Promise<string>} The LLM response
   * @private
   */
  private async _callCustomLLM(prompt: string, settings: LLMSettings): Promise<string> {
    try {
      if (!settings.llmEndpoint) {
        throw new Error('Custom LLM endpoint URL is not configured');
      }

      // Build headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Add API key if provided
      if (settings.llmApiKey) {
        headers['Authorization'] = `Bearer ${settings.llmApiKey}`;
      }

      // Add custom headers
      if (settings.customLLMHeaders) {
        for (const [key, value] of Object.entries(settings.customLLMHeaders)) {
          headers[key] = value;
        }
      }

      // Make request
      const response = await fetch(settings.llmEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          prompt,
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Custom LLM API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();

      // Handle various response formats
      if (data.choices && data.choices.length > 0) {
        // OpenAI-like format
        if (data.choices[0].message && data.choices[0].message.content) {
          return data.choices[0].message.content;
        } else if (data.choices[0].text) {
          return data.choices[0].text;
        }
      } else if (data.content) {
        // Anthropic-like format
        if (Array.isArray(data.content) && data.content.length > 0) {
          return data.content[0].text || data.content[0].value || data.content[0];
        } else {
          return data.content;
        }
      } else if (data.response || data.output || data.result || data.text || data.answer) {
        // Common response fields
        return data.response || data.output || data.result || data.text || data.answer;
      }

      // If we can't figure out the format, return the entire response
      return JSON.stringify(data);
    } catch (error) {
      console.error('Error calling custom LLM:', error);
      throw error;
    }
  }
}