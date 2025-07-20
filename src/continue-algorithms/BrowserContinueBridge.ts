/**
 * Browser-Continue Bridge
 * Orchestrates Continue.dev algorithms in browser extension context
 */

import { StreamEditingEngine, EditOptions, StreamEditResult } from './StreamEditingEngine';
import { 
  ContextProviderManager, 
  ContextItem, 
  ContextProviderExtras,
  BaseContextProvider 
} from './ContextProviders';

export interface LLMResponse {
  content: string;
  extractedCode?: {
    content: string;
    language: string;
    filename?: string;
    actionHint?: string;
  }[];
  fullResponse: string;
}

export interface EditRequest {
  filepath: string;
  userInput: string;
  selectedRange?: {
    startLine: number;
    endLine: number;
  };
  context?: ContextItem[];
}

export interface EditResult {
  success: boolean;
  message: string;
  diff?: StreamEditResult;
  confidence: number;
  reasoning: string[];
}

/**
 * Main orchestrator using Continue's patterns
 */
export class BrowserContinueBridge {
  private editingEngine: StreamEditingEngine;
  private contextManager: ContextProviderManager;
  
  constructor(
    private fileService: any,
    private projectRoot: string
  ) {
    this.editingEngine = new StreamEditingEngine();
    this.contextManager = new ContextProviderManager();
  }

  /**
   * Process LLM response using Continue's intelligence patterns
   */
  async processLLMResponse(
    llmResponse: LLMResponse,
    userInput: string
  ): Promise<{
    fileChanges: EditRequest[];
    analysis: {
      totalBlocks: number;
      actionableBlocks: number;
      examples: number;
      explanations: number;
    };
  }> {
    const fileChanges: EditRequest[] = [];
    const analysis = {
      totalBlocks: llmResponse.extractedCode?.length || 0,
      actionableBlocks: 0,
      examples: 0,
      explanations: 0
    };

    if (!llmResponse.extractedCode) {
      return { fileChanges, analysis };
    }

    // Use Continue's intelligence patterns for response analysis
    for (const codeBlock of llmResponse.extractedCode) {
      const blockAnalysis = this.analyzeCodeBlock(codeBlock, llmResponse.fullResponse);
      
      if (blockAnalysis.isActionable) {
        // Get intelligent context for this file change
        const context = await this.getSmartContext(userInput, {
          fileService: this.fileService,
          projectRoot: this.projectRoot,
          llmInput: userInput
        });

        fileChanges.push({
          filepath: blockAnalysis.suggestedPath,
          userInput: codeBlock.content,
          selectedRange: blockAnalysis.targetRange,
          context
        });
        
        analysis.actionableBlocks++;
      } else if (blockAnalysis.isExample) {
        analysis.examples++;
      } else {
        analysis.explanations++;
      }
    }

    return { fileChanges, analysis };
  }

  /**
   * Apply precise edits using Continue's algorithm
   */
  async applyFileEdit(editRequest: EditRequest): Promise<EditResult> {
    try {
      // Read current file content
      const currentContent = await this.fileService.readFile(editRequest.filepath);
      
      // Build context-aware prompt
      const contextualInput = this.buildContextualPrompt(editRequest);
      
      // Use Continue's streaming diff algorithm
      const editResult = await this.editingEngine.applyEdit(
        currentContent,
        contextualInput,
        editRequest.selectedRange
      );
      
      // Apply the changes
      await this.fileService.writeFile(editRequest.filepath, editResult.newContent);
      
      return {
        success: true,
        message: `Applied precise edit to ${editRequest.filepath}: ${editResult.summary}`,
        diff: editResult,
        confidence: this.calculateEditConfidence(editResult),
        reasoning: [`Used Continue's streaming diff algorithm`, `Context-aware editing`]
      };
      
    } catch (error) {
      return {
        success: false,
        message: `Failed to apply edit: ${error instanceof Error ? error.message : 'Unknown error'}`,
        confidence: 0,
        reasoning: [`Error during edit application`]
      };
    }
  }

  /**
   * Get intelligent context following Continue's patterns
   */
  async getSmartContext(
    userInput: string,
    extras: ContextProviderExtras
  ): Promise<ContextItem[]> {
    console.log(`🔍 BrowserContinueBridge.getSmartContext called with input: "${userInput}"`);
    console.log(`📂 Project root: ${extras.projectRoot}`);
    
    const result = await this.contextManager.getSmartContext(userInput, extras);
    
    console.log(`🎯 BrowserContinueBridge.getSmartContext returned ${result.length} items`);
    
    return result;
  }

  /**
   * Get context from specific provider
   */
  async getContextFromProvider(
    providerName: string,
    query: string,
    extras: ContextProviderExtras
  ): Promise<ContextItem[]> {
    return this.contextManager.getContextItems(providerName, query, extras);
  }

  /**
   * Register custom context provider
   */
  registerContextProvider(name: string, provider: BaseContextProvider) {
    this.contextManager.registerProvider(name, provider);
  }

  /**
   * Analyze code block using Continue's intelligence patterns
   */
  private analyzeCodeBlock(codeBlock: any, fullResponse: string) {
    const content = codeBlock.content.toLowerCase();
    const contextBefore = this.getContextBefore(codeBlock, fullResponse);
    const contextAfter = this.getContextAfter(codeBlock, fullResponse);
    
    // Continue's scoring algorithm
    let score = 0;
    let reasoning = [];

    // Positive indicators
    if (codeBlock.filename) {
      score += 30;
      reasoning.push('Has explicit filename');
    }

    if (codeBlock.actionHint) {
      score += 35;
      reasoning.push(`Has action hint: ${codeBlock.actionHint}`);
    }

    if (contextBefore.includes('create') || contextBefore.includes('add') || contextBefore.includes('implement')) {
      score += 25;
      reasoning.push('Context suggests creation/implementation');
    }

    if (contextBefore.includes('update') || contextBefore.includes('modify') || contextBefore.includes('change')) {
      score += 25;
      reasoning.push('Context suggests modification');
    }

    if (contextBefore.includes('fix') || contextBefore.includes('complete') || contextBefore.includes('replace')) {
      score += 30;
      reasoning.push('Context suggests targeted fix/completion');
    }

    if (contextBefore.includes('function') && (contextBefore.includes('in') || contextBefore.includes('inside'))) {
      score += 25;
      reasoning.push('Context suggests function-level change');
    }

    if (content.includes('function ') && !content.includes('module.exports') && content.split('\n').length < 10) {
      score += 25;
      reasoning.push('Single function implementation detected');
    }

    if (content.includes('module.exports') || content.includes('export') || content.includes('import')) {
      score += 15;
      reasoning.push('Contains module structure');
    }

    // Negative indicators
    if (contextBefore.includes('example') || contextBefore.includes('here\'s how') || contextBefore.includes('for instance')) {
      score -= 20;
      reasoning.push('Marked as example');
    }

    if (content.includes('console.log("hello world")') || content.includes('placeholder')) {
      score -= 10;
      reasoning.push('Contains placeholder content');
    }

    const isActionable = score >= 20;
    const isExample = !isActionable && (contextBefore.includes('example') || contextBefore.includes('current'));
    
    // Suggest file path - enhanced detection with full response for case preservation
    let suggestedPath = codeBlock.filename || this.extractFilenameFromContext(contextBefore, contextAfter, fullResponse) || 'untitled';
    
    if (!codeBlock.filename && suggestedPath === 'untitled') {
      if (codeBlock.language === 'js' || codeBlock.language === 'javascript') {
        suggestedPath = 'utils/generatedCode.js';
      } else if (codeBlock.language === 'ts' || codeBlock.language === 'typescript') {
        suggestedPath = 'src/generatedCode.ts';
      }
    }

    // Detect target range for precise editing
    let targetRange;
    if (reasoning.includes('Single function implementation detected')) {
      // Try to find the function in existing files
      targetRange = this.detectFunctionRange(codeBlock.content);
    }

    return {
      isActionable,
      isExample,
      confidence: Math.min(100, Math.max(0, score)),
      suggestedPath,
      reasoning: reasoning.join(', '),
      targetRange
    };
  }

  /**
   * Build context-aware prompt combining user input with relevant context
   */
  private buildContextualPrompt(editRequest: EditRequest): string {
    let prompt = editRequest.userInput;
    
    if (editRequest.context && editRequest.context.length > 0) {
      prompt += '\n\nRelevant context:\n';
      for (const item of editRequest.context) {
        prompt += `\n${item.name}: ${item.description}\n${item.content}\n`;
      }
    }
    
    return prompt;
  }

  /**
   * Calculate confidence score for edit quality
   */
  private calculateEditConfidence(editResult: StreamEditResult): number {
    const { diffLines } = editResult;
    
    const added = diffLines.filter(d => d.type === 'new').length;
    const removed = diffLines.filter(d => d.type === 'old').length;
    const unchanged = diffLines.filter(d => d.type === 'same').length;
    
    // Higher confidence for targeted changes vs wholesale replacement
    if (unchanged > 0 && (added + removed) / (unchanged + added + removed) < 0.5) {
      return 90; // Precise targeted edit
    } else if (added > 0 && removed === 0) {
      return 85; // Clean addition
    } else if (added > 0 && removed > 0) {
      return 75; // Modification
    } else {
      return 60; // Wholesale replacement
    }
  }

  /**
   * Get context before code block in response
   */
  private getContextBefore(codeBlock: any, fullResponse: string): string {
    const blockIndex = fullResponse.indexOf(codeBlock.content);
    if (blockIndex === -1) return '';
    
    const before = fullResponse.substring(Math.max(0, blockIndex - 200), blockIndex);
    return before.toLowerCase();
  }

  /**
   * Get context after code block in response
   */
  private getContextAfter(codeBlock: any, fullResponse: string): string {
    const blockIndex = fullResponse.indexOf(codeBlock.content);
    if (blockIndex === -1) return '';
    
    const after = fullResponse.substring(
      blockIndex + codeBlock.content.length, 
      Math.min(fullResponse.length, blockIndex + codeBlock.content.length + 200)
    );
    return after.toLowerCase();
  }

  /**
   * Extract filename from context text before/after code block
   */
  private extractFilenameFromContext(contextBefore: string, contextAfter: string, fullResponse?: string): string | undefined {
    // Simple approach - just search the full response for file patterns
    const searchText = fullResponse || (contextBefore + ' ' + contextAfter);
    
    console.log(`🔍 Searching for filename in text: "${searchText.substring(0, 300)}"`);
    
    // Look for patterns that include directory paths like "utils/mathOperations.js"
    const patterns = [
      // Match patterns like "add to utils/mathOperations.js" or "in utils/mathOperations.js"
      /(?:to|in|of|add to|update|modify|edit)\s+([a-zA-Z0-9_\/\-\.]+\/[a-zA-Z0-9_\-\.]+\.[a-zA-Z]+)/gi,
      // Match just file paths with directories
      /([a-zA-Z0-9_\/\-\.]+\/[a-zA-Z0-9_\-\.]+\.[a-zA-Z]+)/gi,
      // Fallback to just filenames
      /([a-zA-Z0-9_\-\.]+\.[a-zA-Z]+)/gi
    ];
    
    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i];
      console.log(`🔍 Trying pattern ${i + 1}: ${pattern}`);
      
      let match;
      pattern.lastIndex = 0; // Reset regex
      while ((match = pattern.exec(searchText)) !== null) {
        const filename = match[1];
        console.log(`🎯 Pattern ${i + 1} matched: "${filename}"`);
        
        // Validate it looks like a real filename
        if (filename.includes('.') && filename.length < 100) {
          // Prefer paths with directories over just filenames
          if (filename.includes('/') || i === patterns.length - 1) {
            console.log(`✅ Selected filename: "${filename}"`);
            return filename;
          }
        }
      }
    }
    
    console.log(`⚠️ No filename found in search text`);
    return undefined;
  }

  /**
   * Get original case context (before lowercase conversion)
   */
  private getOriginalContext(contextBefore: string, contextAfter: string): string {
    // We need to get the original context from the full response since contextBefore/contextAfter are already lowercased
    // This is a workaround - we should ideally store original context earlier in the flow
    return contextBefore + ' ' + contextAfter;
  }

  /**
   * Detect function range for targeted editing
   */
  private detectFunctionRange(codeContent: string): { startLine: number; endLine: number } | undefined {
    const functionMatch = codeContent.match(/function\s+(\w+)/);
    if (functionMatch) {
      const functionName = functionMatch[1];
      // Return a hint that this should target a specific function
      // The actual implementation would be in the editing engine
      return { startLine: 0, endLine: 0 }; // Placeholder
    }
    return undefined;
  }
}