export interface ProxyModelName {
    ownerSlug: string;
    packageSlug: string;
    provider: string;
    model: string;
}
export declare function parseProxyModelName(modelName: string): ProxyModelName;
