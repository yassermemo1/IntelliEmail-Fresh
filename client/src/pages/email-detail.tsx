import React, { useState, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import EmailPreview from "@/components/EmailPreview";
import { EmailCleanerButton } from "@/components/EmailCleanerButton";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

interface Email {
  id: number;
  accountId: number;
  messageId: string;
  sender: string;
  recipients: string[];
  subject: string;
  body: string;
  bodyHtml: string | null;
  threadId: string | null;
  timestamp: Date;
  isRead: boolean;
  isArchived: boolean;
  isStarred: boolean;
  isDeleted: boolean;
  hasAttachments: boolean;
  categories: string[] | null;
  embedding: number[] | null;
  createdAt: Date;
  updatedAt: Date;
}

const EmailDetail: React.FC = () => {
  const { toast } = useToast();
  const [, params] = useRoute<{ id: string }>("/emails/:id");
  const [, relatedParams] = useRoute<{ id: string }>("/emails/:id/related");
  
  // Get the ID from either route
  const emailId = params?.id || relatedParams?.id || "";
  
  const [email, setEmail] = useState<Email | null>(null);
  const [relatedEmails, setRelatedEmails] = useState<Email[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRelatedLoading, setIsRelatedLoading] = useState(true);

  useEffect(() => {
    if (!emailId) return;
    
    // Fetch the email details
    setIsLoading(true);
    fetch(`/api/emails/${emailId}`)
      .then(response => response.json())
      .then(data => {
        setEmail(data);
        setIsLoading(false);
      })
      .catch(error => {
        console.error("Error fetching email:", error);
        toast({
          title: "Error",
          description: "Failed to load email details.",
          variant: "destructive"
        });
        setIsLoading(false);
      });
    
    // Fetch related emails
    setIsRelatedLoading(true);
    fetch(`/api/emails/${emailId}/related`)
      .then(response => response.json())
      .then(data => {
        setRelatedEmails(data);
        setIsRelatedLoading(false);
      })
      .catch(error => {
        console.error("Error fetching related emails:", error);
        toast({
          title: "Error",
          description: "Failed to load related emails.",
          variant: "destructive"
        });
        setIsRelatedLoading(false);
      });
  }, [emailId, toast]);

  const handleExtractTasks = () => {
    toast({
      title: "Extracting tasks",
      description: "Analyzing email to extract tasks...",
    });
    
    fetch(`/api/emails/${emailId}/extract-tasks`, {
      method: 'POST'
    })
      .then(response => response.json())
      .then(data => {
        toast({
          title: "Tasks extracted",
          description: `Successfully extracted ${data.length} tasks from this email.`,
        });
        // Invalidate tasks cache
        queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      })
      .catch(error => {
        console.error("Error extracting tasks:", error);
        toast({
          title: "Extraction failed",
          description: "Failed to extract tasks from this email.",
          variant: "destructive"
        });
      });
  };

  const handleViewEmail = (id: number) => {
    window.location.href = `/emails/${id}`;
  };
  
  const handleOpenEmailMenu = (id: number) => {
    console.log("Open menu for email", id);
  };

  if (isLoading) {
    return (
      <div className="py-6">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center mb-6">
            <Link href="/emails">
              <Button variant="ghost" size="sm" className="mr-2">
                <span className="material-icons mr-1">arrow_back</span>
                Back to emails
              </Button>
            </Link>
          </div>
          <div className="bg-white shadow rounded-lg p-6 flex justify-center items-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-gray-500">Loading email...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!email) {
    return (
      <div className="py-6">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center mb-6">
            <Link href="/emails">
              <Button variant="ghost" size="sm" className="mr-2">
                <span className="material-icons mr-1">arrow_back</span>
                Back to emails
              </Button>
            </Link>
          </div>
          <div className="bg-white shadow rounded-lg p-6">
            <div className="text-center">
              <span className="material-icons text-gray-400 text-6xl mb-4">error_outline</span>
              <h3 className="text-lg font-medium text-gray-900">Email not found</h3>
              <p className="text-gray-500 mt-1">The email you're looking for doesn't exist or has been deleted.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-6">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Email header */}
        <div className="flex items-center mb-6">
          <Link href="/emails">
            <Button variant="ghost" size="sm" className="mr-2">
              <span className="material-icons mr-1">arrow_back</span>
              Back to emails
            </Button>
          </Link>
          <div className="ml-auto flex space-x-2">
            <EmailCleanerButton 
              emailId={parseInt(emailId, 10)} 
              onSuccess={() => {
                // Reload the email to show cleaned content
                fetch(`/api/emails/${emailId}`)
                  .then(response => response.json())
                  .then(data => {
                    setEmail(data);
                  });
              }} 
            />
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleExtractTasks}
            >
              <span className="material-icons mr-1">task_alt</span>
              Extract Tasks
            </Button>
          </div>
        </div>
        
        {/* Email content */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex justify-between items-start mb-2">
              <CardTitle className="text-xl">{email.subject}</CardTitle>
              <Badge variant={email.hasAttachments ? "default" : "outline"}>
                {email.hasAttachments ? "Has attachments" : "No attachments"}
              </Badge>
            </div>
            <CardDescription>
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-medium">{email.sender}</div>
                  <div className="text-gray-500 text-xs">
                    To: {email.recipients.join(", ")}
                  </div>
                </div>
                <div className="text-sm text-gray-500">
                  {format(new Date(email.timestamp), "MMM d, yyyy 'at' h:mm a")}
                </div>
              </div>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Separator className="mb-4" />
            <div className="prose max-w-none">
              {email.bodyHtml ? (
                <div dangerouslySetInnerHTML={{ __html: email.bodyHtml }} />
              ) : (
                <pre className="whitespace-pre-wrap text-sm">{email.body}</pre>
              )}
            </div>
          </CardContent>
        </Card>
        
        {/* Related emails */}
        <div className="mt-8">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Related Emails</h3>
          {isRelatedLoading ? (
            <div className="bg-white shadow rounded-lg p-6 flex justify-center items-center h-32">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mx-auto mb-2"></div>
                <p className="text-gray-500 text-sm">Loading related emails...</p>
              </div>
            </div>
          ) : relatedEmails.length > 0 ? (
            <div className="bg-white shadow rounded-lg">
              <ul className="divide-y divide-gray-200">
                {relatedEmails.map(relatedEmail => (
                  <EmailPreview
                    key={relatedEmail.id}
                    id={relatedEmail.id}
                    subject={relatedEmail.subject}
                    sender={relatedEmail.sender}
                    timestamp={new Date(relatedEmail.timestamp)}
                    body={relatedEmail.body}
                    tasksExtracted={0}
                    onView={handleViewEmail}
                    onOpenMenu={handleOpenEmailMenu}
                  />
                ))}
              </ul>
            </div>
          ) : (
            <div className="bg-white shadow rounded-lg p-6">
              <div className="text-center">
                <span className="material-icons text-gray-400 text-3xl mb-2">mail</span>
                <p className="text-gray-500">No related emails found</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmailDetail;