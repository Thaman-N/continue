# AI Coding Assistant - Integration Testing Guide

## Overview
This guide will help you test the complete Continue.dev integration with your browser extension.

## Prerequisites
1. **Server Running**: The enhanced server should be running on `http://localhost:3001`
2. **Extension Built**: Run `npm run build` to build the extension
3. **Extension Loaded**: Load the `dist/` folder as an unpacked extension in Chrome

## Testing Steps

### 1. Basic Server Connection Test
1. Open the browser extension popup
2. Check that the "Server Status" shows "Connected (Enhanced)"
3. Verify the "Enhanced Features" section shows:
   - ✅ Context providers
   - ✅ Repo map  
   - ✅ Prompt formatting
   - ✅ Intelligent selection

### 2. Context Selection Test
1. Click the "Context" tab in the popup
2. Select a provider (e.g., "codebase")
3. Enter a search query like "popup component" 
4. Click "Search" or "Smart Select"
5. Verify context items appear below

### 3. LLM Provider Detection Test
1. Navigate to https://claude.ai or https://chat.openai.com
2. Click the "Provider" tab in the popup
3. Verify the correct provider is detected
4. Check that the format support shows correctly

### 4. Manual Context Injection Test
1. Stay on the LLM site (Claude/ChatGPT)
2. Go to "Context" tab and select some context
3. Click the green "Insert X Context Items" button
4. Verify the formatted prompt appears in the LLM input field

### 5. Keyboard Shortcut Test (Main Feature)
1. Navigate to https://claude.ai or https://chat.openai.com  
2. Press **Ctrl+Shift+I**
3. Watch for:
   - Notification showing context insertion
   - Formatted prompt appearing in the chat input
   - Success notification

## Expected Results

### Server Health Response
```json
{
  "status": "healthy",
  "providers": 3,
  "availableProviders": ["file", "codebase", "repo-map"],
  "features": {
    "contextProviders": true,
    "repoMap": true, 
    "promptFormatting": true,
    "intelligentSelection": true
  }
}
```

### Formatted Prompt Example (Claude)
```
Human: Here is the relevant code context:

## src/popup/Popup.tsx - React popup component
[File content...]

## src/components/ContextSelector.tsx - Context selection UI
[File content...]

---

Here is the current project context. Please help me understand and work with this code:
