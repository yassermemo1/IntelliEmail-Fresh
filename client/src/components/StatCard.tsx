import React from "react";
import { Link } from "wouter";

interface StatCardProps {
  title: string;
  value: number | string;
  change?: number;
  icon: string;
  iconColor: string;
  iconBgColor: string;
  linkTo?: string;
  onClick?: () => void;
  detailText?: string;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  change,
  icon,
  iconColor,
  iconBgColor,
  linkTo,
  onClick,
  detailText = "View details",
}) => {
  // If we have both linkTo and onClick, prefer linkTo
  const handleClick = onClick && !linkTo ? onClick : undefined;

  const CardContent = () => {
    // Format large numbers with commas for better readability
    const formattedValue = typeof value === 'number' && value > 999 
      ? value.toLocaleString() 
      : value;
      
    return (
      <div className="p-3 sm:p-4 md:p-6">
        <div className="flex flex-col space-y-3">
          <div className="flex items-center justify-between">
            <div className={`flex-shrink-0 ${iconBgColor} rounded-lg p-2.5`}>
              <span className={`material-icons ${iconColor} text-lg`}>{icon}</span>
            </div>
            {change !== undefined && (
              <div className={`flex items-center text-sm font-medium ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                <span className="material-icons text-sm mr-1">{change >= 0 ? 'trending_up' : 'trending_down'}</span>
                {Math.abs(change)}%
              </div>
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
            <p className="text-2xl sm:text-3xl font-bold text-gray-900">{formattedValue}</p>
          </div>
        </div>
        
        {(linkTo || onClick) && (
          <div className="mt-3 pt-2 border-t border-gray-100">
            <div className="text-xs sm:text-sm font-medium text-primary hover:text-primary/80 flex items-center">
              <span className="truncate">{detailText}</span>
              <span className="material-icons text-xs sm:text-sm ml-1 flex-shrink-0">arrow_forward</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (linkTo) {
    return (
      <Link href={linkTo}>
        <div className="block bg-white overflow-hidden shadow-sm border border-gray-100 rounded-xl hover:shadow-md transition-shadow cursor-pointer">
          <CardContent />
        </div>
      </Link>
    );
  }

  return (
    <div 
      className={`bg-white overflow-hidden shadow-sm border border-gray-100 rounded-xl ${(onClick) ? 'hover:shadow-md transition-shadow cursor-pointer' : ''}`}
      onClick={handleClick}
    >
      <CardContent />
    </div>
  );
};

export default StatCard;
