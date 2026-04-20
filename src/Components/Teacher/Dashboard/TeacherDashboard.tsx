import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Search, PlusCircle, ChevronDown, Menu } from 'lucide-react';
import {
  AssessmentResult,
  Assignment,
  AssignmentStatus,
  ExamStudentStatusItem,
  LoginProps,
  SubjectLabel,
  User,
  WrongAnswerReview,
} from '../../../types';
import Sidebar from '../../Common/Sidebar/Sidebar';
import AssignmentTable from '../../Common/AssignmentTable/AssignmentTable';
import CreateExamModal from '../Exam/CreateExamModal';
import { fetchClient } from '../../../api/fetchClient';

let mockUser: User = {
  id: "81114DB7-EF7C-4CEC-97B1-4428AA7AADA6",
  name: `An Nguyen`,
  email: localStorage.getItem('email') || 'an.nguyen@school.edu',
  avatarUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuBaWbkVJIW-UxVbQAZVdNrwMze37EFXHpuuLhTSw7WJksMYe3RyK6MlICHa5M_rj6rAY8fmpaTsje51sF_GaYmBr15LrSN-IPsN9CSad_0QSDbvg69dUedrdiq4gN0Ev5352TfW0E_YrYXi0ugbxl2tDCdOwo84g_5dR-RxAreLeGB0Bs-5JS0tvLlFklj1uRh9wPZecX3HEGBS1Cgfm6tBuHD_pCTa6Z_JZN2Vzxo69eS-QEJjRqrhjg5yFrZfRnFYPL7VgejfRtgj"
};

const getFeedbackItems = (feedback?: string | null) =>
  (feedback || '')
    .split(/\r?\n|•/)
    .map((item) => item.replace(/^[-•]\s*/, '').trim())
    .filter(Boolean);

const groupWrongAnswerItems = (items: WrongAnswerReview[]) => {
  const groups: Array<
    | { type: 'single'; item: WrongAnswerReview }
    | { type: 'group'; key: string; passageText?: string | null; items: WrongAnswerReview[] }
  > = [];
  const processedGroupKeys = new Set<string>();

  items.forEach((item) => {
    const groupKey = item.passageGroupKey?.trim();

    if (item.questionFormat === 'TrueFalse' && groupKey) {
      if (processedGroupKeys.has(groupKey)) return;

      const groupItems = items
        .filter((candidate) => candidate.questionFormat === 'TrueFalse' && candidate.passageGroupKey === groupKey)
        .sort(
          (a, b) =>
            (a.statementOrder ?? Number.MAX_SAFE_INTEGER) -
            (b.statementOrder ?? Number.MAX_SAFE_INTEGER)
        );

      groups.push({
        type: 'group',
        key: groupKey,
        passageText: groupItems.find((candidate) => candidate.passageText)?.passageText || item.passageText,
        items: groupItems,
      });
      processedGroupKeys.add(groupKey);
      return;
    }

    groups.push({ type: 'single', item });
  });

  return groups;
};

const TeacherDashboard: React.FC<LoginProps> = ({ onLogout }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedExam, setSelectedExam] = useState<Assignment | null>(null);
  const [examStudents, setExamStudents] = useState<ExamStudentStatusItem[]>([]);
  const [isStudentListLoading, setIsStudentListLoading] = useState(false);
  const [studentListError, setStudentListError] = useState('');
  const [selectedAssessment, setSelectedAssessment] = useState<AssessmentResult | null>(null);
  const [isAssessmentLoading, setIsAssessmentLoading] = useState(false);
  const [selectedStudentName, setSelectedStudentName] = useState('');
  const fetchAssignments = useCallback(async () => {
    try {
      const response = await fetchClient(
  `/exams?pageNumber=1&pageSize=100`,
  {
    headers: {
      accept: "*/*",
    },
  }
);
      
      if (response.ok) {
        const data = await response.json();
        // Handle array response directly as per your sample
        const items = Array.isArray(data) ? data : (data.data || []);
        
        const mappedAssignments: Assignment[] = items.map((item: any) => {
          const endDate = new Date(item.end);
          const startDate = new Date(item.start);
          const now = new Date();
          
          // Logic to determine status since API doesn't return it
          let status = AssignmentStatus.NEW;
          if (now > endDate) {
            status = AssignmentStatus.GRADED; // Or LATE/CLOSED depending on logic
          } else if (now >= startDate && now <= endDate) {
            status = AssignmentStatus.IN_PROGRESS;
          }

          return {
            id: item.id,
            title: item.name,
            subject: SubjectLabel.GD_KTPL, // Default subject since API doesn't return it
            deadline: item.end,
            deadlineDisplay: endDate.toLocaleString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
              weekday: 'long',
              day: '2-digit',
              month: '2-digit',
              year: 'numeric'
            }),
            status: status,
            isOverdue: now > endDate
          };
        });
        
        setAssignments(mappedAssignments);
      }
    } catch (error) {
      console.error("Failed to fetch assignments", error);
    }
  }, []);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  const getStudentStatusMeta = (item: ExamStudentStatusItem) => {
    if (item.isSubmitted === false) {
      return {
        label: 'Chưa làm bài',
        className: 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
      };
    }

    if (item.isSubmitted === true && item.canViewResult === true) {
      return {
        label: 'Đã có kết quả',
        className: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800',
      };
    }

    return {
      label: 'Đã nộp, đang chấm',
      className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800',
    };
  };

  const handleOpenExamStudents = async (assignment: Assignment) => {
    try {
      setSelectedExam(assignment);
      setSelectedAssessment(null);
      setSelectedStudentName('');
      setStudentListError('');
      setExamStudents([]);
      setIsStudentListLoading(true);

      const response = await fetchClient(`/exams/${assignment.id}/students`);

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();
      const items = Array.isArray(data)
        ? data
        : (data.students || data.items || data.data || []);

      if (!Array.isArray(items)) {
        throw new Error('Unexpected exam student response shape');
      }

      const mappedStudents: ExamStudentStatusItem[] = items.map((item: any) => ({
        studentId: item.studentId || item.id || item.profileId || '',
        studentName: item.studentName || item.name || 'Học sinh',
        schoolClassId: item.schoolClassId || '',
        schoolClassName: item.schoolClassName || item.className || '',
        studentExamId: item.studentExamId || null,
        isSubmitted: !!item.isSubmitted,
        score: typeof item.score === 'number' ? item.score : null,
        assessmentStatus:
          item.assessmentStatus ||
          (item.canViewResult ? 'Completed' : item.isSubmitted ? 'Pending' : 'NotStarted'),
        canViewResult: !!item.canViewResult,
        assessmentError: item.assessmentError || null,
        finishedAt: item.finishedAt || null,
      }));

      setExamStudents(mappedStudents);

      if (!Array.isArray(data) && data.examName) {
        setSelectedExam((prev) => (prev ? { ...prev, title: data.examName } : prev));
      }
    } catch (error) {
      console.error('Failed to fetch exam students', error);
      setStudentListError('Không thể tải danh sách học sinh cho bài thi này.');
    } finally {
      setIsStudentListLoading(false);
    }
  };

  const fetchAssessmentDetail = useCallback(async (studentExamId: string, silent = false) => {
    try {
      if (!silent) setIsAssessmentLoading(true);

      const response = await fetchClient(`/student-exams/${studentExamId}/assessment`);
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data: AssessmentResult = await response.json();
      setSelectedAssessment(data);
      return data;
    } catch (error) {
      console.error('Failed to fetch assessment detail', error);
      return null;
    } finally {
      if (!silent) setIsAssessmentLoading(false);
    }
  }, []);

  const handleViewStudentResult = async (item: ExamStudentStatusItem) => {
    if (!item.canViewResult || !item.studentExamId) return;
    setSelectedStudentName(item.studentName);
    await fetchAssessmentDetail(item.studentExamId);
  };

  useEffect(() => {
    if (!selectedAssessment?.studentExamId || selectedAssessment.assessmentStatus !== 'Pending') {
      return;
    }

    const intervalId = window.setInterval(() => {
      fetchAssessmentDetail(selectedAssessment.studentExamId, true);
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [fetchAssessmentDetail, selectedAssessment]);

  const filteredAssignments = useMemo(() => {
    return assignments.filter(a => 
      a.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [assignments, searchQuery]);

    const handleDeleteExam = async (examId: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa bài tập này không?")) {
      return;
    }

    try {
    const response = await fetchClient(`/exams/${examId}`,
    {
      method: "DELETE"
    }
);

      if (response.ok) {
        // Refresh the list
        fetchAssignments();
      } else {
        alert("Xóa thất bại. Vui lòng thử lại.");
      }
    } catch (error) {
      console.error("Error deleting exam:", error);
      alert("Đã xảy ra lỗi khi xóa bài tập.");
    }
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col lg:flex-row group/design-root">
      
      {/* Mobile Header (Only visible on small screens) */}
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
{/* Create Exam Modal */}
      {isCreateModalOpen && (
        <CreateExamModal 
          onClose={() => setIsCreateModalOpen(false)} 
          onSuccess={() => {
            fetchAssignments();
          }}
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 px-4 py-8 sm:px-8 lg:p-8 overflow-y-auto h-screen">
        <div className="mx-auto flex max-w-7xl flex-col gap-8">
          
          {/* Page Heading */}
          <div className="rounded-3xl border border-slate-200/80 bg-gradient-to-r from-white via-blue-50 to-violet-50 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-2">
                <span className="inline-flex w-fit items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                  Quản lý bài thi
                </span>
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
                  Bài Tập Đã Giao
                </h1>
                <p className="text-base text-gray-600 dark:text-gray-400">
                  Theo dõi danh sách bài thi, trạng thái học sinh và kết quả ngay trên một màn hình.
                </p>
              </div>

              <button onClick={() => setIsCreateModalOpen(true)} className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 hover:from-blue-700 hover:to-violet-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all">
                <PlusCircle size={20} />
                <span>Tạo Mới</span>
              </button>
            </div>
          </div>

          {/* Toolbar & Filters */}
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            
            {/* Search Input */}
            <div className="relative w-full max-w-xs">
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

            {/* Filter Chips */}
            <div className="flex flex-wrap gap-2">
              <button className="flex h-10 items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10 transition-colors">
                <span>Tất cả trạng thái</span>
                <ChevronDown size={16} className="text-gray-500" />
              </button>
              
              <button className="flex h-10 items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10 transition-colors">
                <span>Tất cả môn học</span>
                <ChevronDown size={16} className="text-gray-500" />
              </button>
            </div>
          </div>

          {/* Table Data */}
          <AssignmentTable
            assignments={filteredAssignments}
            onStartExam={handleOpenExamStudents}
            actionLabel="Xem học sinh"
            onDelete={handleDeleteExam}
          />

        </div>
      </main>

      {selectedExam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-5xl rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Danh sách học sinh theo bài thi</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{selectedExam.title}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedExam(null);
                  setSelectedAssessment(null);
                  setSelectedStudentName('');
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                Đóng
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              {studentListError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                  {studentListError}
                </div>
              )}

              {isStudentListLoading ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">Đang tải danh sách học sinh...</p>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-900">
                      <p className="text-sm text-gray-500 dark:text-gray-400">Chưa làm bài</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {examStudents.filter((item) => getStudentStatusMeta(item).label === 'Chưa làm bài').length}
                      </p>
                    </div>
                    <div className="rounded-lg border border-amber-200 dark:border-amber-800 p-4 bg-amber-50 dark:bg-amber-900/20">
                      <p className="text-sm text-amber-700 dark:text-amber-300">Đã nộp, đang chấm</p>
                      <p className="text-2xl font-bold text-amber-800 dark:text-amber-200">
                        {examStudents.filter((item) => getStudentStatusMeta(item).label === 'Đã nộp, đang chấm').length}
                      </p>
                    </div>
                    <div className="rounded-lg border border-green-200 dark:border-green-800 p-4 bg-green-50 dark:bg-green-900/20">
                      <p className="text-sm text-green-700 dark:text-green-300">Đã có kết quả</p>
                      <p className="text-2xl font-bold text-green-800 dark:text-green-200">
                        {examStudents.filter((item) => getStudentStatusMeta(item).label === 'Đã có kết quả').length}
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-800/60">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Học sinh</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Lớp</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Trạng thái</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Điểm</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Hành động</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-transparent">
                        {examStudents.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                              Chưa có học sinh nào trong bài thi này.
                            </td>
                          </tr>
                        ) : (
                          examStudents.map((item) => {
                            const statusMeta = getStudentStatusMeta(item);

                            return (
                              <tr key={`${item.studentId}-${item.studentExamId || 'empty'}`} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                                  <div>
                                    <p>{item.studentName}</p>
                                    {item.assessmentError && (
                                      <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{item.assessmentError}</p>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{item.schoolClassName || '—'}</td>
                                <td className="px-4 py-3 text-sm">
                                  <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusMeta.className}`}>
                                    {statusMeta.label}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                                  {typeof item.score === 'number' ? item.score.toFixed(1) : '—'}
                                </td>
                                <td className="px-4 py-3 text-sm">
                                  {item.canViewResult && item.studentExamId ? (
                                    <button
                                      type="button"
                                      onClick={() => handleViewStudentResult(item)}
                                      className="text-primary hover:text-primary-dark hover:underline transition-colors"
                                    >
                                      Xem kết quả
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

                  {(isAssessmentLoading || selectedAssessment) && (
                    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-5 bg-gray-50 dark:bg-gray-900/50 space-y-4">
                      <div>
                        <h4 className="text-base font-bold text-gray-900 dark:text-white">Kết quả bài làm</h4>
                        {selectedStudentName && (
                          <p className="text-sm text-gray-500 dark:text-gray-400">{selectedStudentName}</p>
                        )}
                      </div>

                      {isAssessmentLoading ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400">Đang tải chi tiết kết quả...</p>
                      ) : selectedAssessment && (
                        <>
                          <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-4 border border-blue-200 dark:border-blue-800">
                            <p className="text-sm text-gray-500 dark:text-gray-400">Điểm tổng</p>
                            <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">{selectedAssessment.score?.toFixed(1) ?? '—'}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Trạng thái: {selectedAssessment.assessmentStatus}</p>
                          </div>

                          {selectedAssessment.overallFeedback && (
                            <div>
                              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Nhận xét chung</p>
                              <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600 dark:text-gray-400">
                                {getFeedbackItems(selectedAssessment.overallFeedback).map((item, index) => (
                                  <li key={index}>{item}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          <div>
                            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Danh sách câu cần học lại</p>
                            {(selectedAssessment.wrongAnswers || []).length === 0 ? (
                              <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 text-sm text-green-700 dark:text-green-300">
                                Không có câu sai nào cần xem lại.
                              </div>
                            ) : (
                              <div className="space-y-4">
                                {groupWrongAnswerItems(selectedAssessment.wrongAnswers || []).map((section) =>
                                  section.type === 'group' ? (
                                    <div key={`group-${section.key}`} className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3 bg-white dark:bg-gray-900">
                                      {section.passageText && (
                                        <div className="rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 text-sm text-slate-700 dark:text-slate-200">
                                          <p className="font-semibold mb-1">Đoạn văn chung</p>
                                          <p>{section.passageText}</p>
                                        </div>
                                      )}
                                      {section.items.map((item, index) => (
                                        <div key={item.questionId} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-2">
                                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Mệnh đề {item.statementOrder ?? index + 1}</p>
                                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.questionContent}</p>
                                          <p className="text-sm text-red-600 dark:text-red-300"><span className="font-semibold">Đã chọn:</span> {item.selectedAnswer || 'Không có câu trả lời'}</p>
                                          <p className="text-sm text-green-700 dark:text-green-300"><span className="font-semibold">Đáp án đúng:</span> {item.correctAnswer || 'Không có dữ liệu'}</p>
                                          {item.keywordHint && <p className="text-sm text-blue-700 dark:text-blue-300"><span className="font-semibold">Từ khóa:</span> {item.keywordHint}</p>}
                                          {(item.errorExplanation || item.highlightText) && <p className="text-sm text-yellow-800 dark:text-yellow-200"><span className="font-semibold">Giải thích:</span> {item.errorExplanation || item.highlightText}</p>}
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div key={section.item.questionId} className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-2 bg-white dark:bg-gray-900">
                                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{section.item.questionContent}</p>
                                      <p className="text-sm text-red-600 dark:text-red-300"><span className="font-semibold">Đã chọn:</span> {section.item.selectedAnswer || 'Không có câu trả lời'}</p>
                                      <p className="text-sm text-green-700 dark:text-green-300"><span className="font-semibold">Đáp án đúng:</span> {section.item.correctAnswer || 'Không có dữ liệu'}</p>
                                      {section.item.keywordHint && <p className="text-sm text-blue-700 dark:text-blue-300"><span className="font-semibold">Từ khóa:</span> {section.item.keywordHint}</p>}
                                      {(section.item.errorExplanation || section.item.highlightText) && <p className="text-sm text-yellow-800 dark:text-yellow-200"><span className="font-semibold">Giải thích:</span> {section.item.errorExplanation || section.item.highlightText}</p>}
                                    </div>
                                  )
                                )}
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherDashboard;