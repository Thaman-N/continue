"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.contextProviderRegistry = exports.ContextProviderRegistry = void 0;
const FileContextProvider_1 = __importDefault(require("./providers/FileContextProvider"));
const CodebaseContextProvider_1 = __importDefault(require("./providers/CodebaseContextProvider"));
const RepoMapContextProvider_1 = __importDefault(require("./providers/RepoMapContextProvider"));
class ContextProviderRegistry {
    constructor() {
        this.providers = new Map();
        this.instances = new Map();
        this.registerDefaultProviders();
    }
    registerDefaultProviders() {
        this.register(FileContextProvider_1.default);
        this.register(CodebaseContextProvider_1.default);
        this.register(RepoMapContextProvider_1.default);
    }
    register(providerClass) {
        const description = providerClass.description;
        this.providers.set(description.title, providerClass);
    }
    getProvider(title, options = {}) {
        const cacheKey = `${title}-${JSON.stringify(options)}`;
        if (this.instances.has(cacheKey)) {
            return this.instances.get(cacheKey);
        }
        const ProviderClass = this.providers.get(title);
        if (!ProviderClass) {
            return undefined;
        }
        const instance = new ProviderClass(options);
        this.instances.set(cacheKey, instance);
        return instance;
    }
    getProviderDescription(title) {
        const ProviderClass = this.providers.get(title);
        return ProviderClass?.description;
    }
    getAllProviderDescriptions() {
        return Array.from(this.providers.values()).map(ProviderClass => ProviderClass.description);
    }
    isValidProvider(title) {
        return this.providers.has(title);
    }
}
exports.ContextProviderRegistry = ContextProviderRegistry;
exports.contextProviderRegistry = new ContextProviderRegistry();
//# sourceMappingURL=ContextProviderRegistry.js.map