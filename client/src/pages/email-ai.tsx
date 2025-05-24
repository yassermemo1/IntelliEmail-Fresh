import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import EmailRagProcessingPanel from "@/components/EmailRagProcessingPanel";

export default function EmailAI() {
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [currentModel, setCurrentModel] = useState<{provider: string, model: string} | null>(null);
  const [examples] = useState([
    "Who are my top email senders?",
    "What are my upcoming deadlines?",
    "When is my next trip or flight?",
    "Find emails about meetings next week",
    "What projects am I currently working on?"
  ]);
  const { toast } = useToast();

  const askQuestion = async () => {
    if (!question.trim()) {
      toast({
        title: "Empty question",
        description: "Please enter a question about your emails",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setError("");
    
    try {
      const response = await apiRequest({
        url: "/api/ai/ask",
        method: "POST",
        body: { question }
      });

      if (response && typeof response === 'object') {
        setAnswer(response.answer || "");
        setSources(response.sources || []);
        // Capture actual model used (variables: response.provider, response.model)
        if (response.provider && response.model) {
          setCurrentModel({ provider: response.provider, model: response.model });
        }
      }
    } catch (err) {
      console.error("Error asking question:", err);
      setError("Failed to get an answer. Please try again.");
      toast({
        title: "Error",
        description: "Failed to get an answer. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const useExample = (example: string) => {
    setQuestion(example);
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex flex-col space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Ask AI About Your Emails</h1>
          <p className="text-gray-600">
            Ask natural language questions about your emails. The AI will analyze your emails and provide answers.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Ask a Question</CardTitle>
                <CardDescription>
                  Enter a question about your emails, or try one of the examples below.
                  {currentModel && (
                    <div className="mt-2 text-xs bg-blue-50 p-2 rounded border">
                      <strong>Current AI Model:</strong> {currentModel.provider} - {currentModel.model}
                      <br />
                      <span className="text-gray-600">Variables: response.provider = "{currentModel.provider}", response.model = "{currentModel.model}"</span>
                    </div>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Textarea
                      placeholder="e.g., Who are my top email senders? When is my next trip?"
                      className="min-h-[100px]"
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                    />
                  </div>
                  <div>
                    <Button onClick={askQuestion} disabled={isLoading} className="w-full">
                      {isLoading ? "Processing..." : "Ask AI"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {(answer || isLoading) && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Answer</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex items-center justify-center p-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : (
                    <div className="prose max-w-none">
                      <p className="whitespace-pre-line">{answer}</p>
                    </div>
                  )}
                </CardContent>
                {sources.length > 0 && (
                  <CardFooter>
                    <div className="w-full">
                      <h4 className="text-sm font-medium mb-2">Sources:</h4>
                      <div className="space-y-2 text-sm">
                        {sources.map((source, index) => (
                          <div key={index} className="p-2 bg-gray-50 rounded">
                            <p className="font-medium">From: {source.from}</p>
                            <p>Subject: {source.subject}</p>
                            <p className="text-gray-500 text-xs">
                              {new Date(source.date).toLocaleString()}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardFooter>
                )}
              </Card>
            )}
          </div>

          <div>
            <Card>
              <CardHeader>
                <CardTitle>Example Questions</CardTitle>
                <CardDescription>
                  Click on any example to use it as your question.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {examples.map((example, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      className="w-full justify-start text-left"
                      onClick={() => useExample(example)}
                    >
                      {example}
                    </Button>
                  ))}
                </div>
              </CardContent>
              <CardFooter>
                <p className="text-xs text-gray-500">
                  Note: The AI can only answer questions based on the emails it has processed.
                </p>
              </CardFooter>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>How It Works</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 text-sm">
                  <div>
                    <h4 className="font-medium">Retrieval Augmented Generation</h4>
                    <p className="text-gray-600">
                      The AI uses RAG technology to find relevant emails and generate accurate answers based on your actual email data.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium">Semantic Search</h4>
                    <p className="text-gray-600">
                      Your question is converted to an embedding vector to find semantically similar emails, not just keyword matches.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium">Natural Language</h4>
                    <p className="text-gray-600">
                      Ask questions in plain English - no need for complex search syntax or keywords.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <div className="mt-6">
              <EmailRagProcessingPanel />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}