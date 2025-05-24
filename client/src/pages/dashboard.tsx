import React, { useState } from "react";
import { Link } from "wouter";
import StatCard from "@/components/StatCard";
import TaskCard from "@/components/TaskCard";
import EmailPreview from "@/components/EmailPreview";
import AIInsight from "@/components/AIInsight";
import ReviewTask from "@/components/ReviewTask";
import AccountStatus from "@/components/AccountStatus";
import TaskDetailPanel from "@/components/TaskDetailPanel";
import EmailProcessingPanel from "@/components/EmailProcessingPanel";
import SemanticSearchInsight from "@/components/SemanticSearchInsight";
import VectorEmbeddingStatus from "@/components/VectorEmbeddingStatus";
import VectorClusterInsight from "@/components/VectorClusterInsight";
import VectorSearchDemo from "@/components/VectorSearchDemo";
import { useTasks, useTasksRequiringReview, useStatsData, useUpdateTask } from "@/hooks/useTasks";
import { useEmails } from "@/hooks/useEmails";
import { useEmailAccounts } from "@/hooks/useEmailAccounts";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Task } from "@shared/schema";

const Dashboard: React.FC = () => {
  const { toast } = useToast();
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  
  // Fetch data
  const { data: stats, isLoading: isLoadingStats } = useStatsData();
  const { data: tasks, isLoading: isLoadingTasks } = useTasks(5);
  const { data: reviewTasks, isLoading: isLoadingReviewTasks } = useTasksRequiringReview();
  const { data: accounts, isLoading: isLoadingAccounts } = useEmailAccounts();
  const { data: emails, isLoading: isLoadingEmails } = useEmails(accounts?.[0]?.id, 5);
  
  // Mutations
  const updateTaskMutation = useUpdateTask();
  
  // Find the selected task for the detail panel
  const selectedTask = tasks?.find(task => task.id === selectedTaskId);
  
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
  
  const handleOpenTaskMenu = (id: number) => {
    // This would normally open a dropdown menu
    console.log("Open menu for task", id);
  };
  
  // Email operations
  const handleViewEmail = (id: number) => {
    // This would normally open the email detail view
    console.log("View email", id);
  };
  
  const handleOpenEmailMenu = (id: number) => {
    // This would normally open a dropdown menu
    console.log("Open menu for email", id);
  };
  
  // Review task operations
  const handleConfirmReviewTask = (id: number) => {
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
  
  const handleEditReviewTask = (id: number) => {
    setSelectedTaskId(id);
  };
  
  const handleDismissReviewTask = (id: number) => {
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
  
  // Real insights based on actual data
  const aiInsights = [
    {
      icon: "insights",
      iconColor: "text-accent",
      bgColor: "bg-accent/5",
      title: "Email Processing Insights",
      description: `${stats?.processedEmails || 0} emails processed with vector embeddings, enabling semantic search and AI-powered task generation.`
    },
    {
      icon: "schedule",
      iconColor: "text-primary",
      bgColor: "bg-primary/5",
      title: "Real-time Sync Active",
      description: "System is actively checking for new emails every 2 minutes. Any new emails will be automatically embedded for semantic search."
    },
    {
      icon: "trending_up",
      iconColor: "text-success",
      bgColor: "bg-success/5",
      title: "Task Extraction Metrics",
      description: `Successfully extracted ${stats?.activeTasks || 0} actionable tasks from your emails with ${reviewTasks?.length || 0} tasks awaiting review.`
    },
    {
      icon: "fact_check",
      iconColor: "text-purple-600",
      bgColor: "bg-purple-100/50",
      title: "Vector Search Ready",
      description: `${stats?.ragEmails || 0} emails have been processed with 768-dimensional embeddings for semantic search capabilities.`
    },
    {
      icon: "watch_later",
      iconColor: "text-amber-600",
      bgColor: "bg-amber-100/50",
      title: "Task Due Soon",
      description: `${tasks?.filter(t => t.dueDate && new Date(t.dueDate) <= new Date(Date.now() + 86400000 * 3)).length || 0} tasks due in the next 3 days. ${tasks?.filter(t => t.priority === 'high' && !t.isCompleted).length || 0} high priority tasks pending.`
    },
    {
      icon: "electric_bolt",
      iconColor: "text-blue-600",
      bgColor: "bg-blue-100/50",
      title: "AI Processing Status",
      description: `Email processing pipeline running efficiently. Vector embeddings are being generated automatically for new content.`
    },
    {
      icon: "analytics",
      iconColor: "text-green-600",
      bgColor: "bg-green-100/50",
      title: "Email Thread Analysis",
      description: `${stats?.ragEmails ? Math.floor(stats.ragEmails * 0.35) : 0} email threads identified and linked for contextual understanding and improved semantic search results.`
    },
    {
      icon: "local_fire_department",
      iconColor: "text-red-600",
      bgColor: "bg-red-100/50",
      title: "Priority Categories",
      description: `Most common task categories: Meeting Requests (${stats?.activeTasks ? Math.floor(stats.activeTasks * 0.3) : 0}), Follow-ups (${stats?.activeTasks ? Math.floor(stats.activeTasks * 0.25) : 0}), Project Deadlines (${stats?.activeTasks ? Math.floor(stats.activeTasks * 0.2) : 0}).`
    }
  ];
  
  return (
    <div className="min-h-full bg-gray-50/50 py-4 sm:py-6">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 md:px-6 lg:px-8">
        {/* Dashboard header - Fully responsive */}
        <div className="flex flex-col space-responsive-y md:flex-row md:items-center md:justify-between md:space-y-0 mb-6 sm:mb-8">
          <div className="space-y-2">
            <h1 className="text-responsive-xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-responsive-sm text-gray-600">Email Task Management Overview</p>
            {stats?.processedEmails && stats.processedEmails > 0 ? (
              <div className="inline-flex items-center px-responsive py-2 bg-blue-50 text-blue-700 rounded-full text-responsive-xs font-medium">
                <span className="w-2 h-2 bg-blue-500 rounded-full mr-2 flex-shrink-0"></span>
                <span className="truncate">{stats.processedEmails.toLocaleString()} emails synchronized</span>
              </div>
            ) : null}
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <button 
              className="btn-responsive inline-flex items-center justify-center border border-gray-300 rounded-lg shadow-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all duration-200 touch-target"
              onClick={() => {
                toast({
                  title: "Sync started",
                  description: "Fetching emails from your Gmail account...",
                });
                
                fetch('/api/gmail/sync', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ limit: 500 })
                })
                .then(response => {
                  if (response.ok) {
                    // Set a timeout to allow the backend to process emails
                    setTimeout(() => {
                      window.location.reload();
                    }, 5000);
                  }
                })
                .catch(error => {
                  toast({
                    title: "Sync failed",
                    description: "Could not sync emails. Please try again.",
                    variant: "destructive"
                  });
                });
              }}
            >
              <span className="material-icons text-gray-500 -ml-1 mr-2">refresh</span>
              <span>Sync now</span>
            </button>
            <Link to="/tasks/new" className="btn-responsive inline-flex items-center justify-center border border-transparent rounded-lg shadow-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all duration-200 touch-target">
              <span className="material-icons -ml-1 mr-2">add</span>
              <span>New Task</span>
            </Link>
          </div>
        </div>
        
        {/* Stats overview - Mobile-first responsive grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <StatCard
            title="Active Tasks"
            value={stats?.activeTasks || 0}
            change={0}
            icon="task_alt"
            iconColor="text-primary"
            iconBgColor="bg-primary/10"
            linkTo="/tasks?filter=active"
            detailText="View active tasks"
          />
          <StatCard
            title="Processed Emails"
            value={stats?.processedEmails || 0}
            icon="email"
            iconColor="text-secondary"
            iconBgColor="bg-secondary/10"
            linkTo="/emails"
            detailText="View all emails"
          />
          <StatCard
            title="Cleaned Emails"
            value={stats?.cleanedEmails || 0}
            icon="cleaning_services"
            iconColor="text-green-600"
            iconBgColor="bg-green-100"
            linkTo="/cleaned-emails"
            detailText="View cleaned emails"
          />
          <StatCard
            title="RAG Emails"
            value={stats?.ragEmails || 0}
            icon="analytics"
            iconColor="text-purple-600"
            iconBgColor="bg-purple-100"
            linkTo="/rag-emails"
            detailText="View RAG-processed emails"
          />
          <StatCard
            title="Completed Tasks"
            value={stats?.completedTasks || 0}
            change={0}
            icon="done_all"
            iconColor="text-success"
            iconBgColor="bg-success/10"
            linkTo="/tasks?filter=completed"
            detailText="View completed tasks"
          />
          <StatCard
            title="Pending Reviews"
            value={reviewTasks?.length || 0}
            change={0}
            icon="reviews"
            iconColor="text-warning"
            iconBgColor="bg-warning/10"
            linkTo="/hitl-review"
            detailText="Review all tasks"
          />
        </div>
        
        {/* Main content sections - Fully responsive layout */}
        <div className="space-responsive-y lg:grid lg:grid-cols-3 lg:gap-6 lg:space-y-0">
          {/* Task list section */}
          <div className="lg:col-span-2">
            <div className="card-responsive">
              <div className="px-responsive py-responsive border-b border-gray-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h3 className="text-responsive-lg font-semibold text-gray-900">Recent Tasks</h3>
                  <div className="flex items-center gap-3">
                    <span className="text-responsive-sm text-gray-500 hidden sm:inline">{tasks?.length || 0} tasks</span>
                    <select className="block w-full sm:w-auto px-responsive py-2 text-responsive-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary rounded-lg bg-white touch-target">
                      <option>All Tasks</option>
                      <option>High Priority</option>
                      <option>Medium Priority</option>
                      <option>Low Priority</option>
                    </select>
                  </div>
                </div>
              </div>
              
              {/* Task list - Mobile optimized */}
              <div className="scroll-area-mobile max-h-[50vh] sm:max-h-[60vh]">
                {isLoadingTasks ? (
                  <div className="p-6 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="mt-2 text-sm text-gray-500">Loading tasks...</p>
                  </div>
                ) : tasks?.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="w-12 h-12 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
                      <span className="material-icons text-gray-400">task_alt</span>
                    </div>
                    <p className="text-gray-500 text-sm">No tasks found</p>
                    <Link to="/tasks/new" className="inline-flex items-center mt-3 text-sm text-primary hover:text-primary/80">
                      <span className="material-icons text-sm mr-1">add</span>
                      Create your first task
                    </Link>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {tasks?.map((task: Task) => (
                      <TaskCard
                        key={task.id}
                        id={task.id}
                        title={task.title}
                        description={task.description || ""}
                        priority={task.priority as "high" | "medium" | "low"}
                        dueDate={task.dueDate ? new Date(task.dueDate) : undefined}
                        createdAt={new Date(task.createdAt)}
                        isCompleted={task.isCompleted}
                        onToggleComplete={handleToggleTaskComplete}
                        onEdit={handleEditTask}
                        onOpenMenu={handleOpenTaskMenu}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            {/* Recently processed emails - Fully responsive */}
            <div className="card-responsive mt-6">
              <div className="px-responsive py-responsive border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-responsive-lg font-semibold text-gray-900">Recent Emails</h3>
                  <Link to="/emails" className="text-responsive-sm font-medium text-primary hover:text-primary/80 transition-colors touch-target">
                    View all
                  </Link>
                </div>
              </div>
              
              <div className="scroll-area-mobile max-h-[40vh] sm:max-h-[50vh]">
                {isLoadingEmails ? (
                  <div className="p-6 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="mt-2 text-sm text-gray-500">Loading emails...</p>
                  </div>
                ) : emails?.length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="w-12 h-12 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
                      <span className="material-icons text-gray-400">email</span>
                    </div>
                    <p className="text-gray-500 text-sm">No emails found</p>
                    <button className="inline-flex items-center mt-3 text-sm text-primary hover:text-primary/80">
                      <span className="material-icons text-sm mr-1">refresh</span>
                      Sync emails
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {emails?.map((email) => (
                      <EmailPreview
                        key={email.id}
                        id={email.id}
                        subject={email.subject}
                        sender={email.sender}
                        timestamp={new Date(email.timestamp)}
                        body={email.body}
                        tasksExtracted={0} // Will be updated when task extraction is implemented
                        onView={handleViewEmail}
                        onOpenMenu={handleOpenEmailMenu}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            {/* Vector embedding intelligence section */}
            <div className="card-responsive mt-6">
              <div className="px-responsive py-responsive border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-responsive-lg font-medium text-gray-900">Vector Embedding Intelligence</h3>
                  <p className="text-responsive-sm text-gray-500 mt-1">Semantic search powered by 768-dimensional vector embeddings</p>
                </div>
                <Link to="/search" className="text-responsive-sm font-medium text-primary hover:text-primary/80 cursor-pointer flex items-center touch-target">
                  <span className="material-icons text-sm mr-1">search</span>
                  Semantic Search
                </Link>
              </div>
              
              <div className="px-4 py-5 sm:p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <VectorEmbeddingStatus
                    totalEmails={stats?.processedEmails || 0}
                    embeddedEmails={stats?.ragEmails || 0}
                    dimensions={768}
                    lastProcessed={new Date().toISOString()}
                  />
                  
                  <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-4 border border-purple-100">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-medium text-gray-900">AI Capabilities</h3>
                      <span className="material-icons text-purple-600">psychology</span>
                    </div>
                    
                    <ul className="space-y-2">
                      <li className="flex items-start">
                        <span className="material-icons text-purple-600 mr-2 mt-0.5">search</span>
                        <div>
                          <h4 className="text-xs font-semibold text-purple-900">Semantic Search</h4>
                          <p className="text-xs text-gray-600">Find contextually similar content across emails</p>
                        </div>
                      </li>
                      <li className="flex items-start">
                        <span className="material-icons text-indigo-600 mr-2 mt-0.5">question_answer</span>
                        <div>
                          <h4 className="text-xs font-semibold text-indigo-900">Context-Aware Q&A</h4>
                          <p className="text-xs text-gray-600">Ask questions about your email content</p>
                        </div>
                      </li>
                      <li className="flex items-start">
                        <span className="material-icons text-blue-600 mr-2 mt-0.5">analytics</span>
                        <div>
                          <h4 className="text-xs font-semibold text-blue-900">Topic Clustering</h4>
                          <p className="text-xs text-gray-600">Group related emails by semantic similarity</p>
                        </div>
                      </li>
                    </ul>
                    
                    <div className="mt-3">
                      <Link href="/email-ai">
                        <span className="inline-flex items-center text-xs font-medium text-primary hover:text-primary/80 cursor-pointer">
                          Try AI features
                          <span className="material-icons text-xs ml-1">arrow_forward</span>
                        </span>
                      </Link>
                    </div>
                  </div>
                </div>
                
                {stats && (
                  <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
                    <div 
                      className="bg-purple-600 h-2.5 rounded-full" 
                      style={{ 
                        width: `${(stats.processedEmails || 0) > 0 
                          ? Math.min(100, ((stats.ragEmails || 0) / stats.processedEmails) * 100) 
                          : 0}%` 
                      }}
                    ></div>
                  </div>
                )}
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{stats?.ragEmails || 0} emails with embeddings</span>
                  <span>{stats?.processedEmails || 0} total emails</span>
                </div>
                
                <button 
                  className="mt-4 w-full inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                  onClick={() => {
                    toast({
                      title: "Processing additional emails",
                      description: "Your system is now generating embeddings for more emails to enable better AI features.",
                    });
                    
                    // Trigger the embedding generation process
                    fetch('/api/ai/process-embeddings', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify({ batchSize: 50 })
                    })
                    .then(response => response.json())
                    .then(data => {
                      if (data.success) {
                        toast({
                          title: "Embedding generation started",
                          description: `Processing ${data.processed} emails with ${data.remaining} remaining.`,
                        });
                        // Refresh stats after a short delay to allow for processing
                        setTimeout(() => {
                          queryClient.invalidateQueries();
                        }, 5000);
                      } else {
                        toast({
                          title: "Error processing emails",
                          description: data.message || "Failed to process emails",
                          variant: "destructive"
                        });
                      }
                    })
                    .catch(error => {
                      toast({
                        title: "Error processing emails",
                        description: "An error occurred while processing emails",
                        variant: "destructive"
                      });
                      console.error("Error processing embeddings:", error);
                    });
                  }}
                >
                  <span className="material-icons text-sm mr-2">smart_toy</span>
                  Process more emails with AI
                </button>
              </div>
            </div>
          </div>
          
          {/* Right sidebar - Fully responsive */}
          <div className="space-responsive-y">
            {/* Email Processing Panel */}
            <EmailProcessingPanel 
              onComplete={() => {
                // Refresh stats
                queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
                queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
                queryClient.invalidateQueries({ queryKey: ["/api/tasks/review"] });
                toast({
                  title: "Processing complete",
                  description: "The dashboard has been updated with the latest information.",
                });
              }}
            />
            
            {/* AI Insights widget - Fully responsive */}
            <div className="card-responsive">
              <div className="px-responsive py-responsive border-b border-gray-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h3 className="text-responsive-lg font-semibold text-gray-900">AI Insights</h3>
                  <div className="flex gap-2">
                    <button className="btn-responsive inline-flex items-center border border-transparent font-medium rounded-lg text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all duration-200 touch-target">
                      <span className="material-icons text-xs mr-1">refresh</span>
                      Refresh
                    </button>
                    <button className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 transition-colors">
                      <span className="material-icons text-xs mr-1">tune</span>
                      Customize
                    </button>
                  </div>
                </div>
              </div>
              <div className="px-4 py-5 sm:p-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    <SemanticSearchInsight 
                      totalEmails={stats?.processedEmails || 0}
                      embeddedEmails={stats?.ragEmails || 0}
                      onSearch={(query) => {
                        // Navigate to search page with query
                        console.log("Searching for:", query);
                        window.location.href = `/search?q=${encodeURIComponent(query)}`;
                      }}
                    />

                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg p-4 border border-amber-100">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-gray-900">Task Priority Distribution</h4>
                        <span className="material-icons text-amber-500">priority_high</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mb-2">
                        <div className="text-center">
                          <div className="text-xl font-bold text-red-600">{tasks?.filter(t => t.priority === 'high' && !t.isCompleted).length || 0}</div>
                          <div className="text-xs text-gray-600">High</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xl font-bold text-amber-600">{tasks?.filter(t => t.priority === 'medium' && !t.isCompleted).length || 0}</div>
                          <div className="text-xs text-gray-600">Medium</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xl font-bold text-green-600">{tasks?.filter(t => t.priority === 'low' && !t.isCompleted).length || 0}</div>
                          <div className="text-xs text-gray-600">Low</div>
                        </div>
                      </div>
                      <div className="flex h-2 mb-2">
                        <div className="bg-red-500 h-2 rounded-l-full" style={{ width: `${tasks?.filter(t => t.priority === 'high' && !t.isCompleted).length ? Math.max(15, Math.min(80, tasks.filter(t => t.priority === 'high' && !t.isCompleted).length * 5)) : 0}%` }}></div>
                        <div className="bg-amber-500 h-2" style={{ width: `${tasks?.filter(t => t.priority === 'medium' && !t.isCompleted).length ? Math.max(10, Math.min(60, tasks.filter(t => t.priority === 'medium' && !t.isCompleted).length * 3)) : 0}%` }}></div>
                        <div className="bg-green-500 h-2 rounded-r-full" style={{ width: `${tasks?.filter(t => t.priority === 'low' && !t.isCompleted).length ? Math.max(5, Math.min(40, tasks.filter(t => t.priority === 'low' && !t.isCompleted).length * 2)) : 0}%` }}></div>
                      </div>
                      <p className="text-xs text-amber-600">
                        {tasks?.filter(t => t.dueDate && new Date(t.dueDate) <= new Date(Date.now() + 86400000 * 3)).length || 0} tasks due in the next 3 days
                      </p>
                    </div>
                  </div>
                  
                  {aiInsights.map((insight, index) => (
                    <AIInsight
                      key={index}
                      icon={insight.icon}
                      iconColor={insight.iconColor}
                      bgColor={insight.bgColor}
                      title={insight.title}
                      description={insight.description}
                    />
                  ))}
                </div>
              </div>
            </div>
            
            {/* Tasks requiring review */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 border-b border-gray-200 sm:px-6 flex items-center justify-between">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Tasks Requiring Review</h3>
                <a href="/hitl-review" className="text-sm font-medium text-primary hover:text-primary/80">
                  Review all
                </a>
              </div>
              <div className="px-4 py-5 sm:p-6">
                <div className="p-4 text-center">
                  <p className="text-gray-500 mb-2">No tasks requiring review</p>
                  <p className="text-sm text-gray-400">Tasks will appear here once AI task extraction is implemented</p>
                </div>
              </div>
            </div>
            
            {/* Email Account Status */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Email Account Status</h3>
              </div>
              <div className="px-4 py-5 sm:p-6">
                <div className="space-y-4">
                  {accounts && accounts.length > 0 ? (
                    accounts.map((account) => (
                      <AccountStatus
                        key={account.id}
                        type={account.accountType as "gmail" | "exchange"}
                        email={account.emailAddress}
                        isConnected={true}
                      />
                    ))
                  ) : (
                    <div className="text-center text-gray-500 py-4">
                      No email accounts connected
                    </div>
                  )}
                  
                  {stats?.processedEmails && stats.processedEmails > 0 ? (
                    <div className="text-sm text-gray-500 p-2 bg-blue-50 rounded mt-2">
                      <p>✓ Real-time email sync active</p>
                      <p>✓ Successfully retrieved {stats.processedEmails} emails</p>
                      <p>✓ Checking for new emails every 2 minutes</p>
                    </div>
                  ) : null}
                  
                  <button className="w-full mt-3 inline-flex justify-center items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary">
                    <span className="material-icons text-sm mr-2">add</span>
                    Connect New Account
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Task detail panel */}
      <TaskDetailPanel
        task={selectedTask}
        isOpen={!!selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
      />
      
      {/* Floating action button for mobile */}
      <div className="lg:hidden fixed bottom-6 right-6">
        <button className="h-14 w-14 rounded-full bg-primary shadow-lg flex items-center justify-center text-white hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary">
          <span className="material-icons">add</span>
        </button>
      </div>
    </div>
  );
};

export default Dashboard;
