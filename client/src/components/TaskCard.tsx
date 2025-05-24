import React from "react";
import { formatDistanceToNow, format } from "date-fns";

export interface TaskCardProps {
  id: number;
  title: string;
  description?: string;
  priority: "high" | "medium" | "low";
  dueDate?: Date;
  createdAt: Date;
  isCompleted: boolean;
  source?: string;
  onToggleComplete: (id: number) => void;
  onEdit: (id: number) => void;
  onOpenMenu: (id: number) => void;
}

const TaskCard: React.FC<TaskCardProps> = ({
  id,
  title,
  description,
  priority,
  dueDate,
  createdAt,
  isCompleted,
  source,
  onToggleComplete,
  onEdit,
  onOpenMenu,
}) => {
  const priorityClasses = {
    high: "bg-primary/10 text-primary",
    medium: "bg-secondary/10 text-secondary",
    low: "bg-gray-100 text-gray-800",
  };
  
  const priorityIconColors = {
    high: "border-primary",
    medium: "border-secondary",
    low: "border-gray-300",
  };

  const getTimeAgo = (date: Date) => {
    try {
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (error) {
      return "Invalid date";
    }
  };
  
  const formatDueDate = (date?: Date) => {
    if (!date) return null;
    try {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      if (date.toDateString() === today.toDateString()) {
        return "Due Today";
      } else if (date.toDateString() === tomorrow.toDateString()) {
        return "Due Tomorrow";
      } else {
        return `Due ${format(date, "MMM d, yyyy")}`;
      }
    } catch (error) {
      return "Invalid date";
    }
  };
  
  return (
    <li className="task-card">
      <div className="px-3 py-3 hover:bg-gray-50 transition-colors sm:px-4 md:px-6 cursor-pointer">
        <div className="flex items-center justify-between">
          <div className="flex items-start space-x-3">
            <div 
              className={`w-5 h-5 border-2 ${priorityIconColors[priority]} rounded ${isCompleted ? "bg-primary" : ""}`}
              onClick={() => onToggleComplete(id)}
            >
              <span className="sr-only">Task checkbox</span>
            </div>
            <div>
              <p className={`text-sm font-medium ${isCompleted ? "line-through text-gray-500" : "text-gray-900"}`}>{title}</p>
              <div className="mt-1 flex items-center">
                <span className={`inline-flex items-center text-xs font-medium ${priorityClasses[priority]} rounded-full px-2.5 py-0.5 mr-2`}>
                  <span className="material-icons text-xs mr-1">flag</span>
                  {priority.charAt(0).toUpperCase() + priority.slice(1)} Priority
                </span>
                {dueDate && (
                  <span className="inline-flex items-center text-xs text-gray-500">
                    <span className="material-icons text-xs mr-1">schedule</span>
                    {formatDueDate(dueDate)}
                  </span>
                )}
              </div>
              {description && (
                <p className="mt-1 text-sm text-gray-500 truncate-2">{description}</p>
              )}
            </div>
          </div>
          <div className="ml-2 flex-shrink-0 flex flex-col items-end space-y-2">
            <span className="text-xs text-gray-500">{getTimeAgo(createdAt)}</span>
            <div className="flex space-x-2">
              <button 
                className="p-1 rounded-full text-gray-400 hover:text-gray-500"
                onClick={() => onEdit(id)}
              >
                <span className="material-icons text-sm">edit</span>
              </button>
              <button 
                className="p-1 rounded-full text-gray-400 hover:text-gray-500"
                onClick={() => onOpenMenu(id)}
              >
                <span className="material-icons text-sm">more_vert</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
};

export default TaskCard;
