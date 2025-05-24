import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useEmailCleaner } from '@/hooks/useEmailCleaner';
import { Loader2 } from 'lucide-react';

interface EmailCleanerButtonProps {
  emailId: number;
  onSuccess?: () => void;
}

export function EmailCleanerButton({ emailId, onSuccess }: EmailCleanerButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { cleanSingleEmail } = useEmailCleaner();
  
  const handleCleanClick = async () => {
    setIsLoading(true);
    try {
      const success = await cleanSingleEmail(emailId);
      if (success && onSuccess) {
        onSuccess();
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCleanClick}
      disabled={isLoading}
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Cleaning...
        </>
      ) : (
        'Clean Email'
      )}
    </Button>
  );
}