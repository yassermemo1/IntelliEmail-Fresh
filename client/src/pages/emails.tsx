import React, { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import EmailPreview from "@/components/EmailPreview";
import { useEmails, useUpdateEmail } from "@/hooks/useEmails";
import { useEmailAccounts } from "@/hooks/useEmailAccounts";
import { useToast } from "@/hooks/use-toast";

const Emails: React.FC = () => {
  const { toast } = useToast();
  const [selectedAccountId, setSelectedAccountId] = useState<number | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Fetch data
  const { data: accounts, isLoading: isLoadingAccounts } = useEmailAccounts();
  const { data: emails, isLoading: isLoadingEmails } = useEmails(selectedAccountId);
  
  // Set first account as default if not already set
  React.useEffect(() => {
    if (accounts?.length && !selectedAccountId) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId]);
  
  // Mutations
  const updateEmailMutation = useUpdateEmail();
  
  // Filter emails based on search query
  const filteredEmails = emails?.filter(email => {
    return !searchQuery || 
      email.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.sender.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.body.toLowerCase().includes(searchQuery.toLowerCase());
  });
  
  // Email operations
  const handleViewEmail = (id: number) => {
    // Navigate to the email detail page with the correct URL format
    window.location.href = `/emails/${id}`;
  };
  
  const handleMarkAsRead = (id: number) => {
    updateEmailMutation.mutate({
      id,
      data: { isRead: true }
    }, {
      onSuccess: () => {
        toast({
          title: "Email updated",
          description: "Email marked as read.",
        });
      }
    });
  };
  
  const handleArchiveEmail = (id: number) => {
    updateEmailMutation.mutate({
      id,
      data: { isArchived: true }
    }, {
      onSuccess: () => {
        toast({
          title: "Email archived",
          description: "Email has been archived.",
        });
      }
    });
  };
  
  const handleOpenEmailMenu = (id: number) => {
    // This would normally open a dropdown menu with more options
    handleMarkAsRead(id);
  };
  
  return (
    <div className="py-4 sm:py-6">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 md:px-6 lg:px-8">
        {/* Page header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Emails</h2>
            <p className="mt-1 text-sm text-gray-500">View and manage your processed emails</p>
          </div>
          
          <div className="mt-4 md:mt-0">
            <Button 
              className="inline-flex items-center px-4 py-2"
              onClick={() => {
                toast({
                  title: "Syncing emails",
                  description: "Starting email synchronization...",
                });
              }}
            >
              <span className="material-icons -ml-1 mr-2 text-lg">refresh</span>
              Sync now
            </Button>
          </div>
        </div>
        
        {/* Filters */}
        <div className="mt-6 flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
          <Select 
            onValueChange={(value) => setSelectedAccountId(Number(value))} 
            value={selectedAccountId?.toString()}
          >
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue placeholder="Select account" />
            </SelectTrigger>
            <SelectContent>
              {isLoadingAccounts ? (
                <SelectItem value="loading" disabled>Loading accounts...</SelectItem>
              ) : accounts?.length === 0 ? (
                <SelectItem value="none" disabled>No accounts found</SelectItem>
              ) : (
                accounts?.map(account => (
                  <SelectItem key={account.id} value={account.id.toString()}>
                    {account.emailAddress} ({account.accountType})
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          
          <div className="relative flex-1">
            <Input
              type="text"
              placeholder="Search emails..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>
        </div>
        
        {/* Email list */}
        <div className="mt-6 bg-white shadow rounded-lg">
          <div className="px-4 py-5 border-b border-gray-200 sm:px-6 flex items-center justify-between">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              {filteredEmails?.length || 0} Processed Emails
            </h3>
          </div>
          
          <div className="overflow-y-auto max-h-[calc(100vh-250px)] custom-scrollbar">
            {!selectedAccountId ? (
              <div className="p-4 text-center text-gray-500">Please select an email account</div>
            ) : isLoadingEmails ? (
              <div className="p-4 text-center">Loading emails...</div>
            ) : filteredEmails?.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                {searchQuery
                  ? "No emails match your search"
                  : "No emails found. Sync your account to load emails."}
              </div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {filteredEmails?.map((email) => (
                  <EmailPreview
                    key={email.id}
                    id={email.id}
                    subject={email.subject}
                    sender={email.sender}
                    timestamp={new Date(email.timestamp)}
                    body={email.body}
                    tasksExtracted={1} // This would normally come from the backend
                    onView={handleViewEmail}
                    onOpenMenu={handleOpenEmailMenu}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Emails;
