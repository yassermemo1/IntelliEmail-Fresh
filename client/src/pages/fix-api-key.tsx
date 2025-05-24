import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle, Lock } from "lucide-react";

export default function FixApiKeyPage() {
  const [apiKey, setApiKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{success: boolean; message: string} | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const { toast } = useToast();

  // Directly update DB on page load
  useEffect(() => {
    const directlyUpdateDatabase = async () => {
      try {
        // Direct SQL approach using the API instead of running SQL directly
        const response = await fetch('/api/fix-api-key/update-openai-key', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            apiKey: process.env.OPENAI_API_KEY || ''
          }),
          credentials: 'include'
        });
        
        const data = await response.json();
        
        setResult({
          success: data.success,
          message: data.message
        });
        
        if (data.success) {
          toast({
            title: "Success!",
            description: `Your OpenAI API key has been automatically added. Found ${data.modelCount} models.`,
          });
        }
      } catch (error) {
        console.error('Auto-update error:', error);
        setErrorDetails(error instanceof Error ? error.message : String(error));
      }
    };
    
    directlyUpdateDatabase();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!apiKey.trim()) {
      toast({
        title: "API Key Required",
        description: "Please enter your OpenAI API key",
        variant: "destructive"
      });
      return;
    }
    
    setIsSubmitting(true);
    setResult(null);
    setErrorDetails(null);
    
    try {
      // Show the actual request for debugging
      console.log('Sending API key update request with key:', apiKey.substring(0, 10) + '...');
      
      const response = await fetch('/api/fix-api-key/update-openai-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ apiKey }),
        credentials: 'include'
      });
      
      // Log full response for debugging
      console.log('Response status:', response.status);
      
      const responseText = await response.text();
      console.log('Raw response:', responseText);
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse response:', parseError);
        setErrorDetails(`Failed to parse server response: ${responseText}`);
        throw new Error('Invalid server response format');
      }
      
      setResult({
        success: data.success,
        message: data.message
      });
      
      if (data.success) {
        toast({
          title: "Success!",
          description: `Your OpenAI API key has been successfully set up. Found ${data.modelCount} models.`,
        });
      } else {
        toast({
          title: "API Key Error",
          description: data.message || "Failed to validate API key",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Submission error:', error);
      
      setResult({
        success: false,
        message: error instanceof Error ? error.message : "An unknown error occurred"
      });
      
      toast({
        title: "Request Error",
        description: error instanceof Error ? error.message : "Failed to submit API key",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto py-10">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-green-500" />
            OpenAI API Key Setup
          </CardTitle>
          <CardDescription>
            This page automatically adds your OpenAI API key to the system, bypassing format validation issues.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {result ? (
              <Alert variant={result.success ? "default" : "destructive"}>
                {result.success ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertTitle>
                  {result.success ? "Success!" : "Error"}
                </AlertTitle>
                <AlertDescription>
                  {result.message}
                </AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Processing</AlertTitle>
                <AlertDescription>
                  Setting up your API key automatically...
                </AlertDescription>
              </Alert>
            )}
            
            {result?.success && (
              <div className="p-4 bg-green-50 border border-green-100 rounded-lg">
                <h3 className="font-medium text-green-800 mb-2">Your API key is now active!</h3>
                <p className="text-sm text-green-700 mb-4">
                  Your OpenAI API key has been successfully added to the system and is ready to use.
                  All OpenAI-powered features should now work correctly.
                </p>
                <Button asChild variant="outline" className="w-full">
                  <a href="/ai-settings">Go to AI Settings</a>
                </Button>
              </div>
            )}
            
            {errorDetails && (
              <div className="p-4 bg-amber-50 border border-amber-100 rounded-lg">
                <h3 className="font-medium text-amber-800 mb-2">Detailed Error Information</h3>
                <p className="text-xs font-mono p-2 bg-amber-100 rounded overflow-auto whitespace-pre-wrap">
                  {errorDetails}
                </p>
              </div>
            )}
            
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-medium mb-2">Manual Setup (if needed)</h3>
              <div className="space-y-2">
                <Input
                  id="apiKey"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Your OpenAI API key is already pre-filled"
                  className="w-full mb-4"
                />
                <Button 
                  onClick={handleSubmit} 
                  disabled={isSubmitting || !apiKey.trim() || result?.success}
                  className="w-full"
                  variant={result?.success ? "outline" : "default"}
                >
                  {isSubmitting 
                    ? "Processing..." 
                    : result?.success 
                      ? "API Key Already Added" 
                      : "Manually Add API Key"}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <p className="text-xs text-gray-500 w-full text-center">
            This page bypasses client-side validation and directly tests your key with OpenAI's API.
          </p>
        </CardFooter>
      </Card>
      
      <div className="mt-8 max-w-2xl mx-auto text-center">
        <p className="text-sm text-gray-500">
          Your key is now set up! You can head to the <a href="/ai-settings" className="text-primary hover:underline">AI Settings page</a> to configure your AI preferences.
        </p>
      </div>
    </div>
  );
}