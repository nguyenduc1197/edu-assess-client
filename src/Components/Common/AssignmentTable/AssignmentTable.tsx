import React from 'react';
import StatusBadge from '../StatusBadge/StatusBadge';
import { Assignment, AssignmentStatus } from '../../../types';
import { Trash2 } from 'lucide-react';

interface AssignmentTableProps {
  assignments: Assignment[];
  onStartExam?: (assignment: Assignment) => void;
  onDelete?: (examId: string) => void;
}

const AssignmentTable: React.FC<AssignmentTableProps> = ({ assignments, onStartExam, onDelete }) => {
  const getActionText = (status: AssignmentStatus) => {
    switch (status) {
      case AssignmentStatus.NEW: return 'Làm bài';
      case AssignmentStatus.IN_PROGRESS: return 'Tiếp tục';
      case AssignmentStatus.SUBMITTED: return 'Xem lại';
      case AssignmentStatus.GRADED: return 'Xem điểm';
      case AssignmentStatus.LATE: return 'Nộp bài';
      default: return 'Chi tiết';
    }
  };

  return (
    <div className="w-full @container">
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-background-dark">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-white/5">
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
                  <tr key={assignment.id} className="group transition-colors hover:bg-gray-50 dark:hover:bg-white/5">
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
                      {onStartExam && (
                      <a href="#" onClick={() => onStartExam && onStartExam(assignment)} className="text-primary hover:text-primary-dark hover:underline transition-colors">
                        {getActionText(assignment.status)}
                      </a>
                      )}
                      {onDelete && (
                          <button 
                            onClick={() => onDelete(assignment.id)}
                            className="text-gray-400 hover:text-red-600 transition-colors"
                            title="Xóa"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
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