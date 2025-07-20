/**
 * Adapted from Continue.dev's streamDiffLines algorithm
 * Provides precise line-level editing capabilities
 */

export interface DiffLine {
  type: 'old' | 'new' | 'same';
  line: string;
}

export interface EditOptions {
  prefix: string;
  highlighted: string;
  suffix: string;
  input: string;
  language?: string;
}

export interface StreamEditResult {
  diffLines: DiffLine[];
  newContent: string;
  summary: string;
}

/**
 * Continue's precise streaming diff algorithm adapted for browser extension
 */
export class StreamEditingEngine {
  /**
   * Apply precise edits to file content using Continue's algorithm
   */
  async applyEdit(
    originalContent: string,
    editRequest: string,
    targetRange?: { startLine: number; endLine: number }
  ): Promise<StreamEditResult> {
    
    const lines = originalContent.split('\n');
    
    if (targetRange) {
      // Precise range editing
      const prefix = lines.slice(0, targetRange.startLine).join('\n') + (targetRange.startLine > 0 ? '\n' : '');
      const highlighted = lines.slice(targetRange.startLine, targetRange.endLine + 1).join('\n');
      const suffix = (targetRange.endLine < lines.length - 1 ? '\n' : '') + lines.slice(targetRange.endLine + 1).join('\n');
      
      return this.streamDiffLines({
        prefix,
        highlighted,
        suffix,
        input: editRequest,
        language: this.detectLanguage(originalContent)
      });
    } else {
      // Full file edit - try to detect the area to modify
      const range = this.detectEditRange(originalContent, editRequest);
      if (range) {
        return this.applyEdit(originalContent, editRequest, range);
      } else {
        // Default to full file replacement
        return this.streamDiffLines({
          prefix: '',
          highlighted: originalContent,
          suffix: '',
          input: editRequest,
          language: this.detectLanguage(originalContent)
        });
      }
    }
  }

  /**
   * Continue's streamDiffLines algorithm adapted for browser
   */
  private async streamDiffLines(options: EditOptions): Promise<StreamEditResult> {
    const { prefix, highlighted, suffix, input, language } = options;
    
    // Generate new content using Continue's pattern
    const newContent = await this.generateEditedContent(options);
    
    // Apply Continue's streaming diff algorithm
    const oldLines = highlighted.length > 0 
      ? highlighted.split('\n')
      : [(prefix + suffix).split('\n')[prefix.split('\n').length - 1]];
    
    // Handle empty lines (insertion-only)
    if (oldLines.length === 1 && oldLines[0].trim() === '') {
      oldLines.splice(0, 1);
    }
    
    const newLines = newContent.split('\n');
    const diffLines = this.streamDiff(oldLines, newLines);
    
    // Add indentation if needed (Continue's pattern)
    const processedDiffLines = this.addIndentationIfNeeded(diffLines, prefix, highlighted);
    
    // Construct final content
    const finalContent = this.constructFinalContent(prefix, processedDiffLines, suffix);
    
    return {
      diffLines: processedDiffLines,
      newContent: finalContent,
      summary: this.generateEditSummary(processedDiffLines)
    };
  }

  /**
   * Continue's streaming diff algorithm
   */
  private streamDiff(oldLines: string[], newLines: string[]): DiffLine[] {
    const diffLines: DiffLine[] = [];
    const oldLinesCopy = [...oldLines];
    let seenIndentationMistake = false;
    
    let newIndex = 0;
    
    while (oldLinesCopy.length > 0 && newIndex < newLines.length) {
      const { matchIndex, isPerfectMatch, newLine } = this.matchLine(
        newLines[newIndex],
        oldLinesCopy,
        seenIndentationMistake
      );
      
      if (!seenIndentationMistake && newLines[newIndex] !== newLine) {
        seenIndentationMistake = true;
      }
      
      const isNewLine = matchIndex === -1;
      
      if (isNewLine) {
        diffLines.push({ type: 'new', line: newLine });
      } else {
        // Insert all deleted lines before match
        for (let i = 0; i < matchIndex; i++) {
          diffLines.push({ type: 'old', line: oldLinesCopy.shift()! });
        }
        
        if (isPerfectMatch) {
          diffLines.push({ type: 'same', line: oldLinesCopy.shift()! });
        } else {
          diffLines.push({ type: 'old', line: oldLinesCopy.shift()! });
          diffLines.push({ type: 'new', line: newLine });
        }
      }
      
      newIndex++;
    }
    
    // Handle remaining lines
    if (newIndex >= newLines.length && oldLinesCopy.length > 0) {
      for (const oldLine of oldLinesCopy) {
        diffLines.push({ type: 'old', line: oldLine });
      }
    }
    
    if (newIndex < newLines.length && oldLinesCopy.length === 0) {
      for (let i = newIndex; i < newLines.length; i++) {
        diffLines.push({ type: 'new', line: newLines[i] });
      }
    }
    
    return diffLines;
  }

  /**
   * Continue's line matching algorithm with indentation tolerance
   */
  private matchLine(
    newLine: string,
    oldLines: string[],
    seenIndentationMistake: boolean
  ): { matchIndex: number; isPerfectMatch: boolean; newLine: string } {
    
    // Try exact match first
    for (let i = 0; i < oldLines.length; i++) {
      if (oldLines[i] === newLine) {
        return { matchIndex: i, isPerfectMatch: true, newLine };
      }
    }
    
    // Try fuzzy match if indentation mistakes seen
    if (seenIndentationMistake) {
      const trimmedNew = newLine.trim();
      for (let i = 0; i < oldLines.length; i++) {
        if (oldLines[i].trim() === trimmedNew) {
          return { matchIndex: i, isPerfectMatch: false, newLine };
        }
      }
    }
    
    return { matchIndex: -1, isPerfectMatch: false, newLine };
  }

  /**
   * Add indentation following Continue's pattern
   */
  private addIndentationIfNeeded(
    diffLines: DiffLine[],
    prefix: string,
    highlighted: string
  ): DiffLine[] {
    if (highlighted.length === 0) {
      const line = prefix.split('\n').slice(-1)[0];
      const indentation = line.slice(0, line.length - line.trimStart().length);
      
      return diffLines.map(diffLine => ({
        ...diffLine,
        line: diffLine.type === 'new' ? indentation + diffLine.line : diffLine.line
      }));
    }
    
    return diffLines;
  }

  /**
   * Generate edited content (simplified - in full implementation would call LLM)
   */
  private async generateEditedContent(options: EditOptions): Promise<string> {
    const { highlighted, input } = options;
    
    // For now, return a simple transformation
    // In full implementation, this would call the web LLM provider
    
    // Simple function replacement detection
    if (input.toLowerCase().includes('implement') && highlighted.includes('// TODO')) {
      // Replace TODO with actual implementation
      return highlighted.replace(/\/\/ TODO:.*/, input);
    }
    
    // For demonstration, return the input as the new content
    return input;
  }

  /**
   * Detect the range that needs editing based on the request
   */
  private detectEditRange(
    content: string,
    editRequest: string
  ): { startLine: number; endLine: number } | null {
    
    const lines = content.split('\n');
    
    // Look for function names in the edit request
    const functionMatch = editRequest.match(/function\s+(\w+)|(\w+)\s*function/i);
    if (functionMatch) {
      const functionName = functionMatch[1] || functionMatch[2];
      
      // Find the function in the content
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(`function ${functionName}`) || 
            lines[i].includes(`${functionName}(`)) {
          
          // Find the end of the function
          let braceCount = 0;
          let endLine = i;
          
          for (let j = i; j < lines.length; j++) {
            const line = lines[j];
            braceCount += (line.match(/\{/g) || []).length;
            braceCount -= (line.match(/\}/g) || []).length;
            
            if (braceCount === 0 && j > i) {
              endLine = j;
              break;
            }
          }
          
          return { startLine: i, endLine };
        }
      }
    }
    
    // Look for TODO comments
    if (editRequest.toLowerCase().includes('implement') || 
        editRequest.toLowerCase().includes('complete')) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('TODO') || lines[i].includes('FIXME')) {
          return { startLine: i, endLine: i };
        }
      }
    }
    
    return null;
  }

  /**
   * Detect programming language from content
   */
  private detectLanguage(content: string): string {
    if (content.includes('function ') || content.includes('const ') || content.includes('let ')) {
      return 'javascript';
    }
    if (content.includes('def ') || content.includes('import ')) {
      return 'python';
    }
    if (content.includes('public class') || content.includes('private ')) {
      return 'java';
    }
    return 'text';
  }

  /**
   * Construct final content from diff lines
   */
  private constructFinalContent(
    prefix: string,
    diffLines: DiffLine[],
    suffix: string
  ): string {
    const newLines: string[] = [];
    
    for (const diffLine of diffLines) {
      if (diffLine.type === 'new' || diffLine.type === 'same') {
        newLines.push(diffLine.line);
      }
    }
    
    return prefix + newLines.join('\n') + suffix;
  }

  /**
   * Generate human-readable edit summary
   */
  private generateEditSummary(diffLines: DiffLine[]): string {
    const added = diffLines.filter(d => d.type === 'new').length;
    const removed = diffLines.filter(d => d.type === 'old').length;
    const unchanged = diffLines.filter(d => d.type === 'same').length;
    
    return `+${added} -${removed} ~${unchanged} lines`;
  }
}