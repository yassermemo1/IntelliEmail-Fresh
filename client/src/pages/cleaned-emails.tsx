import React, { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useEmailAccounts } from "@/hooks/useEmailAccounts";
import { useEmails } from "@/hooks/useEmails";
import EmailPreview from "@/components/EmailPreview";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

const CleanedEmails: React.FC = () => {
  const { toast } = useToast();
  const [selectedAccountId, setSelectedAccountId] = useState<number | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState<string>("");
  
  // Fetch data
  const { data: accounts, isLoading: isLoadingAccounts } = useEmailAccounts();
  // Use the enhanced useEmails hook to directly get cleaned emails from the server
  const { data: cleanedEmails, isLoading: isLoadingEmails } = useEmails(selectedAccountId, 50, 0, true, false);
  
  // Filter emails based on search query
  const filteredEmails = cleanedEmails?.filter(email => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      email.subject.toLowerCase().includes(query) ||
      email.sender.toLowerCase().includes(query) ||
      email.body.toLowerCase().includes(query)
    );
  });
  
  // Email operations
  const handleViewEmail = (id: number) => {
    window.location.href = `/emails/${id}`;
  };
  
  const handleOpenEmailMenu = (id: number) => {
    // This would normally open a dropdown menu
    console.log("Open menu for email", id);
  };
  
  const handleMarkAsRead = (id: number) => {
    // Mark email as read logic would go here
    console.log("Mark email as read", id);
  };
  
  return (
    <div className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Page header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Cleaned Emails</h2>
            <p className="mt-1 text-sm text-gray-500">View your processed and cleaned emails</p>
            <div className="mt-2 py-2 px-4 bg-green-50 text-green-700 rounded-md text-sm font-medium">
              All emails shown here have been cleaned to remove images, logos, and marketing content for better readability
            </div>
          </div>
          
          <div className="mt-4 md:mt-0">
            <Button 
              className="inline-flex items-center px-4 py-2"
              onClick={() => {
                toast({
                  title: "Cleaning more emails",
                  description: "Starting email cleanup process...",
                });
                
                fetch('/api/emails/clean-content', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' }
                })
                .then(response => {
                  if (response.ok) {
                    toast({
                      title: "Cleanup started",
                      description: "Email cleanup process has been started in the background.",
                    });
                  }
                })
                .catch(error => {
                  toast({
                    title: "Cleanup failed",
                    description: "Could not start email cleanup. Please try again.",
                    variant: "destructive"
                  });
                });
              }}
            >
              <span className="material-icons -ml-1 mr-2 text-lg">cleaning_services</span>
              Clean more emails
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
              {filteredEmails?.length || 0} Cleaned Emails
            </h3>
            <Link href="/emails">
              <span className="text-sm font-medium text-primary hover:text-primary/80 cursor-pointer">
                View all emails
              </span>
            </Link>
          </div>
          
          <div className="overflow-y-auto max-h-[calc(100vh-250px)] custom-scrollbar">
            {!selectedAccountId && accounts?.length ? (
              <div className="p-4 text-center text-gray-500">Please select an email account</div>
            ) : isLoadingEmails ? (
              <div className="p-4 text-center">Loading emails...</div>
            ) : filteredEmails?.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                {searchQuery
                  ? "No emails match your search"
                  : "No cleaned emails found."}
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
                    metadata={(() => {
                      if (!email.metadata) return null;
                      if (typeof email.metadata === 'object') return email.metadata;
                      try {
                        // Fix for double-quoted strings in the database
                        const cleanedMetadata = String(email.metadata).replace(/^"+|"+$/g, '');
                        return JSON.parse(cleanedMetadata);
                      } catch (e) {
                        console.log('Failed to parse metadata:', email.metadata);
                        return null;
                      }
                    })()}
                    tasksExtracted={1} // This would normally come from the backend
                    onView={handleViewEmail}
                    onOpenMenu={handleOpenEmailMenu}
                    showMetadata={true}
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

export default CleanedEmails;