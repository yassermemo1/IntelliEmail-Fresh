import React, { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';

const EmailRagProcessingPanel = () => {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [batchSize, setBatchSize] = useState(100);
  const [status, setStatus] = useState<{
    totalEmails: number;
    processedEmails: number;
    unprocessedEmails: number;
    percentComplete: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load initial status
  useEffect(() => {
    fetchStatus();
  }, []);

  // Fetch current processing status
  const fetchStatus = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/ai/embedding-status');
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      } else {
        toast({
          title: 'Error',
          description: 'Failed to fetch processing status',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error fetching status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Process a batch of emails
  const handleProcessEmails = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch('/api/ai/process-embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ batchSize })
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: 'Processing Complete',
          description: `Processed ${data.processedCount} emails for RAG capabilities`,
        });
        // Fetch updated status
        fetchStatus();
      } else {
        const errorData = await response.json();
        toast({
          title: 'Processing Failed',
          description: errorData.error || 'Failed to process emails',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error processing emails:', error);
      toast({
        title: 'Processing Error',
        description: 'An unexpected error occurred',
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
          RAG Email Processing
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Process your emails with vector embeddings for semantic search and AI querying capabilities
        </p>
      </div>

      <div className="px-4 py-5 sm:p-6">
        {isLoading ? (
          <div className="flex justify-center py-6">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
          </div>
        ) : (
          <>
            {status && (
              <div className="mb-6">
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Processing Status</span>
                  <span className="text-sm font-medium text-primary">{status.percentComplete}% Complete</span>
                </div>
                <Progress value={status.percentComplete} className="h-2" />
                
                <div className="mt-4 grid grid-cols-3 gap-4 text-center">
                  <div className="bg-gray-50 rounded-md p-3">
                    <p className="text-xs text-gray-500">Total Emails</p>
                    <p className="text-lg font-semibold text-gray-900">{status.totalEmails}</p>
                  </div>
                  <div className="bg-green-50 rounded-md p-3">
                    <p className="text-xs text-gray-500">Processed</p>
                    <p className="text-lg font-semibold text-green-600">{status.processedEmails}</p>
                  </div>
                  <div className="bg-blue-50 rounded-md p-3">
                    <p className="text-xs text-gray-500">Remaining</p>
                    <p className="text-lg font-semibold text-blue-600">{status.unprocessedEmails}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-5">
              <div>
                <label htmlFor="batchSize" className="block text-sm font-medium text-gray-700">
                  Batch Size
                </label>
                <select
                  id="batchSize"
                  value={batchSize}
                  onChange={(e) => setBatchSize(parseInt(e.target.value))}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md"
                  disabled={isProcessing}
                >
                  <option value={50}>Small (50 emails)</option>
                  <option value={100}>Medium (100 emails)</option>
                  <option value={200}>Large (200 emails)</option>
                  <option value={500}>Very Large (500 emails)</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Larger batches process more emails at once but may take longer to complete
                </p>
              </div>

              <div>
                <button
                  type="button"
                  onClick={handleProcessEmails}
                  disabled={isProcessing || (status?.unprocessedEmails === 0)}
                  className={`w-full inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                    isProcessing || (status?.unprocessedEmails === 0)
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary'
                  }`}
                >
                  {isProcessing ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing Emails...
                    </>
                  ) : status?.unprocessedEmails === 0 ? (
                    'All Emails Processed'
                  ) : (
                    'Process Emails for RAG'
                  )}
                </button>
              </div>

              {status && status.processedEmails > 0 && (
                <div className="mt-6 bg-blue-50 p-4 rounded-md">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <span className="material-icons text-blue-400">info</span>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-blue-800">What you can do with processed emails</h3>
                      <div className="mt-2 text-sm text-blue-700">
                        <ul className="list-disc pl-5 space-y-1">
                          <li>Ask questions about your emails using natural language</li>
                          <li>Find semantically similar emails even with different wording</li>
                          <li>Generate summaries and insights from your email data</li>
                          <li>Automatically classify emails into categories</li>
                        </ul>
                      </div>
                      <div className="mt-3">
                        <a href="/email-ai" className="text-sm font-medium text-blue-600 hover:text-blue-500">
                          Go to Email AI Features <span aria-hidden="true">&rarr;</span>
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default EmailRagProcessingPanel;