import React, { useState } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Loader2, CheckCircle2, AlertCircle, Mail, Table, FileText } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";

const EnhancedBatchProcessingPage = () => {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingResult, setProcessingResult] = useState<any>(null);
  const [options, setOptions] = useState({
    limit: 5,
    daysBack: 7,
    unprocessedOnly: true,
    specificEmailIds: ""
  });
  const [activeTab, setActiveTab] = useState("options");

  const handleProcessBatch = async () => {
    try {
      setIsProcessing(true);
      setProcessingResult(null);
      
      // Parse specific email IDs if provided
      let specificEmailIds: number[] = [];
      if (options.specificEmailIds.trim()) {
        specificEmailIds = options.specificEmailIds
          .split(',')
          .map(id => id.trim())
          .filter(id => /^\d+$/.test(id))
          .map(id => parseInt(id, 10));
      }
      
      const response = await apiRequest('/api/enhanced-batch/process-batch', {
        method: 'POST',
        body: JSON.stringify({
          limit: options.limit,
          daysBack: options.daysBack,
          unprocessedOnly: options.unprocessedOnly,
          specificEmailIds: specificEmailIds
        })
      });
      
      setProcessingResult(response);
      setActiveTab("results");
      
      toast({
        title: "Batch processing complete",
        description: `Processed ${response.data.processed} emails and created ${response.data.taskCount} tasks.`
      });
    } catch (error: any) {
      console.error("Batch processing failed:", error);
      toast({
        title: "Processing failed",
        description: error.message || "An error occurred during batch processing",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOptionChange = (field: string, value: any) => {
    setOptions(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const renderClassificationBadge = (classification: string) => {
    switch (classification) {
      case 'marketing_promotional':
        return <Badge variant="outline" className="bg-amber-100 text-amber-800">Marketing</Badge>;
      case 'non_actionable':
        return <Badge variant="outline" className="bg-gray-100 text-gray-800">Non-Actionable</Badge>;
      default:
        return <Badge variant="outline" className="bg-blue-100 text-blue-800">{classification}</Badge>;
    }
  };

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-2">Enhanced Batch Email Processing</h1>
      <p className="text-gray-600 mb-6">
        Process emails with the advanced AI-powered task extraction system. 
        This tool uses a sophisticated LLM to identify actionable tasks, classify emails, and generate rich task metadata.
      </p>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="options">Processing Options</TabsTrigger>
          <TabsTrigger value="results">Processing Results</TabsTrigger>
        </TabsList>
        
        <TabsContent value="options">
          <Card>
            <CardHeader>
              <CardTitle>Batch Processing Configuration</CardTitle>
              <CardDescription>
                Customize how emails are selected and processed with the enhanced task extraction
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="limit">Maximum Emails to Process</Label>
                    <Input 
                      id="limit" 
                      type="number" 
                      value={options.limit} 
                      onChange={(e) => handleOptionChange('limit', parseInt(e.target.value) || 1)}
                      min={1}
                      max={50}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Between 1 and 50 emails per batch
                    </p>
                  </div>
                  
                  <div>
                    <Label htmlFor="daysBack">Process Emails From Last X Days</Label>
                    <Input 
                      id="daysBack" 
                      type="number" 
                      value={options.daysBack} 
                      onChange={(e) => handleOptionChange('daysBack', parseInt(e.target.value) || 1)}
                      min={1}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Only process recent emails received within this many days
                    </p>
                  </div>
                  
                  <div className="flex items-center space-x-2 pt-2">
                    <Checkbox 
                      id="unprocessedOnly"
                      checked={options.unprocessedOnly}
                      onCheckedChange={(checked) => handleOptionChange('unprocessedOnly', !!checked)}
                    />
                    <Label htmlFor="unprocessedOnly" className="cursor-pointer">
                      Only Process Unprocessed Emails
                    </Label>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="specificEmailIds">Specific Email IDs (Optional)</Label>
                    <Textarea 
                      id="specificEmailIds" 
                      placeholder="Enter comma-separated email IDs (e.g., 123, 456, 789)"
                      value={options.specificEmailIds}
                      onChange={(e) => handleOptionChange('specificEmailIds', e.target.value)}
                      className="h-32"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      If provided, only these specific emails will be processed regardless of other options
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button 
                onClick={handleProcessBatch} 
                disabled={isProcessing}
                className="w-full md:w-auto"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>Start Enhanced Batch Processing</>
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="results">
          <Card>
            <CardHeader>
              <CardTitle>Processing Results</CardTitle>
              <CardDescription>
                Results from the enhanced AI-powered email processing
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isProcessing ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                  <h3 className="text-lg font-medium mb-2">Processing Emails...</h3>
                  <p className="text-sm text-gray-500 max-w-md text-center">
                    The system is analyzing emails with our advanced AI model to extract tasks and classify content.
                    This may take a moment.
                  </p>
                </div>
              ) : !processingResult ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="h-12 w-12 text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Results Yet</h3>
                  <p className="text-sm text-gray-500 max-w-md">
                    Configure and run the enhanced batch processing to see results here.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Emails Processed</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center">
                          <Mail className="h-5 w-5 text-blue-500 mr-2" />
                          <span className="text-2xl font-bold">{processingResult.data.processed}</span>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Tasks Created</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center">
                          <CheckCircle2 className="h-5 w-5 text-green-500 mr-2" />
                          <span className="text-2xl font-bold">{processingResult.data.taskCount}</span>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Tasks Per Email</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center">
                          <Table className="h-5 w-5 text-purple-500 mr-2" />
                          <span className="text-2xl font-bold">
                            {processingResult.data.processed > 0 
                              ? (processingResult.data.taskCount / processingResult.data.processed).toFixed(1) 
                              : '0.0'}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  
                  {processingResult.data.emailResults && (
                    <>
                      <h3 className="text-lg font-medium mt-6 mb-3">Individual Email Results</h3>
                      <ScrollArea className="h-[400px] rounded-md border">
                        <div className="p-4 space-y-4">
                          {processingResult.data.emailResults.map((result: any, index: number) => (
                            <Card key={index} className={result.status === 'error' ? 'border-red-200' : ''}>
                              <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                  <CardTitle className="text-base">Email ID: {result.emailId}</CardTitle>
                                  {result.classification && renderClassificationBadge(result.classification)}
                                </div>
                                {result.status === 'error' && (
                                  <CardDescription className="text-red-500 flex items-center">
                                    <AlertCircle className="h-4 w-4 mr-1" />
                                    {result.error}
                                  </CardDescription>
                                )}
                              </CardHeader>
                              <CardContent className="pb-3">
                                {result.status === 'processed' ? (
                                  <div className="space-y-2">
                                    {result.explanation ? (
                                      <p className="text-sm text-gray-600">{result.explanation}</p>
                                    ) : (
                                      <div>
                                        <p className="text-sm">
                                          <span className="font-medium">Tasks created:</span> {result.tasksCreated}
                                        </p>
                                        
                                        {result.taskData && result.taskData.length > 0 && (
                                          <div className="mt-3 space-y-3">
                                            {result.taskData.map((task: any, taskIndex: number) => (
                                              <div key={taskIndex} className="bg-gray-50 p-2 rounded text-sm">
                                                <p className="font-medium">{task.suggested_title}</p>
                                                <p className="text-xs text-gray-600 mt-1">{task.detailed_description}</p>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                  <Badge variant="outline" className="text-xs">
                                                    {task.suggested_category}
                                                  </Badge>
                                                  <Badge variant="outline" className="text-xs">
                                                    {task.suggested_priority_level}
                                                  </Badge>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-sm text-gray-600">
                                    Processing failed for this email.
                                  </p>
                                )}
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </ScrollArea>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EnhancedBatchProcessingPage;