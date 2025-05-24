import React from "react";

interface SemanticSearchInsightProps {
  totalEmails: number;
  embeddedEmails: number;
  onSearch: (query: string) => void;
}

const SemanticSearchInsight: React.FC<SemanticSearchInsightProps> = ({
  totalEmails,
  embeddedEmails,
  onSearch,
}) => {
  const [searchQuery, setSearchQuery] = React.useState("");
  const coverage = totalEmails > 0 ? Math.round((embeddedEmails / totalEmails) * 100) : 0;
  
  const exampleQueries = [
    "meeting follow-ups from last week",
    "urgent project deadlines",
    "new client proposals",
    "team feedback responses"
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onSearch(searchQuery);
    }
  };

  return (
    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 p-4 rounded-lg border border-purple-100">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-900">Semantic Search Ready</h3>
        <span className="material-icons text-purple-600">psychology</span>
      </div>
      
      <div className="mb-3">
        <div className="flex items-baseline mb-1">
          <span className="text-2xl font-bold text-purple-700">{embeddedEmails}</span>
          <span className="text-sm ml-2 text-purple-600">emails with vector embeddings</span>
        </div>
        <div className="w-full bg-purple-200 rounded-full h-1.5 mb-1">
          <div 
            className="bg-purple-600 h-1.5 rounded-full" 
            style={{ width: `${coverage}%` }} 
          />
        </div>
        <p className="text-xs text-purple-600">{coverage}% of your emails are semantically indexed</p>
      </div>
      
      <form onSubmit={handleSubmit} className="mb-3">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Try semantic search..."
            className="w-full py-2 pl-3 pr-10 border border-purple-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
          />
          <button 
            type="submit"
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-purple-500 hover:text-purple-700"
          >
            <span className="material-icons text-lg">search</span>
          </button>
        </div>
      </form>
      
      <div>
        <p className="text-xs text-gray-500 mb-2">Try searching for:</p>
        <div className="flex flex-wrap gap-2">
          {exampleQueries.map((query, index) => (
            <button
              key={index}
              onClick={() => {
                setSearchQuery(query);
                onSearch(query);
              }}
              className="px-2 py-1 bg-white text-xs text-purple-700 border border-purple-200 rounded-full hover:bg-purple-50"
            >
              {query}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SemanticSearchInsight;