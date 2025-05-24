import React, { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

interface EmailProcessingPanelProps {
  onComplete?: () => void;
}

const EmailProcessingPanel: React.FC<EmailProcessingPanelProps> = ({ 
  onComplete 
}) => {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [batchSize, setBatchSize] = useState(20);
  const [results, setResults] = useState<{
    processed?: number;
    tasksCreated?: number;
    message?: string;
  } | null>(null);

  const handleProcessEmails = async () => {
    setIsProcessing(true);
    setResults(null);
    
    try {
      const response = await fetch('/api/emails/batch-process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          limit: batchSize
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to process emails');
      }
      
      const data = await response.json();
      setResults({
        processed: data.processed,
        tasksCreated: data.tasksCreated,
        message: data.message
      });
      
      toast({
        title: 'Emails Processed',
        description: `${data.processed} emails analyzed, ${data.tasksCreated} tasks created.`,
      });
      
      if (onComplete) {
        onComplete();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to process emails. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };
  
  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900">
          Email Analysis & Task Generation
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Use AI to analyze emails and automatically extract tasks
        </p>
      </div>
      
      <div className="px-4 py-5 sm:p-6">
        <div className="space-y-4">
          <div className="bg-blue-50 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="material-icons text-blue-400">info</span>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">How it works</h3>
                <div className="mt-2 text-sm text-blue-700">
                  <ul className="list-disc pl-5 space-y-1">
                    <li>AI will analyze your email content to identify actionable items</li>
                    <li>Each detected task will be assigned a priority and due date (if mentioned)</li>
                    <li>Tasks with lower confidence will be marked for your review</li>
                    <li>You can edit or delete any automatically generated tasks</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4 items-end">
            <div className="col-span-2">
              <label htmlFor="batchSize" className="block text-sm font-medium text-gray-700">
                Batch Size
              </label>
              <div className="mt-1">
                <input
                  type="number"
                  id="batchSize"
                  name="batchSize"
                  min={1}
                  max={100}
                  value={batchSize}
                  onChange={(e) => setBatchSize(parseInt(e.target.value) || 20)}
                  className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md"
                  disabled={isProcessing}
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Number of emails to process at once (1-100)
              </p>
            </div>
            
            <div>
              <button
                type="button"
                className={`w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary ${
                  isProcessing ? 'opacity-75 cursor-not-allowed' : ''
                }`}
                onClick={handleProcessEmails}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <span className="material-icons animate-spin mr-2">refresh</span>
                    Processing...
                  </>
                ) : (
                  <>
                    <span className="material-icons mr-2">psychology</span>
                    Analyze Emails
                  </>
                )}
              </button>
            </div>
          </div>
          
          {results && (
            <div className={`mt-4 p-4 rounded-md ${
              results.tasksCreated && results.tasksCreated > 0 
                ? 'bg-green-50 text-green-800' 
                : 'bg-gray-50 text-gray-800'
            }`}>
              <div className="flex">
                <div className="flex-shrink-0">
                  {results.tasksCreated && results.tasksCreated > 0 ? (
                    <span className="material-icons text-green-400">check_circle</span>
                  ) : (
                    <span className="material-icons text-gray-400">info</span>
                  )}
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium">Processing Results</h3>
                  <div className="mt-2 text-sm">
                    <p>
                      {results.message || 
                        `Analyzed ${results.processed || 0} emails and created ${results.tasksCreated || 0} tasks.`}
                    </p>
                    
                    {results.tasksCreated && results.tasksCreated > 0 && (
                      <p className="mt-2">
                        Head over to the <a href="/tasks" className="font-medium underline">Tasks page</a> to review 
                        the newly created tasks, or check the <a href="/hitl-review" className="font-medium underline">Review page</a> 
                        for tasks needing confirmation.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmailProcessingPanel;