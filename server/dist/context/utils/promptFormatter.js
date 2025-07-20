"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromptFormatter = void 0;
// Template factory function adapted from Continue.dev
function templateFactory(systemMessage, userPrompt, assistantPrompt, separator, prefix, emptySystemMessage) {
    return (msgs) => {
        let prompt = prefix ?? "";
        // Skip assistant messages at the beginning
        while (msgs.length > 0 && msgs[0].role === "assistant") {
            msgs.shift();
        }
        if (msgs.length > 0 && msgs[0].role === "system") {
            prompt += systemMessage(msgs.shift());
        }
        else if (emptySystemMessage) {
            prompt += emptySystemMessage;
        }
        for (let i = 0; i < msgs.length; i++) {
            const msg = msgs[i];
            prompt += msg.role === "user" ? userPrompt : assistantPrompt;
            prompt += msg.content;
            if (i < msgs.length - 1) {
                prompt += separator;
            }
        }
        if (msgs.length > 0 && msgs[msgs.length - 1].role === "user") {
            prompt += separator;
            prompt += assistantPrompt;
        }
        return prompt;
    };
}
// Anthropic/Claude template
function anthropicTemplateMessages(messages) {
    const HUMAN_PROMPT = "\n\nHuman:";
    const AI_PROMPT = "\n\nAssistant:";
    let prompt = "";
    // Anthropic prompt must start with a Human turn
    if (messages.length > 0 &&
        messages[0].role !== "user" &&
        messages[0].role !== "system") {
        prompt += `${HUMAN_PROMPT} Hello.`;
    }
    for (const msg of messages) {
        prompt += `${msg.role === "user" || msg.role === "system" ? HUMAN_PROMPT : AI_PROMPT} ${msg.content} `;
    }
    prompt += AI_PROMPT;
    return prompt;
}
// OpenAI ChatML format (default for most models)
const chatmlTemplateMessages = templateFactory((msg) => `<|im_start|>${msg.role}\n${msg.content}<|im_end|>\n`, "<|im_start|>user\n", "<|im_start|>assistant\n", "<|im_end|>\n");
// Llama2/Codellama template
function llama2TemplateMessages(msgs) {
    if (msgs.length === 0) {
        return "";
    }
    if (msgs[0].role === "assistant") {
        msgs.shift();
    }
    let prompt = "";
    let hasSystem = msgs[0]?.role === "system";
    if (hasSystem && msgs[0].content.trim() === "") {
        hasSystem = false;
        msgs = msgs.slice(1);
    }
    if (hasSystem) {
        const systemMessage = `<<SYS>>\n ${msgs[0].content}\n<</SYS>>\n\n`;
        if (msgs.length > 1) {
            prompt += `<s>[INST] ${systemMessage} ${msgs[1].content} [/INST]`;
        }
        else {
            prompt += `[INST] ${systemMessage} [/INST]`;
            return prompt;
        }
    }
    for (let i = hasSystem ? 2 : 0; i < msgs.length; i++) {
        if (msgs[i].role === "user") {
            prompt += `[INST] ${msgs[i].content} [/INST]`;
        }
        else {
            prompt += msgs[i].content;
            if (i < msgs.length - 1) {
                prompt += "</s>\n<s>";
            }
        }
    }
    return prompt;
}
// Llama3 template
const llama3TemplateMessages = templateFactory((msg) => `<|begin_of_text|><|start_header_id|>${msg.role}<|end_header_id|>\n${msg.content}<|eot_id|>\n`, "<|start_header_id|>user<|end_header_id|>\n", "<|start_header_id|>assistant<|end_header_id|>\n", "<|eot_id|>");
// Gemma template
const gemmaTemplateMessage = templateFactory(() => "", "<start_of_turn>user\n", "<start_of_turn>model\n", "<end_of_turn>\n");
class PromptFormatter {
    constructor() {
        this.formatters = {
            anthropic: anthropicTemplateMessages,
            claude: anthropicTemplateMessages,
            openai: chatmlTemplateMessages,
            chatgpt: chatmlTemplateMessages,
            gpt: chatmlTemplateMessages,
            llama2: llama2TemplateMessages,
            codellama: llama2TemplateMessages,
            llama3: llama3TemplateMessages,
            gemma: gemmaTemplateMessage,
            default: chatmlTemplateMessages,
        };
    }
    formatMessages(messages, options = {}) {
        const { provider = 'default', model = '' } = options;
        // Determine formatter based on provider or model name
        let formatter = this.formatters.default;
        if (this.formatters[provider.toLowerCase()]) {
            formatter = this.formatters[provider.toLowerCase()];
        }
        else {
            // Try to detect from model name
            const modelLower = model.toLowerCase();
            for (const [key, func] of Object.entries(this.formatters)) {
                if (modelLower.includes(key)) {
                    formatter = func;
                    break;
                }
            }
        }
        return formatter([...messages]); // Clone to avoid mutation
    }
    buildContextualPrompt(userMessage, contextItems, systemPrompt) {
        const messages = [];
        // Add system message if provided
        if (systemPrompt) {
            messages.push({
                role: 'system',
                content: systemPrompt
            });
        }
        // Build context section
        let contextContent = '';
        if (contextItems.length > 0) {
            contextContent = 'Here is the relevant code context:\n\n';
            for (const item of contextItems) {
                contextContent += `## ${item.name}`;
                if (item.description) {
                    contextContent += ` - ${item.description}`;
                }
                contextContent += '\n\n';
                contextContent += item.content;
                contextContent += '\n\n';
            }
            contextContent += '---\n\n';
        }
        // Combine context with user message
        const fullUserMessage = contextContent + userMessage;
        messages.push({
            role: 'user',
            content: fullUserMessage
        });
        return messages;
    }
    estimateTokens(text) {
        // Simple estimation: roughly 4 characters per token for English text
        return Math.ceil(text.length / 4);
    }
    trimToTokenLimit(content, maxTokens) {
        const estimatedTokens = this.estimateTokens(content);
        if (estimatedTokens <= maxTokens) {
            return content;
        }
        // Trim from the beginning to preserve the end of the content
        const targetLength = maxTokens * 4;
        const excess = content.length - targetLength;
        if (excess > 0) {
            return '...[content truncated]...\n' + content.slice(excess);
        }
        return content;
    }
    /**
     * Format for web interfaces - human readable, not API format
     */
    formatForWebInterface(userMessage, contextItems, systemPrompt) {
        let prompt = '';
        // Add coding assistant instructions for better code extraction
        prompt += '**Instructions:** When providing code solutions, always:\n';
        prompt += '1. Include explicit filenames for each code block (e.g., "Update app.js:", "Create package.json:")\n';
        prompt += '2. Use clear file references before code blocks\n';
        prompt += '3. Minimize explanatory text - focus on actionable code\n';
        prompt += '4. Structure responses for easy parsing and application\n\n';
        // Add context in a clean, readable format
        if (contextItems.length > 0) {
            prompt += '**Project Context:**\n\n';
            contextItems.forEach(item => {
                prompt += `### ${item.name}${item.description ? ` - ${item.description}` : ''}\n`;
                prompt += '```\n';
                prompt += item.content;
                prompt += '\n```\n\n';
            });
            prompt += '---\n\n';
        }
        // Add system instructions as part of the user message (if provided)
        if (systemPrompt && systemPrompt.trim()) {
            prompt += `${systemPrompt}\n\n`;
        }
        // Add the actual user request
        prompt += userMessage;
        return prompt;
    }
    /**
     * Static helper for backward compatibility
     */
    static formatForProvider(message, contextItems, provider = 'openai', systemPrompt) {
        const formatter = new PromptFormatter();
        // For web interfaces, always use human-readable format
        return formatter.formatForWebInterface(message, contextItems, systemPrompt);
    }
}
exports.PromptFormatter = PromptFormatter;
exports.default = PromptFormatter;
//# sourceMappingURL=promptFormatter.js.map