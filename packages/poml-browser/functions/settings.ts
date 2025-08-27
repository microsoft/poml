import { SettingsBundle } from './types';
import { everywhere } from './everywhere';

// Cache for settings to avoid repeated storage calls
let cachedSettings: SettingsBundle | null = null;

/**
 * Get the current settings bundle from chrome.storage.local.
 * This function always fetches fresh settings from storage.
 * It can only be executed in the background service worker where chrome.storage is accessible.
 * Other contexts will automatically use messaging through the everywhere system.
 */
async function _getSettingsImpl(): Promise<SettingsBundle> {
  const defaultSettings: SettingsBundle = {
    theme: 'auto',
    uiNotificationLevel: 'warning',
    consoleNotificationLevel: 'warning',
  };

  try {
    // This will only work in background context where chrome.storage is available
    const result = await chrome.storage.local.get(['settings']);
    const settings = { ...defaultSettings, ...result.settings };
    return settings;
  } catch (error) {
    console.error('Failed to get settings from storage:', error);
    return defaultSettings;
  }
}

/**
 * Set settings in chrome.storage.local.
 * This function can only be executed in the background service worker.
 * Other contexts will automatically use messaging through the everywhere system.
 *
 * @param settings Partial settings to update
 */
async function _setSettingsImpl(settings: Partial<SettingsBundle>): Promise<void> {
  try {
    // Get current settings first
    const currentSettings = await _getSettingsImpl();

    // Merge with new settings
    const updatedSettings = { ...currentSettings, ...settings };

    // Save to storage
    await chrome.storage.local.set({ settings: updatedSettings });

    // Clear cache since settings have changed
    cachedSettings = null;

    // Clear notification settings cache (from notification.ts)
    if (typeof (globalThis as any).clearSettingsCache === 'function') {
      (globalThis as any).clearSettingsCache();
    }
  } catch (error) {
    console.error('Failed to set settings:', error);
    throw error;
  }
}

// Register these functions with the everywhere system
// They will only actually execute in the background context (service worker)
export const getSettingsEverywhere = everywhere('getSettings', _getSettingsImpl, ['background']);
export const setSettingsEverywhere = everywhere('setSettings', _setSettingsImpl, ['background']);

/**
 * Get settings with caching support.
 * @param refresh If true, bypass cache and fetch fresh settings from storage
 * @returns The current settings bundle
 */
export async function getSettings(refresh?: boolean): Promise<SettingsBundle> {
  // Clear cache if refresh requested
  if (refresh) {
    cachedSettings = null;
  }

  // Return cached settings if available (saves RPC cost)
  if (cachedSettings) {
    return cachedSettings;
  }

  // Fetch fresh settings via everywhere system (RPC if not in background)
  const settings = await getSettingsEverywhere();
  cachedSettings = settings;
  return settings;
}

/**
 * Set settings and clear cache.
 * @param settings Partial settings to update
 */
export async function setSettings(settings: Partial<SettingsBundle>): Promise<void> {
  await setSettingsEverywhere(settings);
  // Cache is cleared in the implementation
}

/**
 * Clear the settings cache. Useful when settings are updated externally.
 */
export function clearSettingsCache(): void {
  cachedSettings = null;
}
