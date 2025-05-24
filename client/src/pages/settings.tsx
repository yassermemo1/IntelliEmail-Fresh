import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { useEmailAccounts, useCreateEmailAccount, useUpdateEmailAccount, useDeleteEmailAccount } from "@/hooks/useEmailAccounts";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import AccountStatus from "@/components/AccountStatus";

const Settings: React.FC = () => {
  const { toast } = useToast();
  const [currentTab, setCurrentTab] = useState("accounts");
  const [newAccount, setNewAccount] = useState({
    accountType: "gmail",
    emailAddress: "",
    credentials: {
      username: "",
      password: ""
    }
  });
  const [aiSettings, setAiSettings] = useState({
    llmProvider: "ollama",
    llmModel: "llama3",
    embeddingModel: "nomic-embed-text",
    confidenceThreshold: 70,
    apiKeys: {
      openai: "",
      azure: ""
    }
  });
  
  // Fetch data
  const { data: accounts, isLoading: isLoadingAccounts } = useEmailAccounts();
  
  // Mutations
  const createAccountMutation = useCreateEmailAccount();
  const updateAccountMutation = useUpdateEmailAccount();
  const deleteAccountMutation = useDeleteEmailAccount();
  
  // Handle account form submission
  const handleAddAccount = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    if (!newAccount.emailAddress || !newAccount.credentials.username || !newAccount.credentials.password) {
      toast({
        title: "Validation error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }
    
    createAccountMutation.mutate(newAccount, {
      onSuccess: () => {
        toast({
          title: "Account added",
          description: `${newAccount.emailAddress} has been connected successfully.`,
        });
        
        // Reset form
        setNewAccount({
          accountType: "gmail",
          emailAddress: "",
          credentials: {
            username: "",
            password: ""
          }
        });
      },
      onError: (error) => {
        toast({
          title: "Error adding account",
          description: error.message,
          variant: "destructive"
        });
      }
    });
  };
  
  // Handle AI settings submission
  const handleSaveAiSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await apiRequest("PUT", "/api/ai-settings", aiSettings);
      const updatedSettings = await response.json();
      
      toast({
        title: "Settings saved",
        description: "AI settings have been updated successfully.",
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/ai-settings"] });
    } catch (error) {
      toast({
        title: "Error saving settings",
        description: (error as Error).message,
        variant: "destructive"
      });
    }
  };
  
  // Handle account deletion
  const handleDeleteAccount = (id: number) => {
    deleteAccountMutation.mutate(id, {
      onSuccess: () => {
        toast({
          title: "Account deleted",
          description: "Email account has been removed successfully.",
        });
      },
      onError: (error) => {
        toast({
          title: "Error deleting account",
          description: error.message,
          variant: "destructive"
        });
      }
    });
  };
  
  // Load AI settings on mount
  React.useEffect(() => {
    const fetchAiSettings = async () => {
      try {
        const response = await fetch("/api/ai-settings", {
          credentials: "include"
        });
        if (response.ok) {
          const data = await response.json();
          if (data) {
            setAiSettings({
              llmProvider: data.llmProvider,
              llmModel: data.llmModel,
              embeddingModel: data.embeddingModel,
              confidenceThreshold: data.confidenceThreshold,
              apiKeys: data.apiKeys || { openai: "", azure: "" }
            });
          }
        }
      } catch (error) {
        console.error("Error fetching AI settings:", error);
      }
    };
    
    fetchAiSettings();
  }, []);
  
  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Page header */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Settings</h2>
          <p className="mt-1 text-sm text-gray-500">Configure your email accounts, AI preferences, and application settings</p>
        </div>
        
        {/* Settings tabs */}
        <div className="mt-6">
          <Tabs defaultValue="accounts" onValueChange={setCurrentTab}>
            <TabsList>
              <TabsTrigger value="accounts">Email Accounts</TabsTrigger>
              <TabsTrigger value="ai">AI Settings</TabsTrigger>
              <TabsTrigger value="app">Application Settings</TabsTrigger>
            </TabsList>
            
            {/* Email Accounts Tab */}
            <TabsContent value="accounts" className="mt-4 space-y-6">
              {/* Connected Accounts */}
              <Card>
                <CardHeader>
                  <CardTitle>Connected Email Accounts</CardTitle>
                  <CardDescription>
                    Manage your connected email accounts for task extraction
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingAccounts ? (
                    <div className="text-center py-4">Loading accounts...</div>
                  ) : accounts?.length === 0 ? (
                    <div className="text-center py-4 text-gray-500">No email accounts connected</div>
                  ) : (
                    <div className="space-y-4">
                      {accounts?.map((account) => (
                        <div key={account.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <AccountStatus
                            type={account.accountType as "gmail" | "exchange"}
                            email={account.emailAddress}
                            isConnected={account.isActive}
                          />
                          <div className="flex space-x-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                updateAccountMutation.mutate({
                                  id: account.id,
                                  data: { isActive: !account.isActive }
                                });
                              }}
                            >
                              {account.isActive ? "Disable" : "Enable"}
                            </Button>
                            <Button 
                              variant="destructive" 
                              size="sm"
                              onClick={() => handleDeleteAccount(account.id)}
                            >
                              <span className="material-icons text-sm">delete</span>
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {/* Add New Account */}
              <Card>
                <CardHeader>
                  <CardTitle>Add New Email Account</CardTitle>
                  <CardDescription>
                    Connect a new email account to process and extract tasks
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleAddAccount} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="accountType">Account Type</Label>
                      <Select 
                        value={newAccount.accountType} 
                        onValueChange={(value) => setNewAccount({...newAccount, accountType: value})}
                      >
                        <SelectTrigger id="accountType">
                          <SelectValue placeholder="Select account type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gmail">Gmail (IMAP)</SelectItem>
                          <SelectItem value="exchange">Microsoft Exchange</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="emailAddress">Email Address</Label>
                      <Input 
                        id="emailAddress" 
                        type="email" 
                        placeholder="your.email@example.com"
                        value={newAccount.emailAddress}
                        onChange={(e) => setNewAccount({...newAccount, emailAddress: e.target.value})}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="username">Username</Label>
                      <Input 
                        id="username" 
                        placeholder="Username or email address"
                        value={newAccount.credentials.username}
                        onChange={(e) => setNewAccount({
                          ...newAccount, 
                          credentials: {...newAccount.credentials, username: e.target.value}
                        })}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="password">
                        {newAccount.accountType === "gmail" ? "App Password" : "Password"}
                      </Label>
                      <Input 
                        id="password" 
                        type="password" 
                        placeholder="Enter password"
                        value={newAccount.credentials.password}
                        onChange={(e) => setNewAccount({
                          ...newAccount, 
                          credentials: {...newAccount.credentials, password: e.target.value}
                        })}
                      />
                      {newAccount.accountType === "gmail" && (
                        <p className="text-xs text-gray-500 mt-1">
                          For Gmail, you need to use an App Password. <a href="https://support.google.com/accounts/answer/185833" target="_blank" className="text-primary hover:underline">Learn how</a>
                        </p>
                      )}
                    </div>
                    
                    <Button 
                      type="submit" 
                      className="mt-4"
                      disabled={createAccountMutation.isPending}
                    >
                      {createAccountMutation.isPending ? (
                        <>
                          <span className="material-icons animate-spin mr-2">autorenew</span>
                          Connecting...
                        </>
                      ) : (
                        <>
                          <span className="material-icons mr-2">add</span>
                          Connect Account
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* AI Settings Tab */}
            <TabsContent value="ai" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>AI Configuration</CardTitle>
                  <CardDescription>
                    Configure the AI models and settings for task extraction
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSaveAiSettings} className="space-y-6">
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="llmProvider">LLM Provider</Label>
                        <Select 
                          value={aiSettings.llmProvider} 
                          onValueChange={(value) => setAiSettings({...aiSettings, llmProvider: value})}
                        >
                          <SelectTrigger id="llmProvider" className="mt-1">
                            <SelectValue placeholder="Select LLM provider" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ollama">Ollama (Local)</SelectItem>
                            <SelectItem value="openai">OpenAI</SelectItem>
                            <SelectItem value="azure_openai">Azure OpenAI</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label htmlFor="llmModel">LLM Model</Label>
                        <Select 
                          value={aiSettings.llmModel} 
                          onValueChange={(value) => setAiSettings({...aiSettings, llmModel: value})}
                        >
                          <SelectTrigger id="llmModel" className="mt-1">
                            <SelectValue placeholder="Select LLM model" />
                          </SelectTrigger>
                          <SelectContent>
                            {aiSettings.llmProvider === "ollama" ? (
                              <>
                                <SelectItem value="llama3">Llama 3</SelectItem>
                                <SelectItem value="mistral">Mistral</SelectItem>
                                <SelectItem value="gemma">Gemma</SelectItem>
                              </>
                            ) : aiSettings.llmProvider === "openai" ? (
                              <>
                                <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                                <SelectItem value="gpt-4">GPT-4</SelectItem>
                                <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                              </>
                            ) : (
                              <>
                                <SelectItem value="gpt-35-turbo">Azure GPT-3.5 Turbo</SelectItem>
                                <SelectItem value="gpt-4">Azure GPT-4</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label htmlFor="embeddingModel">Embedding Model</Label>
                        <Select 
                          value={aiSettings.embeddingModel} 
                          onValueChange={(value) => setAiSettings({...aiSettings, embeddingModel: value})}
                        >
                          <SelectTrigger id="embeddingModel" className="mt-1">
                            <SelectValue placeholder="Select embedding model" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="nomic-embed-text">Nomic Embed</SelectItem>
                            <SelectItem value="openai-ada">OpenAI Ada</SelectItem>
                            <SelectItem value="azure-ada">Azure Ada</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {(aiSettings.llmProvider === "openai" || aiSettings.llmProvider === "azure_openai") && (
                        <div>
                          <Label htmlFor="apiKey">
                            {aiSettings.llmProvider === "openai" ? "OpenAI API Key" : "Azure OpenAI API Key"}
                          </Label>
                          <Input 
                            id="apiKey" 
                            type="password" 
                            placeholder="Enter API key"
                            value={aiSettings.llmProvider === "openai" ? aiSettings.apiKeys.openai : aiSettings.apiKeys.azure}
                            onChange={(e) => {
                              const newApiKeys = {...aiSettings.apiKeys};
                              if (aiSettings.llmProvider === "openai") {
                                newApiKeys.openai = e.target.value;
                              } else {
                                newApiKeys.azure = e.target.value;
                              }
                              setAiSettings({...aiSettings, apiKeys: newApiKeys});
                            }}
                            className="mt-1"
                          />
                        </div>
                      )}
                      
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <Label htmlFor="confidenceThreshold">Confidence Threshold: {aiSettings.confidenceThreshold}%</Label>
                        </div>
                        <Slider
                          id="confidenceThreshold"
                          min={0}
                          max={100}
                          step={1}
                          value={[aiSettings.confidenceThreshold]}
                          onValueChange={(value) => setAiSettings({...aiSettings, confidenceThreshold: value[0]})}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Tasks with confidence below this threshold will be sent for human review
                        </p>
                      </div>
                    </div>
                    
                    <Button type="submit">Save AI Settings</Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Application Settings Tab */}
            <TabsContent value="app" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Application Settings</CardTitle>
                  <CardDescription>
                    Configure general application preferences
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="darkMode">Dark Mode</Label>
                        <p className="text-sm text-gray-500">Enable dark mode for the application</p>
                      </div>
                      <Switch id="darkMode" />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="notifications">Email Notifications</Label>
                        <p className="text-sm text-gray-500">Receive notifications when new emails arrive</p>
                      </div>
                      <Switch id="notifications" defaultChecked />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="autoSync">Auto-Sync Interval</Label>
                        <p className="text-sm text-gray-500">Set how often emails are synchronized</p>
                      </div>
                      <Select defaultValue="15">
                        <SelectTrigger id="autoSync" className="w-[180px]">
                          <SelectValue placeholder="Select interval" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5">Every 5 minutes</SelectItem>
                          <SelectItem value="15">Every 15 minutes</SelectItem>
                          <SelectItem value="30">Every 30 minutes</SelectItem>
                          <SelectItem value="60">Every hour</SelectItem>
                          <SelectItem value="manual">Manual only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <Button>Save Application Settings</Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Settings;
