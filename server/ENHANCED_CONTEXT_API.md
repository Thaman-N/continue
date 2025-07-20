# Enhanced Context API Guide

The server now includes Continue.dev-inspired context providers for intelligent code understanding and prompt formatting.

## New Endpoints

### Health Check
```bash
GET /api/context/health
```
Returns status of enhanced context features and available providers.

### Context Providers

#### List Available Providers
```bash
GET /api/context/providers
```
Returns array of available context providers:
- `file` - Direct file access with smart path resolution
- `codebase` - Semantic search across the entire codebase
- `repo-map` - Repository structure mapping with function signatures

#### Get Context from Specific Provider
```bash
POST /api/context/provider/{provider}
Content-Type: application/json

{
  "query": "search term or file path"
}
```

**Examples:**
```bash
# Search codebase for authentication logic
curl -X POST "http://localhost:3001/api/context/provider/codebase" \
  -H "Content-Type: application/json" \
  -d '{"query": "authentication login"}'

# Get specific file content  
curl -X POST "http://localhost:3001/api/context/provider/file" \
  -H "Content-Type: application/json" \
  -d '{"query": "src/services/ContextService.ts"}'

# Get repository map
curl -X POST "http://localhost:3001/api/context/provider/repo-map" \
  -H "Content-Type: application/json" \
  -d '{"query": "entire-codebase"}'
```

### Intelligent Context Selection
```bash
POST /api/context/intelligent
Content-Type: application/json

{
  "query": "what you're looking for",
  "maxItems": 10
}
```

Automatically selects the most relevant context from multiple providers based on the query.

### Prompt Formatting
```bash
POST /api/prompt/format
Content-Type: application/json

{
  "message": "Your question or instruction",
  "contextItems": [
    {
      "name": "file.ts",
      "content": "code content",
      "description": "file description"
    }
  ],
  "options": {
    "provider": "openai|anthropic|llama2|llama3",
    "maxTokens": 8000
  },
  "systemPrompt": "Optional system prompt"
}
```

**Supported Formats:**
- `openai` / `chatgpt` - ChatML format
- `anthropic` / `claude` - Anthropic format  
- `llama2` / `codellama` - Llama2 format
- `llama3` - Llama3 format
- `gemma` - Gemma format

### Enhanced Project Context
```bash
GET /api/context/enhanced?provider=codebase&query=search&includeRepoMap=true&format=openai
```

Parameters:
- `provider` - Context provider to use (default: codebase)
- `query` - Search query
- `includeRepoMap` - Include repository structure (default: false)
- `format` - Prompt format for LLM (optional)
- `systemPrompt` - Custom system prompt (optional)
- `maxTokens` - Token limit (default: 8000)

### Quick Access Endpoints

#### Search Files
```bash
GET /api/context/quick/files?q=search_term
```

#### Search Codebase  
```bash
GET /api/context/quick/codebase?q=search_term
```

#### Get Repository Map
```bash
GET /api/repo/map?folder=src
```

## Response Format

All context endpoints return items in this format:
```json
{
  "items": [
    {
      "name": "Display name",
      "description": "File path or description", 
      "content": "Formatted code content",
      "uri": {
        "type": "file",
        "value": "/absolute/path"
      },
      "startLine": 10,
      "endLine": 50
    }
  ]
}
```

## Integration Examples

### Browser Extension Integration
```javascript
// Get intelligent context for a query
const response = await fetch('http://localhost:3001/api/context/intelligent', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: userInput,
    maxItems: 5
  })
});

const { items } = await response.json();

// Format for specific LLM
const promptResponse = await fetch('http://localhost:3001/api/prompt/format', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: userInput,
    contextItems: items,
    options: { provider: 'openai' },
    systemPrompt: 'You are a helpful coding assistant.'
  })
});

const { formattedPrompt } = await promptResponse.json();
```

### Enhanced Ctrl+Shift+I Implementation
```javascript
// 1. Get intelligent context selection
const contextItems = await getIntelligentContext(selectedText || currentFile);

// 2. Format for target LLM (detected from current tab)
const llmProvider = detectLLMProvider(window.location.href);
const formattedPrompt = await formatPrompt(userQuery, contextItems, llmProvider);

// 3. Insert into LLM interface
insertIntoLLM(formattedPrompt);
```

## Performance Notes

- Repository map generation: ~1-3 seconds for medium projects
- Codebase search: ~500ms-2s depending on project size  
- File context: ~100-500ms
- Intelligent selection: ~1-2s (combines multiple providers)
- Prompt formatting: ~50-200ms

All operations include caching for improved performance on repeated requests.