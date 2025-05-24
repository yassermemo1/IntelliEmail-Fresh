import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import type { Task, InsertTask } from "@shared/schema";

export const useTasks = (limit?: number, offset?: number, search?: string, priority?: string) => {
  const queryParams = new URLSearchParams();
  if (limit) queryParams.append("limit", limit.toString());
  if (offset) queryParams.append("offset", offset.toString());
  if (search) queryParams.append("search", search);
  if (priority && priority !== 'all') queryParams.append("priority", priority);
  
  const url = `/api/tasks${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
  
  return useQuery<Task[]>({
    queryKey: ['/api/tasks', { limit, offset, search, priority }],
    queryFn: () => fetch(url).then(res => res.json())
  });
};

export const useTasksRequiringReview = () => {
  return useQuery<Task[]>({
    queryKey: ["/api/tasks/review"],
  });
};

export const useTask = (id?: number) => {
  return useQuery<Task>({
    queryKey: [`/api/tasks/${id}`],
    enabled: !!id,
  });
};

export const useCreateTask = () => {
  return useMutation({
    mutationFn: async (data: Omit<InsertTask, "userId">) => {
      const response = await apiRequest({
        method: "POST", 
        url: "/api/tasks", 
        body: data
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
  });
};

export const useUpdateTask = () => {
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertTask> }) => {
      const response = await apiRequest({
        method: "PUT", 
        url: `/api/tasks/${id}`, 
        body: data
      });
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${variables.id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/review"] });
    },
  });
};

export const useDeleteTask = () => {
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest({
        method: "DELETE", 
        url: `/api/tasks/${id}`
      });
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
  });
};

export interface StatsData {
  activeTasks: number;
  completedTasks: number;
  processedEmails: number;
  pendingReviews: number;
  ragEmails: number;
  cleanedEmails: number;
}

export const useStatsData = () => {
  return useQuery<StatsData>({
    queryKey: ["/api/stats"],
    queryFn: async () => {
      try {
        const response = await fetch('/api/stats');
        if (!response.ok) {
          throw new Error('Failed to fetch stats data');
        }
        
        const data = await response.json();
        
        // Transform backend API response to match frontend expected structure
        return {
          activeTasks: data.tasks?.pending || 0,
          completedTasks: data.tasks?.completed || 0,
          processedEmails: data.emails?.processedEmails || 0,
          cleanedEmails: data.emails?.cleanedEmails || 0,
          ragEmails: data.emails?.ragEmails || 0,
          pendingReviews: data.tasks?.pending || 0
        };
      } catch (error) {
        console.error('Error fetching stats:', error);
        // Return default values if the API call fails
        return {
          activeTasks: 0,
          completedTasks: 0,
          processedEmails: 0,
          cleanedEmails: 0,
          ragEmails: 0,
          pendingReviews: 0
        };
      }
    }
  });
};
