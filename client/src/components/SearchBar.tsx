import React, { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X, Loader2 } from 'lucide-react';
import { useTypoTolerantSearch } from '@/hooks/useTypoTolerantSearch';
import { useToast } from '@/hooks/use-toast';

interface SearchBarProps {
  placeholder?: string;
  userId: number;
  onResultsChange?: (results: any[]) => void;
  searchTarget?: 'emails' | 'tasks';
  autoFocus?: boolean;
  className?: string;
}

export function SearchBar({
  placeholder = 'Search...',
  userId,
  onResultsChange,
  searchTarget = 'emails',
  autoFocus = false,
  className = '',
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
  // Use our typo-tolerant search hook
  const {
    query,
    setQuery,
    results,
    isLoading,
    clearSearch,
  } = useTypoTolerantSearch({
    userId,
    target: searchTarget,
    searchType: 'hybrid', // Use hybrid search for best results
  });
  
  // Notify parent component when results change
  useEffect(() => {
    if (onResultsChange) {
      onResultsChange(results);
    }
  }, [results, onResultsChange]);
  
  // Auto-focus the input if specified
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);
  
  // Handle search input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  };
  
  // Handle search form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // The search happens automatically via the hook
    
    // Show a toast if there are no results
    if (query && results.length === 0 && !isLoading) {
      toast({
        title: 'No results found',
        description: `No ${searchTarget} matched your search.`,
      });
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className={`relative ${className}`}>
      <div className="relative flex items-center">
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={handleChange}
          className="pr-14"
          disabled={isLoading}
        />
        
        <div className="absolute inset-y-0 right-0 flex pr-3">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : query ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => {
                clearSearch();
                inputRef.current?.focus();
              }}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Clear search</span>
            </Button>
          ) : (
            <Search className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>
      
      {/* Can add search suggestions or auto-complete here */}
    </form>
  );
}