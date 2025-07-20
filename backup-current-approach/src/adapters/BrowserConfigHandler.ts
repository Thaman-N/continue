// Browser-specific configuration handler using chrome.storage
import {
  ContinueConfig,
  BrowserSerializedContinueConfig,
  defaultConfig,
  IDE,
  ILLMLogger,
  IdeSettings
} from '../core-types';
import EventEmitter from 'events';

export class BrowserConfigHandler {
  private eventEmitter = new EventEmitter();
  private currentConfig: ContinueConfig | null = null;
  private storageKey = 'continue-config';
  private settingsKey = 'continue-settings';

  public isInitialized: Promise<void>;

  constructor(
    private readonly ide: IDE,
    private llmLogger: ILLMLogger
  ) {
    this.isInitialized = this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Load config from chrome.storage
      await this.reloadConfig();
      this.eventEmitter.emit('init');
    } catch (error) {
      console.error('Error initializing BrowserConfigHandler:', error);
      // Fall back to default config
      this.currentConfig = defaultConfig as any;
      this.eventEmitter.emit('init');
    }
  }

  async reloadConfig(): Promise<void> {
    try {
      // Load from chrome.storage
      const stored = await chrome.storage.local.get([this.storageKey]);
      const serializedConfig = stored[this.storageKey];

      if (serializedConfig) {
        // Deserialize the config
        this.currentConfig = await this.deserializeConfig(serializedConfig);
      } else {
        // Use default config
        this.currentConfig = defaultConfig as any;
        // Save default config to storage
        await this.saveConfig(this.currentConfig);
      }

      // Notify listeners of config change
      this.eventEmitter.emit('configUpdate', this.currentConfig);
    } catch (error) {
      console.error('Error reloading config:', error);
      this.currentConfig = defaultConfig as any;
    }
  }

  private async deserializeConfig(serialized: BrowserSerializedContinueConfig): Promise<ContinueConfig> {
    // For now, use a simplified deserialization
    // In a full implementation, this would handle LLM providers, context providers, etc.
    return {
      allowAnonymousTelemetry: false,
      slashCommands: [],
      contextProviders: [], // This will be empty array of IContextProvider for now
      tools: [],
      mcpServerStatuses: [],
      rules: [],
      modelsByRole: {} as any,
      selectedModelByRole: {} as any,
      docs: [],
      experimental: {},
      ...serialized
    } as unknown as ContinueConfig;
  }

  private async saveConfig(config: ContinueConfig): Promise<void> {
    try {
      // Serialize config for storage
      const serialized: BrowserSerializedContinueConfig = {
        allowAnonymousTelemetry: false,
        slashCommands: [],
        contextProviders: [],
        tools: config.tools || [],
        mcpServerStatuses: config.mcpServerStatuses || [],
        rules: config.rules || [],
        usePlatform: false,
        tabAutocompleteOptions: config.tabAutocompleteOptions,
        modelsByRole: {} as any,
        selectedModelByRole: {} as any,
        docs: config.docs || [],
        experimental: config.experimental || {}
      };

      await chrome.storage.local.set({ [this.storageKey]: serialized });
    } catch (error) {
      console.error('Error saving config:', error);
    }
  }

  getConfig(): ContinueConfig {
    if (!this.currentConfig) {
      throw new Error('Config not initialized');
    }
    return this.currentConfig;
  }

  async updateConfig(newConfig: Partial<ContinueConfig>): Promise<void> {
    if (!this.currentConfig) {
      throw new Error('Config not initialized');
    }

    // Merge with existing config
    this.currentConfig = {
      ...this.currentConfig,
      ...newConfig
    };

    // Save to storage
    await this.saveConfig(this.currentConfig);

    // Notify listeners
    this.eventEmitter.emit('configUpdate', this.currentConfig);
  }

  onConfigUpdate(callback: (config: ContinueConfig) => void): void {
    this.eventEmitter.on('configUpdate', callback);
  }

  // IDE Settings management
  async getIdeSettings(): Promise<IdeSettings> {
    try {
      const stored = await chrome.storage.local.get([this.settingsKey]);
      const settings = stored[this.settingsKey];

      if (settings) {
        return settings;
      } else {
        // Default settings for browser extension
        const defaultSettings: IdeSettings = {
          remoteConfigServerUrl: undefined,
          remoteConfigSyncPeriod: 60,
          userToken: '',
          continueTestEnvironment: 'none',
          pauseCodebaseIndexOnStart: false
        };

        await chrome.storage.local.set({ [this.settingsKey]: defaultSettings });
        return defaultSettings;
      }
    } catch (error) {
      console.error('Error getting IDE settings:', error);
      return {
        remoteConfigServerUrl: undefined,
        remoteConfigSyncPeriod: 60,
        userToken: '',
        continueTestEnvironment: 'none',
        pauseCodebaseIndexOnStart: false
      };
    }
  }

  async updateIdeSettings(settings: Partial<IdeSettings>): Promise<void> {
    try {
      const currentSettings = await this.getIdeSettings();
      const newSettings = { ...currentSettings, ...settings };
      await chrome.storage.local.set({ [this.settingsKey]: newSettings });
    } catch (error) {
      console.error('Error updating IDE settings:', error);
    }
  }

  // Simplified profile management for browser extension
  getCurrentProfile() {
    return {
      profileId: 'browser-default',
      profileTitle: 'Browser Extension Profile'
    };
  }

  // Clean up
  dispose(): void {
    this.eventEmitter.removeAllListeners();
  }

  // Browser-specific methods
  async exportConfig(): Promise<string> {
    const config = this.getConfig();
    return JSON.stringify(config, null, 2);
  }

  async importConfig(configJson: string): Promise<void> {
    try {
      const config = JSON.parse(configJson);
      await this.updateConfig(config);
    } catch (error) {
      console.error('Error importing config:', error);
      throw new Error('Invalid configuration format');
    }
  }

  async resetToDefault(): Promise<void> {
    await this.updateConfig(defaultConfig as any);
  }
}