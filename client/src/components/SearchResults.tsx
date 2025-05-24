import React from 'react';
import { useLocation } from 'wouter';
import { format } from 'date-fns';
import { Mail, CheckSquare, Calendar, ArrowUpRight } from 'lucide-react';

interface SearchResultsProps {
  emails: any[];
  tasks: any[];
  isLoading: boolean;
  isOpen: boolean;
  onClose: () => void;
  searchQuery: string;
}

const SearchResults: React.FC<SearchResultsProps> = ({
  emails,
  tasks,
  isLoading,
  isOpen,
  onClose,
  searchQuery
}) => {
  const [, setLocation] = useLocation();

  if (!isOpen) return null;

  const handleEmailClick = (emailId: number) => {
    setLocation(`/emails/${emailId}`);
    onClose();
  };

  const handleTaskClick = (taskId: number) => {
    setLocation(`/tasks/${taskId}`);
    onClose();
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    try {
      return format(new Date(dateString), 'MMM d, yyyy');
    } catch (e) {
      return '';
    }
  };

  // Highlight matching text in search results
  const highlightMatch = (text: string, query: string) => {
    if (!text || !query || query.length < 2) return text;
    
    // Escape special regex characters
    const safeQuery = query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    
    // Create a regular expression for case-insensitive search
    const regex = new RegExp(`(${safeQuery})`, 'gi');
    
    // Split the text by matches and join with highlighted spans
    const parts = text.split(regex);
    return parts.map((part, i) => {
      if (part.toLowerCase() === query.toLowerCase()) {
        return <span key={i} className="bg-yellow-200 font-medium">{part}</span>;
      }
      return part;
    });
  };

  return (
    <div className="absolute top-full left-0 w-full mt-1 bg-white rounded-md shadow-lg z-50 max-h-96 overflow-y-auto">
      {isLoading ? (
        <div className="p-4 text-center">
          <div className="animate-spin h-6 w-6 border-t-2 border-blue-500 border-solid rounded-full mx-auto"></div>
          <p className="mt-2 text-gray-600">Searching...</p>
        </div>
      ) : (
        <div>
          {/* No results state */}
          {emails.length === 0 && tasks.length === 0 && searchQuery.length >= 2 && (
            <div className="p-4 text-center">
              <p className="text-gray-600">No results found for "{searchQuery}"</p>
            </div>
          )}

          {/* Email results */}
          {emails.length > 0 && (
            <div>
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Emails ({emails.length})
                </h3>
              </div>
              <ul>
                {emails.map((email) => (
                  <li 
                    key={email.id}
                    className="px-4 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 flex items-start"
                    onClick={() => handleEmailClick(email.id)}
                  >
                    <Mail className="h-4 w-4 text-gray-400 mt-1 mr-2 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{highlightMatch(email.subject, searchQuery)}</p>
                      <p className="text-sm text-gray-500 truncate">From: {email.sender}</p>
                      {email.date && (
                        <p className="text-xs text-gray-400">{formatDate(email.date)}</p>
                      )}
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-gray-400 ml-2 flex-shrink-0" />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Task results */}
          {tasks.length > 0 && (
            <div>
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Tasks ({tasks.length})
                </h3>
              </div>
              <ul>
                {tasks.map((task) => (
                  <li 
                    key={task.id}
                    className="px-4 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 flex items-start"
                    onClick={() => handleTaskClick(task.id)}
                  >
                    <CheckSquare className="h-4 w-4 text-gray-400 mt-1 mr-2 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{highlightMatch(task.title, searchQuery)}</p>
                      {task.description && (
                        <p className="text-sm text-gray-500 truncate">{highlightMatch(task.description, searchQuery)}</p>
                      )}
                      <div className="flex items-center mt-1">
                        {task.dueDate && (
                          <span className="flex items-center text-xs text-gray-400 mr-3">
                            <Calendar className="h-3 w-3 mr-1" />
                            {formatDate(task.dueDate)}
                          </span>
                        )}
                        {task.priority && (
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                            task.priority === 'high' ? 'bg-red-100 text-red-800' :
                            task.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {task.priority}
                          </span>
                        )}
                      </div>
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-gray-400 ml-2 flex-shrink-0" />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      
      {/* Close button */}
      <div className="px-4 py-2 border-t border-gray-200">
        <button 
          onClick={onClose}
          className="w-full text-sm text-gray-600 hover:text-gray-900 text-center py-1"
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default SearchResults;