import React from "react";

interface AIInsightProps {
  icon: string;
  iconColor: string;
  bgColor: string;
  title: string;
  description: string;
}

const AIInsight: React.FC<AIInsightProps> = ({
  icon,
  iconColor,
  bgColor,
  title,
  description,
}) => {
  return (
    <div className={`p-4 ${bgColor} rounded-lg`}>
      <div className="flex">
        <div className="flex-shrink-0">
          <span className={`material-icons ${iconColor}`}>{icon}</span>
        </div>
        <div className="ml-3">
          <h4 className="text-sm font-medium text-gray-900">{title}</h4>
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        </div>
      </div>
    </div>
  );
};

export default AIInsight;
