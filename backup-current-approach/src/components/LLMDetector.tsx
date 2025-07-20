import React, { useState, useEffect } from 'react';

interface LLMDetectorProps {
  onProviderDetected: (provider: string) => void;
}

interface LLMProvider {
  name: string;
  displayName: string;
  domains: string[];
  formatSupport: string;
}

const LLM_PROVIDERS: LLMProvider[] = [
  {
    name: 'openai',
    displayName: 'ChatGPT',
    domains: ['chatgpt.com'],
    formatSupport: 'openai'
  },
  {
    name: 'anthropic',
    displayName: 'Claude',
    domains: ['claude.ai', 'console.anthropic.com'],
    formatSupport: 'anthropic'
  },
  {
    name: 'google',
    displayName: 'Gemini',
    domains: ['gemini.google.com', 'ai.google.dev'],
    formatSupport: 'openai'
  },
  {
    name: 'perplexity',
    displayName: 'Perplexity',
    domains: ['perplexity.ai'],
    formatSupport: 'openai'
  },
  {
    name: 'mistral',
    displayName: 'Mistral AI',
    domains: ['chat.mistral.ai'],
    formatSupport: 'openai'
  },
  {
    name: 'huggingface',
    displayName: 'Hugging Face',
    domains: ['huggingface.co'],
    formatSupport: 'openai'
  }
];

const LLMDetector: React.FC<LLMDetectorProps> = ({ onProviderDetected }) => {
  const [detectedProvider, setDetectedProvider] = useState<LLMProvider | null>(null);
  const [activeTab, setActiveTab] = useState<chrome.tabs.Tab | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);

  useEffect(() => {
    detectCurrentProvider();
    // Set up tab change listener
    const interval = setInterval(detectCurrentProvider, 2000);
    return () => clearInterval(interval);
  }, []);

  const detectCurrentProvider = async () => {
    setIsDetecting(true);
    try {
      // Query active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      setActiveTab(tab);

      if (tab?.url) {
        const url = new URL(tab.url);
        const hostname = url.hostname.toLowerCase();

        const provider = LLM_PROVIDERS.find(p => 
          p.domains.some(domain => hostname.includes(domain))
        );

        setDetectedProvider(provider || null);
        onProviderDetected(provider?.formatSupport || 'openai');
      }
    } catch (error) {
      console.error('Failed to detect provider:', error);
    } finally {
      setIsDetecting(false);
    }
  };

  return (
    <div style={{ padding: '16px', borderTop: '1px solid #e5e7eb' }}>
      <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px', margin: '0 0 12px 0' }}>
        LLM Provider Detection
      </h3>

      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '14px', marginBottom: '6px' }}>
          <strong>Current Tab:</strong>
        </div>
        <div style={{ 
          fontSize: '12px', 
          color: '#6b7280',
          wordBreak: 'break-all',
          padding: '4px 8px',
          backgroundColor: '#f3f4f6',
          borderRadius: '4px'
        }}>
          {activeTab?.title || 'Unknown'} {activeTab?.url ? `(${new URL(activeTab.url).hostname})` : ''}
        </div>
      </div>

      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '14px', marginBottom: '6px' }}>
          <strong>Detected Provider:</strong>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: detectedProvider ? '#10b981' : '#ef4444'
          }} />
          <span style={{ fontSize: '14px' }}>
            {isDetecting ? 'Detecting...' : (detectedProvider?.displayName || 'No LLM provider detected')}
          </span>
        </div>
      </div>

      {detectedProvider && (
        <div style={{
          padding: '8px',
          backgroundColor: '#f0f9ff',
          border: '1px solid #bae6fd',
          borderRadius: '4px',
          fontSize: '12px'
        }}>
          <div style={{ marginBottom: '4px' }}>
            <strong>Provider:</strong> {detectedProvider.displayName}
          </div>
          <div style={{ marginBottom: '4px' }}>
            <strong>Format:</strong> {detectedProvider.formatSupport}
          </div>
          <div style={{ color: '#0369a1' }}>
            ✓ Ctrl+Shift+I will use optimized prompts for this provider
          </div>
        </div>
      )}

      <div style={{ marginTop: '12px' }}>
        <button
          onClick={detectCurrentProvider}
          disabled={isDetecting}
          style={{
            width: '100%',
            padding: '6px 12px',
            backgroundColor: '#6366f1',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '14px',
            cursor: isDetecting ? 'not-allowed' : 'pointer',
            opacity: isDetecting ? 0.6 : 1
          }}
        >
          {isDetecting ? 'Detecting...' : 'Refresh Detection'}
        </button>
      </div>

      <div style={{ marginTop: '12px', fontSize: '12px', color: '#6b7280' }}>
        <strong>Supported Providers:</strong>
        <ul style={{ margin: '4px 0', paddingLeft: '16px' }}>
          {LLM_PROVIDERS.map(provider => (
            <li key={provider.name}>{provider.displayName}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default LLMDetector;