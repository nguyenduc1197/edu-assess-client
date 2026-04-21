import React from 'react';
import StatusBadge from '../StatusBadge/StatusBadge';
import { Assignment, AssignmentStatus } from '../../../types';
import { Trash2 } from 'lucide-react';

interface AssignmentTableProps {
  assignments: Assignment[];
  onStartExam?: (assignment: Assignment) => void;
  onDelete?: (examId: string) => void;
  onRetryAssessment?: (assignment: Assignment) => void;
  actionLabel?: string;
}

const AssignmentTable: React.FC<AssignmentTableProps> = ({ assignments, onStartExam, onDelete, onRetryAssessment, actionLabel }) => {
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
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 shadow-lg shadow-slate-200/40 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-none">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50/90 dark:bg-slate-800/70">
              <tr>
                <th scope="col" className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Tên bài tập
                </th>
                <th scope="col" className="hidden px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 @lg:table-cell">
                  Môn học
                </th>
                <th scope="col" className="hidden px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400 @md:table-cell">
                  Hạn chót
                </th>
                <th scope="col" className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Trạng thái
                </th>
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