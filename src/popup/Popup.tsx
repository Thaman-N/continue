import React, { useState, useEffect } from 'react';
import ContextSelector from '../components/ContextSelector';
import LLMDetector from '../components/LLMDetector';
import ChangeReviewer from '../components/ChangeReviewer';

interface ContextItem {
  name: string;
  description: string;
  content: string;
  uri?: {
    type: string;
    value: string;
  };
}

interface ServerHealth {
  status: string;
  timestamp: string;
  providers?: number;
  availableProviders?: string[];
  features?: {
    contextProviders: boolean;
    repoMap: boolean;
    promptFormatting: boolean;
    intelligentSelection: boolean;
  };
}

const Popup: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [serverStatus, setServerStatus] = useState('Checking...');
  const [error, setError] = useState<string | null>(null);
  const [selectedContext, setSelectedContext] = useState<ContextItem[]>([]);
  const [detectedProvider, setDetectedProvider] = useState<string>('openai');
  const [serverHealth, setServerHealth] = useState<ServerHealth | null>(null);
  const [activeTab, setActiveTab] = useState<'status' | 'context' | 'provider' | 'changes'>('status');

  useEffect(() => {
    checkServerConnection();
  }, []);

  const checkServerConnection = async () => {
    setError(null);
    setServerStatus('Checking...');
    
    try {
      console.log('Trying to connect to server...');
      
      // Check basic health
      const healthResponse = await fetch('http://localhost:3001/health', {
        method: 'GET',
        mode: 'cors',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (healthResponse.ok) {
        // Check enhanced context health
        const enhancedResponse = await fetch('http://localhost:3001/api/context/health', {
          method: 'GET',
          mode: 'cors',
          credentials: 'include',
        });
        
        if (enhancedResponse.ok) {
          const enhancedData = await enhancedResponse.json();
          console.log('Enhanced context response:', enhancedData);
          setServerHealth(enhancedData);
          setIsConnected(true);
          setServerStatus('Connected (Enhanced)');
        } else {
          const basicData = await healthResponse.json();
          console.log('Basic server response:', basicData);
          setIsConnected(true);
          setServerStatus('Connected (Basic)');
        }
      } else {
        setIsConnected(false);
        setServerStatus(`Server error: ${healthResponse.status}`);
        setError(`HTTP ${healthResponse.status}`);
      }
    } catch (error) {
      console.error('Connection error:', error);
      setIsConnected(false);
      setServerStatus('Server offline');
      setError(error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const handleContextSelected = (items: ContextItem[]) => {
    setSelectedContext(items);
  };

  const handleProviderDetected = (provider: string) => {
    setDetectedProvider(provider);
  };

  const insertContextIntoCurrentTab = async () => {
    console.log('insertContextIntoCurrentTab called with context:', selectedContext);
    if (selectedContext.length === 0) {
      setError('No context selected');
      return;
    }

    try {
      // Send context to background script for injection
      await chrome.runtime.sendMessage({
        type: 'INSERT_CONTEXT',
        context: selectedContext,
        provider: detectedProvider
      });
      
      // Close popup after successful injection
      window.close();
    } catch (error) {
      console.error('Failed to insert context:', error);
      setError('Failed to insert context');
    }
  };

  return (
    <div style={{ 
      width: '420px', 
      fontFamily: 'system-ui, sans-serif', 
      maxHeight: '500px', 
      overflowY: 'auto',
      fontSize: '13px'
    }}>
      <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px', margin: '0 0 8px 0' }}>
          AI Coding Assistant
        </h1>
        
        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: '2px', marginBottom: '12px' }}>
          {(['status', 'context', 'provider', 'changes'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                padding: '4px 6px',
                backgroundColor: activeTab === tab ? '#3b82f6' : '#f3f4f6',
                color: activeTab === tab ? 'white' : '#374151',
                border: 'none',
                borderRadius: '3px',
                fontSize: '11px',
                cursor: 'pointer',
                textTransform: 'capitalize',
                whiteSpace: 'nowrap'
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Server Status Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
          <div 
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              marginRight: '8px',
              backgroundColor: isConnected ? '#10b981' : '#ef4444'
            }}
          />
          <span style={{ fontSize: '14px' }}>Server: {serverStatus}</span>
        </div>

        {error && (
          <div style={{ 
            fontSize: '12px', 
            color: '#ef4444', 
            marginBottom: '8px',
            padding: '6px',
            backgroundColor: '#fef2f2',
            borderRadius: '4px'
          }}>
            Error: {error}
          </div>
        )}
      </div>

      {/* Tab Content */}
      {activeTab === 'status' && (
        <div style={{ padding: '16px' }}>
          <div style={{ marginBottom: '16px' }}>
            <button 
              onClick={checkServerConnection}
              style={{
                width: '100%',
                padding: '8px 12px',
                backgroundColor: '#3b82f6',
                color: 'white',
                borderRadius: '4px',
                border: 'none',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              Refresh Connection
            </button>
          </div>

          {serverHealth && (
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px', margin: '0 0 8px 0' }}>
                Enhanced Features
              </h3>
              <div style={{ fontSize: '14px', color: '#6b7280' }}>
                <p style={{ margin: '4px 0' }}>
                  Providers: {serverHealth.providers || 0} ({serverHealth.availableProviders?.join(', ')})
                </p>
                <div style={{ marginTop: '8px' }}>
                  {serverHealth.features && Object.entries(serverHealth.features).map(([feature, enabled]) => (
                    <div key={feature} style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                      <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        marginRight: '6px',
                        backgroundColor: enabled ? '#10b981' : '#ef4444'
                      }} />
                      <span style={{ fontSize: '12px', textTransform: 'capitalize' }}>
                        {feature.replace(/([A-Z])/g, ' $1').toLowerCase()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {isConnected && (
            <div style={{ padding: '12px', backgroundColor: '#f0f9ff', borderRadius: '4px' }}>
              <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '6px' }}>
                Quick Actions:
              </div>
              <div style={{ fontSize: '12px', color: '#0369a1' }}>
                • Switch to Context tab to select project context<br/>
                • Use Provider tab to detect current LLM<br/>
                • Press Ctrl+Shift+I on LLM sites to insert context
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'context' && (
        <ContextSelector 
          onContextSelected={handleContextSelected}
          isConnected={isConnected}
        />
      )}

      {activeTab === 'provider' && (
        <LLMDetector onProviderDetected={handleProviderDetected} />
      )}

      {activeTab === 'changes' && (
        <ChangeReviewer isConnected={isConnected} />
      )}

      {/* Insert Context Button (always visible when context is selected) */}
      {selectedContext.length > 0 && (
        <div style={{ 
          padding: '12px 16px', 
          backgroundColor: '#f9fafb', 
          borderTop: '1px solid #e5e7eb',
          position: 'sticky',
          bottom: 0
        }}>
          <button
            onClick={insertContextIntoCurrentTab}
            style={{
              width: '100%',
              padding: '10px 16px',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Insert {selectedContext.length} Context Item{selectedContext.length > 1 ? 's' : ''} → {detectedProvider}
          </button>
          <div style={{ fontSize: '11px', color: '#6b7280', textAlign: 'center', marginTop: '4px' }}>
            Will format for {detectedProvider} and inject into current tab
          </div>
        </div>
      )}
    </div>
  );
};

export default Popup;
