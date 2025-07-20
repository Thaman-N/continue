// Base context provider extracted and adapted from Continue.dev
import { 
  ContextItem, 
  ContextProviderDescription, 
  ContextProviderExtras,
  ContextSubmenuItem,
  LoadSubmenuItemsArgs 
} from './types';

export abstract class BaseContextProvider {
  static description: ContextProviderDescription;
  
  constructor(protected options: any = {}) {}

  abstract getContextItems(
    query: string,
    extras: ContextProviderExtras
  ): Promise<ContextItem[]>;

  async loadSubmenuItems?(
    args: LoadSubmenuItemsArgs
  ): Promise<ContextSubmenuItem[]>;

  async load?(): Promise<void>;

  protected getDescription(): ContextProviderDescription {
    return (this.constructor as typeof BaseContextProvider).description;
  }
}