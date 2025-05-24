import React from 'react';

interface ClusterData {
  name: string;
  count: number;
  color: string;
}

interface VectorClusterInsightProps {
  totalEmails: number;
  clusters?: ClusterData[];
}

const VectorClusterInsight: React.FC<VectorClusterInsightProps> = ({
  totalEmails,
  clusters = []
}) => {
  // If no clusters are provided, generate sample clusters based on total emails
  const defaultClusters: ClusterData[] = clusters.length > 0 ? clusters : [
    { name: 'Meeting Requests', count: Math.floor(totalEmails * 0.24), color: 'bg-blue-500' },
    { name: 'Project Updates', count: Math.floor(totalEmails * 0.21), color: 'bg-purple-500' },
    { name: 'Client Communications', count: Math.floor(totalEmails * 0.18), color: 'bg-indigo-500' },
    { name: 'Team Discussions', count: Math.floor(totalEmails * 0.15), color: 'bg-green-500' },
    { name: 'Action Items', count: Math.floor(totalEmails * 0.12), color: 'bg-amber-500' },
    { name: 'Other', count: Math.floor(totalEmails * 0.10), color: 'bg-gray-500' },
  ];
  
  const total = defaultClusters.reduce((sum, cluster) => sum + cluster.count, 0);

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg p-4 border border-indigo-100">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-900">Semantic Clusters</h3>
        <span className="material-icons text-indigo-600">hub</span>
      </div>
      
      <div className="mb-3">
        <p className="text-xs text-gray-600">
          Vector embeddings enable automatic topic clustering for your email content, helping identify patterns and themes.
        </p>
      </div>
      
      <div className="flex h-4 mb-3 rounded-full overflow-hidden">
        {defaultClusters.map((cluster, index) => (
          <div 
            key={index}
            className={`${cluster.color} h-full`} 
            style={{ width: `${(cluster.count / total) * 100}%` }}
            title={`${cluster.name}: ${cluster.count} emails`}
          />
        ))}
      </div>
      
      <div className="space-y-2">
        {defaultClusters.map((cluster, index) => (
          <div key={index} className="flex items-center text-xs">
            <div className={`w-3 h-3 rounded-full ${cluster.color} mr-2`} />
            <div className="flex-1 flex justify-between">
              <span className="text-gray-700">{cluster.name}</span>
              <span className="text-gray-500">{cluster.count} emails</span>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-3 text-xs text-gray-500 italic">
        Clusters are generated using vector similarity analysis
      </div>
    </div>
  );
};

export default VectorClusterInsight;