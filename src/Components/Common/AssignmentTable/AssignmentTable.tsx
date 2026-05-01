import React from 'react';
import StatusBadge from '../StatusBadge/StatusBadge';
import { Assignment, AssignmentStatus } from '../../../types';
import { Clock3, Sparkles, Trash2 } from 'lucide-react';

interface AssignmentTableProps {
  assignments: Assignment[];
  onStartExam?: (assignment: Assignment) => void;
  onDelete?: (examId: string) => void;
  onRetryAssessment?: (assignment: Assignment) => void;
  actionLabel?: string;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (column: string) => void;
}

const AssignmentTable: React.FC<AssignmentTableProps> = ({
  assignments,
  onStartExam,
  onDelete,
  onRetryAssessment,
  actionLabel,
  sortBy,
  sortDirection,
  onSort,
}) => {
  const getSortIndicator = (column: string) => {
    if (sortBy !== column) return '<->';
    return sortDirection === 'asc' ? '^' : 'v';
  };

  const renderSortableHeader = (label: string, column: string, className: string) => (
    <th scope="col" className={className}>
      {onSort ? (
        <button
          type="button"
          onClick={() => onSort(column)}
          className="inline-flex items-center gap-1 text-left uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-200"
        >
          <span>{label}</span>
          <span className="text-[10px]">{getSortIndicator(column)}</span>
        </button>
      ) : (
        label
      )}
    </th>
  );

  const getActionText = (assignment: Assignment) => {
    if (assignment.isSubmitted) {
      if (assignment.assessmentStatus === 'Pending') return 'Đang chấm';
      if (assignment.assessmentStatus === 'Failed' && assignment.canRetryAssessment) return 'Chấm lại';
      if (assignment.assessmentStatus === 'Failed') return 'Xem kết quả';
      if (assignment.assessmentStatus === 'Completed') return 'Xem kết quả';
    }

    switch (assignment.status) {
      case AssignmentStatus.NEW: return 'Làm bài';
      case AssignmentStatus.IN_PROGRESS: return 'Tiếp tục';
      case AssignmentStatus.SUBMITTED: return 'Đang chấm';
      case AssignmentStatus.GRADED: return 'Xem kết quả';
      case AssignmentStatus.LATE: return 'Nộp bài';
      case AssignmentStatus.RETRY: return 'Chấm lại';
      default: return 'Chi tiết';
    }
  };

  const handleAction = (assignment: Assignment) => {
    if (assignment.isSubmitted && assignment.assessmentStatus === 'Failed' && assignment.canRetryAssessment && onRetryAssessment) {
      onRetryAssessment(assignment);
      return;
    }

    if (onStartExam) {
      onStartExam(assignment);
    }
  };

  return (
    <div className="w-full @container">
      <div className="overflow-hidden rounded-[1.9rem] border border-slate-200/80 bg-white/90 shadow-lg shadow-slate-200/40 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-none">
        <div className="space-y-3 p-3 md:hidden">
          {assignments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-gray-500 dark:border-slate-700">
              Không tìm thấy bài tập nào phù hợp.
            </div>
          ) : (
            assignments.map((assignment) => (
              <div key={assignment.id} className="mobile-premium-enter rounded-[1.75rem] border border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(241,245,249,0.92)_100%)] p-4 shadow-[0_18px_32px_rgba(15,23,42,0.08)] dark:border-slate-700 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.95)_0%,rgba(15,23,42,0.82)_100%)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500 dark:bg-white/5 dark:text-slate-300">
                      <Sparkles size={12} />
                      {assignment.subject}
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm font-semibold text-gray-900 dark:text-white">{assignment.title}</p>
                  </div>
                  <div className="shrink-0">
                    <StatusBadge status={assignment.status} />
                  </div>
                </div>

                <div className={`mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs ${assignment.isOverdue ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-300' : 'bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-300'}`}>
                  <Clock3 size={13} />
                  <span>{assignment.deadlineDisplay}</span>
                </div>

                {assignment.statusMessage && (
                  <p className={`mt-2 text-xs ${assignment.canRetryAssessment ? 'text-amber-700 dark:text-amber-300' : 'text-gray-600 dark:text-gray-300'}`}>
                    {assignment.statusMessage}
                  </p>
                )}

                <div className="mt-4 flex flex-col gap-3">
                  {(onStartExam || onRetryAssessment) && (
                    <button
                      type="button"
                      onClick={() => handleAction(assignment)}
                      className="inline-flex min-h-11 w-full items-center justify-center rounded-[1.2rem] bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-blue-500/25 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950 active:scale-[0.99]"
                    >
                      {actionLabel || getActionText(assignment)}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50/90 dark:bg-slate-800/70">
              <tr>
                {renderSortableHeader('Tên bài tập', 'title', 'px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400')}
                {renderSortableHeader('Môn học', 'subject', 'hidden px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 @lg:table-cell')}
                {renderSortableHeader('Hạn chót', 'deadline', 'hidden px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 @md:table-cell')}
                {renderSortableHeader('Trạng thái', 'status', 'px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400')}
                <th scope="col" className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Hành động
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-transparent">
              {assignments.length === 0 ? (
                 <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-500">
                      Không tìm thấy bài tập nào phù hợp.
                    </td>
                 </tr>
              ) : (
                assignments.map((assignment) => (
                  <tr key={assignment.id} className="group transition-colors hover:bg-slate-50/80 dark:hover:bg-white/5">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-900 dark:text-white line-clamp-1">
                          {assignment.title}
                        </span>
                        {/* Mobile-only sub-info */}
                        <span className="mt-1 text-xs text-gray-500 @lg:hidden">
                          {assignment.subject}
                        </span>
                        <span className={`mt-0.5 text-xs @md:hidden ${assignment.isOverdue ? 'text-red-600' : 'text-gray-500'}`}>
                          {assignment.deadlineDisplay}
                        </span>
                        {assignment.statusMessage && (
                          <span className={`mt-1 text-xs ${assignment.canRetryAssessment ? 'text-amber-700 dark:text-amber-300' : 'text-gray-500 dark:text-gray-400'}`}>
                            {assignment.statusMessage}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="hidden px-6 py-4 text-sm text-gray-500 dark:text-gray-400 @lg:table-cell">
                      {assignment.subject}
                    </td>
                    <td className={`hidden px-6 py-4 text-sm font-medium @md:table-cell ${assignment.isOverdue ? 'text-red-600 dark:text-red-400' : (assignment.status === AssignmentStatus.IN_PROGRESS ? 'text-orange-600 dark:text-orange-400' : 'text-gray-500 dark:text-gray-400')}`}>
                      {assignment.deadlineDisplay}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={assignment.status} />
                    </td>
                    <td className="px-6 py-4 text-sm font-medium">
                      <div className="flex items-center gap-4">
                        {(onStartExam || onRetryAssessment) && (
                          <button
                            type="button"
                            onClick={() => handleAction(assignment)}
                            className="inline-flex items-center rounded-full bg-gradient-to-r from-blue-600 to-violet-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:scale-[1.02] hover:shadow-md"
                          >
                            {actionLabel || getActionText(assignment)}
                          </button>
                        )}
                        {onDelete && (
                          <button 
                            onClick={() => onDelete(assignment.id)}
                            className="rounded-full p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                            title="Xóa"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AssignmentTable;
