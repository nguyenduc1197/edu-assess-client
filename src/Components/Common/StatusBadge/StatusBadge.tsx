import React from 'react';
import { AssignmentStatus } from '../../../types';

interface StatusBadgeProps {
  status: AssignmentStatus;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  let styles = '';

  switch (status) {
    case AssignmentStatus.NEW:
      styles = 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300';
      break;
    case AssignmentStatus.IN_PROGRESS:
      styles = 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300';
      break;
    case AssignmentStatus.SUBMITTED:
      styles = 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300';
      break;
    case AssignmentStatus.GRADED:
      styles = 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300';
      break;
    case AssignmentStatus.LATE:
      styles = 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
      break;
    default:
      styles = 'bg-gray-100 text-gray-800';
  }

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${styles}`}>
      {status}
    </span>
  );
};

export default StatusBadge;