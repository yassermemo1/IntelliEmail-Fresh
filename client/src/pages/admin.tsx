import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { useStatsData } from '@/hooks/useTasks';

export default function AdminPage() {
  const { toast } = useToast();
  const [cleaning, setCleaning] = useState(false);
  const [cleanupStarted, setCleanupStarted] = useState(false);
  
  // Fetch stats data to get email counts
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useStatsData();
  
  // Periodically refetch stats when cleanup is running to show progress
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    
    if (cleaning) {
      interval = setInterval(() => {
        refetchStats();
      }, 5000); // Refetch every 5 seconds
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [cleaning, refetchStats]);

  const triggerEmailCleanup = async () => {
    try {
      setCleaning(true);
      setCleanupStarted(true);
      
      const response = await apiRequest({
        url: '/api/emails/clean-content',
        method: 'POST'
      });
      
      toast({
        title: 'Content cleanup started',
        description: 'The system is now cleaning all email content. This may take several minutes.',
      });
      
      // Start polling for updates
      const pollInterval = setInterval(async () => {
        await refetchStats();
        // If all emails are cleaned, stop polling
        if (stats && stats.processedEmails > 0 && stats.processedEmails >= stats.totalEmails) {
          clearInterval(pollInterval);
          setCleaning(false);
          toast({
            title: 'Content cleanup complete',
            description: `Successfully cleaned ${stats.processedEmails} emails.`,
          });
        }
      }, 10000); // Check every 10 seconds
      
      // Safety timeout after 5 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        setCleaning(false);
      }, 5 * 60 * 1000);
      
    } catch (error) {
      toast({
        title: 'Error starting cleanup',
        description: 'Failed to start the email content cleanup process.',
        variant: 'destructive',
      });
    } finally {
      // Don't set cleaning to false here, we'll do it after polling completes
    }
  };

  // Calculate progress percentage
  const cleanupProgress = stats && stats.totalEmails > 0
    ? Math.min(100, (stats.processedEmails / stats.totalEmails) * 100)
    : 0;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <h1 className="text-3xl font-bold">Admin Tools</h1>

      <Card>
        <CardHeader>
          <CardTitle>Email Content Cleanup</CardTitle>
          <CardDescription>
            Clean up all existing emails to remove images, logos, and links, replacing them with text placeholders.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stats && (
            <div className="mb-6">
              <div className="flex justify-between mb-2">
                <span className="text-sm text-gray-500">Cleaned Emails:</span>
                <span className="text-sm font-medium">{stats?.processedEmails ? stats.processedEmails : 0} of {stats?.totalEmails ? stats.totalEmails : 0}</span>
              </div>
              <Progress value={cleanupProgress} className="h-2" />
            </div>
          )}
          
          <p className="text-sm text-gray-600 mb-4">
            This process will go through all emails in the database and clean their content to remove URLs, images, logos, and marketing elements. 
            The process runs in the background and may take several minutes to complete depending on the number of emails.
          </p>
          
          <div className="bg-blue-50 text-blue-800 p-4 rounded-md">
            <h4 className="font-medium mb-2">Elements that will be cleaned:</h4>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Images (replaced with [IMAGE REMOVED])</li>
              <li>URLs and hyperlinks (replaced with [URL REMOVED])</li>
              <li>End_Logo references (replaced with [LOGO REMOVED])</li>
              <li>Marketing email footers with unsubscribe links</li>
              <li>HTML content will be set to null to prevent images from loading</li>
            </ul>
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            onClick={triggerEmailCleanup} 
            disabled={cleaning}
            className="bg-primary hover:bg-primary/90"
          >
            {cleaning ? 'Processing...' : cleanupStarted ? 'Restart Cleanup' : 'Start Content Cleanup'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}