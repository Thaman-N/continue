export function parseProxyModelName(modelName) {
    const parts = modelName.split("/");
    const [ownerSlug, packageSlug, provider, ...modelParts] = parts;
    const model = modelParts.join("/");
    if (!provider || !model) {
        throw new Error("Invalid model format");
    }
    return { provider, model, ownerSlug, packageSlug };
}
//# sourceMappingURL=modelName.js.map