import React, { useState, useEffect } from 'react';

interface ContextItem {
  name: string;
  description: string;
  content: string;
  uri?: {
    type: string;
    value: string;
  };
}

interface ContextProvider {
  title: string;
  displayTitle: string;
  description: string;
  type: string;
}

interface ContextSelectorProps {
  onContextSelected: (items: ContextItem[]) => void;
  isConnected: boolean;
}

const ContextSelector: React.FC<ContextSelectorProps> = ({ onContextSelected, isConnected }) => {
  const [providers, setProviders] = useState<ContextProvider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>('intelligent');
  const [query, setQuery] = useState<string>('');
  const [contextItems, setContextItems] = useState<ContextItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isConnected) {
      loadProviders();
    }
  }, [isConnected]);

  const loadProviders = async () => {
    try {
      // Use Continue-style context providers
      const mockProviders: ContextProvider[] = [
        {
          title: 'intelligent',
          displayTitle: 'Intelligent Context',
          description: 'Smart context selection using Continue\'s algorithms',
          type: 'intelligent'
        },
        {
          title: 'codebase',
          displayTitle: 'Codebase Context',
          description: 'Repository-wide code analysis',
          type: 'provider'
        },
        {
          title: 'files',
          displayTitle: 'File Context',
          description: 'Specific file content',
          type: 'provider'
        }
      ];
      setProviders(mockProviders);
    } catch (error) {
      console.error('Failed to load providers:', error);
    }
  };

  const searchContext = async () => {
    console.log('searchContext called with query:', query);
    if (!query.trim()) {
      setError('Please enter a search query');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Use intelligent endpoint for intelligent provider, otherwise use provider-specific endpoint
      const endpoint = selectedProvider === 'intelligent' 
        ? 'http://localhost:3001/api/context/intelligent'
        : `http://localhost:3001/api/context/provider/${selectedProvider}`;
        
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, maxItems: 10 }),
      });

      if (response.ok) {
        const data = await response.json();
        setContextItems(data.items || []);
        onContextSelected(data.items || []);
      } else {
        setError('Failed to search context');
      }
    } catch (error) {
      setError('Search failed');
      console.error('Context search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const useIntelligentSelection = async () => {
    console.log('useIntelligentSelection called with query:', query);
    if (!query.trim()) {
      setError('Please enter a search query');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:3001/api/context/intelligent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, maxItems: 5 }),
      });

      if (response.ok) {
        const data = await response.json();
        setContextItems(data.items || []);
        onContextSelected(data.items || []);
      } else {
        setError('Intelligent selection failed');
      }
    } catch (error) {
      setError('Intelligent selection failed');
      console.error('Intelligent selection error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isConnected) {
    return (
      <div style={{ padding: '16px', textAlign: 'center', color: '#6b7280' }}>
        Connect to server to use context features
      </div>
    );
  }

  return (
    <div style={{ padding: '16px' }}>
      <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px', margin: '0 0 12px 0' }}>
        Context Selection
      </h3>

      {/* Provider Selection */}
      <div style={{ marginBottom: '12px' }}>
        <label style={{ fontSize: '14px', fontWeight: '500', marginBottom: '4px', display: 'block' }}>
          Provider:
        </label>
        <select
          value={selectedProvider}
          onChange={(e) => setSelectedProvider(e.target.value)}
          style={{
            width: '100%',
            padding: '6px 8px',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            fontSize: '14px'
          }}
        >
          {providers.map((provider) => (
            <option key={provider.title} value={provider.title}>
              {provider.displayTitle} - {provider.description}
            </option>
          ))}
        </select>
      </div>

      {/* Search Query */}
      <div style={{ marginBottom: '12px' }}>
        <label style={{ fontSize: '14px', fontWeight: '500', marginBottom: '4px', display: 'block' }}>
          Search Query:
        </label>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g., authentication logic, context service, etc."
          style={{
            width: '100%',
            padding: '6px 8px',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            fontSize: '14px',
            boxSizing: 'border-box'
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              searchContext();
            }
          }}
        />
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <button
          onClick={searchContext}
          disabled={loading}
          style={{
            flex: 1,
            padding: '8px 12px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '14px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1
          }}
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
        <button
          onClick={useIntelligentSelection}
          disabled={loading}
          style={{
            flex: 1,
            padding: '8px 12px',
            backgroundColor: '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '14px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1
          }}
        >
          {loading ? 'Selecting...' : 'Smart Select'}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div style={{
          padding: '8px',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '4px',
          color: '#dc2626',
          fontSize: '14px',
          marginBottom: '12px'
        }}>
          {error}
        </div>
      )}

      {/* Context Items */}
      {contextItems.length > 0 && (
        <div style={{ marginTop: '12px' }}>
          <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>
            Found {contextItems.length} context items:
          </div>
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {contextItems.map((item, index) => (
              <div
                key={index}
                style={{
                  padding: '8px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '4px',
                  marginBottom: '6px',
                  backgroundColor: '#f9fafb'
                }}
              >
                <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '2px' }}>
                  {item.name}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                  {item.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ContextSelector;