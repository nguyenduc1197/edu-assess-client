import React, { useMemo, useState } from 'react';
import { AlertCircle, ArrowLeft, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { MissingExamStudent, User } from '../../../types';
import Sidebar from '../../Common/Sidebar/Sidebar';
import { MobileBottomNav, MobileHeaderBar } from '../../Common/MobileAppChrome/MobileAppChrome';
import { formatVietnamDateTime } from '../../../utils/apiDateTime';
import { getMissingExamsClassName } from './missingExamsApi';
import { useClassMissingExams } from './useClassMissingExams';

interface ClassMissingExamsPageProps {
  onLogout?: () => void;
}

const DEFAULT_AVATAR_URL =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBaWbkVJIW-UxVbQAZVdNrwMze37EFXHpuuLhTSw7WJksMYe3RyK6MlICHa5M_rj6rAY8fmpaTsje51sF_GaYmBr15LrSN-IPsN9CSad_0QSDbvg69dUedrdiq4gN0Ev5352TfW0E_YrYXi0ugbxl2tDCdOwo84g_5dR-RxAreLeGB0Bs-5JS0tvLlFklj1uRh9wPZecX3HEGBS1Cgfm6tBuHD_pCTa6Z_JZN2Vzxo69eS-QEJjRqrhjg5yFrZfRnFYPL7VgejfRtgj';

const mockUser: User = {
  id: '81114DB7-EF7C-4CEC-97B1-4428AA7AADA6',
  name: localStorage.getItem('name') || 'An Nguyen',
  email: localStorage.getItem('email') || 'an.nguyen@school.edu',
  avatarUrl: DEFAULT_AVATAR_URL,
};

const SummaryCard: React.FC<{
  label: string;
  value: number;
  tone?: 'default' | 'warning' | 'danger';
}> = ({ label, value, tone = 'default' }) => {
  const toneClassName =
    tone === 'warning'
      ? 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20'
      : tone === 'danger'
        ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
        : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900';

  return (
    <div className={`rounded-xl border p-4 ${toneClassName}`}>
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
};

const StudentMissingExamRow: React.FC<{
  student: MissingExamStudent;
  studentKey: string;
  isExpanded: boolean;
  onToggle: () => void;
}> = ({ student, studentKey, isExpanded, onToggle }) => (
  <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/70"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-base font-semibold text-gray-900 dark:text-white">{student.studentName}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Mã học sinh: {student.studentId || '—'}</p>
          </div>
          <span className="inline-flex w-fit items-center rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300">
            {student.missingExamCount} bài còn thiếu
          </span>
        </div>
      </div>
      {isExpanded ? (
        <ChevronUp className="h-5 w-5 shrink-0 text-gray-500 dark:text-gray-400" />
      ) : (
        <ChevronDown className="h-5 w-5 shrink-0 text-gray-500 dark:text-gray-400" />
      )}
    </button>

    {isExpanded && (
      <div className="border-t border-gray-200 bg-gray-50/70 px-4 py-4 dark:border-gray-800 dark:bg-gray-950/40">
        <div className="space-y-3">
          {student.missingExams.map((exam) => (
            <div
              key={`${studentKey}-${exam.studentExamId || exam.examId || exam.examName}`}
              className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{exam.examName}</p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Mã lượt thi: {exam.studentExamId || '—'}
                  </p>
                </div>
                <div className="grid gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white">Bắt đầu:</span>{' '}
                    {formatVietnamDateTime(exam.start)}
                  </div>
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white">Kết thúc:</span>{' '}
                    {formatVietnamDateTime(exam.end)}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {student.missingExams.length === 0 && (
            <div className="rounded-xl border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
              Chưa có chi tiết bài còn thiếu cho học sinh này.
            </div>
          )}
        </div>
      </div>
    )}
  </div>
);

const ClassMissingExamsPage: React.FC<ClassMissingExamsPageProps> = ({ onLogout }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [expandedStudentIds, setExpandedStudentIds] = useState<string[]>([]);
  const { classId = '' } = useParams<{ classId: string }>();
  const { data, error, isLoading, isNotFound, refetch } = useClassMissingExams(classId);

  const className = getMissingExamsClassName(data?.schoolClass);
  const students = data?.students;

  const sortedStudents = useMemo(
    () =>
      [...(students || [])].sort((left, right) => {
        if (right.missingExamCount !== left.missingExamCount) {
          return right.missingExamCount - left.missingExamCount;
        }

        return left.studentName.localeCompare(right.studentName, 'vi');
      }),
    [students]
  );

  const getStudentKey = (student: MissingExamStudent, index: number) =>
    student.studentId || student.studentName || `student-${index}`;

  const toggleExpandedStudent = (studentKey: string) => {
    setExpandedStudentIds((current) =>
      current.includes(studentKey)
        ? current.filter((id) => id !== studentKey)
        : [...current, studentKey]
    );
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col lg:flex-row group/design-root">
      <MobileHeaderBar
        title="Chi tiết lớp học"
        subtitle="Theo dõi học sinh còn thiếu bài và số lượt chưa nộp theo từng lớp."
        onOpenMenu={() => setIsSidebarOpen(true)}
      />

      <Sidebar user={mockUser} isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} onLogout={onLogout} />
      <MobileBottomNav onOpenMenu={() => setIsSidebarOpen(true)} />

      <main className="mobile-safe-bottom flex-1 overflow-y-auto px-4 py-8 sm:px-8 lg:h-screen lg:p-8 lg:pb-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-6">
          <div className="rounded-3xl border border-slate-200/80 bg-gradient-to-r from-white via-emerald-50 to-teal-50 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-2">
                <span className="inline-flex w-fit items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                  Học sinh thiếu bài
                </span>
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">{className}</h1>
                <p className="text-base text-gray-600 dark:text-gray-400">
                  Theo dõi nhanh số học sinh đang thiếu bài và các bài thi chưa nộp.
                </p>
              </div>
              <Link
                to="/teacher/classes"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <ArrowLeft size={18} />
                Quay lại danh sách lớp
              </Link>
            </div>
          </div>

          {isLoading ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
              Đang tải thống kê học sinh thiếu bài...
            </div>
          ) : isNotFound ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center shadow-sm dark:border-amber-800 dark:bg-amber-900/20">
              <AlertCircle className="mx-auto h-10 w-10 text-amber-600 dark:text-amber-300" />
              <h2 className="mt-4 text-xl font-semibold text-amber-900 dark:text-amber-100">Không tìm thấy lớp</h2>
              <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
                Lớp bạn đang tìm không tồn tại hoặc không còn khả dụng.
              </p>
              <Link
                to="/teacher/classes"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-700"
              >
                <ArrowLeft size={16} />
                Quay lại danh sách lớp
              </Link>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center shadow-sm dark:border-red-800 dark:bg-red-900/20">
              <AlertCircle className="mx-auto h-10 w-10 text-red-600 dark:text-red-300" />
              <h2 className="mt-4 text-xl font-semibold text-red-900 dark:text-red-100">Không thể tải dữ liệu</h2>
              <p className="mt-2 text-sm text-red-800 dark:text-red-200">{error}</p>
              <button
                type="button"
                onClick={() => {
                  refetch();
                }}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700"
              >
                <RefreshCw size={16} />
                Thử lại
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <SummaryCard
                  label="Tổng học sinh đang hoạt động"
                  value={data?.totalActiveStudents || 0}
                />
                <SummaryCard
                  label="Số học sinh đang thiếu bài"
                  value={data?.studentsWithMissingExamsCount || 0}
                  tone="warning"
                />
                <SummaryCard
                  label="Tổng số lượt bài chưa nộp"
                  value={data?.totalMissingExamAssignments || 0}
                  tone="danger"
                />
              </div>

              <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="flex flex-col gap-2 border-b border-gray-200 pb-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Danh sách học sinh thiếu bài</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Chạm vào từng học sinh để xem danh sách bài còn thiếu và thời gian làm bài.
                    </p>
                  </div>
                  <span className="inline-flex w-fit items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {sortedStudents.length} học sinh
                  </span>
                </div>

                {sortedStudents.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/70 px-6 py-12 text-center dark:border-emerald-800 dark:bg-emerald-900/20">
                    <p className="text-lg font-semibold text-emerald-800 dark:text-emerald-200">
                      Tất cả học sinh đã hoàn thành bài được giao
                    </p>
                    <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
                      Không có học sinh nào đang thiếu bài trong lớp này.
                    </p>
                  </div>
                ) : (
                  <div className="mt-5 space-y-4">
                    {sortedStudents.map((student, index) => {
                      const studentKey = getStudentKey(student, index);

                      return (
                        <StudentMissingExamRow
                          key={studentKey}
                          student={student}
                          studentKey={studentKey}
                          isExpanded={expandedStudentIds.includes(studentKey)}
                          onToggle={() => toggleExpandedStudent(studentKey)}
                        />
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default ClassMissingExamsPage;
