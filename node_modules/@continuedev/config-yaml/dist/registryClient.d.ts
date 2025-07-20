import { Registry } from "./interfaces/index.js";
import { PackageIdentifier } from "./interfaces/slugs.js";
interface RegistryClientOptions {
    accessToken?: string;
    apiBase?: string;
    rootPath?: string;
}
export declare class RegistryClient implements Registry {
    private readonly accessToken?;
    private readonly apiBase;
    private readonly rootPath?;
    constructor(options?: RegistryClientOptions);
    getContent(id: PackageIdentifier): Promise<string>;
    private getContentFromFilePath;
    private getContentFromSlug;
}
export {};
