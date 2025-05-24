import { useCallback } from 'react';
import { toast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { queryClient } from '@/lib/queryClient';

export function useEmailCleaner() {
  // Clean a single email and update the cache
  const cleanSingleEmail = useCallback(async (emailId: number) => {
    try {
      const result = await apiRequest(`/api/clean-emails/single/${emailId}`, {
        method: 'POST',
      });
      
      if (result.success) {
        // Invalidate the specific email cache
        queryClient.invalidateQueries({ queryKey: [`/api/emails/${emailId}`] });
        
        toast({
          title: 'Email cleaned',
          description: 'Email content has been cleaned successfully',
          variant: 'default',
        });
        
        return true;
      } else {
        throw new Error(result.error || 'Failed to clean email');
      }
    } catch (error: any) {
      console.error('Error cleaning email:', error);
      
      toast({
        title: 'Error cleaning email',
        description: error.message || 'An error occurred while cleaning the email',
        variant: 'destructive',
      });
      
      return false;
    }
  }, []);
  
  // Start a batch cleaning process
  const cleanBatchEmails = useCallback(async (limit: number = 500) => {
    try {
      const result = await apiRequest('/api/clean-emails/batch', {
        method: 'POST',
        body: JSON.stringify({ limit }),
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (result.success) {
        // Invalidate all emails cache
        queryClient.invalidateQueries({ queryKey: ['/api/emails'] });
        
        toast({
          title: 'Batch cleaning started',
          description: `Successfully cleaned ${result.count} emails`,
          variant: 'default',
        });
        
        return result;
      } else {
        throw new Error(result.error || 'Failed to start batch cleaning');
      }
    } catch (error: any) {
      console.error('Error starting batch cleaning:', error);
      
      toast({
        title: 'Error starting batch cleaning',
        description: error.message || 'An error occurred while starting batch cleaning',
        variant: 'destructive',
      });
      
      return { success: false, count: 0, error: error.message };
    }
  }, []);
  
  // Get the current cleaning status
  const getCleaningStatus = useCallback(async () => {
    try {
      const result = await apiRequest('/api/clean-emails/status');
      return result;
    } catch (error: any) {
      console.error('Error getting cleaning status:', error);
      return {
        success: false,
        error: error.message || 'An error occurred while getting cleaning status',
      };
    }
  }, []);
  
  return {
    cleanSingleEmail,
    cleanBatchEmails,
    getCleaningStatus,
  };
}