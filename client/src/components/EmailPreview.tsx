import React, { useState } from "react";
import { format } from "date-fns";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";

export interface EmailPreviewProps {
  id: number;
  subject: string;
  sender: string;
  timestamp: Date;
  body: string;
  metadata?: any; // For structured data
  tasksExtracted: number;
  onView: (id: number) => void;
  onOpenMenu: (id: number) => void;
  showRelatedTasks?: boolean;
  showActions?: boolean;
  showMetadata?: boolean;
}

const EmailPreview: React.FC<EmailPreviewProps> = ({
  id,
  subject,
  sender,
  timestamp,
  body,
  metadata,
  tasksExtracted,
  onView,
  onOpenMenu,
  showRelatedTasks = true,
  showActions = true,
  showMetadata = false,
}) => {
  const [expanded, setExpanded] = useState(false);
  
  const formatDate = (date: Date) => {
    try {
      return format(date, "MMM d, yyyy");
    } catch (error) {
      return "Invalid date";
    }
  };
  
  const getEmailAddress = (fullSender: string) => {
    // Extract email from "Name <email@domain.com>" format or return as is
    const match = fullSender.match(/<([^>]+)>/);
    return match ? `(${match[1]})` : "";
  };
  
  const getSenderName = (fullSender: string) => {
    // Extract name from "Name <email@domain.com>" format or return as is
    const match = fullSender.match(/^(.*?)\s*</);
    return match ? match[1] : fullSender;
  };
  
  const toggleExpanded = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(!expanded);
  };
  
  const handleEmailClick = () => {
    onView(id);
  };
  
  return (
    <li className="border-b border-gray-100 last:border-0">
      <div 
        className="px-4 py-4 hover:bg-gray-50 sm:px-6 cursor-pointer transition-colors"
        onClick={handleEmailClick}
      >
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-900 truncate">
              {subject}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              From: {getSenderName(sender)} {getEmailAddress(sender)}
            </p>
            <p className={`mt-1 text-sm text-gray-500 ${expanded ? '' : 'line-clamp-2'} max-w-md`}>
              {body ? body.replace(/\[.*?\]/g, '').replace(/<.*?>/g, '').substring(0, expanded ? 500 : 150) + (expanded ? '' : '...') : 'No content'}
            </p>
            
            {body && body.length > 150 && (
              <button 
                className="mt-1 text-xs text-primary font-medium hover:text-primary/80 focus:outline-none"
                onClick={toggleExpanded}
              >
                {expanded ? 'Show less' : 'Show more'}
              </button>
            )}
            
            <div className="mt-2 flex flex-wrap gap-2">
              {tasksExtracted > 0 && showRelatedTasks && (
                <Link href={`/tasks?emailId=${id}`}>
                  <span className="inline-flex items-center text-xs font-medium rounded-full px-2.5 py-0.5 bg-green-100 text-green-800 hover:bg-green-200 transition-colors">
                    <span className="material-icons text-xs mr-1">check_circle</span>
                    {tasksExtracted} Task{tasksExtracted !== 1 ? 's' : ''} Extracted
                  </span>
                </Link>
              )}
              
              <Link href={`/emails/${id}/related`}>
                <span className="inline-flex items-center text-xs font-medium rounded-full px-2.5 py-0.5 bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors">
                  <span className="material-icons text-xs mr-1">connect_without_contact</span>
                  Related Emails
                </span>
              </Link>
              
              {tasksExtracted === 0 && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    // Extract tasks from this email
                    fetch(`/api/emails/${id}/extract-tasks`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' }
                    })
                    .then(response => response.json())
                    .then(data => {
                      const tasksCreated = data.tasksCreated || 0;
                      if (tasksCreated > 0) {
                        window.location.reload(); // Refresh to show the new tasks
                      }
                    })
                    .catch(error => {
                      console.error('Error extracting tasks:', error);
                    });
                  }}
                  className="inline-flex items-center text-xs font-medium rounded-full px-2.5 py-0.5 bg-purple-100 text-purple-800 hover:bg-purple-200 transition-colors"
                >
                  <span className="material-icons text-xs mr-1">auto_awesome</span>
                  Extract Tasks
                </button>
              )}
              
              {/* Show metadata badges if available and enabled */}
              {showMetadata && metadata && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {metadata.isReply && (
                    <Badge variant="outline" className="bg-blue-50">
                      <span className="material-icons text-xs mr-1">reply</span>
                      Reply
                    </Badge>
                  )}
                  
                  {metadata.isForwarded && (
                    <Badge variant="outline" className="bg-amber-50">
                      <span className="material-icons text-xs mr-1">forward</span>
                      Forwarded
                    </Badge>
                  )}
                  
                  {metadata.urgency === 'high' && (
                    <Badge variant="outline" className="bg-red-50 text-red-800">
                      <span className="material-icons text-xs mr-1">priority_high</span>
                      Urgent
                    </Badge>
                  )}
                  
                  {metadata.topics?.length > 0 && metadata.topics.map((topic: string) => (
                    <Badge key={topic} variant="outline" className="bg-green-50">
                      {topic}
                    </Badge>
                  ))}
                  
                  {metadata.ccCount > 0 && (
                    <Badge variant="outline" className="bg-gray-100">
                      +{metadata.ccCount} CC
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="ml-4 flex-shrink-0 flex flex-col items-end space-y-2">
            <span className="text-xs text-gray-500">{formatDate(timestamp)}</span>
            {showActions && (
              <div className="flex space-x-2">
                <button 
                  className="p-1.5 rounded-full text-gray-400 hover:text-gray-500 hover:bg-gray-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    onView(id);
                  }}
                  aria-label="View email details"
                >
                  <span className="material-icons text-sm">visibility</span>
                </button>
                <button 
                  className="p-1.5 rounded-full text-gray-400 hover:text-gray-500 hover:bg-gray-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenMenu(id);
                  }}
                  aria-label="Show more options"
                >
                  <span className="material-icons text-sm">more_vert</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </li>
  );
};

export default EmailPreview;
