import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface ApiTestResult {
  provider: string;
  status: "success" | "error";
  message: string;
  isKeyValid?: boolean;
}

export default function ModelConnectionTest() {
  const [results, setResults] = useState<ApiTestResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const testAllConnections = async () => {
    setIsLoading(true);
    setResults([]);
    
    try {
      const response = await apiRequest({
        url: '/api/ai/test-all-connections',
        method: 'GET'
      });

      if (response?.success) {
        setResults(response.results);
        toast({
          title: "Connection Tests Complete",
          description: `Tested ${response.results.length} AI model providers`,
        });
      } else {
        toast({
          title: "Test Failed",
          description: response?.message || "Could not test AI model connections",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to test connections",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Run the test automatically when the page loads
    testAllConnections();
  }, []);

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>AI Model Connection Status</CardTitle>
          <CardDescription>
            Check the connection status for all configured AI models
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="flex justify-end">
              <Button 
                onClick={testAllConnections} 
                disabled={isLoading}
                size="sm"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  "Refresh Status"
                )}
              </Button>
            </div>
            
            {isLoading ? (
              <div className="flex flex-col items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin mb-4" />
                <p>Testing connections to all AI model providers...</p>
              </div>
            ) : results.length > 0 ? (
              <div className="space-y-4">
                {results.map((result, index) => (
                  <div key={index} className="border rounded-md p-4">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center">
                        <h3 className="text-lg font-medium capitalize">{result.provider}</h3>
                        <Badge 
                          variant={result.status === "success" ? "default" : "destructive"}
                          className="ml-3"
                        >
                          {result.status === "success" ? "Connected" : "Connection Error"}
                        </Badge>
                      </div>
                      {result.status === "success" ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                    </div>
                    
                    {result.isKeyValid !== undefined && (
                      <div className="flex items-center mb-2">
                        <span className="text-sm mr-2">API Key Status:</span>
                        <Badge 
                          variant={result.isKeyValid ? "outline" : "destructive"}
                          className={result.isKeyValid ? "bg-green-50 text-green-700" : ""}
                        >
                          {result.isKeyValid ? "Valid" : "Invalid"}
                        </Badge>
                      </div>
                    )}
                    
                    <p className="text-sm text-gray-600">{result.message}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center p-8 text-gray-500">
                No connection test results available. Click "Refresh Status" to test connections.
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col items-start">
          <Separator className="my-2" />
          <div className="text-sm text-gray-500 mt-2">
            <p>The application can use multiple AI providers:</p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>OpenAI - Used for GPT models and embeddings</li>
              <li>Anthropic - Used for Claude models</li>
              <li>Perplexity - Used for Perplexity models</li>
              <li>Ollama - Used for local open-source models (requires local Ollama server)</li>
            </ul>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}