// Context Provider Registry for managing all available providers
import { BaseContextProvider } from './BaseContextProvider';
import { ContextProviderDescription } from './types';

import FileContextProvider from './providers/FileContextProvider';
import CodebaseContextProvider from './providers/CodebaseContextProvider';
import RepoMapContextProvider from './providers/RepoMapContextProvider';

export class ContextProviderRegistry {
  private providers = new Map<string, typeof BaseContextProvider>();
  private instances = new Map<string, BaseContextProvider>();

  constructor() {
    this.registerDefaultProviders();
  }

  private registerDefaultProviders() {
    this.register(FileContextProvider);
    this.register(CodebaseContextProvider);
    this.register(RepoMapContextProvider);
  }

  register(providerClass: typeof BaseContextProvider) {
    const description = providerClass.description;
    this.providers.set(description.title, providerClass);
  }

  getProvider(title: string, options: any = {}): BaseContextProvider | undefined {
    const cacheKey = `${title}-${JSON.stringify(options)}`;
    
    if (this.instances.has(cacheKey)) {
      return this.instances.get(cacheKey);
    }

    const ProviderClass = this.providers.get(title);
    if (!ProviderClass) {
      return undefined;
    }

    const instance = new (ProviderClass as any)(options);
    this.instances.set(cacheKey, instance);
    return instance;
  }

  getProviderDescription(title: string): ContextProviderDescription | undefined {
    const ProviderClass = this.providers.get(title);
    return ProviderClass?.description;
  }

  getAllProviderDescriptions(): ContextProviderDescription[] {
    return Array.from(this.providers.values()).map(ProviderClass => ProviderClass.description);
  }

  isValidProvider(title: string): boolean {
    return this.providers.has(title);
  }
}

export const contextProviderRegistry = new ContextProviderRegistry();