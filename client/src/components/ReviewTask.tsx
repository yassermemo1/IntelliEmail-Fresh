import React from "react";

interface ReviewTaskProps {
  id: number;
  title: string;
  description: string;
  confidence: number;
  onConfirm: (id: number) => void;
  onEdit: (id: number) => void;
  onDismiss: (id: number) => void;
}

const ReviewTask: React.FC<ReviewTaskProps> = ({
  id,
  title,
  description,
  confidence,
  onConfirm,
  onEdit,
  onDismiss,
}) => {
  return (
    <div className="p-4 bg-warning/5 border border-warning/20 rounded-lg">
      <div className="flex items-start">
        <div className="flex-shrink-0 mt-0.5">
          <span className="material-icons text-warning">help_outline</span>
        </div>
        <div className="ml-3 flex-1">
          <h4 className="text-sm font-medium text-gray-900">{title}</h4>
          <p className="mt-1 text-sm text-gray-500 truncate-3">
            {description}. Confidence: {confidence}%
          </p>
          <div className="mt-3 flex space-x-2">
            <button 
              className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-primary bg-primary/10 hover:bg-primary/20"
              onClick={() => onConfirm(id)}
            >
              <span className="material-icons text-xs mr-1">check</span>
              Confirm
            </button>
            <button 
              className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
              onClick={() => onEdit(id)}
            >
              <span className="material-icons text-xs mr-1">edit</span>
              Edit
            </button>
            <button 
              className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
              onClick={() => onDismiss(id)}
            >
              <span className="material-icons text-xs mr-1">close</span>
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReviewTask;
