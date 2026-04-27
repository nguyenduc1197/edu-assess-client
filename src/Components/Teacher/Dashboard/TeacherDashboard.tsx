import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Search, PlusCircle, Menu, Copy, Edit2, BarChart2 } from 'lucide-react';
import {
  AssessmentResult,
  Assignment,
  AssignmentStatus,
  ExamAnalytics,
  ExamStudentStatusItem,
  LoginProps,
  ScoreDistributionItem,
  SubjectLabel,
  User,
  WrongAnswerReview,
} from '../../../types';
import Sidebar from '../../Common/Sidebar/Sidebar';
import CreateExamModal from '../Exam/CreateExamModal';
import { fetchClient } from '../../../api/fetchClient';
import { getAssessmentStatusLabel } from '../../../utils/assessmentStatus';

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

const formatAccumulationPercent = (value?: number | null) => {
  if (value === null || value === undefined) return '--';
  return `${(value * 10).toFixed(0)}%`;
};

const formatAccumulationGain = (value?: number | null) => {
  if (value === null || value === undefined) return '--';

  const percentValue = `${(value * 10).toFixed(0)}%`;
  return value > 0 ? `+${percentValue}` : percentValue;
};

const getAccumulationGainTone = (value?: number | null) => {
  if (value === null || value === undefined) return 'text-gray-400 dark:text-gray-500';
  if (value > 0) return 'text-green-600 dark:text-green-400';
  if (value < 0) return 'text-red-600 dark:text-red-400';
  return 'text-gray-600 dark:text-gray-400';
};

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
  const [sortBy] = useState<'title' | 'subject' | 'deadline' | 'status'>('deadline');
  const [sortDirection] = useState<'asc' | 'desc'>('desc');
  const [studentSortBy, setStudentSortBy] = useState<'studentName' | 'schoolClassName' | 'assessmentStatus' | 'score'>('studentName');
  const [studentSortDirection, setStudentSortDirection] = useState<'asc' | 'desc'>('asc');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<{ id: string; name: string; start: string; end: string; questionIds: string[]; schoolClassId: string } | null>(null);
  const [selectedExam, setSelectedExam] = useState<Assignment | null>(null);
  const [examStudents, setExamStudents] = useState<ExamStudentStatusItem[]>([]);
  const [isStudentListLoading, setIsStudentListLoading] = useState(false);
  const [studentListError, setStudentListError] = useState('');
  const [selectedAssessment, setSelectedAssessment] = useState<AssessmentResult | null>(null);
  const [isAssessmentLoading, setIsAssessmentLoading] = useState(false);
  const [selectedStudentName, setSelectedStudentName] = useState('');
  const [examAnalytics, setExamAnalytics] = useState<ExamAnalytics | null>(null);
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState('');
  const [examDetailTab, setExamDetailTab] = useState<'students' | 'analytics'>('students');
  const [filterClassId, setFilterClassId] = useState('');
  const [filterClasses, setFilterClasses] = useState<{ id: string; name: string }[]>([]);
  const [totalExams, setTotalExams] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const PAGE_SIZE = 20;

  const fetchAssignments = useCallback(async (page = 1, classId = '', keyword = '') => {
    try {
      const query = new URLSearchParams({
        pageNumber: String(page),
        pageSize: String(PAGE_SIZE),
        sortBy: 'start',
        sortDirection: 'desc',
      });
      if (classId) query.append('schoolClassId', classId);
      if (keyword) query.append('keyword', keyword);

      const response = await fetchClient(`/exams?${query.toString()}`);
      
      if (response.ok) {
        const data = await response.json();
        const items = Array.isArray(data) ? data : (data.items || data.data || []);
        const total = data.totalCount ?? items.length;
        const pages = data.totalPages ?? (Math.ceil(total / PAGE_SIZE) || 1);
        setTotalExams(total);
        setTotalPages(pages);
        
        const mappedAssignments: Assignment[] = items.map((item: any) => {
          const endDate = new Date(item.end);
          const startDate = new Date(item.start);
          const now = new Date();
          
          let status = AssignmentStatus.NEW;
          if (now > endDate) {
            status = AssignmentStatus.GRADED;
          } else if (now >= startDate && now <= endDate) {
            status = AssignmentStatus.IN_PROGRESS;
          }

          return {
            id: item.id,
            title: item.name,
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchAssignments(currentPage, filterClassId, searchQuery);
  }, [fetchAssignments, currentPage, filterClassId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load classes for filter dropdown
  useEffect(() => {
    const loadClasses = async () => {
      try {
        const response = await fetchClient('/classes?pageNumber=1&pageSize=100');
        if (!response.ok) return;
        const data = await response.json();
        const items = Array.isArray(data) ? data : (data.items || data.data || []);
        setFilterClasses(items.map((c: any) => ({ id: c.id, name: c.name })));
      } catch (err) {
        console.error('Failed to load classes for filter', err);
      }
    };
    loadClasses();
  }, []);

  const handleStudentSort = useCallback((column: 'studentName' | 'schoolClassName' | 'assessmentStatus' | 'score') => {
    if (studentSortBy === column) {
      setStudentSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setStudentSortBy(column);
    setStudentSortDirection('asc');
  }, [studentSortBy]);

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
    const filtered = assignments.filter(a => 
      a.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const modifier = sortDirection === 'asc' ? 1 : -1;

    return [...filtered].sort((left, right) => {
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

  const sortedExamStudents = useMemo(() => {
    const modifier = studentSortDirection === 'asc' ? 1 : -1;

    return [...examStudents].sort((left, right) => {
      switch (studentSortBy) {
        case 'schoolClassName':
          return (left.schoolClassName || '').localeCompare(right.schoolClassName || '') * modifier;
        case 'assessmentStatus':
          return String(left.assessmentStatus || '').localeCompare(String(right.assessmentStatus || '')) * modifier;
        case 'score':
          return ((left.score ?? -1) - (right.score ?? -1)) * modifier;
        case 'studentName':
        default:
          return left.studentName.localeCompare(right.studentName) * modifier;
      }
    });
  }, [examStudents, studentSortBy, studentSortDirection]);

  const handleDeleteExam = async (examId: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa bài tập này không?")) {
      return;
    }

    try {
      const response = await fetchClient(`/exams/${examId}`, { method: "DELETE" });
      if (response.ok) {
        fetchAssignments(currentPage, filterClassId, searchQuery);
      } else {
        alert("Xóa thất bại. Vui lòng thử lại.");
      }
    } catch (error) {
      console.error("Error deleting exam:", error);
      alert("Đã xảy ra lỗi khi xóa bài tập.");
    }
  };

  const handleEditExam = async (assignment: Assignment) => {
    try {
      const [examRes, questionsRes] = await Promise.all([
        fetchClient(`/exams/${assignment.id}`),
        fetchClient(`/questions?examId=${assignment.id}&pageNumber=1&pageSize=200`),
      ]);
      const examData = examRes.ok ? await examRes.json() : {};
      const qData = questionsRes.ok ? await questionsRes.json() : [];
      const questionItems: any[] = Array.isArray(qData) ? qData : (qData.items || []);
      setEditingExam({
        id: assignment.id,
        name: examData.name || assignment.title,
        start: examData.start || assignment.deadline,
        end: examData.end || assignment.deadline,
        questionIds: questionItems.map((q: any) => q.id),
        schoolClassId: examData.schoolClassId || '',
      });
    } catch (err) {
      console.error('Failed to load exam for editing', err);
      setEditingExam({
        id: assignment.id,
        name: assignment.title,
        start: '',
        end: assignment.deadline,
        questionIds: [],
        schoolClassId: '',
      });
    }
  };

  const handleDuplicateExam = async (examId: string) => {
    try {
      const response = await fetchClient(`/exams/${examId}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      const result = await response.json();
      fetchAssignments(currentPage, filterClassId, searchQuery);
      if (result?.examId) {
        const newAssignment: Assignment = {
          id: result.examId,
          title: '',
          subject: SubjectLabel.GD_KTPL,
          deadline: '',
          deadlineDisplay: '',
          status: AssignmentStatus.NEW,
        };
        handleEditExam(newAssignment);
      }
    } catch (err) {
      console.error('Failed to duplicate exam', err);
      alert('Nhân đôi bài thi thất bại. Vui lòng thử lại.');
    }
  };

  const fetchExamAnalytics = async (examId: string) => {
    setIsAnalyticsLoading(true);
    setAnalyticsError('');
    setExamAnalytics(null);
    try {
      const response = await fetchClient(`/exams/${examId}/analytics`);
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      const data: ExamAnalytics = await response.json();
      setExamAnalytics(data);
    } catch (err) {
      console.error('Failed to fetch exam analytics', err);
      setAnalyticsError('Không thể tải dữ liệu phân tích.');
    } finally {
      setIsAnalyticsLoading(false);
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
{/* Create/Edit Exam Modal */}
      {(isCreateModalOpen || editingExam) && (
        <CreateExamModal 
          onClose={() => { setIsCreateModalOpen(false); setEditingExam(null); }} 
          onSuccess={() => {
            fetchAssignments(currentPage, filterClassId, searchQuery);
          }}
          examToEdit={editingExam}
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
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              {/* Search Input */}
              <div className="relative w-full sm:w-64">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                  <Search size={20} />
                </div>
                <input
                  type="text"
                  placeholder="Tìm bài tập..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') fetchAssignments(1, filterClassId, searchQuery);
                  }}
                  className="block h-10 w-full rounded-lg border border-gray-300 bg-white pl-10 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:ring-1 focus:ring-primary dark:border-gray-700 dark:bg-background-dark dark:text-white dark:placeholder-gray-500 transition-colors"
                />
              </div>

              {/* Class filter */}
              <select
                value={filterClassId}
                onChange={(e) => { setFilterClassId(e.target.value); setCurrentPage(1); }}
                className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-primary focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              >
                <option value="">Tất cả lớp</option>
                {filterClasses.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              <button
                onClick={() => fetchAssignments(1, filterClassId, searchQuery)}
                className="h-10 rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10 transition-colors"
              >
                Tìm kiếm
              </button>
            </div>

            <span className="text-sm text-gray-500 dark:text-gray-400">
              {totalExams} bài thi
            </span>
          </div>

          {/* Table Data */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Tên bài thi</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Thời hạn</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Trạng thái</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 dark:text-gray-300">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssignments.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                      Chưa có bài thi nào.
                    </td>
                  </tr>
                ) : (
                  filteredAssignments.map((a) => (
                    <tr key={a.id} className="border-b border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white max-w-[220px] truncate">
                        {a.title}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        {a.deadlineDisplay}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
                          a.status === AssignmentStatus.IN_PROGRESS
                            ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800'
                            : a.status === AssignmentStatus.GRADED
                            ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800'
                            : 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'
                        }`}>
                          {a.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            title="Xem học sinh"
                            onClick={() => handleOpenExamStudents(a)}
                            className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors text-xs font-medium"
                          >
                            Học sinh
                          </button>
                          <button
                            type="button"
                            title="Phân tích"
                            onClick={() => { handleOpenExamStudents(a); setExamDetailTab('analytics'); fetchExamAnalytics(a.id); }}
                            className="p-1.5 rounded-lg text-violet-600 hover:bg-violet-50 dark:text-violet-400 dark:hover:bg-violet-900/20 transition-colors"
                          >
                            <BarChart2 size={16} />
                          </button>
                          <button
                            type="button"
                            title="Chỉnh sửa"
                            onClick={() => handleEditExam(a)}
                            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 transition-colors"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            type="button"
                            title="Nhân đôi"
                            onClick={() => handleDuplicateExam(a.id)}
                            className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20 transition-colors"
                          >
                            <Copy size={16} />
                          </button>
                          <button
                            type="button"
                            title="Xóa"
                            onClick={() => handleDeleteExam(a.id)}
                            className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="h-9 px-3 rounded-lg border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
              >
                ‹
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => Math.abs(p - currentPage) <= 2)
                .map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setCurrentPage(p)}
                    className={`h-9 w-9 rounded-lg border text-sm font-medium transition-colors ${
                      p === currentPage
                        ? 'border-primary bg-primary text-white'
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="h-9 px-3 rounded-lg border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
              >
                ›
              </button>
            </div>
          )}

        </div>
      </main>

      {selectedExam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-5xl rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{selectedExam.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedExam(null);
                  setSelectedAssessment(null);
                  setSelectedStudentName('');
                  setExamAnalytics(null);
                  setExamDetailTab('students');
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                Đóng
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-700 px-6">
              <button
                onClick={() => setExamDetailTab('students')}
                className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                  examDetailTab === 'students'
                    ? 'border-primary text-primary dark:border-blue-400 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}
              >
                Học sinh
              </button>
              <button
                onClick={() => {
                  setExamDetailTab('analytics');
                  if (!examAnalytics && selectedExam) fetchExamAnalytics(selectedExam.id);
                }}
                className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                  examDetailTab === 'analytics'
                    ? 'border-primary text-primary dark:border-blue-400 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}
              >
                Phân tích
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {examDetailTab === 'students' && (
                <>
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
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"><button type="button" onClick={() => handleStudentSort('studentName')} className="hover:text-gray-700 dark:hover:text-gray-200">Học sinh {studentSortBy === 'studentName' ? (studentSortDirection === 'asc' ? '^' : 'v') : '<->'}</button></th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"><button type="button" onClick={() => handleStudentSort('schoolClassName')} className="hover:text-gray-700 dark:hover:text-gray-200">Lớp {studentSortBy === 'schoolClassName' ? (studentSortDirection === 'asc' ? '^' : 'v') : '<->'}</button></th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"><button type="button" onClick={() => handleStudentSort('assessmentStatus')} className="hover:text-gray-700 dark:hover:text-gray-200">Trạng thái {studentSortBy === 'assessmentStatus' ? (studentSortDirection === 'asc' ? '^' : 'v') : '<->'}</button></th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"><button type="button" onClick={() => handleStudentSort('score')} className="hover:text-gray-700 dark:hover:text-gray-200">Điểm {studentSortBy === 'score' ? (studentSortDirection === 'asc' ? '^' : 'v') : '<->'}</button></th>
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
                          sortedExamStudents.map((item) => {
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
                            <p className="text-sm text-gray-500 dark:text-gray-400">Trạng thái: {getAssessmentStatusLabel(selectedAssessment.assessmentStatus)}</p>
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

                          {selectedAssessment.completedExamCount > 0 && (
                            <div className="space-y-4">
                              <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Tiến độ năng lực qua các bài kiểm tra</h5>

                              {selectedAssessment.behaviorAdjustmentAccumulation && (
                                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Năng lực điều chỉnh hành vi</p>
                                  <div className="grid grid-cols-3 gap-3">
                                    <div className="text-center">
                                      <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">Lần này</p>
                                      <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                                        {formatAccumulationPercent(selectedAssessment.behaviorAdjustmentAccumulation.latestScore)}
                                      </p>
                                    </div>
                                    <div className="text-center">
                                      <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">Trung bình</p>
                                      <p className="text-lg font-bold text-green-600 dark:text-green-400">
                                        {formatAccumulationPercent(selectedAssessment.behaviorAdjustmentAccumulation.averageScore)}
                                      </p>
                                    </div>
                                    <div className="text-center">
                                      <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">So với trước</p>
                                      <p className={`text-lg font-bold ${getAccumulationGainTone(selectedAssessment.behaviorAdjustmentAccumulation.gainVsPreviousAttempt)}`}>
                                        {formatAccumulationGain(selectedAssessment.behaviorAdjustmentAccumulation.gainVsPreviousAttempt)}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {selectedAssessment.selfDevelopmentAccumulation && (
                                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Năng lực phát triển bản thân</p>
                                  <div className="grid grid-cols-3 gap-3">
                                    <div className="text-center">
                                      <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">Lần này</p>
                                      <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                                        {formatAccumulationPercent(selectedAssessment.selfDevelopmentAccumulation.latestScore)}
                                      </p>
                                    </div>
                                    <div className="text-center">
                                      <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">Trung bình</p>
                                      <p className="text-lg font-bold text-green-600 dark:text-green-400">
                                        {formatAccumulationPercent(selectedAssessment.selfDevelopmentAccumulation.averageScore)}
                                      </p>
                                    </div>
                                    <div className="text-center">
                                      <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">So với trước</p>
                                      <p className={`text-lg font-bold ${getAccumulationGainTone(selectedAssessment.selfDevelopmentAccumulation.gainVsPreviousAttempt)}`}>
                                        {formatAccumulationGain(selectedAssessment.selfDevelopmentAccumulation.gainVsPreviousAttempt)}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {selectedAssessment.economicSocialParticipationAccumulation && (
                                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Năng lực Tìm kiếm Tham gia KT-XH</p>
                                  <div className="grid grid-cols-3 gap-3">
                                    <div className="text-center">
                                      <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">Lần này</p>
                                      <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                                        {formatAccumulationPercent(selectedAssessment.economicSocialParticipationAccumulation.latestScore)}
                                      </p>
                                    </div>
                                    <div className="text-center">
                                      <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">Trung bình</p>
                                      <p className="text-lg font-bold text-green-600 dark:text-green-400">
                                        {formatAccumulationPercent(selectedAssessment.economicSocialParticipationAccumulation.averageScore)}
                                      </p>
                                    </div>
                                    <div className="text-center">
                                      <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">So với trước</p>
                                      <p className={`text-lg font-bold ${getAccumulationGainTone(selectedAssessment.economicSocialParticipationAccumulation.gainVsPreviousAttempt)}`}>
                                        {formatAccumulationGain(selectedAssessment.economicSocialParticipationAccumulation.gainVsPreviousAttempt)}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )}
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
                                          {(item.errorExplanation || item.highlightText) && <p className="text-sm text-yellow-800 dark:text-yellow-200"><span className="font-semibold">Giải thích:</span> {item.errorExplanation || item.highlightText}</p>}
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div key={section.item.questionId} className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-2 bg-white dark:bg-gray-900">
                                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{section.item.questionContent}</p>
                                      <p className="text-sm text-red-600 dark:text-red-300"><span className="font-semibold">Đã chọn:</span> {section.item.selectedAnswer || 'Không có câu trả lời'}</p>
                                      <p className="text-sm text-green-700 dark:text-green-300"><span className="font-semibold">Đáp án đúng:</span> {section.item.correctAnswer || 'Không có dữ liệu'}</p>
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
                </>
              )}

              {examDetailTab === 'analytics' && (
                <div className="space-y-5">
                  {analyticsError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                      {analyticsError}
                    </div>
                  )}
                  {isAnalyticsLoading ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">Đang tải phân tích...</p>
                  ) : examAnalytics ? (
                    <>
                      {/* Summary */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center bg-white dark:bg-gray-900">
                          <p className="text-xs text-gray-500 dark:text-gray-400">Tổng học sinh</p>
                          <p className="text-2xl font-bold text-gray-900 dark:text-white">{examAnalytics.totalStudents}</p>
                        </div>
                        <div className="rounded-lg border border-blue-200 dark:border-blue-800 p-3 text-center bg-blue-50 dark:bg-blue-900/20">
                          <p className="text-xs text-blue-600 dark:text-blue-400">Đã nộp</p>
                          <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{examAnalytics.submittedCount}</p>
                        </div>
                        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center bg-white dark:bg-gray-900">
                          <p className="text-xs text-gray-500 dark:text-gray-400">Cao nhất</p>
                          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{examAnalytics.highestScore?.toFixed(1)}</p>
                        </div>
                        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center bg-white dark:bg-gray-900">
                          <p className="text-xs text-gray-500 dark:text-gray-400">Thấp nhất</p>
                          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{examAnalytics.lowestScore?.toFixed(1)}</p>
                        </div>
                      </div>

                      {/* Competency averages */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-800 dark:bg-violet-900/20">
                          <p className="text-xs font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400 mb-1">Điều chỉnh hành vi</p>
                          <p className="text-3xl font-bold text-violet-700 dark:text-violet-300">
                            {examAnalytics.averageBehaviorAdjustmentScore !== null ? examAnalytics.averageBehaviorAdjustmentScore?.toFixed(2) : '--'}
                          </p>
                        </div>
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20">
                          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 mb-1">Phát triển bản thân</p>
                          <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-300">
                            {examAnalytics.averageSelfDevelopmentScore !== null ? examAnalytics.averageSelfDevelopmentScore?.toFixed(2) : '--'}
                          </p>
                        </div>
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
                          <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400 mb-1">Tìm kiếm Tham gia KT-XH</p>
                          <p className="text-3xl font-bold text-amber-700 dark:text-amber-300">
                            {examAnalytics.averageEconomicSocialParticipationScore !== null ? examAnalytics.averageEconomicSocialParticipationScore?.toFixed(2) : '--'}
                          </p>
                        </div>
                      </div>

                      {/* Score Distribution Bar Chart */}
                      {examAnalytics.scoreDistribution && examAnalytics.scoreDistribution.length > 0 && (
                        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
                          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Phân bố điểm số</h4>
                          <div className="flex items-end gap-2 h-32">
                            {(() => {
                              const maxCount = Math.max(...examAnalytics.scoreDistribution.map((d: ScoreDistributionItem) => d.count), 1);
                              return examAnalytics.scoreDistribution.map((d: ScoreDistributionItem) => (
                                <div key={d.label} className="flex flex-1 flex-col items-center gap-1">
                                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{d.count}</span>
                                  <div
                                    className="w-full rounded-t bg-primary/70 dark:bg-blue-500/70 transition-all"
                                    style={{ height: `${(d.count / maxCount) * 96}px`, minHeight: '2px' }}
                                  />
                                  <span className="text-xs text-gray-500 dark:text-gray-400">{d.label}</span>
                                </div>
                              ));
                            })()}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">Không có dữ liệu phân tích.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherDashboard;
