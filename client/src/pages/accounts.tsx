import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useEmailAccounts } from "@/hooks/useEmailAccounts";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import AddAccountModal from "@/components/AddAccountModal";
import { queryClient } from "@/lib/queryClient";

const AccountsPage: React.FC = () => {
  const { toast } = useToast();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const { data: accounts, isLoading, error } = useEmailAccounts();
  
  // Check URL parameters for OAuth callbacks
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const accountAdded = urlParams.get('accountAdded');
    const email = urlParams.get('email');
    const oauthError = urlParams.get('error');
    
    if (accountAdded === 'true' && email) {
      toast({
        title: "Account connected!",
        description: `${email} was successfully connected via OAuth.`,
      });
      
      // Clear URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Refresh email accounts list
      queryClient.invalidateQueries({ queryKey: ['/api/email-accounts'] });
    } else if (oauthError) {
      toast({
        title: "OAuth connection failed",
        description: "There was a problem connecting your account. Please try again.",
        variant: "destructive"
      });
      
      // Clear URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [toast]);
  
  const handleSyncAccount = async (accountId: number) => {
    try {
      const response = await fetch(`/api/email-accounts/${accountId}/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ limit: 100 })
      });
      
      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Sync successful",
          description: `${data.emailsProcessed} new emails processed.`
        });
        
        // Refresh accounts to update last synced time
        queryClient.invalidateQueries({ queryKey: ['/api/email-accounts'] });
      } else {
        const error = await response.json();
        throw new Error(error.error || "Failed to sync account");
      }
    } catch (error) {
      toast({
        title: "Sync failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
    }
  };
  
  const handleDeleteAccount = async (accountId: number) => {
    if (!confirm("Are you sure you want to delete this account? This will remove all associated emails and tasks.")) {
      return;
    }
    
    try {
      const response = await fetch(`/api/email-accounts/${accountId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        toast({
          title: "Account deleted",
          description: "Email account was successfully removed."
        });
        
        // Refresh accounts list
        queryClient.invalidateQueries({ queryKey: ['/api/email-accounts'] });
      } else {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete account");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
    }
  };
  
  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Email Accounts</h2>
            <p className="mt-1 text-sm text-gray-500">Manage your connected email accounts and synchronization settings</p>
          </div>
          <Button onClick={() => setIsAddModalOpen(true)}>
            <span className="material-icons mr-2">add</span>
            Add Account
          </Button>
        </div>
        
        {/* Email accounts section */}
        <div className="mt-6 space-y-6">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin material-icons text-4xl text-primary mb-2">sync</div>
              <p>Loading accounts...</p>
            </div>
          ) : error ? (
            <Card className="bg-red-50 border-red-200">
              <CardContent className="pt-6">
                <div className="flex items-center text-red-600">
                  <span className="material-icons mr-2">error</span>
                  <p>Error loading accounts: {error instanceof Error ? error.message : "Unknown error"}</p>
                </div>
              </CardContent>
            </Card>
          ) : accounts?.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <span className="material-icons text-4xl text-gray-400 mb-2">mail</span>
                  <h3 className="text-lg font-medium text-gray-900">No email accounts connected</h3>
                  <p className="text-gray-500 mt-1">Add your first email account to start managing tasks</p>
                  <Button className="mt-4" onClick={() => setIsAddModalOpen(true)}>
                    <span className="material-icons mr-2">add</span>
                    Add Email Account
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {accounts?.map(account => (
                <Card key={account.id} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="flex items-center">
                          <span className={`material-icons mr-2 ${account.accountType === 'gmail' ? 'text-red-500' : 'text-blue-500'}`}>
                            {account.accountType === 'gmail' ? 'mail' : 'inbox'}
                          </span>
                          {account.displayName || account.emailAddress}
                        </CardTitle>
                        <CardDescription>{account.emailAddress}</CardDescription>
                      </div>
                      <Badge variant={account.isActive ? "default" : "outline"}>
                        {account.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <Separator />
                  <CardContent className="pt-4">
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Account type:</span>
                        <span className="font-medium capitalize">{account.accountType}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Auth method:</span>
                        <span className="font-medium capitalize">{account.authMethod?.replace('_', ' ') || 'App password'}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Last synced:</span>
                        <span className="font-medium">
                          {account.lastSynced 
                            ? formatDistanceToNow(new Date(account.lastSynced), { addSuffix: true }) 
                            : 'Never'}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Sync enabled:</span>
                        <span className={`font-medium ${account.syncEnabled ? 'text-green-600' : 'text-red-600'}`}>
                          {account.syncEnabled ? 'Yes' : 'No'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex space-x-2 mt-4">
                      <Button 
                        size="sm" 
                        className="flex-1"
                        onClick={() => handleSyncAccount(account.id)}
                      >
                        <span className="material-icons text-sm mr-1">sync</span>
                        Sync Now
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={() => handleDeleteAccount(account.id)}
                      >
                        <span className="material-icons text-sm">delete</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Add account modal */}
      <AddAccountModal 
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />
    </div>
  );
};

export default AccountsPage;