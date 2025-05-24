import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/Layout";
import { Loader2, AlertCircle, Check } from "lucide-react";

const OllamaSettings: React.FC = () => {
  const { toast } = useToast();
  const [ollamaEndpoint, setOllamaEndpoint] = useState('http://localhost:11434');
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'none' | 'success' | 'error'>('none');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [testPrompt, setTestPrompt] = useState('Summarize this email: "Hello, just wanted to follow up on our meeting yesterday about the project timeline. Can we schedule another call for next week?"');
  const [testResponse, setTestResponse] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [selectedModel, setSelectedModel] = useState('');

  const testConnection = async () => {
    setIsConnecting(true);
    setConnectionStatus('none');
    setAvailableModels([]);
    
    try {
      // Test connection to Ollama server using the AI service test-ollama endpoint
      const response = await fetch('/api/ai/test-ollama', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: ollamaEndpoint })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setConnectionStatus('success');
        
        if (data.models && data.models.length > 0) {
          const modelNames = data.models.map((model: any) => model.name);
          setAvailableModels(modelNames);
          
          if (modelNames.length > 0) {
            setSelectedModel(modelNames[0]);
          }
          
          toast({
            title: "Connection Successful",
            description: `Found ${modelNames.length} models on Ollama server.`,
          });
        } else {
          toast({
            title: "Connected to Ollama",
            description: "No models found. You may need to pull models using the Ollama CLI.",
            variant: "default"
          });
        }
      } else {
        setConnectionStatus('error');
        toast({
          title: "Connection Failed",
          description: data.message || "Could not connect to Ollama server. Make sure it's running and accessible.",
          variant: "destructive"
        });
      }
    } catch (error) {
      setConnectionStatus('error');
      toast({
        title: "Connection Error",
        description: "Error connecting to Ollama server. Check the endpoint URL and make sure Ollama is running.",
        variant: "destructive"
      });
      console.error("Error connecting to Ollama:", error);
    } finally {
      setIsConnecting(false);
    }
  };

  const testModelCompletion = async () => {
    if (!selectedModel) {
      toast({
        title: "No Model Selected",
        description: "Please select a model to test",
        variant: "destructive"
      });
      return;
    }
    
    setIsTesting(true);
    setTestResponse('');
    
    try {
      // Using the AI route for testing completions
      const response = await fetch('/api/ai/generate-completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          model: selectedModel, 
          prompt: testPrompt,
          provider: 'ollama',
          endpoint: ollamaEndpoint
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setTestResponse(data.completion || data.text || '');
        toast({
          title: "Model Test Successful",
          description: "Received response from Ollama model",
        });
      } else {
        toast({
          title: "Model Test Failed",
          description: data.message || "Failed to get response from model",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Model Test Error",
        description: "Error testing model. Check console for details.",
        variant: "destructive"
      });
      console.error("Error testing model:", error);
    } finally {
      setIsTesting(false);
    }
  };

  const saveSettings = async () => {
    try {
      // Save Ollama settings in the database via AI settings
      const response = await fetch('/api/ai/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ollamaEndpoint,
          selectedProvider: availableModels.length > 0 ? 'ollama' : 'openai',
          selectedModelId: selectedModel || null
        })
      });
      
      if (response.ok) {
        toast({
          title: "Settings Saved",
          description: "Ollama settings have been saved successfully",
        });
      } else {
        toast({
          title: "Save Failed",
          description: "Failed to save Ollama settings",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Settings Error",
        description: "Error saving settings. Check console for details.",
        variant: "destructive"
      });
      console.error("Error saving settings:", error);
    }
  };

  return (
    <Layout>
      <div className="container mx-auto py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Ollama Integration Settings</h1>
          <p className="text-gray-600">Configure and test your Ollama instance for local AI processing</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Connect to Ollama Server</CardTitle>
              <CardDescription>Configure the connection to your Ollama server</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="endpoint">Ollama API Endpoint</Label>
                  <Input 
                    id="endpoint" 
                    value={ollamaEndpoint} 
                    onChange={(e) => setOllamaEndpoint(e.target.value)}
                    placeholder="http://localhost:11434"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Use http://localhost:11434 when running on your local machine, or enter your Ollama server's full URL.
                    <a href="https://ollama.ai/download" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline ml-1">
                      Download Ollama
                    </a>
                  </p>
                </div>
                
                <Button onClick={testConnection} disabled={isConnecting}>
                  {isConnecting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Testing Connection
                    </>
                  ) : (
                    "Test Connection"
                  )}
                </Button>
                
                {connectionStatus === 'success' && (
                  <Alert className="bg-green-50 border-green-200">
                    <Check className="h-4 w-4 text-green-600" />
                    <AlertTitle className="text-green-800">Connected Successfully</AlertTitle>
                    <AlertDescription className="text-green-700">
                      Successfully connected to Ollama server at {ollamaEndpoint}
                    </AlertDescription>
                  </Alert>
                )}
                
                {connectionStatus === 'error' && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Connection Failed</AlertTitle>
                    <AlertDescription>
                      Could not connect to Ollama server. Check that Ollama is running and the endpoint is correct.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
              
              {availableModels.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-md font-medium mb-2">Available Models</h3>
                  <div className="flex flex-wrap gap-2">
                    {availableModels.map((model) => (
                      <Badge 
                        key={model} 
                        variant={selectedModel === model ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => setSelectedModel(model)}
                      >
                        {model}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              <Separator className="my-6" />
              
              <Button onClick={saveSettings} disabled={connectionStatus !== 'success'}>
                Save Settings
              </Button>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Test Ollama Model</CardTitle>
              <CardDescription>Verify that your Ollama model works correctly</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="testPrompt">Test Prompt</Label>
                  <Input 
                    id="testPrompt" 
                    value={testPrompt} 
                    onChange={(e) => setTestPrompt(e.target.value)}
                  />
                </div>
                
                <Button 
                  onClick={testModelCompletion} 
                  disabled={isTesting || !selectedModel || connectionStatus !== 'success'}
                >
                  {isTesting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Testing Model
                    </>
                  ) : (
                    "Test Model"
                  )}
                </Button>
                
                {testResponse && (
                  <div className="mt-4">
                    <Label>Model Response</Label>
                    <div className="p-4 bg-gray-50 rounded-md mt-1 text-sm whitespace-pre-wrap">
                      {testResponse}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default OllamaSettings;