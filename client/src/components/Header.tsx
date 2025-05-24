import React, { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useTypoTolerantSearch } from "@/hooks/useTypoTolerantSearch";
import { SearchIcon } from "lucide-react";
import SearchResults from "@/components/SearchResults";

interface HeaderProps {
  toggleSidebar: () => void;
}

const Header: React.FC<HeaderProps> = ({ toggleSidebar }) => {
  const [location] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  
  // Simplified search state
  const [searchResults, setSearchResults] = React.useState({ tasks: [], emails: [] });
  const [isSearching, setIsSearching] = React.useState(false);

  // Perform search when query changes
  React.useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults({ tasks: [], emails: [] });
      return;
    }

    const searchTimeout = setTimeout(async () => {
      setIsSearching(true);
      try {
        // Search both tasks and emails using the working endpoints
        console.log(`Making search requests for: "${searchQuery}"`);
        const [tasksResponse, emailsResponse] = await Promise.all([
          fetch(`/api/find-tasks?query=${encodeURIComponent(searchQuery)}`),
          fetch(`/api/find-emails?query=${encodeURIComponent(searchQuery)}`)
        ]);

        // Check if responses are JSON by examining content-type
        const tasksText = await tasksResponse.text();
        const emailsText = await emailsResponse.text();
        
        let tasks = [];
        let emails = [];
        
        try {
          tasks = tasksText.startsWith('[') || tasksText.startsWith('{') ? JSON.parse(tasksText) : [];
        } catch (e) {
          console.warn('Tasks response not JSON:', tasksText.substring(0, 100));
          tasks = [];
        }
        
        try {
          emails = emailsText.startsWith('[') || emailsText.startsWith('{') ? JSON.parse(emailsText) : [];
        } catch (e) {
          console.warn('Emails response not JSON:', emailsText.substring(0, 100));
          emails = [];
        }
        
        // Debug logging to see what we're getting
        console.log('Search results - Tasks:', tasks);
        console.log('Search results - Emails:', emails);
        
        setSearchResults({ tasks, emails });
      } catch (error) {
        console.error('Search error:', error);
        setSearchResults({ tasks: [], emails: [] });
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(searchTimeout);
  }, [searchQuery]);
  
  // Handle clicks outside of search results
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);
  
  // Determine the current page title based on location
  const getPageTitle = () => {
    switch (location) {
      case "/":
        return "Intelligent Email Task Manager";
      case "/tasks":
        return "Tasks";
      case "/emails":
        return "Emails";
      case "/search":
        return "Semantic Search";
      case "/hitl-review":
        return "HITL Review";
      case "/settings":
        return "Settings";
      default:
        return "Intelligent Email Task Manager";
    }
  };
  
  return (
    <header className="bg-white border-b border-gray-200 z-10">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <h1 className="text-xl font-semibold text-primary">{getPageTitle()}</h1>
            </div>
          </div>
          <div className="flex items-center">
            {/* Global search */}
            <div className="flex-1 flex justify-center px-2 lg:ml-6 lg:justify-end">
              <div className="max-w-lg w-full lg:max-w-xs relative" ref={searchRef}>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <SearchIcon className="h-4 w-4 text-gray-400" />
                  </div>
                  <input 
                    id="search" 
                    name="search" 
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:border-primary focus:ring-1 focus:ring-primary sm:text-sm" 
                    placeholder="Search with typo tolerance (e.g. intersting → interesting)" 
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setIsSearchOpen(true)}
                  />
                </div>
                
                {/* Search Results Dropdown */}
                <SearchResults 
                  isOpen={isSearchOpen && searchQuery.length >= 2}
                  emails={searchResults.emails || []}
                  tasks={searchResults.tasks || []}
                  isLoading={isSearching}
                  onClose={() => setIsSearchOpen(false)}
                  searchQuery={searchQuery}
                />
              </div>
            </div>
            
            {/* Notification bell */}
            <div className="relative">
              <button 
                className="flex-shrink-0 p-1 ml-4 text-gray-400 rounded-full hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary relative"
                onClick={() => {
                  // In a real app, this would toggle notifications
                  alert("Notifications feature will be implemented in future updates");
                }}
              >
                <span className="material-icons">notifications</span>
                <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500"></span>
              </button>
            </div>
            
            {/* User profile dropdown */}
            <div className="ml-4 relative flex-shrink-0">
              <button 
                className="bg-white rounded-full flex items-center text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary p-1"
                onClick={() => {
                  // Navigate to settings page
                  window.location.href = '/settings';
                }}
              >
                <span className="sr-only">Open user menu</span>
                <span className="material-icons text-gray-600">account_circle</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
