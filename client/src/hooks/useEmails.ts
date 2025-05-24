import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import type { Email } from "@shared/schema";

export const useEmails = (accountId?: number, limit?: number, offset?: number, cleaned?: boolean, ragProcessed?: boolean) => {
  const queryParams = new URLSearchParams();
  if (accountId) queryParams.append("accountId", accountId.toString());
  if (limit) queryParams.append("limit", limit.toString());
  if (offset) queryParams.append("offset", offset.toString());
  if (cleaned) queryParams.append("cleaned", "true");
  if (ragProcessed) queryParams.append("ragProcessed", "true");
  
  const url = `/api/emails${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
  
  return useQuery<Email[]>({
    queryKey: [url],
    enabled: true, // We want to enable even without accountId for cleaned/rag emails views
  });
};

export const useEmail = (id?: number) => {
  return useQuery<Email>({
    queryKey: [`/api/emails/${id}`],
    enabled: !!id,
  });
};

export const useUpdateEmail = () => {
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Email> }) => {
      const response = await apiRequest("PUT", `/api/emails/${id}`, data);
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/emails/${variables.id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/emails"] });
    },
  });
};

export const useSearch = (query?: string, type?: 'emails' | 'tasks' | 'all') => {
  const queryParams = new URLSearchParams();
  if (query) queryParams.append("q", query);
  if (type) queryParams.append("type", type);
  
  const url = `/api/search${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
  
  return useQuery<any>({
    queryKey: [url],
    enabled: !!query,
  });
};
