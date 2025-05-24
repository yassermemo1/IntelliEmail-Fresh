import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, AlertCircle, Info } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Task {
  title: string;
  description: string;
  priority: string;
  dueDate?: string;
  confidence: number;
  category?: string;
}

interface AnalysisResult {
  emailId: number;
  subject: string;
  from: string;
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

export default function OpenAiTest() {
  const [count, setCount] = useState<number>(5);
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const runAnalysis = async () => {
    setIsLoading(true);
    try {
      const response = await apiRequest({
        url: '/api/test-openai-analysis/analyze-recent-emails',
        method: 'POST',
        body: { count }
      });

      if (response?.success) {
        setResults(response.results);
        toast({
          title: "Analysis Complete",
          description: `Analyzed ${response.results.length} emails with OpenAI`,
          variant: "default"
        });
      } else {
        toast({
          title: "Analysis Failed",
          description: response?.message || "Could not analyze emails",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to run OpenAI analysis",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Generate color based on priority
  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="container mx-auto py-8 max-w-5xl">
      <Card>
        <CardHeader className="bg-slate-50">
          <CardTitle>OpenAI Email Analysis Test</CardTitle>
          <CardDescription>
            Test how well your OpenAI API key analyzes emails and extracts potential tasks
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex items-center space-x-2 mb-6">
            <div className="w-full max-w-xs">
              <Input
                type="number"
                min={1}
                max={10}
                value={count}
                onChange={(e) => setCount(parseInt(e.target.value) || 5)}
                placeholder="Number of emails to analyze"
              />
            </div>
            <Button onClick={runAnalysis} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                "Analyze Recent Emails"
              )}
            </Button>
          </div>

          {results.length > 0 && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold">Analysis Results</h3>
              
              {results.map((result, index) => (
                <Card key={index} className="overflow-hidden">
                  <CardHeader className="bg-gray-50 pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{result.subject}</CardTitle>
                        <CardDescription>{result.from}</CardDescription>
                      </div>
                      {result.isLikelyNonActionable ? (
                        <Badge variant="outline" className="bg-gray-100">Non-Actionable</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-blue-100 text-blue-800">Actionable</Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {result.classification.map((category, idx) => (
                        <Badge variant="secondary" key={idx}>{category}</Badge>
                      ))}
                    </div>
                  </CardHeader>
                  
                  <CardContent className="pt-4">
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-500 mb-2">AI Analysis</h4>
                      <p className="text-sm">{result.analysis.explanation}</p>
                    </div>
                    
                    <Separator className="my-4" />
                    
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-2">
                        Extracted Tasks ({result.extractedTasks.length})
                      </h4>
                      
                      {result.extractedTasks.length > 0 ? (
                        <div className="space-y-3">
                          {result.extractedTasks.map((task, taskIdx) => (
                            <div key={taskIdx} className="border rounded-md p-3">
                              <div className="flex justify-between items-start">
                                <h5 className="font-medium">{task.title}</h5>
                                <div className="flex gap-2">
                                  <Badge className={getPriorityColor(task.priority)}>
                                    {task.priority}
                                  </Badge>
                                  {task.confidence && (
                                    <Badge variant="outline" className="bg-blue-50">
                                      {Math.round(task.confidence * 100)}% confidence
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                              <div className="flex flex-wrap gap-2 mt-2">
                                {task.dueDate && (
                                  <div className="text-xs text-gray-500 flex items-center">
                                    <Info className="h-3 w-3 mr-1" />
                                    Due: {new Date(task.dueDate).toLocaleDateString()}
                                  </div>
                                )}
                                {task.category && (
                                  <Badge variant="outline" className="text-xs">
                                    {task.category}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 italic">No tasks extracted from this email</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}