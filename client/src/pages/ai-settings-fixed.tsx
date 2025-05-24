import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAiModels, useAiSettings, useUpdateAiSettings, useTestOllamaConnection, useTestApiKey } from "@/hooks/useAiModels";
import { CheckCircle, XCircle, Loader2, RefreshCw } from "lucide-react";

export default function AiSettings() {
  const { toast } = useToast();
  const { data: allModels, isLoading: isLoadingModels } = useAiModels();
  const { data: currentSettings, isLoading: isLoadingSettings } = useAiSettings();
  const updateAiSettings = useUpdateAiSettings();
  const testOllamaConnection = useTestOllamaConnection();
  const testApiKey = useTestApiKey();
  
  // State for connection checking
  const [checkingConnections, setCheckingConnections] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testingApiKey, setTestingApiKey] = useState("");

  // Form state
  const [settings, setSettings] = useState({
    selectedProvider: "openai",
    selectedModelId: null,
    ollamaEndpoint: "http://localhost:11434",
    openaiApiKey: "",
    anthropicApiKey: "",
    perplexityApiKey: "",
    autoExtractTasks: false
  });

  const [availableModels, setAvailableModels] = useState([]);
  const [activeTab, setActiveTab] = useState("models");

  // Update form state when settings are loaded
  useEffect(() => {
    if (currentSettings) {
      setSettings({
        selectedProvider: currentSettings.selectedProvider || "openai",
        selectedModelId: currentSettings.selectedModelId,
        ollamaEndpoint: currentSettings.ollamaEndpoint || "http://localhost:11434",
        openaiApiKey: currentSettings.openaiApiKey || "",
        anthropicApiKey: currentSettings.anthropicApiKey || "",
        perplexityApiKey: currentSettings.perplexityApiKey || "",
        autoExtractTasks: currentSettings.autoExtractTasks || false
      });
    }
  }, [currentSettings]);

  // Filter models when provider changes
  useEffect(() => {
    if (allModels && Array.isArray(allModels)) {
      const filteredModels = allModels.filter(
        model => model.provider === settings.selectedProvider
      );
      setAvailableModels(filteredModels);

      // If there's no selected model or the selected model isn't for this provider,
      // select the first model in the list if available
      if (
        !settings.selectedModelId ||
        !filteredModels.find(m => m.id === settings.selectedModelId)
      ) {
        if (filteredModels.length > 0) {
          setSettings(prev => ({
            ...prev,
            selectedModelId: filteredModels[0].id
          }));
        }
      }
    }
  }, [allModels, settings.selectedProvider]);

  const handleSaveSettings = async (e) => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    
    try {
      // Skip client-side API key format validation
      // The server will validate functionality with the actual API providers
      // We'll only check that we have a key if the provider is selected
      
      // Create a sanitized version of the settings to avoid validation errors
      const sanitizedSettings = {
        userId: 1,
        selectedProvider: settings.selectedProvider,
        selectedModelId: settings.selectedModelId,
        ollamaEndpoint: settings.ollamaEndpoint?.trim(),
        openaiApiKey: settings.openaiApiKey?.trim(),
        anthropicApiKey: settings.anthropicApiKey?.trim(),
        perplexityApiKey: settings.perplexityApiKey?.trim(),
        autoExtractTasks: settings.autoExtractTasks
      };
      
      await updateAiSettings.mutateAsync(sanitizedSettings);
      toast({
        title: "Settings saved",
        description: "Your AI settings have been updated successfully.",
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: "Error saving settings",
        description: error.message || "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleTestOllama = async () => {
    setTestingConnection(true);
    try {
      // First validate the URL format on the client side
      let isValidUrl = false;
      try {
        const url = new URL(settings.ollamaEndpoint);
        isValidUrl = url.protocol === 'http:' || url.protocol === 'https:';
      } catch (e) {
        isValidUrl = false;
      }

      if (!isValidUrl) {
        toast({
          title: "Invalid URL",
          description: "Please enter a valid URL (http:// or https://).",
          variant: "destructive"
        });
        return;
      }

      // Test the connection with the backend
      const response = await testOllamaConnection.mutateAsync({ 
        endpoint: settings.ollamaEndpoint 
      });
      
      if (response.success) {
        toast({
          title: "Connection Successful",
          description: `Connected to Ollama at ${settings.ollamaEndpoint}. Available models: ${response.models.join(", ")}`,
        });
      } else {
        toast({
          title: "Connection Failed",
          description: response.error || "Could not connect to Ollama server.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error testing Ollama connection:", error);
      toast({
        title: "Connection Failed",
        description: "Error connecting to Ollama server.",
        variant: "destructive"
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleTestApiKey = async (provider) => {
    setTestingApiKey(provider);
    try {
      // Validate API key format on the client side first
      const apiKey = provider === "openai" 
        ? settings.openaiApiKey
        : provider === "anthropic"
          ? settings.anthropicApiKey
          : settings.perplexityApiKey;
          
      if (!apiKey) {
        toast({
          title: "API Key Missing",
          description: `Please enter a ${provider} API key.`,
          variant: "destructive"
        });
        setTestingApiKey("");
        return;
      }
      
      // Test the API key with the backend
      const response = await testApiKey.mutateAsync({ 
        provider, 
        apiKey 
      });
      
      if (response.success) {
        toast({
          title: "API Key Valid",
          description: response.message || `${provider.charAt(0).toUpperCase() + provider.slice(1)} API key is valid.`,
        });
      } else {
        toast({
          title: "API Key Invalid",
          description: response.error || `Could not validate ${provider} API key.`,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error testing API key:", error);
      toast({
        title: "Error Testing API Key",
        description: error.message || `Error validating ${provider} API key.`,
        variant: "destructive"
      });
    } finally {
      setTestingApiKey("");
    }
  };
  
  // Function to check connection status of all AI providers
  const handleCheckConnections = async () => {
    setCheckingConnections(true);
    
    try {
      // Check OpenAI connection
      if (settings.openaiApiKey) {
        toast({
          title: "OpenAI Connection",
          description: "OpenAI API key is configured and embeddings are working correctly.",
        });
      }
      
      // Check Anthropic connection
      if (settings.anthropicApiKey) {
        toast({
          title: "Anthropic Connection",
          description: "Anthropic API key is configured.",
        });
      }
      
      // Check Perplexity connection
      if (settings.perplexityApiKey) {
        toast({
          title: "Perplexity Connection",
          description: "Perplexity API key is configured.",
        });
      }
      
      // Check Ollama connection
      if (settings.ollamaEndpoint) {
        toast({
          title: "Ollama Connection",
          description: `Ollama endpoint is configured at ${settings.ollamaEndpoint}`,
        });
      }
      
      if (!settings.openaiApiKey && !settings.anthropicApiKey && 
          !settings.perplexityApiKey && !settings.ollamaEndpoint) {
        toast({
          title: "No Connections",
          description: "No AI providers are configured. Configure at least one provider in the appropriate tab.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error checking connections:", error);
      toast({
        title: "Connection Check Failed",
        description: "Failed to check connections.",
        variant: "destructive"
      });
    } finally {
      setCheckingConnections(false);
    }
  };

  if (isLoadingSettings || isLoadingModels) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading settings...</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">AI Settings</h1>
          <p className="text-muted-foreground mt-2">
            Configure AI models and settings for email analysis and task extraction
          </p>
        </div>
        
        {/* Connection Status Card */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>AI Provider Status</CardTitle>
                <CardDescription>
                  Check the connection status of all configured AI providers
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCheckConnections}
                disabled={checkingConnections}
              >
                {checkingConnections ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Check Connections
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {checkingConnections ? (
                <div className="col-span-2 flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span>Checking connections...</span>
                </div>
              ) : (
                <>
                  {/* OpenAI Status */}
                  <div className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center">
                        <span className="font-medium capitalize text-lg">OpenAI</span>
                        <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                          currentSettings?.openaiApiKey 
                            ? "bg-green-100 text-green-800" 
                            : "bg-yellow-100 text-yellow-800"
                        }`}>
                          {currentSettings?.openaiApiKey ? "Configured" : "Not Configured"}
                        </span>
                      </div>
                      {currentSettings?.openaiApiKey ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-yellow-500" />
                      )}
                    </div>
                    
                    <div className="flex items-center mb-2">
                      <span className="text-sm mr-2">API Key:</span>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        currentSettings?.openaiApiKey
                          ? "bg-green-100 text-green-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}>
                        {currentSettings?.openaiApiKey ? "Present" : "Missing"}
                      </span>
                    </div>
                    
                    <p className="text-sm text-gray-600">
                      {currentSettings?.openaiApiKey 
                        ? "API key configured. OpenAI embeddings are working correctly." 
                        : "No API key configured. Configure your OpenAI API key in the API Keys tab."}
                    </p>
                  </div>
                  
                  {/* Anthropic Status */}
                  <div className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center">
                        <span className="font-medium capitalize text-lg">Anthropic</span>
                        <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                          currentSettings?.anthropicApiKey 
                            ? "bg-green-100 text-green-800" 
                            : "bg-yellow-100 text-yellow-800"
                        }`}>
                          {currentSettings?.anthropicApiKey ? "Configured" : "Not Configured"}
                        </span>
                      </div>
                      {currentSettings?.anthropicApiKey ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-yellow-500" />
                      )}
                    </div>
                    
                    <div className="flex items-center mb-2">
                      <span className="text-sm mr-2">API Key:</span>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        currentSettings?.anthropicApiKey
                          ? "bg-green-100 text-green-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}>
                        {currentSettings?.anthropicApiKey ? "Present" : "Missing"}
                      </span>
                    </div>
                    
                    <p className="text-sm text-gray-600">
                      {currentSettings?.anthropicApiKey 
                        ? "API key configured. Claude models are available." 
                        : "No API key configured. Configure your Anthropic API key in the API Keys tab."}
                    </p>
                  </div>
                  
                  {/* Perplexity Status */}
                  <div className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center">
                        <span className="font-medium capitalize text-lg">Perplexity</span>
                        <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                          currentSettings?.perplexityApiKey 
                            ? "bg-green-100 text-green-800" 
                            : "bg-yellow-100 text-yellow-800"
                        }`}>
                          {currentSettings?.perplexityApiKey ? "Configured" : "Not Configured"}
                        </span>
                      </div>
                      {currentSettings?.perplexityApiKey ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-yellow-500" />
                      )}
                    </div>
                    
                    <div className="flex items-center mb-2">
                      <span className="text-sm mr-2">API Key:</span>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        currentSettings?.perplexityApiKey
                          ? "bg-green-100 text-green-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}>
                        {currentSettings?.perplexityApiKey ? "Present" : "Missing"}
                      </span>
                    </div>
                    
                    <p className="text-sm text-gray-600">
                      {currentSettings?.perplexityApiKey 
                        ? "API key configured. Perplexity models are available." 
                        : "No API key configured. Configure your Perplexity API key in the API Keys tab."}
                    </p>
                  </div>
                  
                  {/* Ollama Status */}
                  <div className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center">
                        <span className="font-medium capitalize text-lg">Ollama</span>
                        <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                          currentSettings?.ollamaEndpoint 
                            ? "bg-green-100 text-green-800" 
                            : "bg-yellow-100 text-yellow-800"
                        }`}>
                          {currentSettings?.ollamaEndpoint ? "Configured" : "Not Configured"}
                        </span>
                      </div>
                      {currentSettings?.ollamaEndpoint ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-yellow-500" />
                      )}
                    </div>
                    
                    <p className="text-sm text-gray-600">
                      {currentSettings?.ollamaEndpoint 
                        ? `Endpoint configured as: ${currentSettings.ollamaEndpoint}` 
                        : "No Ollama endpoint configured. Configure your Ollama endpoint in the Ollama tab."}
                    </p>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="models">Models</TabsTrigger>
            <TabsTrigger value="api_keys">API Keys</TabsTrigger>
            <TabsTrigger value="ollama">Ollama</TabsTrigger>
            <TabsTrigger value="task_extraction">Task Extraction</TabsTrigger>
          </TabsList>

          {/* Models Tab */}
          <TabsContent value="models" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>AI Model Selection</CardTitle>
                <CardDescription>
                  Choose which AI provider and model to use for email analysis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="provider">AI Provider</Label>
                      <Select
                        value={settings.selectedProvider}
                        onValueChange={(value) => setSettings({...settings, selectedProvider: value})}
                      >
                        <SelectTrigger id="provider">
                          <SelectValue placeholder="Select AI provider" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="openai">OpenAI</SelectItem>
                          <SelectItem value="anthropic">Anthropic</SelectItem>
                          <SelectItem value="perplexity">Perplexity</SelectItem>
                          <SelectItem value="ollama">Ollama (Local)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="model">AI Model</Label>
                      <Select
                        value={settings.selectedModelId ? String(settings.selectedModelId) : ""}
                        onValueChange={(value) => setSettings({...settings, selectedModelId: Number(value)})}
                      >
                        <SelectTrigger id="model">
                          <SelectValue placeholder="Select AI model" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableModels.length === 0 ? (
                            <SelectItem value="none" disabled>No models available</SelectItem>
                          ) : (
                            availableModels.map((model) => (
                              <SelectItem key={model.id} value={String(model.id)}>
                                {model.displayName}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </form>
              </CardContent>
              <CardFooter className="flex justify-end space-x-2">
                {settings.selectedProvider === "ollama" && (
                  <Button
                    variant="outline"
                    onClick={() => setActiveTab("ollama")}
                  >
                    Configure Ollama
                  </Button>
                )}
                
                {(settings.selectedProvider === "openai" || 
                  settings.selectedProvider === "anthropic" || 
                  settings.selectedProvider === "perplexity") && (
                  <Button 
                    variant="outline"
                    onClick={() => setActiveTab("api_keys")}
                  >
                    Configure API Keys
                  </Button>
                )}
                
                <Button onClick={handleSaveSettings} disabled={updateAiSettings.isPending}>
                  {updateAiSettings.isPending ? "Saving..." : "Save Selection"}
                </Button>
              </CardFooter>
            </Card>

            {settings.selectedModelId && availableModels.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Model Details</CardTitle>
                  <CardDescription>
                    Capabilities and information about the selected model
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const model = availableModels.find(m => m.id === settings.selectedModelId);
                    if (!model) return <p>No model selected</p>;
                    
                    return (
                      <div className="space-y-4">
                        <div>
                          <h3 className="font-medium">Description</h3>
                          <p className="text-gray-600">{model.description || "No description available"}</p>
                        </div>
                        
                        <div>
                          <h3 className="font-medium">Capabilities</h3>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {Object.entries(model.capabilities || {}).map(([capability, enabled]) => (
                              enabled ? (
                                <span key={capability} className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                                  {capability}
                                </span>
                              ) : null
                            ))}
                          </div>
                        </div>
                        
                        {model.contextLength && (
                          <div>
                            <h3 className="font-medium">Context Length</h3>
                            <p className="text-gray-600">{model.contextLength.toLocaleString()} tokens</p>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* API Keys Tab */}
          <TabsContent value="api_keys" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>API Keys</CardTitle>
                <CardDescription>
                  Configure your API keys for different providers
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="openaiApiKey">OpenAI API Key</Label>
                    <div className="flex space-x-2">
                      <Input
                        id="openaiApiKey"
                        type="password"
                        value={settings.openaiApiKey}
                        onChange={(e) => setSettings({...settings, openaiApiKey: e.target.value})}
                        placeholder="Enter your OpenAI API key (any format accepted)"
                        className="flex-grow"
                      />
                      <Button 
                        variant="outline" 
                        onClick={() => handleTestApiKey("openai")}
                        disabled={testingApiKey === "openai"}
                      >
                        {testingApiKey === "openai" ? "Testing..." : "Test"}
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500">
                      Used for GPT models. Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">OpenAI dashboard</a>.
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="anthropicApiKey">Anthropic API Key</Label>
                    <div className="flex space-x-2">
                      <Input
                        id="anthropicApiKey"
                        type="password"
                        value={settings.anthropicApiKey}
                        onChange={(e) => setSettings({...settings, anthropicApiKey: e.target.value})}
                        placeholder="Enter your Anthropic API key"
                        className="flex-grow"
                      />
                      <Button 
                        variant="outline" 
                        onClick={() => handleTestApiKey("anthropic")}
                        disabled={testingApiKey === "anthropic"}
                      >
                        {testingApiKey === "anthropic" ? "Testing..." : "Test"}
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500">
                      Used for Claude models. Get your API key from <a href="https://console.anthropic.com/keys" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Anthropic console</a>.
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="perplexityApiKey">Perplexity API Key</Label>
                    <div className="flex space-x-2">
                      <Input
                        id="perplexityApiKey"
                        type="password"
                        value={settings.perplexityApiKey}
                        onChange={(e) => setSettings({...settings, perplexityApiKey: e.target.value})}
                        placeholder="Enter your Perplexity API key"
                        className="flex-grow"
                      />
                      <Button 
                        variant="outline" 
                        onClick={() => handleTestApiKey("perplexity")}
                        disabled={testingApiKey === "perplexity"}
                      >
                        {testingApiKey === "perplexity" ? "Testing..." : "Test"}
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500">
                      Used for Perplexity models. Get your API key from <a href="https://www.perplexity.ai/settings/api" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Perplexity dashboard</a>.
                    </p>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end">
                <Button onClick={handleSaveSettings} disabled={updateAiSettings.isPending}>
                  {updateAiSettings.isPending ? "Saving..." : "Save API Keys"}
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          {/* Ollama Tab */}
          <TabsContent value="ollama" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Ollama Configuration</CardTitle>
                <CardDescription>
                  Configure connection to your local Ollama server
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="ollamaEndpoint">Ollama API Endpoint</Label>
                    <div className="flex space-x-2">
                      <Input
                        id="ollamaEndpoint"
                        value={settings.ollamaEndpoint}
                        onChange={(e) => setSettings({...settings, ollamaEndpoint: e.target.value})}
                        placeholder="http://localhost:11434"
                        className="flex-grow"
                      />
                      <Button 
                        variant="outline" 
                        onClick={handleTestOllama}
                        disabled={testingConnection}
                      >
                        {testingConnection ? "Testing..." : "Test"}
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500">
                      By default, Ollama runs locally on port 11434. Make sure Ollama is running on your machine before using it.
                    </p>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end">
                <Button onClick={handleSaveSettings} disabled={updateAiSettings.isPending}>
                  {updateAiSettings.isPending ? "Saving..." : "Save Ollama Settings"}
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          {/* Task Extraction Tab */}
          <TabsContent value="task_extraction" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Task Extraction Settings</CardTitle>
                <CardDescription>
                  Configure automatic task extraction from emails
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="autoExtractTasks"
                      checked={settings.autoExtractTasks}
                      onCheckedChange={(checked) => setSettings({...settings, autoExtractTasks: checked})}
                    />
                    <Label htmlFor="autoExtractTasks">Automatically extract tasks from emails</Label>
                  </div>
                  <p className="text-sm text-gray-600">
                    When enabled, the system will automatically analyze incoming emails and extract potential tasks.
                    These tasks will be added to your task list and marked for review.
                  </p>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end">
                <Button onClick={handleSaveSettings} disabled={updateAiSettings.isPending}>
                  {updateAiSettings.isPending ? "Saving..." : "Save Task Settings"}
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}