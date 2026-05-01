import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Search, ChevronDown, Menu } from 'lucide-react';
import { AppView, Assignment, AssignmentStatus, CompletedExam, LoginProps, SubjectLabel, User } from '../../../types';
import Sidebar from '../../Common/Sidebar/Sidebar';
import AssignmentTable from '../../Common/AssignmentTable/AssignmentTable';
import ExamSession from '../Exam/ExamSession';
import { fetchClient, getCurrentProfileId } from '../../../api/fetchClient';

const mockUser: User = {
  id: localStorage.getItem('profileId') || 'student-user',
  name: localStorage.getItem('name') || 'Học sinh',
  email: localStorage.getItem('email') || 'student@school.edu',
  avatarUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBaWbkVJIW-UxVbQAZVdNrwMze37EFXHpuuLhTSw7WJksMYe3RyK6MlICHa5M_rj6rAY8fmpaTsje51sF_GaYmBr15LrSN-IPsN9CSad_0QSDbvg69dUedrdiq4gN0Ev5352TfW0E_YrYXi0ugbxl2tDCdOwo84g_5dR-RxAreLeGB0Bs-5JS0tvLlFklj1uRh9wPZecX3HEGBS1Cgfm6tBuHD_pCTa6Z_JZN2Vzxo69eS-QEJjRqrhjg5yFrZfRnFYPL7VgejfRtgj'
};

const StudentDashboard: React.FC<LoginProps> = ({ onLogout }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'title' | 'subject' | 'deadline' | 'status'>('deadline');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedExam, setSelectedExam] = useState<Assignment | null>(null);
  const [currentView, setCurrentView] = useState<AppView>('dashboard');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'available' | 'completed'>('available');
  const [completedExams, setCompletedExams] = useState<CompletedExam[]>([]);
  const [isCompletedLoading, setIsCompletedLoading] = useState(false);
  const [completedError, setCompletedError] = useState('');
  const [viewingResultStudentExamId, setViewingResultStudentExamId] = useState<string | null>(null);

  const fetchCompletedExams = useCallback(async () => {
    const studentId = getCurrentProfileId();
    if (!studentId) return;

    setIsCompletedLoading(true);
    setCompletedError('');
    try {
      const response = await fetchClient(`/students/${studentId}/completed-exams`);
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      const data = await response.json();
      setCompletedExams(Array.isArray(data) ? data : (data.items || data.data || []));
    } catch (err) {
      console.error('Failed to fetch completed exams', err);
      setCompletedError('Không thể tải danh sách bài thi đã hoàn thành.');
    } finally {
      setIsCompletedLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompletedExams();
  }, [fetchCompletedExams]);

  const fetchAssignments = useCallback(async () => {
    const studentId = getCurrentProfileId();

    if (!studentId) {
      setAssignments([]);
      setError('Không xác định được tài khoản học sinh. Vui lòng đăng nhập lại.');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError('');

      const response = await fetchClient(`/students/${studentId}/available-exams`);

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();
      const items = Array.isArray(data) ? data : (data.data || []);

      const mappedAssignments: Assignment[] = items.map((item: any) => {
        const endDate = new Date(item.end);
        const startDate = new Date(item.start);
        const now = new Date();
        const isSubmitted = item.isSubmitted === true;
        const assessmentStatus = item.assessmentStatus || (isSubmitted ? 'Pending' : 'NotStarted');
        const canRetryAssessment = item.canRetryAssessment === true;

        let status = AssignmentStatus.NEW;
        let statusMessage = '';

        if (!isSubmitted && now > endDate) {
          status = AssignmentStatus.LATE;
        } else if (!isSubmitted && now >= startDate && now <= endDate) {
          status = AssignmentStatus.IN_PROGRESS;
        } else if (isSubmitted && assessmentStatus === 'Pending') {
          status = AssignmentStatus.SUBMITTED;
          statusMessage = 'Bài đang được đánh giá.';
        } else if (isSubmitted && assessmentStatus === 'Failed' && canRetryAssessment) {
          status = AssignmentStatus.RETRY;
          statusMessage = item.assessmentError
            ? `${item.assessmentError} Em có thể yêu cầu chấm lại.`
            : 'Đánh giá thất bại, em có thể yêu cầu chấm lại.';
        } else if (isSubmitted && assessmentStatus === 'Completed') {
          status = AssignmentStatus.GRADED;
          statusMessage = 'Đã có kết quả.';
        } else if (isSubmitted && assessmentStatus === 'Failed') {
          status = AssignmentStatus.SUBMITTED;
          statusMessage = item.assessmentError || 'Đánh giá thất bại.';
        }

        return {
          id: item.examId,
          title: item.examName,
          subject: SubjectLabel.GD_KTPL,
          deadline: item.end,
          deadlineDisplay: endDate.toLocaleString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            weekday: 'long',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          }),
          status,
          isOverdue: now > endDate,
          assessmentStatus,
          canRetry: !!item.canRetry,
          canRetryAssessment,
          assessmentError: item.assessmentError || null,
          statusMessage,
          studentExamId: item.studentExamId || null,
          isSubmitted,
        };
      });

      setAssignments(mappedAssignments);
    } catch (fetchError) {
      console.error('Failed to fetch available exams', fetchError);
      setAssignments([]);
      setError('Không thể tải danh sách bài thi khả dụng.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  const handleSort = useCallback((column: string) => {
    if (sortBy === column) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortBy(column as 'title' | 'subject' | 'deadline' | 'status');
    setSortDirection('asc');
  }, [sortBy]);

  const filteredAssignments = useMemo(() => {
    const filtered = assignments.filter((assignment) =>
      assignment.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return [...filtered].sort((left, right) => {
      const modifier = sortDirection === 'asc' ? 1 : -1;

      switch (sortBy) {
        case 'title':
          return left.title.localeCompare(right.title) * modifier;
        case 'subject':
          return String(left.subject).localeCompare(String(right.subject)) * modifier;
        case 'status':
          return String(left.status).localeCompare(String(right.status)) * modifier;
        case 'deadline':
        default:
          return (new Date(left.deadline).getTime() - new Date(right.deadline).getTime()) * modifier;
      }
    });
  }, [assignments, searchQuery, sortBy, sortDirection]);

  const handleStartExam = (assignment: Assignment) => {
    setSelectedExam(assignment);
    setCurrentView('exam-session');
    window.scrollTo(0, 0);
  };

  const handleRetryAssessment = async (assignment: Assignment) => {
    if (!assignment.studentExamId) {
      setError('Không thể yêu cầu chấm lại: thiếu thông tin bài thi.');
      return;
    }

    try {
      setIsLoading(true);
      setError('');

      const response = await fetchClient(`/student-exams/${assignment.studentExamId}/retry-assessment`, {
        method: 'POST',
      });

      const retryData = await response.json().catch(() => ({}));

      if (!response.ok || !retryData?.studentExamId) {
        throw new Error(retryData?.message || `API returned ${response.status}`);
      }

      await fetchAssignments();

      setSelectedExam({
        ...assignment,
        studentExamId: retryData.studentExamId,
        assessmentStatus: retryData.assessmentStatus || 'Pending',
        isSubmitted: true,
        canRetryAssessment: false,
        status: AssignmentStatus.SUBMITTED,
        statusMessage: retryData.message || 'Bài đang được đánh giá lại.',
      });
      setCurrentView('exam-session');
      window.scrollTo(0, 0);
    } catch (retryError) {
      console.error('Failed to retry assessment', retryError);
      setError('Không thể yêu cầu chấm lại. Vui lòng thử lại sau.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExitExam = () => {
    setSelectedExam(null);
    setCurrentView('dashboard');
    fetchAssignments();
    fetchCompletedExams();
  };

  if (viewingResultStudentExamId) {
    const examForResult = completedExams.find(
      (ce) => ce.studentExamId === viewingResultStudentExamId
    );
    const assignmentForResult: Assignment = {
      id: examForResult?.examId || '',
      title: examForResult?.examName || '',
      subject: SubjectLabel.GD_KTPL,
      deadline: examForResult?.end || '',
      deadlineDisplay: '',
      status: AssignmentStatus.GRADED,
      studentExamId: viewingResultStudentExamId,
      isSubmitted: true,
      assessmentStatus: 'Completed',
    };
    return (
      <ExamSession
        assignment={assignmentForResult}
        examId={assignmentForResult.id}
        onExit={() => setViewingResultStudentExamId(null)}
        onSubmitted={() => {}}
      />
    );
  }

  if (currentView === 'exam-session' && selectedExam) {
    return (
      <ExamSession
        assignment={selectedExam}
        examId={selectedExam.id}
        onExit={handleExitExam}
        onSubmitted={fetchAssignments}
      />
    );
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col lg:flex-row group/design-root">
      <div className="lg:hidden flex items-center justify-start px-4 py-3 bg-white border-b border-gray-200 dark:bg-background-dark dark:border-gray-800 sticky top-0 z-20 shadow-sm gap-3">
        <button
          className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg dark:text-gray-300 dark:hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-700 transition-colors"
          onClick={() => setIsSidebarOpen(true)}
          aria-label="Mở menu"
        >
          <Menu size={24} />
        </button>
        <span className="font-bold text-lg text-gray-900 dark:text-white tracking-tight">
          StudentHub
        </span>
      </div>

      <Sidebar
        user={mockUser}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onLogout={onLogout}
      />

      <main className="min-h-[calc(100dvh-61px)] flex-1 overflow-x-hidden overflow-y-auto px-3 py-5 sm:px-6 sm:py-7 lg:h-screen lg:p-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 sm:gap-6">
          <div className="rounded-3xl border border-slate-200/80 bg-gradient-to-r from-white via-cyan-50 to-blue-50 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
            <div className="flex flex-col gap-2">
              <span className="inline-flex w-fit items-center rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300">
                Không gian học tập
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
                Bài Thi Của Em
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 sm:text-base">
                Theo dõi các bài thi khả dụng và lịch sử hoàn thành.
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex overflow-x-auto border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab('available')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'available'
                  ? 'border-primary text-primary dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              Bài thi khả dụng
              {assignments.length > 0 && (
                <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-xs text-primary dark:bg-blue-900/30 dark:text-blue-300">
                  {assignments.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'completed'
                  ? 'border-primary text-primary dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              Đã hoàn thành
              {completedExams.length > 0 && (
                <span className="ml-1.5 rounded-full bg-green-100 px-1.5 py-0.5 text-xs text-green-700 dark:bg-green-900/30 dark:text-green-300">
                  {completedExams.length}
                </span>
              )}
            </button>
          </div>

          {activeTab === 'available' && (
            <>
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
                  {error}
                </div>
              )}

              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div className="relative w-full max-w-none sm:max-w-xs">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                    <Search size={20} />
                  </div>
                  <input
                    type="text"
                    placeholder="Tìm bài tập..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="block h-10 w-full rounded-lg border border-gray-300 bg-white pl-10 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:ring-1 focus:ring-primary dark:border-gray-700 dark:bg-background-dark dark:text-white dark:placeholder-gray-500 transition-colors"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <button className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10 sm:w-auto">
                    <span>{isLoading ? 'Đang tải...' : `${filteredAssignments.length} bài thi`}</span>
                    <ChevronDown size={16} className="text-gray-500" />
                  </button>
                </div>
              </div>

              <AssignmentTable
                assignments={filteredAssignments}
                onStartExam={handleStartExam}
                onRetryAssessment={handleRetryAssessment}
                sortBy={sortBy}
                sortDirection={sortDirection}
                onSort={handleSort}
              />
            </>
          )}

          {activeTab === 'completed' && (
            <>
              {completedError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
                  {completedError}
                </div>
              )}

              {isCompletedLoading ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-gray-500 dark:text-gray-400">Đang tải...</p>
                </div>
              ) : completedExams.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-gray-500 dark:text-gray-400">Chưa có bài thi nào đã hoàn thành.</p>
                </div>
              ) : (
                <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                  <div className="space-y-3 p-3 sm:hidden">
                    {completedExams.map((ce) => (
                      <div
                        key={ce.studentExamId}
                        className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800/40"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{ce.examName}</p>
                          <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                            {ce.score !== null ? ce.score.toFixed(1) : '—'}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                          Nộp ngày {new Date(ce.finishedAt).toLocaleDateString('vi-VN')}
                        </p>
                        <div className="mt-3 flex flex-col gap-3">
                          <span className={`inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
                            ce.assessmentStatus === 'Completed'
                              ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800'
                              : ce.assessmentStatus === 'Pending'
                              ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800'
                              : 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'
                          }`}>
                            {ce.assessmentStatus === 'Completed'
                              ? 'Đã đánh giá'
                              : ce.assessmentStatus === 'Pending'
                              ? 'Đang chấm'
                              : ce.assessmentStatus === 'Failed'
                              ? 'Lỗi đánh giá'
                              : 'Chưa đánh giá'}
                          </span>
                          {ce.assessmentStatus === 'Completed' ? (
                            <button
                              type="button"
                              onClick={() => setViewingResultStudentExamId(ce.studentExamId)}
                              className="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark"
                            >
                              Xem kết quả
                            </button>
                          ) : (
                            <span className="text-sm text-gray-400">Chưa thể xem kết quả</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="hidden overflow-x-auto sm:block">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Bài thi</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Ngày nộp</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">Điểm</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Trạng thái</th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 dark:text-gray-300">Hành động</th>
                        </tr>
                      </thead>
                      <tbody>
                        {completedExams.map((ce) => (
                          <tr
                            key={ce.studentExamId}
                            className="border-b border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                          >
                            <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white max-w-[200px] truncate">
                              {ce.examName}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                              {new Date(ce.finishedAt).toLocaleDateString('vi-VN')}
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-bold text-blue-600 dark:text-blue-400">
                              {ce.score !== null ? ce.score.toFixed(1) : '—'}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
                                ce.assessmentStatus === 'Completed'
                                  ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800'
                                  : ce.assessmentStatus === 'Pending'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800'
                                  : 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'
                              }`}>
                                {ce.assessmentStatus === 'Completed'
                                  ? 'Đã đánh giá'
                                  : ce.assessmentStatus === 'Pending'
                                  ? 'Đang chấm'
                                  : ce.assessmentStatus === 'Failed'
                                  ? 'Lỗi đánh giá'
                                  : 'Chưa đánh giá'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {ce.assessmentStatus === 'Completed' ? (
                                <button
                                  type="button"
                                  onClick={() => setViewingResultStudentExamId(ce.studentExamId)}
                                  className="text-primary hover:underline text-sm font-medium dark:text-blue-400"
                                >
                                  Xem kết quả
                                </button>
                              ) : (
                                <span className="text-gray-400 text-sm">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default StudentDashboard;
