import React, { useState } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCreateEmailAccount } from "@/hooks/useEmailAccounts";

interface AddAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AddAccountModal({ isOpen, onClose }: AddAccountModalProps) {
  const { toast } = useToast();
  const [accountTab, setAccountTab] = useState("gmail");
  const [gmailAuthMethod, setGmailAuthMethod] = useState("app_password");
  const [exchangeAuthMethod, setExchangeAuthMethod] = useState("basic");
  
  // Form state
  const [gmailForm, setGmailForm] = useState({
    emailAddress: "",
    appPassword: "",
    displayName: ""
  });
  
  const [exchangeForm, setExchangeForm] = useState({
    emailAddress: "",
    username: "",
    password: "",
    serverUrl: "",
    displayName: ""
  });
  
  const createAccountMutation = useCreateEmailAccount();
  
  // Handle Gmail OAuth connection
  const handleGmailOAuth = async () => {
    try {
      const response = await fetch('/api/oauth/gmail/url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ emailAddress: gmailForm.emailAddress })
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate OAuth URL');
      }
      
      const { url } = await response.json();
      
      // Close the modal before redirecting
      onClose();
      
      // Redirect to Google OAuth page
      window.location.href = url;
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start OAuth flow",
        variant: "destructive"
      });
    }
  };
  
  // Handle Gmail App Password connection
  const handleAddGmailAccount = async () => {
    if (!gmailForm.emailAddress || (gmailAuthMethod === "app_password" && !gmailForm.appPassword)) {
      toast({
        title: "Missing information",
        description: "Please fill all required fields",
        variant: "destructive"
      });
      return;
    }
    
    try {
      if (gmailAuthMethod === "oauth") {
        await handleGmailOAuth();
        return;
      }
      
      // Add account with app password
      createAccountMutation.mutate({
        accountType: "gmail",
        authMethod: "app_password",
        emailAddress: gmailForm.emailAddress,
        displayName: gmailForm.displayName || gmailForm.emailAddress,
        credentials: {
          appPassword: gmailForm.appPassword
        }
      }, {
        onSuccess: () => {
          toast({
            title: "Account added",
            description: `${gmailForm.emailAddress} was successfully connected.`
          });
          
          // Reset form and close modal
          setGmailForm({
            emailAddress: "",
            appPassword: "",
            displayName: ""
          });
          onClose();
        },
        onError: (error) => {
          toast({
            title: "Error",
            description: error instanceof Error ? error.message : "Failed to add account",
            variant: "destructive"
          });
        }
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
    }
  };
  
  // Handle Exchange/EWS account connection
  const handleAddExchangeAccount = async () => {
    if (!exchangeForm.emailAddress || !exchangeForm.username || !exchangeForm.password || !exchangeForm.serverUrl) {
      toast({
        title: "Missing information",
        description: "Please fill all required fields for Exchange account",
        variant: "destructive"
      });
      return;
    }
    
    try {
      createAccountMutation.mutate({
        accountType: "exchange",
        authMethod: exchangeAuthMethod,
        emailAddress: exchangeForm.emailAddress,
        displayName: exchangeForm.displayName || exchangeForm.emailAddress,
        credentials: {
          username: exchangeForm.username,
          password: exchangeForm.password,
          serverUrl: exchangeForm.serverUrl
        }
      }, {
        onSuccess: () => {
          toast({
            title: "Account added",
            description: `${exchangeForm.emailAddress} was successfully connected.`
          });
          
          // Reset form and close modal
          setExchangeForm({
            emailAddress: "",
            username: "",
            password: "",
            serverUrl: "",
            displayName: ""
          });
          onClose();
        },
        onError: (error) => {
          toast({
            title: "Error",
            description: error instanceof Error ? error.message : "Failed to add Exchange account",
            variant: "destructive"
          });
        }
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Add Email Account</DialogTitle>
          <DialogDescription>
            Connect your email account to start processing tasks
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="gmail" value={accountTab} onValueChange={setAccountTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="gmail">Gmail</TabsTrigger>
            <TabsTrigger value="exchange">Exchange / Office 365</TabsTrigger>
          </TabsList>
          
          {/* Gmail Tab */}
          <TabsContent value="gmail">
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="gmail-email">Email Address</Label>
                <Input 
                  id="gmail-email" 
                  type="email" 
                  placeholder="your.email@gmail.com"
                  value={gmailForm.emailAddress}
                  onChange={(e) => setGmailForm({...gmailForm, emailAddress: e.target.value})}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="gmail-display-name">Display Name (Optional)</Label>
                <Input 
                  id="gmail-display-name" 
                  placeholder="Work Email, Personal, etc."
                  value={gmailForm.displayName}
                  onChange={(e) => setGmailForm({...gmailForm, displayName: e.target.value})}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gmail-auth-method">Authentication Method</Label>
                  <Select 
                    value={gmailAuthMethod}
                    onValueChange={setGmailAuthMethod}
                  >
                    <SelectTrigger id="gmail-auth-method">
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="app_password">App Password</SelectItem>
                      <SelectItem value="oauth">Google OAuth</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="gmail-app-password">App Password</Label>
                  <Input 
                    id="gmail-app-password" 
                    type="password"
                    placeholder={gmailAuthMethod === "oauth" ? "Not required for OAuth" : "16-character app password"}
                    value={gmailForm.appPassword}
                    onChange={(e) => setGmailForm({...gmailForm, appPassword: e.target.value})}
                    disabled={gmailAuthMethod === "oauth"}
                  />
                </div>
              </div>
              
              {gmailAuthMethod === "app_password" && (
                <div className="text-sm mt-2">
                  <a 
                    href="https://support.google.com/accounts/answer/185833" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    How to generate an App Password for Gmail
                  </a>
                </div>
              )}
              
              {gmailAuthMethod === "oauth" && (
                <div className="text-sm mt-2">
                  <p className="text-gray-500">
                    You'll be redirected to Google to authorize access to your emails.
                  </p>
                </div>
              )}
            </div>
            
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button 
                type="button" 
                onClick={handleAddGmailAccount}
                disabled={createAccountMutation.isPending}
              >
                {createAccountMutation.isPending ? "Connecting..." : "Connect Gmail Account"}
              </Button>
            </DialogFooter>
          </TabsContent>
          
          {/* Exchange Tab */}
          <TabsContent value="exchange">
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="exchange-email">Email Address</Label>
                <Input 
                  id="exchange-email" 
                  type="email" 
                  placeholder="your.email@company.com"
                  value={exchangeForm.emailAddress}
                  onChange={(e) => setExchangeForm({...exchangeForm, emailAddress: e.target.value})}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="exchange-display-name">Display Name (Optional)</Label>
                <Input 
                  id="exchange-display-name" 
                  placeholder="Work Email, Company, etc."
                  value={exchangeForm.displayName}
                  onChange={(e) => setExchangeForm({...exchangeForm, displayName: e.target.value})}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="exchange-server-url">Exchange Server URL</Label>
                <Input 
                  id="exchange-server-url" 
                  placeholder="https://outlook.office365.com/EWS/Exchange.asmx"
                  value={exchangeForm.serverUrl}
                  onChange={(e) => setExchangeForm({...exchangeForm, serverUrl: e.target.value})}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="exchange-username">Username</Label>
                  <Input 
                    id="exchange-username" 
                    placeholder="Domain\\username or email"
                    value={exchangeForm.username}
                    onChange={(e) => setExchangeForm({...exchangeForm, username: e.target.value})}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="exchange-password">Password</Label>
                  <Input 
                    id="exchange-password" 
                    type="password"
                    placeholder="Exchange password"
                    value={exchangeForm.password}
                    onChange={(e) => setExchangeForm({...exchangeForm, password: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="text-sm mt-2">
                <p className="text-gray-500">
                  Contact your IT department if you're unsure about any of these details.
                </p>
              </div>
            </div>
            
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button 
                type="button" 
                onClick={handleAddExchangeAccount}
                disabled={createAccountMutation.isPending}
              >
                {createAccountMutation.isPending ? "Connecting..." : "Connect Exchange Account"}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}