import React, { useCallback, useMemo, useState } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';
import { StudentResultSummary, User } from '../../../types';
import Sidebar from '../../Common/Sidebar/Sidebar';
import { fetchClient, getCurrentUserId } from '../../../api/fetchClient';
import { MobileBottomNav, MobileHeaderBar } from '../../Common/MobileAppChrome/MobileAppChrome';
import { getAssessmentStatusLabel } from '../../../utils/assessmentStatus';

interface FailedAssessmentsProps {
  onLogout?: () => void;
}

const mockUser: User = {
  id: getCurrentUserId() || localStorage.getItem('accountId') || 'teacher-user',
  name: localStorage.getItem('name') || 'An Nguyen',
  email: localStorage.getItem('email') || 'an.nguyen@school.edu',
  avatarUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBaWbkVJIW-UxVbQAZVdNrwMze37EFXHpuuLhTSw7WJksMYe3RyK6MlICHa5M_rj6rAY8fmpaTsje51sF_GaYmBr15LrSN-IPsN9CSad_0QSDbvg69dUedrdiq4gN0Ev5352TfW0E_YrYXi0ugbxl2tDCdOwo84g_5dR-RxAreLeGB0Bs-5JS0tvLlFklj1uRh9wPZecX3HEGBS1Cgfm6tBuHD_pCTa6Z_JZN2Vzxo69eS-QEJjRqrhjg5yFrZfRnFYPL7VgejfRtgj',
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const FailedAssessments: React.FC<FailedAssessmentsProps> = ({ onLogout }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [failedAssessments, setFailedAssessments] = useState<StudentResultSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryingIds, setRetryingIds] = useState<string[]>([]);

  const loadFailedAssessments = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');

      const response = await fetchClient('/student-exams/results?assessmentStatus=Failed');
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();
      const items = Array.isArray(data) ? data : (data.items || data.data || []);

      setFailedAssessments(
        Array.isArray(items)
          ? items.map((item: any) => ({
              studentExamId: item.studentExamId || '',
              examId: item.examId || '',
              examName: item.examName || 'Bài thi',
              studentId: item.studentId || '',
              studentName: item.studentName || 'Học sinh',
              schoolClassId: item.schoolClassId || '',
              schoolClassName: item.schoolClassName || '—',
              isSubmitted: item.isSubmitted !== false,
              score: typeof item.score === 'number' ? item.score : null,
              assessmentStatus: item.assessmentStatus || 'Failed',
              finishedAt: item.finishedAt || null,
              assessedAt: item.assessedAt || null,
              assessmentError: item.assessmentError || null,
              canRetryAssessment: !!item.canRetryAssessment,
            }))
          : []
      );
    } catch (loadError) {
      console.error('Failed to fetch failed assessments', loadError);
      setFailedAssessments([]);
      setError('Không thể tải danh sách bài thi chấm lỗi.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadFailedAssessments();
  }, [loadFailedAssessments]);

  const handleRetryAssessment = useCallback(async (studentExamId: string) => {
    try {
      setRetryingIds((current) => [...current, studentExamId]);
      setError('');

      const response = await fetchClient(`/student-exams/${studentExamId}/retry-assessment`, {
        method: 'POST',
      });

      if (!response.ok) {
        const retryData = await response.json().catch(() => ({}));
        throw new Error(retryData?.message || `API returned ${response.status}`);
      }

      await loadFailedAssessments();
    } catch (retryError) {
      console.error('Failed to retry assessment', retryError);
      setError('Không thể yêu cầu chấm lại. Vui lòng thử lại sau.');
    } finally {
      setRetryingIds((current) => current.filter((id) => id !== studentExamId));
    }
  }, [loadFailedAssessments]);

  const retryableCount = useMemo(
    () => failedAssessments.filter((item) => item.canRetryAssessment).length,
    [failedAssessments]
  );

  return (
    <div className="relative flex min-h-screen w-full flex-col lg:flex-row">
      <MobileHeaderBar
        title="Bài thi chấm lỗi"
        subtitle="Theo dõi các bài thi AI chấm thất bại và gửi yêu cầu chấm lại."
        onOpenMenu={() => setIsSidebarOpen(true)}
      />

      <Sidebar
        user={mockUser}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onLogout={onLogout}
      />
      <MobileBottomNav onOpenMenu={() => setIsSidebarOpen(true)} />

      <main className="mobile-safe-bottom min-h-[calc(100dvh-var(--mobile-app-header-height))] flex-1 overflow-x-hidden overflow-y-auto px-4 py-8 sm:px-8 lg:h-screen lg:p-8 lg:pb-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-6">
          <div className="rounded-3xl border border-amber-200/80 bg-gradient-to-r from-white via-amber-50 to-red-50 p-6 shadow-sm dark:border-amber-900 dark:bg-slate-900">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                  <AlertTriangle size={14} />
                  Bài thi chấm lỗi
                </span>
                <h1 className="mt-3 text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
                  Danh sách lỗi chấm bài
                </h1>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Hiển thị các bài thi có trạng thái đánh giá thất bại và cho phép chấm lại ngay.
                </p>
              </div>

              <button
                type="button"
                onClick={loadFailedAssessments}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
              >
                <RotateCw size={16} />
                Làm mới
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-900/20">
              <p className="text-sm text-red-700 dark:text-red-300">Tổng bài chấm lỗi</p>
              <p className="mt-2 text-3xl font-bold text-red-800 dark:text-red-200">{failedAssessments.length}</p>
            </div>
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-900/20">
              <p className="text-sm text-blue-700 dark:text-blue-300">Có thể chấm lại</p>
              <p className="mt-2 text-3xl font-bold text-blue-800 dark:text-blue-200">{retryableCount}</p>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            <div className="space-y-3 p-3 sm:hidden">
              {isLoading ? (
                <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  Đang tải danh sách lỗi chấm...
                </div>
              ) : failedAssessments.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  Không có bài thi chấm lỗi.
                </div>
              ) : (
                failedAssessments.map((item) => {
                  const isRetrying = retryingIds.includes(item.studentExamId);

                  return (
                    <div key={item.studentExamId} className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800/40">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.examName}</p>
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {item.studentName} • {item.schoolClassName || '—'}
                          </p>
                        </div>
                        <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                          {getAssessmentStatusLabel(item.assessmentStatus)}
                        </span>
                      </div>

                      <div className="mt-3 space-y-2 text-xs text-gray-500 dark:text-gray-400">
                        <p>Kết thúc: {formatDateTime(item.finishedAt)}</p>
                        <p>Chấm lúc: {formatDateTime(item.assessedAt)}</p>
                      </div>

                      <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                        {item.assessmentError || 'Không có chi tiết lỗi.'}
                      </div>

                      {item.canRetryAssessment && (
                        <button
                          type="button"
                          disabled={isRetrying}
                          onClick={() => handleRetryAssessment(item.studentExamId)}
                          className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <RotateCw size={16} className={isRetrying ? 'animate-spin' : ''} />
                          {isRetrying ? 'Đang gửi...' : 'Chấm lại'}
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="hidden overflow-x-auto sm:block">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                <thead className="bg-gray-50 dark:bg-gray-800/60">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Bài thi</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Học sinh</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Lớp</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Kết thúc</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Chấm lúc</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Lý do lỗi</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-800 dark:bg-transparent">
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                        Đang tải danh sách lỗi chấm...
                      </td>
                    </tr>
                  ) : failedAssessments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                        Không có bài thi chấm lỗi.
                      </td>
                    </tr>
                  ) : (
                    failedAssessments.map((item) => {
                      const isRetrying = retryingIds.includes(item.studentExamId);

                      return (
                        <tr key={item.studentExamId} className="align-top hover:bg-gray-50 dark:hover:bg-gray-800/40">
                          <td className="px-4 py-4 text-sm font-medium text-gray-900 dark:text-white">
                            <div className="space-y-2">
                              <p>{item.examName}</p>
                              <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                                {getAssessmentStatusLabel(item.assessmentStatus)}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">{item.studentName}</td>
                          <td className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">{item.schoolClassName || '—'}</td>
                          <td className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">{formatDateTime(item.finishedAt)}</td>
                          <td className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">{formatDateTime(item.assessedAt)}</td>
                          <td className="px-4 py-4 text-sm text-amber-700 dark:text-amber-300">{item.assessmentError || 'Không có chi tiết lỗi.'}</td>
                          <td className="px-4 py-4 text-sm">
                            {item.canRetryAssessment ? (
                              <button
                                type="button"
                                disabled={isRetrying}
                                onClick={() => handleRetryAssessment(item.studentExamId)}
                                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <RotateCw size={16} className={isRetrying ? 'animate-spin' : ''} />
                                {isRetrying ? 'Đang gửi...' : 'Chấm lại'}
                              </button>
                            ) : (
                              <span className="text-gray-400 dark:text-gray-500">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default FailedAssessments;
