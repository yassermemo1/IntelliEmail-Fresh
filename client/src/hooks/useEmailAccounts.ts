import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';

export interface EmailAccount {
  id: number;
  userId: number;
  accountType: string;
  authMethod: string;
  emailAddress: string;
  displayName?: string;
  lastSynced?: string;
  isActive: boolean;
  syncEnabled: boolean;
}

export function useEmailAccounts() {
  return useQuery({
    queryKey: ['/api/email-accounts'],
    queryFn: async () => {
      try {
        // Get accounts from the email accounts endpoint
        const response = await fetch('/api/email-accounts');
        if (!response.ok) {
          throw new Error('Failed to fetch email accounts');
        }
        return response.json() as Promise<EmailAccount[]>;
      } catch (error) {
        console.error('Error fetching accounts:', error);
        throw error;
      }
    },
    refetchOnWindowFocus: true,
    staleTime: 60000 // Consider data fresh for 1 minute
  });
}

export function useEmailAccount(id: number) {
  return useQuery({
    queryKey: ['/api/email-accounts', id],
    queryFn: async () => {
      const response = await fetch(`/api/email-accounts/${id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch email account');
      }
      return response.json() as Promise<EmailAccount>;
    },
    enabled: !!id
  });
}

export function useCreateEmailAccount() {
  return useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/email-accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create account');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/email-accounts'] });
    }
  });
}

export function useUpdateEmailAccount() {
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await fetch(`/api/email-accounts/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update account');
      }
      
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/email-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/email-accounts', variables.id] });
    }
  });
}

export function useDeleteEmailAccount() {
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/email-accounts/${id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete account');
      }
      
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/email-accounts'] });
    }
  });
}

export function useSyncEmailAccount() {
  return useMutation({
    mutationFn: async ({ id, limit = 50 }: { id: number; limit?: number }) => {
      const response = await fetch(`/api/email-accounts/${id}/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ limit })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to sync account');
      }
      
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/email-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/email-accounts', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/emails'] });
    }
  });
}