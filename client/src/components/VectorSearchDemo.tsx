import React, { useState } from 'react';

interface SearchResult {
  title: string;
  snippet: string;
  similarity: number;
}

interface VectorSearchDemoProps {
  onSearch: (query: string) => void;
}

const VectorSearchDemo: React.FC<VectorSearchDemoProps> = ({ onSearch }) => {
  const [query, setQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  
  // Example search results for demonstration
  const demoResults: SearchResult[] = [
    {
      title: "Project Update: Q2 Goals",
      snippet: "Here's the latest update on our progress toward Q2 goals and next steps for the team...",
      similarity: 0.92
    },
    {
      title: "Team Sync-up",
      snippet: "Summary of yesterday's planning session and action items for the upcoming sprint...",
      similarity: 0.87
    },
    {
      title: "Client Meeting Notes",
      snippet: "Following up on our discussion about project timeline and resource allocation...",
      similarity: 0.82
    }
  ];
  
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setShowResults(true);
      onSearch(query);
    }
  };
  
  const exampleQueries = [
    "project timeline updates",
    "client feedback responses",
    "upcoming team meetings",
    "resource allocation discussions"
  ];

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-100">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-900">Vector Search Demo</h3>
        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">768D Vectors</span>
      </div>
      
      <p className="text-xs text-gray-600 mb-3">
        Try semantic search powered by 768-dimensional vector embeddings to find contextually similar content:
      </p>
      
      <form onSubmit={handleSearch} className="mb-3">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by meaning, not just keywords..."
            className="w-full py-2 pl-3 pr-10 border border-blue-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
          <button 
            type="submit"
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-blue-500 hover:text-blue-700"
          >
            <span className="material-icons text-lg">search</span>
          </button>
        </div>
      </form>
      
      {!showResults ? (
        <div className="mb-3">
          <p className="text-xs text-gray-500 mb-2">Try searching for:</p>
          <div className="flex flex-wrap gap-2">
            {exampleQueries.map((q, index) => (
              <button
                key={index}
                onClick={() => {
                  setQuery(q);
                  setShowResults(true);
                  onSearch(q);
                }}
                className="px-2 py-1 bg-white text-xs text-blue-700 border border-blue-200 rounded-full hover:bg-blue-50"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3 mb-3">
          <p className="text-xs text-gray-500 flex items-center">
            <span className="material-icons text-xs mr-1">info</span>
            Results using semantic similarity via vector embeddings:
          </p>
          
          {demoResults.map((result, index) => (
            <div key={index} className="bg-white p-2 rounded border border-blue-100">
              <div className="flex justify-between items-start">
                <h4 className="text-xs font-semibold text-blue-900">{result.title}</h4>
                <div className="px-1.5 py-0.5 bg-blue-50 text-blue-800 text-xs rounded flex items-center">
                  <span className="material-icons text-xs mr-1">shuffle</span>
                  {(result.similarity * 100).toFixed(0)}%
                </div>
              </div>
              <p className="text-xs text-gray-600 mt-1">{result.snippet}</p>
            </div>
          ))}
          
          <button 
            onClick={() => setShowResults(false)} 
            className="text-xs text-blue-600 hover:text-blue-800 flex items-center"
          >
            <span className="material-icons text-xs mr-1">refresh</span>
            Try another search
          </button>
        </div>
      )}
      
      <div className="text-xs text-gray-500 italic">
        Semantic search understands meaning beyond keywords
      </div>
    </div>
  );
};

export default VectorSearchDemo;