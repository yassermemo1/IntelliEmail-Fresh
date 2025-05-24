import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'wouter';

// Type definitions
interface Task {
  id: number;
  title: string;
  description: string;
  priority: string;
  dueDate: string | null;
  isCompleted: boolean;
  emailId: number | null;
}

interface TestResult {
  emailId: number;
  subject: string;
  from: string; // This field comes from the API as 'from' but actually contains the sender's email
  classification: string[];
  isLikelyNonActionable: boolean;
  extractedTasks: Task[];
  analysis: {
    extractedTaskCount: number;
    categories: string[];
    explanation: string;
  };
  error?: string;
}

export default function TaskAnalysis() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [emailCount, setEmailCount] = useState<number>(10);
  const { toast } = useToast();

  // Auto-run the analysis when the component mounts
  useEffect(() => {
    if (results.length === 0 && !isLoading) {
      runTaskAnalysis();
    }
  }, []);

  const runTaskAnalysis = async () => {
    setIsLoading(true);
    try {
      const response = await apiRequest({
        url: '/api/ai/task-extraction',
        method: 'POST',
        body: { count: emailCount }
      });

      if (response && response.results) {
        setResults(response.results);
        toast({
          title: 'Analysis Complete',
          description: `Analyzed ${response.totalProcessed} emails for task extraction`,
        });
      }
    } catch (error) {
      console.error('Error running task analysis:', error);
      toast({
        title: 'Analysis Failed',
        description: 'Failed to analyze emails for task extraction',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Function to get badge color based on priority
  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high':
        return 'bg-red-500 hover:bg-red-600';
      case 'medium':
        return 'bg-yellow-500 hover:bg-yellow-600';
      case 'low':
        return 'bg-green-500 hover:bg-green-600';
      default:
        return 'bg-gray-500 hover:bg-gray-600';
    }
  };

  // Function to get category badge color
  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'work':
        return 'bg-blue-500 hover:bg-blue-600';
      case 'personal':
        return 'bg-purple-500 hover:bg-purple-600';
      case 'financial':
        return 'bg-green-500 hover:bg-green-600';
      case 'urgent':
        return 'bg-red-500 hover:bg-red-600';
      case 'travel':
        return 'bg-orange-500 hover:bg-orange-600';
      default:
        return 'bg-gray-500 hover:bg-gray-600';
    }
  };

  return (
      <div className="container mx-auto py-8 bg-white">
        <div className="flex flex-col space-y-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Email Task Analysis</h1>
            <p className="text-gray-600 mb-6">
              See how the AI analyzes your emails and determines which tasks to extract. This tool demonstrates the classification logic and task generation from your emails.
            </p>

            <div className="flex items-center space-x-4 mb-8">
              <div className="w-32">
                <label htmlFor="emailCount" className="block text-sm font-medium text-gray-700 mb-1">
                  Email Count:
                </label>
                <select
                  id="emailCount"
                  value={emailCount}
                  onChange={(e) => setEmailCount(Number(e.target.value))}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
                  disabled={isLoading}
                >
                  <option value={5}>5 emails</option>
                  <option value={10}>10 emails</option>
                  <option value={20}>20 emails</option>
                </select>
              </div>
              <Button onClick={runTaskAnalysis} disabled={isLoading} className="mt-6">
                {isLoading ? 'Analyzing...' : 'Analyze Recent Emails'}
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-8 w-3/4" />
                    <Skeleton className="h-4 w-1/2 mt-2" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-2/3" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-6 bg-white">
              {results.length > 0 ? (
                results.map((result, index) => (
                  <Card key={index} className={result.isLikelyNonActionable ? 'border-l-4 border-l-gray-300 bg-white' : 'border-l-4 border-l-blue-500 bg-white'}>
                    <CardHeader className="bg-white">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-gray-900">{result.subject || 'No Subject'}</CardTitle>
                          <CardDescription className="text-gray-700">From: {result.from}</CardDescription>
                          {result.emailId && (
                            <Link href={`/emails/${result.emailId}`} className="text-blue-600 hover:underline text-xs mt-1 inline-block">
                              View Email Details
                            </Link>
                          )}
                        </div>
                        <div>
                          {result.isLikelyNonActionable ? (
                            <Badge variant="outline" className="ml-2 bg-gray-100 text-gray-700">Non-Actionable</Badge>
                          ) : (
                            <Badge variant="default" className="ml-2">Actionable</Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="bg-white text-gray-900">
                      <div className="mb-4">
                        <h4 className="text-sm font-medium mb-2 text-gray-900">Email Classification:</h4>
                        <div className="flex flex-wrap gap-2 mb-4">
                          {result.classification.length > 0 ? (
                            result.classification.map((category, idx) => (
                              <Badge key={idx} className={getCategoryColor(category)}>
                                {category}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-gray-500 text-sm">No categories detected</span>
                          )}
                        </div>
                      </div>

                      <div className="mb-4">
                        <h4 className="text-sm font-medium mb-2 text-gray-900">Analysis Explanation:</h4>
                        <p className="text-sm text-gray-700">{result.analysis.explanation}</p>
                      </div>

                      {result.extractedTasks && result.extractedTasks.length > 0 ? (
                        <div>
                          <h4 className="text-sm font-medium mb-2 text-gray-900">Extracted Tasks ({result.extractedTasks.length}):</h4>
                          <Accordion type="single" collapsible className="w-full bg-white">
                            {result.extractedTasks.map((task, taskIdx) => (
                              <AccordionItem key={taskIdx} value={`task-${index}-${taskIdx}`} className="bg-white border border-gray-200 mb-2 rounded-md">
                                <AccordionTrigger className="text-left text-gray-900 px-3">
                                  <div className="flex items-center">
                                    <Badge className={`mr-2 ${getPriorityColor(task.priority)}`}>{task.priority}</Badge>
                                    <span>{task.title}</span>
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent className="bg-white px-3">
                                  <div className="pl-2 border-l-2 border-gray-200">
                                    <p className="text-sm mb-2 text-gray-700">{task.description}</p>
                                    {task.dueDate && (
                                      <p className="text-xs text-gray-500">
                                        Due date: {new Date(task.dueDate).toLocaleDateString()}
                                      </p>
                                    )}
                                  </div>
                                </AccordionContent>
                              </AccordionItem>
                            ))}
                          </Accordion>
                        </div>
                      ) : !result.isLikelyNonActionable ? (
                        <div className="mt-4 text-sm text-amber-600">
                          No tasks were extracted from this email, even though it was classified as actionable.
                        </div>
                      ) : (
                        <div className="mt-4 text-sm text-gray-500">
                          No tasks extracted (non-actionable email).
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card className="bg-white">
                  <CardContent className="flex flex-col items-center justify-center p-8 bg-white">
                    <p className="text-gray-700 mb-4">
                      Click the "Analyze Recent Emails" button to see how the AI classifies your emails and extracts tasks.
                    </p>
                    <Button onClick={runTaskAnalysis}>Analyze Recent Emails</Button>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
  );
}