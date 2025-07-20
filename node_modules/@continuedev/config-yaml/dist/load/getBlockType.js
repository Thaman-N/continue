import { z } from "zod";
export const BLOCK_TYPES = [
    "models",
    "context",
    "data",
    "mcpServers",
    "rules",
    "prompts",
    "docs",
];
export const blockTypeSchema = z.enum(BLOCK_TYPES);
export function getBlockType(block) {
    if (block.context?.length) {
        return "context";
    }
    else if (block.models?.length) {
        return "models";
    }
    else if (block.docs?.length) {
        return "docs";
    }
    else if (block.mcpServers?.length) {
        return "mcpServers";
    }
    else if (block.data?.length) {
        return "data";
    }
    else if (block.rules?.length) {
        return "rules";
    }
    else if (block.prompts?.length) {
        return "prompts";
    }
    else {
        return undefined;
    }
}
//# sourceMappingURL=getBlockType.js.map