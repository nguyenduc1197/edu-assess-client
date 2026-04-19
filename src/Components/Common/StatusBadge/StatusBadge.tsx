import React from 'react';
import { AssignmentStatus } from '../../../types';

interface StatusBadgeProps {
  status: AssignmentStatus;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  let styles = '';

  switch (status) {
    case AssignmentStatus.NEW:
      styles = 'border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      break;
    case AssignmentStatus.IN_PROGRESS:
      styles = 'border border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
      break;
    case AssignmentStatus.SUBMITTED:
      styles = 'border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
      break;
    case AssignmentStatus.GRADED:
      styles = 'border border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-900/30 dark:text-violet-300';
      break;
    case AssignmentStatus.LATE:
      styles = 'border border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300';
      break;
    case AssignmentStatus.RETRY:
      styles = 'border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
      break;
    default:
      styles = 'border border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300';
  }

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm ${styles}`}>
      {status}
    </span>
  );
};

export default StatusBadge;