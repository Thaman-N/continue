import { RuleObject } from "../schemas/index.js";
export declare enum RuleType {
    Always = "Always",
    AutoAttached = "Auto Attached",
    AgentRequested = "Agent Requested",
    Manual = "Manual"
}
export declare const RuleTypeDescriptions: Record<RuleType, string>;
/**
 * Determines the rule type based on the rule properties
 */
export declare function getRuleType(rule: Partial<RuleObject>): RuleType;
