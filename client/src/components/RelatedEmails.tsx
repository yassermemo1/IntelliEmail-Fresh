import React, { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface RelatedEmail {
  id: number;
  subject: string;
  sender: string;
  timestamp: string;
}

interface RelatedEmailsProps {
  emailId: number;
}

const RelatedEmails: React.FC<RelatedEmailsProps> = ({ emailId }) => {
  const [relatedEmails, setRelatedEmails] = useState<RelatedEmail[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchRelatedEmails = async () => {
      if (!emailId) return;
      
      setIsLoading(true);
      try {
        const response = await fetch(`/api/emails/${emailId}/related`);
        if (!response.ok) {
          throw new Error('Failed to fetch related emails');
        }
        const data = await response.json();
        setRelatedEmails(data);
      } catch (error) {
        console.error('Error fetching related emails:', error);
        toast({
          title: 'Error',
          description: 'Could not load related emails.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchRelatedEmails();
  }, [emailId, toast]);

  if (isLoading) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Related Emails</h3>
        <div className="animate-pulse flex flex-col space-y-2">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (relatedEmails.length === 0) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Related Emails</h3>
        <p className="text-sm text-gray-500">No related emails found.</p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-50 rounded-lg">
      <h3 className="text-sm font-medium text-gray-700 mb-3">
        <span className="flex items-center">
          <span className="material-icons text-sm mr-1">link</span>
          Related Emails ({relatedEmails.length})
        </span>
      </h3>
      <ul className="space-y-2">
        {relatedEmails.map((email) => (
          <li key={email.id} className="text-sm">
            <a 
              href={`/emails/${email.id}`} 
              className="block p-2 hover:bg-gray-100 rounded transition-colors duration-150"
            >
              <div className="font-medium text-gray-800 truncate">{email.subject}</div>
              <div className="text-gray-600 text-xs flex justify-between mt-1">
                <span>{email.sender}</span>
                <span>{formatDistanceToNow(new Date(email.timestamp), { addSuffix: true })}</span>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default RelatedEmails;