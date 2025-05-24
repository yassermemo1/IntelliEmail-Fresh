import { useState, useEffect } from 'react';
import { Task, Email } from '@shared/schema';

interface HybridSearchResults {
  emails: Email[];
  tasks: Task[];
  totalResults: number;
  isLoading: boolean;
  error: string | null;
  searchType: 'hybrid' | 'semantic' | 'fulltext';
}

export function useHybridSearch(query: string, options: { semanticOnly?: boolean, ftsOnly?: boolean } = {}) {
  const [results, setResults] = useState<HybridSearchResults>({
    emails: [],
    tasks: [],
    totalResults: 0,
    isLoading: false,
    error: null,
    searchType: 'hybrid'
  });

  useEffect(() => {
    // Don't search if query is empty or too short
    if (!query || query.length < 2) {
      setResults({
        emails: [],
        tasks: [],
        totalResults: 0,
        isLoading: false,
        error: null,
        searchType: 'hybrid'
      });
      return;
    }

    const controller = new AbortController();
    const signal = controller.signal;

    const fetchResults = async () => {
      setResults(prev => ({ ...prev, isLoading: true, error: null }));
      
      try {
        // Build the URL with query parameters for search options
        let searchUrl = `/api/hybrid-search?q=${encodeURIComponent(query)}`;
        
        // Add optional parameters for search type
        if (options.semanticOnly) {
          searchUrl += '&semanticOnly=true';
        } else if (options.ftsOnly) {
          searchUrl += '&ftsOnly=true';
        }
        
        const response = await fetch(searchUrl, { signal });
        
        if (!response.ok) {
          throw new Error('Search request failed');
        }
        
        const data = await response.json();
        
        if (data.success) {
          setResults({
            emails: data.emails || [],
            tasks: data.tasks || [],
            totalResults: data.totalResults || 0,
            isLoading: false,
            error: null,
            searchType: data.searchType || 'hybrid'
          });
        } else {
          throw new Error(data.message || 'Unknown search error');
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          setResults(prev => ({
            ...prev,
            isLoading: false,
            error: error.message || 'Failed to search'
          }));
        }
      }
    };

    fetchResults();

    return () => {
      controller.abort();
    };
  }, [query, options.semanticOnly, options.ftsOnly]);

  return results;
}