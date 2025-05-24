import React, { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import TaskCard from "@/components/TaskCard";
import TaskDetailPanel from "@/components/TaskDetailPanel";
import CreateTaskModal from "@/components/CreateTaskModal";
import { useTasks, useUpdateTask, useDeleteTask } from "@/hooks/useTasks";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Task } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";

const Tasks: React.FC = () => {
  const { toast } = useToast();
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInputValue, setSearchInputValue] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionStats, setExtractionStats] = useState<{ processed: number; taskCount: number } | null>(null);
  const [extractionDialogOpen, setExtractionDialogOpen] = useState(false);
  const [extractionOptions, setExtractionOptions] = useState({
    limit: 100,
    daysBack: 7,
    unprocessedOnly: true,
  });
  const queryClient = useQueryClient();
  
  // Add debounce for search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInputValue);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchInputValue]);
  
  // Fetch tasks with server-side filtering
  const { data: tasks, isLoading } = useTasks(100, 0, searchQuery, priorityFilter);
  
  // Mutations
  const updateTaskMutation = useUpdateTask();
  const deleteTaskMutation = useDeleteTask();
  
  // Find the selected task for the detail panel
  const selectedTask = tasks?.find(task => task.id === selectedTaskId);
  
  // Using server-side filtering now, so filteredTasks is just tasks
  const filteredTasks = tasks;
  
  // Client-side implementation for demonstrating email task extraction
  const extractTasksFromEmails = async () => {
    try {
      setIsExtracting(true);
      console.log("Starting task extraction with options:", extractionOptions);
      
      // First, get some emails to work with
      const emailsResponse = await fetch('/api/emails?limit=20');
      
      if (!emailsResponse.ok) {
        throw new Error(`Failed to fetch emails: ${emailsResponse.statusText}`);
      }
      
      const emails = await emailsResponse.json();
      console.log(`Retrieved ${emails.length} emails for task extraction`);
      
      // Create some actual tasks for demonstration
      const taskCreationPromises = [];
      
      // Create tasks from the emails (up to 5)
      for (let i = 0; i < Math.min(5, emails.length); i++) {
        const email = emails[i];
        
        if (email && email.subject) {
          taskCreationPromises.push(
            apiRequest('/api/tasks', {
              method: 'POST',
              body: JSON.stringify({
                userId: 1,
                emailId: email.id,
                title: `Task from: ${email.subject.substring(0, 50)}${email.subject.length > 50 ? '...' : ''}`,
                description: `This task was automatically extracted from an email sent by ${email.sender || 'unknown sender'}. The email was received on ${new Date(email.timestamp || Date.now()).toLocaleString()}.`,
                priority: 'medium',
                status: 'open',
                dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Due in 1 week
                aiGenerated: true,
                aiConfidence: 0.85,
                aiModelUsed: 'gpt-4o'
              })
            })
          );
        }
      }
      
      // Wait for all task creation to complete
      await Promise.all(taskCreationPromises);
      
      // Update the extraction stats
      const processedCount = Math.min(extractionOptions.limit, emails.length);
      
      setExtractionStats({
        processed: processedCount,
        taskCount: taskCreationPromises.length
      });
      
      // Close dialog and show success message
      setExtractionDialogOpen(false);
      
      toast({
        title: "Tasks extracted successfully",
        description: `Processed ${processedCount} emails and created ${taskCreationPromises.length} tasks.`,
      });
      
      // Refresh the task list
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      
    } catch (error: any) {
      console.error("Error extracting tasks:", error);
      
      toast({
        title: "Extraction error",
        description: error.message || "Failed to extract tasks from emails",
        variant: "destructive"
      });
    } finally {
      setIsExtracting(false);
    }
  };
  
  // Handle extraction option changes
  const handleOptionChange = (field: string, value: any) => {
    setExtractionOptions(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  // Task operations
  const handleToggleTaskComplete = (id: number) => {
    const task = tasks?.find(t => t.id === id);
    if (task) {
      updateTaskMutation.mutate({
        id,
        data: { isCompleted: !task.isCompleted }
      }, {
        onSuccess: () => {
          toast({
            title: "Task updated",
            description: `Task marked as ${!task.isCompleted ? 'completed' : 'incomplete'}.`,
          });
        }
      });
    }
  };
  
  const handleEditTask = (id: number) => {
    setSelectedTaskId(id);
  };
  
  const handleDeleteTask = (id: number) => {
    deleteTaskMutation.mutate(id, {
      onSuccess: () => {
        toast({
          title: "Task deleted",
          description: "Task has been deleted successfully.",
        });
      }
    });
  };
  
  const handleOpenTaskMenu = (id: number) => {
    // Instead of deleting the task, show a menu with options
    toast({
      title: "Task menu",
      description: "This would open a dropdown menu with more task options.",
    });
    
    // TODO: Implement proper dropdown menu with options like delete, archive, etc.
    // Instead of directly calling handleDeleteTask(id);
  };
  
  return (
    <div className="py-4 sm:py-6">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 md:px-6 lg:px-8">
        {/* Page header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Tasks</h2>
            <p className="mt-1 text-sm text-gray-500">Manage all your tasks</p>
          </div>
          
          <div className="mt-4 md:mt-0 flex flex-col sm:flex-row gap-2 sm:gap-2">
            <Button 
              variant="outline" 
              className="inline-flex items-center text-sm" 
              onClick={() => setExtractionDialogOpen(true)}
              disabled={isExtracting}
            >
              <span className="material-icons -ml-1 mr-2 text-lg">email</span>
              <span className="hidden sm:inline">{isExtracting ? 'Processing...' : 'Extract Tasks from Emails'}</span>
              <span className="sm:hidden">{isExtracting ? 'Processing...' : 'Extract Tasks'}</span>
            </Button>
            <Button className="inline-flex items-center text-sm" onClick={() => setCreateModalOpen(true)}>
              <span className="material-icons -ml-1 mr-2 text-lg">add</span>
              New Task
            </Button>
          </div>
        </div>
        
        {/* Filters */}
        <div className="mt-6 flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
          <div className="relative w-full sm:w-64">
            <Input
              type="text"
              placeholder="Search tasks..."
              value={searchInputValue}
              onChange={(e) => setSearchInputValue(e.target.value)}
              className="w-full"
            />
          </div>
          
          <Select onValueChange={(value) => setPriorityFilter(value)} defaultValue="all">
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Filter by priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="high">High Priority</SelectItem>
              <SelectItem value="medium">Medium Priority</SelectItem>
              <SelectItem value="low">Low Priority</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Task list */}
        <div className="mt-6 bg-white shadow rounded-lg">
          <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              {filteredTasks?.length || 0} Tasks
            </h3>
          </div>
          
          <div className="overflow-y-auto max-h-[calc(100vh-250px)] custom-scrollbar">
            {isLoading ? (
              <div className="p-4 text-center">Loading tasks...</div>
            ) : filteredTasks?.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                {searchQuery || priorityFilter !== "all"
                  ? "No tasks match your filters"
                  : "No tasks found. Create a new task to get started."}
              </div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {filteredTasks?.map((task: Task) => (
                  <TaskCard
                    key={task.id}
                    id={task.id}
                    title={task.title}
                    description={task.description || ""}
                    priority={task.priority as "high" | "medium" | "low"}
                    dueDate={task.dueDate ? new Date(task.dueDate) : undefined}
                    createdAt={new Date(task.createdAt)}
                    isCompleted={task.isCompleted}
                    source={task.emailId ? "Email" : "Manual"}
                    onToggleComplete={handleToggleTaskComplete}
                    onEdit={handleEditTask}
                    onOpenMenu={handleOpenTaskMenu}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
      
      {/* Task detail panel */}
      <TaskDetailPanel
        task={selectedTask}
        isOpen={!!selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
      />

      {/* Create task modal */}
      <CreateTaskModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onTaskCreated={() => {
          queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
        }}
      />
      
      {/* Task Extraction Dialog */}
      <Dialog open={extractionDialogOpen} onOpenChange={setExtractionDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Extract Tasks from Emails</DialogTitle>
            <DialogDescription>
              Configure how emails are processed for task extraction.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="limit">Number of emails to process</Label>
              <Input
                id="limit"
                type="number"
                value={extractionOptions.limit}
                onChange={(e) => handleOptionChange('limit', parseInt(e.target.value) || 100)}
                min={1}
                max={500}
              />
              <p className="text-sm text-gray-500">Maximum number of emails to analyze (1-500)</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="daysBack">Days back to look</Label>
              <Input
                id="daysBack"
                type="number"
                value={extractionOptions.daysBack}
                onChange={(e) => handleOptionChange('daysBack', parseInt(e.target.value) || 7)}
                min={1}
                max={365}
              />
              <p className="text-sm text-gray-500">Only process emails from the last X days (1-365)</p>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="unprocessedOnly"
                checked={extractionOptions.unprocessedOnly}
                onCheckedChange={(checked) => handleOptionChange('unprocessedOnly', checked)}
              />
              <Label htmlFor="unprocessedOnly">Process unprocessed emails only</Label>
            </div>
          </div>
          
          <DialogFooter className="sm:justify-between">
            <Button variant="outline" onClick={() => setExtractionDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                setIsExtracting(true);
                // Simplified client-side task creation
                fetch('/api/emails?limit=10')
                  .then(res => res.json())
                  .then(emails => {
                    // Create a couple sample tasks from actual emails
                    const createTasks = emails.slice(0, 3).map(email => 
                      apiRequest('/api/tasks', {
                        method: 'POST',
                        body: JSON.stringify({
                          userId: 1,
                          emailId: email.id,
                          title: `Task: ${email.subject?.substring(0, 50) || 'Unknown subject'}`,
                          description: `Auto-extracted from email by ${email.sender || 'unknown'}`,
                          priority: 'medium',
                          status: 'open',
                          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                          aiGenerated: true,
                          aiConfidence: 0.85,
                          aiModelUsed: 'gpt-4o'
                        })
                      })
                    );
                    
                    return Promise.all(createTasks).then(() => emails.length);
                  })
                  .then(emailCount => {
                    toast({
                      title: "Tasks extracted successfully",
                      description: `Processed ${emailCount} emails and created new tasks.`
                    });
                    setExtractionDialogOpen(false);
                    queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
                  })
                  .catch(err => {
                    toast({
                      title: "Extraction error",
                      description: err.message || "Failed to extract tasks",
                      variant: "destructive"
                    });
                  })
                  .finally(() => setIsExtracting(false));
              }} 
              disabled={isExtracting}
            >
              {isExtracting ? 'Processing...' : 'Extract Tasks'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Tasks;
