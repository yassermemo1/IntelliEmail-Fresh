import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ReviewTask from "@/components/ReviewTask";
import TaskDetailPanel from "@/components/TaskDetailPanel";
import { useTasksRequiringReview, useUpdateTask } from "@/hooks/useTasks";
import { useToast } from "@/hooks/use-toast";
import { Task } from "@shared/schema";
import { Loader2 } from "lucide-react";

const HitlReview: React.FC = () => {
  const { toast } = useToast();
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(false);
  const [reviewStatus, setReviewStatus] = useState<"pending" | "approved" | "rejected">("pending");
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Fetch review tasks
  const { data: reviewTasks, isLoading, refetch } = useTasksRequiringReview();
  
  // Mutations
  const updateTaskMutation = useUpdateTask();
  
  // Find the selected task for the detail panel
  const selectedTask = reviewTasks?.find(task => task.id === selectedTaskId);
  
  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
    toast({
      title: "Refreshed",
      description: "The task list has been refreshed.",
    });
  };
  
  // Task operations
  const handleConfirmTask = (id: number) => {
    updateTaskMutation.mutate({
      id,
      data: { needsReview: false }
    }, {
      onSuccess: () => {
        toast({
          title: "Task confirmed",
          description: "Task has been confirmed and added to your task list.",
        });
      }
    });
  };
  
  const handleEditTask = (id: number) => {
    setSelectedTaskId(id);
    setIsDetailPanelOpen(true);
  };
  
  const handleDismissTask = (id: number) => {
    updateTaskMutation.mutate({
      id,
      data: { needsReview: false, isCompleted: true }
    }, {
      onSuccess: () => {
        toast({
          title: "Task dismissed",
          description: "Task has been dismissed.",
        });
      }
    });
  };
  
  // Close detail panel
  const handleCloseDetailPanel = () => {
    setIsDetailPanelOpen(false);
    setSelectedTaskId(null);
  };
  
  // Filter tasks based on review status
  const filteredTasks = reviewTasks?.filter(task => {
    if (reviewStatus === "pending") {
      return task.needsReview;
    } else if (reviewStatus === "approved") {
      return !task.needsReview && !task.isCompleted;
    } else {
      return !task.needsReview && task.isCompleted;
    }
  });
  
  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Page header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Human-in-the-Loop Review</h2>
            <p className="mt-1 text-sm text-gray-500">Review and validate AI-generated tasks that need human verification</p>
          </div>
          
          <div className="mt-4 md:mt-0">
            <Button 
              onClick={handleRefresh} 
              disabled={isRefreshing}
              className="inline-flex items-center"
            >
              {isRefreshing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Refreshing...
                </>
              ) : (
                <>
                  <span className="material-icons -ml-1 mr-2 text-lg">refresh</span>
                  Refresh
                </>
              )}
            </Button>
          </div>
        </div>
        
        {/* HITL review tabs */}
        <div className="mt-6">
          <Tabs defaultValue="pending" onValueChange={(value) => setReviewStatus(value as "pending" | "approved" | "rejected")}>
            <TabsList>
              <TabsTrigger value="pending">Pending Review</TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="rejected">Rejected</TabsTrigger>
            </TabsList>
            
            <TabsContent value={reviewStatus} className="mt-4">
              <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    {reviewStatus === "pending" ? "Tasks Requiring Review" : 
                      reviewStatus === "approved" ? "Approved Tasks" : "Rejected Tasks"}
                    <span className="ml-2 text-sm text-gray-500">({filteredTasks?.length || 0})</span>
                  </h3>
                </div>
                
                <div className="overflow-y-auto max-h-[calc(100vh-250px)] custom-scrollbar">
                  {isLoading ? (
                    <div className="p-4 text-center">Loading tasks...</div>
                  ) : filteredTasks?.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                      {reviewStatus === "pending" 
                        ? "No tasks requiring review" 
                        : reviewStatus === "approved" 
                          ? "No approved tasks" 
                          : "No rejected tasks"}
                    </div>
                  ) : (
                    <div className="p-4 space-y-4">
                      {filteredTasks?.map((task: Task) => (
                        <ReviewTask
                          key={task.id}
                          id={task.id}
                          title={task.title}
                          description={task.description || ""}
                          confidence={task.aiConfidence || 0}
                          onConfirm={handleConfirmTask}
                          onEdit={handleEditTask}
                          onDismiss={handleDismissTask}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
        
        {/* AI confidence explanation */}
        <div className="mt-6 bg-white shadow rounded-lg p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0 pt-0.5">
              <span className="material-icons text-primary">info</span>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-gray-900">About AI Task Confidence</h3>
              <p className="mt-1 text-sm text-gray-500">
                Tasks with confidence below your threshold (currently set to 70%) are sent for human review.
                Higher confidence scores indicate the AI's certainty about the extracted task information.
                When you confirm, edit, or dismiss tasks, the system learns from your decisions to improve future extraction accuracy.
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Task detail panel */}
      <TaskDetailPanel
        task={selectedTask}
        isOpen={isDetailPanelOpen}
        onClose={handleCloseDetailPanel}
        isEditable={true}
      />
    </div>
  );
};

export default HitlReview;
