import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';

// Model interface
export interface AIModel {
  id: number;
  provider: string;
  modelId: string;
  displayName: string;
  description: string;
  capabilities: Record<string, boolean>;
  isEmbeddingModel: boolean;
  isDefault: boolean;
  contextLength?: number;
  createdAt?: string;
  updatedAt?: string;
}

// API response interface
export interface AIModelsResponse {
  success: boolean;
  data: AIModel[];
  message: string;
}

// Hook to get all available AI models with proper typing
export const useAiModels = () => {
  return useQuery<AIModelsResponse>({
    queryKey: ['/api/ai/models'],
    refetchOnWindowFocus: false,
    refetchInterval: 10000, // Refresh every 10 seconds to keep models list updated
  });
};

// Hook to get current AI settings
export const useAiSettings = () => {
  return useQuery({
    queryKey: ['/api/ai/settings'],
    refetchOnWindowFocus: false,
  });
};

// Hook to update AI settings
export const useUpdateAiSettings = () => {
  return useMutation({
    mutationFn: async (settings: any) => {
      const response = await fetch('/api/ai/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || 'Failed to update AI settings');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['/api/ai/settings'] });
    },
  });
};

// Hook to test Ollama connection
export const useTestOllamaConnection = () => {
  return useMutation({
    mutationFn: async (endpoint: string) => {
      const response = await fetch('/api/ai/test-ollama', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ endpoint }),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || 'Failed to connect to Ollama');
      }

      return response.json();
    },
  });
};

// Hook to get model abilities/capabilities
export const useModelCapabilities = (modelId?: number) => {
  return useQuery({
    queryKey: ['/api/ai/models', modelId, 'capabilities'],
    enabled: !!modelId,
    refetchOnWindowFocus: false,
  });
};

// Hook to test API keys
export const useTestApiKey = () => {
  return useMutation({
    mutationFn: async ({ provider, apiKey }: { provider: string; apiKey: string }) => {
      const response = await fetch('/api/ai/test-api-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ provider, apiKey }),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || `Failed to validate ${provider} API key`);
      }

      return response.json();
    },
  });
};

// Connection status type for AI provider connections
export interface ConnectionStatus {
  provider: string;
  status: "success" | "error";
  message: string;
  isKeyValid?: boolean;
}

// Hook to check connection status for all AI providers - removed as we're using direct status checks