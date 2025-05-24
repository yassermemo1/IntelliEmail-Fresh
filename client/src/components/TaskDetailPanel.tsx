import React, { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { Task } from "@shared/schema";
import { useUpdateTask } from "@/hooks/useTasks";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface TaskDetailPanelProps {
  task?: Task;
  isOpen: boolean;
  onClose: () => void;
  isEditable?: boolean;
}

const TaskDetailPanel: React.FC<TaskDetailPanelProps> = ({
  task,
  isOpen,
  onClose,
  isEditable = false,
}) => {
  const { toast } = useToast();
  const updateTaskMutation = useUpdateTask();
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedTask, setEditedTask] = useState<Partial<Task> | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  useEffect(() => {
    if (task) {
      setEditedTask(task);
    }
  }, [task]);

  if (!isOpen || !task || !editedTask) return null;
  
  const formatDate = (date?: Date | string | null) => {
    if (!date) return "No date set";
    try {
      const dateObj = typeof date === "string" ? new Date(date) : date;
      return format(dateObj, "MMMM d, yyyy");
    } catch (error) {
      return "Invalid date";
    }
  };
  
  const priorityColors = {
    high: "text-primary",
    medium: "text-secondary",
    low: "text-gray-500",
  };

  const handleSaveChanges = () => {
    if (!task || !editedTask) return;
    
    updateTaskMutation.mutate({
      id: task.id,
      data: {
        title: editedTask.title,
        description: editedTask.description,
        priority: editedTask.priority,
        dueDate: editedTask.dueDate ? new Date(editedTask.dueDate) : null,
        needsReview: false, // Always mark as reviewed when saved
      }
    }, {
      onSuccess: () => {
        toast({
          title: "Task updated",
          description: "Task details have been updated successfully.",
        });
        setIsEditMode(false);
        onClose();
      },
      onError: (error) => {
        toast({
          title: "Error",
          description: "Failed to update task. Please try again.",
          variant: "destructive",
        });
      }
    });
  };

  const handleFieldChange = (field: string, value: any) => {
    setEditedTask(prev => prev ? {...prev, [field]: value} : null);
  };
  
  const toggleCompleteStatus = () => {
    if (!task) return;
    
    updateTaskMutation.mutate({
      id: task.id,
      data: {
        isCompleted: !task.isCompleted,
        needsReview: false, // Always mark as reviewed when updated
      }
    }, {
      onSuccess: () => {
        toast({
          title: task.isCompleted ? "Task marked as incomplete" : "Task marked as complete",
          description: "Task status has been updated successfully.",
        });
        onClose();
      }
    });
  };
  
  return (
    <div className="fixed inset-0 overflow-hidden z-20" aria-labelledby="slide-over-title" role="dialog" aria-modal="true">
      <div className="absolute inset-0 overflow-hidden">
        {/* Background overlay */}
        <div 
          className="absolute inset-0 bg-gray-500 bg-opacity-75 transition-opacity" 
          aria-hidden="true"
          onClick={onClose}
        ></div>
        
        <div className="fixed inset-y-0 right-0 pl-10 max-w-full flex">
          <div className="w-screen max-w-md">
            <div className="h-full flex flex-col bg-white shadow-xl overflow-y-scroll">
              {/* Header */}
              <div className="px-4 py-6 sm:px-6 bg-gray-50 border-b border-gray-200">
                <div className="flex items-start justify-between">
                  <h2 id="slide-over-title" className="text-lg font-medium text-gray-900">
                    {isEditMode ? "Edit Task" : "Task Details"}
                    {task.aiGenerated && !isEditMode && (
                      <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        <span className="material-icons text-xs mr-1">auto_awesome</span>
                        AI Generated
                      </span>
                    )}
                  </h2>
                  <button 
                    className="rounded-md text-gray-400 hover:text-gray-500"
                    onClick={onClose}
                  >
                    <span className="material-icons">close</span>
                  </button>
                </div>
              </div>
              
              {/* Task content */}
              <div className="flex-1 px-4 py-6 sm:px-6">
                <div className="space-y-6">
                  {isEditMode ? (
                    <>
                      <div>
                        <label htmlFor="title" className="block text-sm font-medium text-gray-700">Title</label>
                        <Input
                          id="title"
                          value={editedTask.title || ""}
                          onChange={(e) => handleFieldChange("title", e.target.value)}
                          className="mt-1 block w-full"
                          placeholder="Task title"
                        />
                      </div>
                      
                      <div>
                        <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
                        <Textarea
                          id="description"
                          value={editedTask.description || ""}
                          onChange={(e) => handleFieldChange("description", e.target.value)}
                          className="mt-1 block w-full"
                          placeholder="Add a description..."
                          rows={4}
                        />
                      </div>
                      
                      <div>
                        <label htmlFor="priority" className="block text-sm font-medium text-gray-700">Priority</label>
                        <Select 
                          value={editedTask.priority} 
                          onValueChange={(value) => handleFieldChange("priority", value)}
                        >
                          <SelectTrigger className="mt-1 w-full">
                            <SelectValue placeholder="Select priority" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="low">Low</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700">Due Date</label>
                        <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="mt-1 w-full justify-start text-left font-normal">
                              <span className="material-icons mr-2">calendar_today</span>
                              {editedTask.dueDate 
                                ? formatDate(editedTask.dueDate) 
                                : "Select a date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={editedTask.dueDate ? new Date(editedTask.dueDate) : undefined}
                              onSelect={(date) => {
                                handleFieldChange("dueDate", date);
                                setDatePickerOpen(false);
                              }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <h3 className="text-xl font-medium text-gray-900">{task.title}</h3>
                        <div className="mt-2 flex items-center">
                          <span className={`inline-flex items-center text-sm font-medium ${priorityColors[task.priority as keyof typeof priorityColors]} mr-4`}>
                            <span className="material-icons text-sm mr-1">flag</span>
                            {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)} Priority
                          </span>
                          <span className="inline-flex items-center text-sm text-gray-500">
                            <span className="material-icons text-sm mr-1">schedule</span>
                            Due: {formatDate(task.dueDate)}
                          </span>
                        </div>
                      </div>
                      
                      {task.description && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-900">Description</h4>
                          <p className="mt-2 text-sm text-gray-500 whitespace-pre-line">{task.description}</p>
                        </div>
                      )}
                      
                      {task.categories && task.categories.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-900">Categories</h4>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {task.categories.map((category, index) => (
                              <span 
                                key={index}
                                className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800"
                              >
                                {category}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {task.entities && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-900">Related Entities</h4>
                          <div className="mt-2 space-y-2">
                            {Object.entries(task.entities as Record<string, string[]>).map(([type, items]) => (
                              <div key={type}>
                                <h5 className="text-xs font-medium text-gray-500">{type.charAt(0).toUpperCase() + type.slice(1)}</h5>
                                <div className="flex flex-wrap gap-2 mt-1">
                                  {items.map((item, index) => (
                                    <span 
                                      key={index}
                                      className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800"
                                    >
                                      {item}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className="border-t border-gray-200 pt-4">
                        <div className="flex items-center justify-between text-sm text-gray-500">
                          <div>Created: {formatDate(task.createdAt)}</div>
                          {task.needsReview && (
                            <div className="flex items-center text-warning">
                              <span className="material-icons text-xs mr-1">priority_high</span>
                              Needs Review
                            </div>
                          )}
                        </div>
                        
                        {/* Display AI model information if available */}
                        {task.aiGenerated && task.aiModel && (
                          <div className="mt-2 flex items-center text-sm text-gray-500">
                            <span className="material-icons text-xs mr-1">smart_toy</span>
                            <span>Analyzed by: <span className="font-semibold">{task.aiModel}</span></span>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex-shrink-0 px-4 py-4 flex justify-end border-t border-gray-200 space-x-2">
                {isEditable && !isEditMode && (
                  <Button
                    variant="outline"
                    onClick={() => setIsEditMode(true)}
                  >
                    <span className="material-icons text-sm mr-1">edit</span>
                    Edit
                  </Button>
                )}
                
                {isEditMode ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsEditMode(false);
                        setEditedTask(task);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSaveChanges}
                      disabled={updateTaskMutation.isPending}
                    >
                      {updateTaskMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={toggleCompleteStatus}
                    variant={task.isCompleted ? "outline" : "default"}
                  >
                    <span className="material-icons text-sm mr-1">{task.isCompleted ? "replay" : "check"}</span>
                    {task.isCompleted ? 'Mark as Incomplete' : 'Mark as Complete'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskDetailPanel;
