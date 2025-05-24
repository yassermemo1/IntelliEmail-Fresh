import React from 'react';

interface VectorEmbeddingStatusProps {
  totalEmails: number;
  embeddedEmails: number;
  dimensions: number;
  lastProcessed?: string;
}

const VectorEmbeddingStatus: React.FC<VectorEmbeddingStatusProps> = ({
  totalEmails,
  embeddedEmails,
  dimensions,
  lastProcessed
}) => {
  const percentage = totalEmails > 0 ? Math.min(100, Math.round((embeddedEmails / totalEmails) * 100)) : 0;
  
  return (
    <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-lg p-4 border border-indigo-100">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-900">Vector Embedding Status</h3>
        <div className="px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
          <span className="material-icons text-xs mr-1">memory</span>
          {dimensions}D Vectors
        </div>
      </div>
      
      <div className="flex items-baseline mb-2">
        <span className="text-2xl font-bold text-indigo-700">{embeddedEmails}</span>
        <span className="text-sm ml-2 text-indigo-600">emails embedded</span>
        <span className="ml-auto text-xs text-indigo-500">{percentage}%</span>
      </div>
      
      <div className="w-full bg-indigo-100 rounded-full h-2 mb-3">
        <div 
          className="bg-indigo-600 h-2 rounded-full" 
          style={{ width: `${percentage}%` }} 
        />
      </div>
      
      <div className="grid grid-cols-2 gap-2 text-center text-xs">
        <div className="p-2 bg-white rounded border border-indigo-100">
          <div className="text-sm font-semibold text-indigo-800">{totalEmails - embeddedEmails}</div>
          <div className="text-gray-600">Pending</div>
        </div>
        <div className="p-2 bg-white rounded border border-indigo-100">
          <div className="text-sm font-semibold text-indigo-800">{dimensions}</div>
          <div className="text-gray-600">Dimensions</div>
        </div>
      </div>
      
      {lastProcessed && (
        <div className="mt-3 text-xs text-gray-500">
          Last processed: {new Date(lastProcessed).toLocaleString()}
        </div>
      )}
    </div>
  );
};

export default VectorEmbeddingStatus;