import { useState, useEffect } from 'react';
import { Task, Email } from '@shared/schema';

interface SearchResults {
  tasks: Task[];
  emails: Email[];
  totalResults: number;
  isLoading: boolean;
  error: string | null;
}

export function useGlobalSearch(query: string) {
  const [results, setResults] = useState<SearchResults>({
    tasks: [],
    emails: [],
    totalResults: 0,
    isLoading: false,
    error: null
  });

  useEffect(() => {
    // Don't search if query is empty or too short
    if (!query || query.length < 2) {
      setResults({
        tasks: [],
        emails: [],
        totalResults: 0,
        isLoading: false,
        error: null
      });
      return;
    }

    const controller = new AbortController();
    const signal = controller.signal;

    const fetchResults = async () => {
      setResults(prev => ({ ...prev, isLoading: true, error: null }));
      
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          signal
        });
        
        if (!response.ok) {
          throw new Error('Search request failed');
        }
        
        const data = await response.json();
        
        setResults({
          tasks: data.tasks || [],
          emails: data.emails || [],
          totalResults: data.totalResults || 0,
          isLoading: false,
          error: null
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          setResults(prev => ({
            ...prev,
            isLoading: false,
            error: err instanceof Error ? err.message : 'An error occurred'
          }));
        }
      }
    };

    // Debounce search requests
    const timeout = setTimeout(() => {
      fetchResults();
    }, 300);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  return results;
}