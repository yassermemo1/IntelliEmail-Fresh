import React from 'react';
import { Badge } from "@/components/ui/badge";

interface AccountStatusProps {
  type: 'gmail' | 'exchange';
  email: string;
  isConnected: boolean;
}

const AccountStatus: React.FC<AccountStatusProps> = ({ type, email, isConnected }) => {
  return (
    <div className="flex items-center">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${type === 'gmail' ? 'bg-red-100' : 'bg-blue-100'} mr-3`}>
        <span className={`material-icons ${type === 'gmail' ? 'text-red-500' : 'text-blue-500'}`}>
          {type === 'gmail' ? 'mail' : 'inbox'}
        </span>
      </div>
      <div>
        <div className="font-medium flex items-center">
          {email}
          {isConnected ? (
            <div className="ml-2 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
              <span className="material-icons text-xs mr-1">check_circle</span>
              Active
            </div>
          ) : (
            <div className="ml-2 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
              <span className="material-icons text-xs mr-1">error</span>
              Inactive
            </div>
          )}
        </div>
        <div className="text-xs text-gray-500">
          {type === 'gmail' ? 'Gmail' : 'Microsoft Exchange'}
        </div>
      </div>
    </div>
  );
};

export default AccountStatus;