import React, { useState, useEffect } from 'react';

interface FileChange {
  path: string;
  content: string;
  type: 'create' | 'update' | 'delete';
  originalContent?: string;
  isPartialChange?: boolean;
}

interface ExtractedChanges {
  changes: FileChange[];
  timestamp: number;
  provider: string;
}

interface ChangeReviewerProps {
  isConnected: boolean;
}

const ChangeReviewer: React.FC<ChangeReviewerProps> = ({ isConnected }) => {
  const [extractedChanges, setExtractedChanges] = useState<ExtractedChanges | null>(null);
  const [selectedChanges, setSelectedChanges] = useState<Set<number>>(new Set());
  const [isApplying, setIsApplying] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);

  useEffect(() => {
    loadExtractedChanges();
    
    // Listen for new extracted changes
    const handleStorageChange = (changes: any) => {
      if (changes.lastExtractedChanges) {
        setExtractedChanges(changes.lastExtractedChanges.newValue);
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  const loadExtractedChanges = async () => {
    try {
      const result = await chrome.storage.local.get('lastExtractedChanges');
      if (result.lastExtractedChanges) {
        setExtractedChanges(result.lastExtractedChanges);
        // Auto-select all changes initially
        const allIndices = new Set<number>(result.lastExtractedChanges.changes.map((_: any, index: number) => index));
        setSelectedChanges(allIndices);
      }
    } catch (error) {
      console.error('Failed to load extracted changes:', error);
    }
  };

  const toggleChangeSelection = (index: number) => {
    const newSelection = new Set(selectedChanges);
    if (newSelection.has(index)) {
      newSelection.delete(index);
    } else {
      newSelection.add(index);
    }
    setSelectedChanges(newSelection);
  };

  const selectAllChanges = () => {
    if (!extractedChanges) return;
    const allIndices = new Set<number>(extractedChanges.changes.map((_, index) => index));
    setSelectedChanges(allIndices);
  };

  const deselectAllChanges = () => {
    setSelectedChanges(new Set<number>());
  };

  const previewChanges = async () => {
    if (!extractedChanges || selectedChanges.size === 0) return;

    const selectedFileChanges = extractedChanges.changes.filter((_, index) => 
      selectedChanges.has(index)
    );

    try {
      const response = await fetch('http://localhost:3001/api/files/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileChanges: selectedFileChanges })
      });

      if (response.ok) {
        const data = await response.json();
        setPreviewData(data.previews);
        setShowPreview(true);
      }
    } catch (error) {
      console.error('Failed to preview changes:', error);
    }
  };

  const applyChanges = async () => {
    if (!extractedChanges || selectedChanges.size === 0) return;

    setIsApplying(true);
    
    const selectedFileChanges = extractedChanges.changes.filter((_, index) => 
      selectedChanges.has(index)
    );

    try {
      const response = await fetch('http://localhost:3001/api/files/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          fileChanges: selectedFileChanges,
          options: { createBackups: true, dryRun: false }
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Applied changes:', result);
        
        // Clear extracted changes after successful application
        await chrome.storage.local.remove('lastExtractedChanges');
        setExtractedChanges(null);
        
        // Show success notification
        alert(`Successfully applied ${result.successful} changes!`);
      } else {
        throw new Error('Failed to apply changes');
      }
    } catch (error) {
      console.error('Failed to apply changes:', error);
      alert('Failed to apply changes. Check console for details.');
    } finally {
      setIsApplying(false);
    }
  };

  const clearChanges = async () => {
    await chrome.storage.local.remove('lastExtractedChanges');
    setExtractedChanges(null);
    setSelectedChanges(new Set());
  };

  const getChangeTypeColor = (type: string) => {
    switch (type) {
      case 'create': return '#10b981';
      case 'update': return '#3b82f6';
      case 'delete': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getChangeTypeIcon = (type: string) => {
    switch (type) {
      case 'create': return '+';
      case 'update': return '~';
      case 'delete': return '−';
      default: return '?';
    }
  };

  if (!isConnected) {
    return (
      <div style={{ padding: '16px', textAlign: 'center', color: '#6b7280' }}>
        Connect to server to review AI changes
      </div>
    );
  }

  if (!extractedChanges || extractedChanges.changes.length === 0) {
    return (
      <div style={{ padding: '16px', textAlign: 'center', color: '#6b7280' }}>
        <div style={{ marginBottom: '8px' }}>📝 No AI changes detected</div>
        <div style={{ fontSize: '12px' }}>
          AI code changes will appear here automatically
        </div>
      </div>
    );
  }

  if (showPreview && previewData) {
    return (
      <div style={{ padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
          <button
            onClick={() => setShowPreview(false)}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '16px',
              cursor: 'pointer',
              marginRight: '8px'
            }}
          >
            ←
          </button>
          <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>
            Change Preview
          </h3>
        </div>
        
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {previewData.map((preview: any, index: number) => (
            <div key={index} style={{ marginBottom: '16px', border: '1px solid #e5e7eb', borderRadius: '4px' }}>
              <div style={{ 
                padding: '8px', 
                backgroundColor: '#f9fafb', 
                borderBottom: '1px solid #e5e7eb',
                fontSize: '14px',
                fontWeight: '500'
              }}>
                {preview.filePath}
              </div>
              <div style={{ padding: '8px', fontSize: '12px', fontFamily: 'monospace' }}>
                {preview.lineChanges.slice(0, 10).map((change: any, lineIndex: number) => (
                  <div key={lineIndex} style={{ 
                    color: change.type === 'add' ? '#10b981' : change.type === 'remove' ? '#ef4444' : '#3b82f6',
                    marginBottom: '2px'
                  }}>
                    {change.type === 'add' ? '+' : change.type === 'remove' ? '-' : '~'} {change.content}
                  </div>
                ))}
                {preview.lineChanges.length > 10 && (
                  <div style={{ color: '#6b7280', fontStyle: 'italic' }}>
                    ... and {preview.lineChanges.length - 10} more changes
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          <button
            onClick={applyChanges}
            disabled={isApplying}
            style={{
              flex: 1,
              padding: '8px 12px',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              cursor: isApplying ? 'not-allowed' : 'pointer',
              opacity: isApplying ? 0.6 : 1
            }}
          >
            {isApplying ? 'Applying...' : 'Apply Changes'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>
          AI Changes Detected
        </h3>
        <button
          onClick={clearChanges}
          style={{
            background: 'none',
            border: 'none',
            color: '#6b7280',
            fontSize: '12px',
            cursor: 'pointer'
          }}
        >
          Clear
        </button>
      </div>

      <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '12px' }}>
        From {extractedChanges.provider} • {new Date(extractedChanges.timestamp).toLocaleTimeString()}
      </div>

      <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
        <button
          onClick={selectAllChanges}
          style={{
            padding: '4px 8px',
            fontSize: '12px',
            background: 'none',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Select All
        </button>
        <button
          onClick={deselectAllChanges}
          style={{
            padding: '4px 8px',
            fontSize: '12px',
            background: 'none',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Deselect All
        </button>
      </div>

      <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '12px' }}>
        {extractedChanges.changes.map((change, index) => (
          <div
            key={index}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '8px',
              border: '1px solid #e5e7eb',
              borderRadius: '4px',
              marginBottom: '6px',
              backgroundColor: selectedChanges.has(index) ? '#f0f9ff' : 'white',
              cursor: 'pointer'
            }}
            onClick={() => toggleChangeSelection(index)}
          >
            <input
              type="checkbox"
              checked={selectedChanges.has(index)}
              onChange={() => toggleChangeSelection(index)}
              style={{ marginRight: '8px' }}
            />
            <div
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                backgroundColor: getChangeTypeColor(change.type),
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 'bold',
                marginRight: '8px'
              }}
            >
              {getChangeTypeIcon(change.type)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: '500' }}>
                {change.path.split('/').pop()}
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>
                {change.path} • {change.type}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={previewChanges}
          disabled={selectedChanges.size === 0}
          style={{
            flex: 1,
            padding: '8px 12px',
            backgroundColor: selectedChanges.size === 0 ? '#f3f4f6' : '#3b82f6',
            color: selectedChanges.size === 0 ? '#9ca3af' : 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '14px',
            cursor: selectedChanges.size === 0 ? 'not-allowed' : 'pointer'
          }}
        >
          Preview ({selectedChanges.size})
        </button>
        <button
          onClick={applyChanges}
          disabled={selectedChanges.size === 0 || isApplying}
          style={{
            flex: 1,
            padding: '8px 12px',
            backgroundColor: selectedChanges.size === 0 || isApplying ? '#f3f4f6' : '#10b981',
            color: selectedChanges.size === 0 || isApplying ? '#9ca3af' : 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '14px',
            cursor: selectedChanges.size === 0 || isApplying ? 'not-allowed' : 'pointer'
          }}
        >
          {isApplying ? 'Applying...' : `Apply (${selectedChanges.size})`}
        </button>
      </div>
    </div>
  );
};

export default ChangeReviewer;