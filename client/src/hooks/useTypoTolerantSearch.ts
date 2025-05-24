import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Email, Task } from '@shared/schema';
import { fetchSemanticEmbedding } from '@/lib/vectorUtils';

// Define the different types of searches we can perform
type SearchType = 'keyword' | 'semantic' | 'hybrid';
type SearchTarget = 'emails' | 'tasks'; 

interface UseTypoTolerantSearchOptions {
  userId: number;
  searchType?: SearchType;
  initialQuery?: string;
  target: SearchTarget;
  limit?: number;
  onlyWithEmbeddings?: boolean;
  debounceMs?: number;
}

interface SearchResult {
  id: number;
  // Common fields for all search results
  matchType?: 'keyword' | 'semantic' | 'keyword+semantic';
  score?: number;
  hybrid_score?: number;
  semantic_score?: number;
  distance?: number;
  rank?: number;
  // Other fields will depend on whether it's an email or task
  [key: string]: any;
}

/**
 * A hook for performing typo-tolerant searches on emails or tasks
 * 
 * @param options - Configuration options for the search
 * @returns An object containing the search state and functions
 */
export function useTypoTolerantSearch({
  userId,
  searchType = 'hybrid',
  initialQuery = '',
  target,
  limit = 20,
  onlyWithEmbeddings = false,
  debounceMs = 300
}: UseTypoTolerantSearchOptions) {
  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Store the embedding for semantic searches
  const [queryEmbedding, setQueryEmbedding] = useState<number[] | null>(null);
  const [isGeneratingEmbedding, setIsGeneratingEmbedding] = useState(false);

  // Debounce the search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [query, debounceMs]);

  // Generate embedding for the query if needed (for semantic or hybrid search)
  useEffect(() => {
    let isMounted = true;

    async function generateEmbedding() {
      if (!debouncedQuery || (searchType === 'keyword')) {
        setQueryEmbedding(null);
        return;
      }

      try {
        setIsGeneratingEmbedding(true);
        const embedding = await fetchSemanticEmbedding(debouncedQuery);
        
        if (isMounted) {
          if (embedding && Array.isArray(embedding)) {
            setQueryEmbedding(embedding);
          } else {
            setQueryEmbedding(null);
          }
          setIsGeneratingEmbedding(false);
        }
      } catch (err) {
        if (isMounted) {
          console.error('Error generating embedding:', err);
          setIsGeneratingEmbedding(false);
          // Don't set error - we can still do keyword search
          setQueryEmbedding(null);
        }
      }
    }

    if (debouncedQuery && (searchType === 'semantic' || searchType === 'hybrid')) {
      generateEmbedding();
    } else {
      setQueryEmbedding(null);
      setIsGeneratingEmbedding(false);
    }

    return () => {
      isMounted = false;
    };
  }, [debouncedQuery, searchType]);

  // Perform the search when the debounced query or embedding changes
  const performSearch = useCallback(async () => {
    if (!debouncedQuery || !userId) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Use POST method consistently since it's working in the backend
      const endpoint = `/api/search/typo-tolerant/${target}`;
      
      const requestBody: any = {
        query: debouncedQuery,
        limit,
        searchType: searchType || 'hybrid'
      };

      // Add embedding for semantic/hybrid searches if available
      if ((searchType === 'semantic' || searchType === 'hybrid') && queryEmbedding && Array.isArray(queryEmbedding)) {
        requestBody.embedding = queryEmbedding;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Search failed');
      }

      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error('Search error:', error);
      setError(typeof error === 'object' && error !== null && 'message' in error 
        ? (error as Error).message 
        : 'Failed to perform search');
      
      toast({
        title: "Search Error",
        description: typeof error === 'object' && error !== null && 'message' in error 
          ? (error as Error).message 
          : 'Failed to perform search',
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [debouncedQuery, userId, searchType, target, limit, queryEmbedding, onlyWithEmbeddings, toast]);

  // Execute search when relevant dependencies change
  useEffect(() => {
    if (debouncedQuery) {
      // If we need an embedding but don't have it yet and aren't in the process of getting it,
      // don't perform the search yet
      if ((searchType === 'semantic' || searchType === 'hybrid') && 
          !queryEmbedding && 
          !isGeneratingEmbedding) {
        return;
      }

      // For keyword searches or when we have the embedding (or don't need it), perform the search
      performSearch();
    } else {
      setResults([]);
    }
  }, [debouncedQuery, queryEmbedding, isGeneratingEmbedding, searchType, performSearch]);

  // Function to clear the search
  const clearSearch = useCallback(() => {
    setQuery('');
    setDebouncedQuery('');
    setResults([]);
    setQueryEmbedding(null);
  }, []);

  return {
    query,
    setQuery,
    results,
    isLoading: isLoading || isGeneratingEmbedding,
    error,
    clearSearch,
    searchType,
    isGeneratingEmbedding
  };
}

// Utility function to create a dummy fetchSemanticEmbedding function if it doesn't exist
// This should be replaced with a proper implementation that calls your backend
if (typeof window !== 'undefined' && !window.hasOwnProperty('fetchSemanticEmbedding')) {
  (window as any).fetchSemanticEmbedding = async (text: string): Promise<number[]> => {
    // This is a dummy implementation - in a real app, this would call your backend
    console.log('Dummy embedding generation for:', text);
    return Promise.resolve(Array(768).fill(0).map(() => Math.random() - 0.5));
  };
}