import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";

const TaskExtractionTestPage = () => {
  const { toast } = useToast();
  const [emailContent, setEmailContent] = useState<string>('');
  const [emailSubject, setEmailSubject] = useState<string>('');
  const [emailSender, setEmailSender] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Sample business email for easy testing
  const loadSampleEmail = () => {
    setEmailSubject('Q3 Planning Meeting and Report Deadlines');
    setEmailSender('project-manager@company.com');
    setEmailContent(`Hello Team,

I wanted to follow up on a few important items we need to address this week:

1. Q3 Planning Meeting: We need to schedule our quarterly planning session before the end of the month. Please send me your availability for next Thursday or Friday.

2. Budget Reports: Department heads, please submit your Q2 budget reports by this Friday COB. We need this data for our executive presentation next week.

3. Client Feedback Survey: Marketing team, please finalize the customer feedback survey by Wednesday. We need to distribute it to all Premium tier clients before month-end.

Let me know if you have any questions or concerns.

Thanks,
Project Manager`);
  };

  const handleExtractTasks = async () => {
    if (!emailContent) {
      toast({
        title: "Missing content",
        description: "Please enter email content to analyze",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const response = await apiRequest('/api/task-extraction/extract-tasks-enhanced', {
        method: 'POST',
        body: JSON.stringify({
          emailContent,
          emailSubject,
          emailSender
        })
      });

      setResult(response);
    } catch (error) {
      console.error('Task extraction failed:', error);
      toast({
        title: "Extraction failed",
        description: "An error occurred while extracting tasks",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderPriorityBadge = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high':
        return <Badge variant="destructive">High Priority</Badge>;
      case 'medium':
        return <Badge variant="default">Medium Priority</Badge>;
      case 'low':
        return <Badge variant="outline">Low Priority</Badge>;
      default:
        return <Badge variant="secondary">{priority}</Badge>;
    }
  };

  const renderCategoryBadge = (category: string) => {
    const categoryMap: Record<string, { color: string, label: string }> = {
      'Meeting_Coordination_Prep': { color: 'bg-blue-100 text-blue-800', label: 'Meeting' },
      'Report_Generation_Submission': { color: 'bg-purple-100 text-purple-800', label: 'Report' },
      'Client_Vendor_Communication': { color: 'bg-green-100 text-green-800', label: 'Client Comm' },
      'FollowUp_ResponseNeeded': { color: 'bg-orange-100 text-orange-800', label: 'Follow-up' },
      'Review_Approval_Feedback': { color: 'bg-yellow-100 text-yellow-800', label: 'Review' },
      'Research_Investigation_Analysis': { color: 'bg-indigo-100 text-indigo-800', label: 'Research' },
      'Planning_Strategy_Development': { color: 'bg-pink-100 text-pink-800', label: 'Planning' },
      'Internal_Project_Task': { color: 'bg-teal-100 text-teal-800', label: 'Project' },
      'Administrative_Logistics': { color: 'bg-gray-100 text-gray-800', label: 'Admin' },
      'Urgent_Action_Required': { color: 'bg-red-100 text-red-800', label: 'Urgent' },
      'Information_To_Digest_Review': { color: 'bg-cyan-100 text-cyan-800', label: 'Info Review' },
      'Personal_Reminder_Appt': { color: 'bg-lime-100 text-lime-800', label: 'Personal' },
      'Marketing_Promotional_Content': { color: 'bg-gray-100 text-gray-500', label: 'Marketing' },
    };

    const categoryInfo = categoryMap[category] || { color: 'bg-gray-100 text-gray-800', label: category };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${categoryInfo.color}`}>
        {categoryInfo.label}
      </span>
    );
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Enhanced Task Extraction Test</h1>
      <p className="text-gray-600 mb-8">
        This tool demonstrates our enhanced AI-powered task extraction capabilities. 
        Enter email content below or use the sample to see how our system identifies and categorizes tasks with rich metadata.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Email Input</CardTitle>
            <CardDescription>
              Enter email content to analyze or use the sample business email
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid w-full items-center gap-2">
              <Label htmlFor="email-subject">Email Subject</Label>
              <Input
                id="email-subject"
                placeholder="Enter email subject"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
              />
            </div>

            <div className="grid w-full items-center gap-2">
              <Label htmlFor="email-sender">Email Sender</Label>
              <Input
                id="email-sender"
                placeholder="Enter sender email"
                value={emailSender}
                onChange={(e) => setEmailSender(e.target.value)}
              />
            </div>

            <div className="grid w-full items-center gap-2">
              <Label htmlFor="email-content">Email Content</Label>
              <Textarea
                id="email-content"
                placeholder="Paste email content here..."
                value={emailContent}
                onChange={(e) => setEmailContent(e.target.value)}
                className="min-h-[240px]"
              />
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={loadSampleEmail}>
              Load Sample
            </Button>
            <Button onClick={handleExtractTasks} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Extracting...
                </>
              ) : (
                'Extract Tasks'
              )}
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Extraction Results</CardTitle>
            <CardDescription>
              Identified tasks with rich metadata
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                <p className="text-sm text-gray-500">
                  Processing with enhanced AI model...
                </p>
              </div>
            ) : result ? (
              <div>
                {result.classification === 'marketing_promotional' || result.classification === 'non_actionable' ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <AlertCircle className="h-10 w-10 text-amber-500 mb-4" />
                    <h3 className="text-lg font-medium mb-2">
                      {result.classification === 'marketing_promotional' 
                        ? 'Marketing/Promotional Content' 
                        : 'Non-Actionable Content'}
                    </h3>
                    <p className="text-sm text-gray-500 max-w-md">
                      {result.explanation}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="mb-4 flex items-center">
                      <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                      <span className="font-medium">
                        {result.tasks?.length || 0} tasks identified
                      </span>
                    </div>

                    <ScrollArea className="h-[400px] pr-4">
                      <div className="space-y-6">
                        {result.tasks && result.tasks.map((task: any, index: number) => (
                          <div key={index} className="border rounded-lg p-4">
                            <div className="flex justify-between items-start mb-3">
                              <h3 className="font-medium text-lg">{task.title}</h3>
                              <div className="flex gap-2">
                                {renderPriorityBadge(task.priority)}
                                {task.category && renderCategoryBadge(task.category)}
                              </div>
                            </div>
                            
                            <p className="text-sm text-gray-600 mb-3">
                              {task.detailed_description}
                            </p>
                            
                            <div className="bg-gray-50 p-3 rounded-md text-sm text-gray-500 mb-3">
                              <p className="font-medium text-xs uppercase text-gray-400 mb-1">Source Snippet</p>
                              <p>"{task.source_snippet}"</p>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              {task.actors_involved && task.actors_involved.length > 0 && (
                                <div>
                                  <p className="font-medium text-xs uppercase text-gray-400 mb-1">
                                    People Involved
                                  </p>
                                  <div className="flex flex-wrap gap-1">
                                    {task.actors_involved.map((actor: string, actorIdx: number) => (
                                      <Badge key={actorIdx} variant="secondary" className="mr-1">
                                        {actor}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              {task.estimated_effort_minutes && (
                                <div>
                                  <p className="font-medium text-xs uppercase text-gray-400 mb-1">
                                    Estimated Effort
                                  </p>
                                  <p>{task.estimated_effort_minutes} minutes</p>
                                </div>
                              )}
                            </div>
                            
                            {task.aiSuggestedReminderText && (
                              <div className="mt-3 pt-3 border-t border-gray-100">
                                <p className="font-medium text-xs uppercase text-gray-400 mb-1">
                                  Suggested Reminder
                                </p>
                                <p className="text-sm">{task.aiSuggestedReminderText}</p>
                              </div>
                            )}
                            
                            {task.isRecurringSuggestion && (
                              <div className="mt-3 flex items-center">
                                <Badge variant="outline" className="bg-blue-50">Recurring Task</Badge>
                              </div>
                            )}
                            
                            <div className="mt-3 flex items-center">
                              <p className="text-xs text-gray-400">
                                AI Confidence: {task.aiConfidence}%
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                No results yet. Enter email content and click "Extract Tasks".
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TaskExtractionTestPage;