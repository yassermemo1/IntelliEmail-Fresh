import { useState, useEffect } from 'react';

export interface SearchResult {
  type: 'task' | 'email';
  id: number;
  title?: string;
  subject?: string;
  description?: string;
  sender?: string;
  date?: string;
  dueDate?: string;
  priority?: string;
  status?: string;
}

export function useSimpleSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchEmails = async (searchQuery: string): Promise<SearchResult[]> => {
    try {
      const response = await fetch(`/api/direct-email-search?q=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) {
        console.error('Email search failed:', response.status);
        return [];
      }
      const emails = await response.json();
      console.log('Search results - Emails:', emails);
      return emails.map((email: any) => ({
        type: 'email' as const,
        id: email.id,
        subject: email.subject,
        sender: email.sender,
        date: email.date,
      }));
    } catch (error) {
      console.error('Email search error:', error);
      return [];
    }
  };

  const searchTasks = async (searchQuery: string): Promise<SearchResult[]> => {
    try {
      const response = await fetch(`/api/direct-task-search?q=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) {
        console.error('Task search failed:', response.status);
        return [];
      }
      const tasks = await response.json();
      console.log('Search results - Tasks:', tasks);
      return tasks.map((task: any) => ({
        type: 'task' as const,
        id: task.id,
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: task.status,
        dueDate: task.dueDate,
      }));
    } catch (error) {
      console.error('Task search error:', error);
      return [];
    }
  };

  const performSearch = async (searchQuery: string) => {
    if (!searchQuery || searchQuery.length < 2) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [emailResults, taskResults] = await Promise.all([
        searchEmails(searchQuery),
        searchTasks(searchQuery)
      ]);

      const allResults = [...emailResults, ...taskResults];
      setResults(allResults);
    } catch (err) {
      console.error('Search error:', err);
      setError('Search failed. Please try again.');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      performSearch(query);
    }, 300); // Debounce search

    return () => clearTimeout(timeoutId);
  }, [query]);

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setError(null);
  };

  return {
    query,
    setQuery,
    results,
    isLoading,
    error,
    clearSearch
  };
}