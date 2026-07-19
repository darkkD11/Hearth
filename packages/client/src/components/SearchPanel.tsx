import { useState, useCallback, useRef, useEffect } from 'react';
import { api } from '../lib/api';
import { X, SearchIcon } from 'lucide-react';
import type { Message } from '@hearth/shared';
import './SearchPanel.css';

interface SearchResult extends Message {
  channel_name?: string;
  rank?: number;
}

interface SearchPanelProps {
  channelId?: string | null;
  onClose: () => void;
  onJumpToMessage?: (channelId: string, messageId: string) => void;
}

function formatSearchTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function highlightText(text: string, query: string): string {
  if (!query.trim()) return text;
  const terms = query.trim().split(/\s+/);
  let result = text;
  terms.forEach(term => {
    const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    result = result.replace(regex, '<mark>$1</mark>');
  });
  return result;
}

export function SearchPanel({ channelId, onClose }: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

    try {
      const params = new URLSearchParams({ q });
      if (channelId) params.set('channelId', channelId);
      
      const data = await api.get<{ results: SearchResult[] }>(`/messages/search?${params}`);
      setResults(data.results);
    } catch (err) {
      console.error('Search failed:', err);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [channelId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    
    // Debounce search
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 300);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="search-panel">
      <div className="search-panel-header">
        <SearchIcon size={18} style={{ color: 'var(--text-muted)' }} />
        <h3>Search Messages</h3>
        <button className="search-close-btn" onClick={onClose} title="Close">
          <X size={18} />
        </button>
      </div>

      <div className="search-input-wrapper">
        <input
          ref={inputRef}
          type="text"
          className="search-input"
          placeholder={channelId ? 'Search in this channel...' : 'Search all channels...'}
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
        />
      </div>

      <div className="search-results">
        {isSearching && (
          <div className="search-loading">Searching...</div>
        )}

        {!isSearching && hasSearched && results.length === 0 && (
          <div className="search-empty">
            <p>No results found for "{query}"</p>
          </div>
        )}

        {!isSearching && !hasSearched && (
          <div className="search-empty">
            <p>Type at least 2 characters to search</p>
          </div>
        )}

        {results.map((result) => (
          <div key={result.id} className="search-result-item">
            <div className="search-result-header">
              <span className="search-result-author">
                {result.author?.display_name || result.author?.username || 'Unknown'}
              </span>
              {result.channel_name && (
                <span className="search-result-channel">#{result.channel_name}</span>
              )}
              <span className="search-result-time">{formatSearchTime(result.created_at)}</span>
            </div>
            <div
              className="search-result-content"
              dangerouslySetInnerHTML={{ __html: highlightText(result.content, query) }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
