import { z } from "zod";
import { ConfigYaml } from "../schemas/index.js";
export declare const BLOCK_TYPES: readonly ["models", "context", "data", "mcpServers", "rules", "prompts", "docs"];
export type BlockType = (typeof BLOCK_TYPES)[number];
export declare const blockTypeSchema: z.ZodEnum<["models", "context", "data", "mcpServers", "rules", "prompts", "docs"]>;
export declare function getBlockType(block: ConfigYaml): BlockType | undefined;
