import React, { useCallback, useEffect, useState } from 'react';
import { Eye } from 'lucide-react';
import {
  AntiCheatBreakdownItem,
  AntiCheatDetailsResponse,
  AntiCheatRecentEvent,
  AntiCheatStatus,
  AssessmentResult,
  Class as SchoolClass,
  CompetencyAccumulation,
  Student,
  StudentResultSummary,
  User,
  WrongAnswerReview,
} from '../../../types';
import Sidebar from '../../Common/Sidebar/Sidebar';
import { fetchClient } from '../../../api/fetchClient';
import { MobileBottomNav, MobileHeaderBar } from '../../Common/MobileAppChrome/MobileAppChrome';
import { getAssessmentStatusLabel } from '../../../utils/assessmentStatus';
import { competencyScoreToPercent, formatCompetencyPercent } from '../../../utils/competencyPercent';

interface TeacherResultsProps {
  onLogout?: () => void;
}

type DetailTab = 'assessment' | 'antiCheat';

const RECENT_ANTI_CHEAT_EVENT_LIMIT = 50;

const mockUser: User = {
  id: '81114DB7-EF7C-4CEC-97B1-4428AA7AADA6',
  name: localStorage.getItem('name') || 'An Nguyen',
  email: localStorage.getItem('email') || 'an.nguyen@school.edu',
  avatarUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBaWbkVJIW-UxVbQAZVdNrwMze37EFXHpuuLhTSw7WJksMYe3RyK6MlICHa5M_rj6rAY8fmpaTsje51sF_GaYmBr15LrSN-IPsN9CSad_0QSDbvg69dUedrdiq4gN0Ev5352TfW0E_YrYXi0ugbxl2tDCdOwo84g_5dR-RxAreLeGB0Bs-5JS0tvLlFklj1uRh9wPZecX3HEGBS1Cgfm6tBuHD_pCTa6Z_JZN2Vzxo69eS-QEJjRqrhjg5yFrZfRnFYPL7VgejfRtgj',
};

const getFeedbackItems = (feedback?: string | null) =>
  (feedback || '')
    .split(/\r?\n|•/)
    .map((item) => item.replace(/^[-•]\s*/, '').trim())
    .filter(Boolean);

const formatScoreChipValue = (value?: number | null) => {
  return formatCompetencyPercent(value, { fractionDigits: 0 });
};

const formatGainChipValue = (value?: number | null) => {
  return formatCompetencyPercent(value, { fractionDigits: 0, signed: true });
};

const getGainChipTone = (value?: number | null) => {
  if (value === null || value === undefined) return 'text-gray-500 dark:text-gray-400';
  if (value > 0) return 'text-emerald-700 dark:text-emerald-300';
  if (value < 0) return 'text-red-700 dark:text-red-300';
  return 'text-gray-600 dark:text-gray-300';
};

const ProgressChip: React.FC<{
  label: string;
  accumulation?: CompetencyAccumulation | null;
}> = ({ label, accumulation }) => {
  if (!accumulation) return null;

  return (
      <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800/70">
        <div className="font-semibold text-slate-700 dark:text-slate-200">{label}</div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-slate-600 dark:text-slate-300">
          <span>Hiện tại {formatScoreChipValue(accumulation.latestScore)}</span>
          <span>Trung bình {formatScoreChipValue(accumulation.averageScore)}</span>
          <span className={getGainChipTone(accumulation.gainVsPreviousAttempt)}>
            {formatGainChipValue(accumulation.gainVsPreviousAttempt)}
          </span>
      </div>
    </div>
  );
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

const formatAntiCheatStatusLabel = (status?: AntiCheatStatus | null) => {
  if (!status) return 'Chưa có dữ liệu';

  switch (status) {
    case 'Normal':
      return 'Bình thường';
    case 'Suspicious':
      return 'Khả nghi';
    case 'Violated':
      return 'Vi phạm';
    default:
      return status;
  }
};

const getAntiCheatStatusClassName = (status?: AntiCheatStatus | null) => {
  if (!status) {
    return 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300';
  }

  if (status === 'Normal') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
  }

  if (status === 'Suspicious') {
    return 'border-amber-300 bg-amber-50 text-amber-800 ring-1 ring-amber-200 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200 dark:ring-amber-800';
  }

  return 'border-red-300 bg-red-50 text-red-700 ring-1 ring-red-200 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200 dark:ring-red-800';
};

const AntiCheatStatusBadge: React.FC<{
  status?: AntiCheatStatus | null;
}> = ({ status }) => (
  <span className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-semibold ${getAntiCheatStatusClassName(status)}`}>
    {formatAntiCheatStatusLabel(status)}
  </span>
);

const formatEventTypeLabel = (eventType: string) => {
  const labels: Record<string, string> = {
    PageHidden: 'Ẩn trang',
    PageVisible: 'Hiện lại trang',
    WindowBlur: 'Mất focus cửa sổ',
    WindowFocus: 'Lấy lại focus cửa sổ',
    FullscreenExited: 'Thoát toàn màn hình',
    FullscreenEntered: 'Vào toàn màn hình',
    Copy: 'Sao chép',
    Paste: 'Dán',
    Reload: 'Tải lại trang',
    Offline: 'Mất mạng',
    Online: 'Có mạng lại',
    AttemptOpenedInAnotherTab: 'Mở ở tab khác',
    AttemptResumed: 'Tiếp tục phiên',
  };

  return labels[eventType] || eventType;
};

const formatMetadata = (metadata?: string | null) => {
  if (!metadata) return '—';

  try {
    const parsed = JSON.parse(metadata) as Record<string, unknown>;
    return Object.entries(parsed)
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join(' • ');
  } catch {
    return metadata;
  }
};

const AntiCheatMetricCard: React.FC<{
  label: string;
  value: string | number;
  tone?: 'default' | 'warning';
}> = ({ label, value, tone = 'default' }) => (
  <div className={`rounded-xl border p-4 ${
    tone === 'warning'
      ? 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20'
      : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900'
  }`}>
    <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
    <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
  </div>
);

const getAntiCheatSummaryToneClassName = (status?: AntiCheatStatus | null) => {
  if (status === 'Normal') {
    return 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20';
  }

  if (status === 'Suspicious') {
    return 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20';
  }

  return 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20';
};

const isAntiCheatEnabled = (detail?: AntiCheatDetailsResponse | null) =>
  detail?.isEnabled ?? detail?.summary?.isEnabled ?? true;

const TeacherResults: React.FC<TeacherResultsProps> = ({ onLogout }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [results, setResults] = useState<StudentResultSummary[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [sortBy, setSortBy] = useState<'finishedAt' | 'assessedAt' | 'score' | 'studentName' | 'examName'>('finishedAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [detailTab, setDetailTab] = useState<DetailTab>('assessment');
  const [selectedResultSummary, setSelectedResultSummary] = useState<StudentResultSummary | null>(null);
  const [selectedResult, setSelectedResult] = useState<AssessmentResult | null>(null);
  const [antiCheatDetail, setAntiCheatDetail] = useState<AntiCheatDetailsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isAntiCheatLoading, setIsAntiCheatLoading] = useState(false);
  const [antiCheatError, setAntiCheatError] = useState('');
  const [isAntiCheatEmpty, setIsAntiCheatEmpty] = useState(false);
  const [error, setError] = useState('');

  const fetchMetadata = useCallback(async () => {
    try {
      const [examResponse, classResponse, studentResponse] = await Promise.all([
        fetchClient('/exams?pageNumber=1&pageSize=100'),
        fetchClient('/classes?pageNumber=1&pageSize=100'),
        fetchClient('/students?pageNumber=1&pageSize=100&isDeleted=false'),
      ]);

      if (examResponse.ok) {
        const examData = await examResponse.json();
        setExams(Array.isArray(examData) ? examData : (examData.items || examData.data || []));
      }

      if (classResponse.ok) {
        const classData = await classResponse.json();
        setClasses(Array.isArray(classData) ? classData : (classData.items || classData.data || []));
      }

      if (studentResponse.ok) {
        const studentData = await studentResponse.json();
        setStudents(Array.isArray(studentData) ? studentData : (studentData.items || studentData.data || []));
      }
    } catch (loadError) {
      console.error('Failed to fetch filter metadata', loadError);
    }
  }, []);

  const fetchResults = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');

      const params = new URLSearchParams();
      if (selectedExamId) params.append('examId', selectedExamId);
      if (selectedClassId) params.append('schoolClassId', selectedClassId);
      if (selectedStudentId) params.append('studentId', selectedStudentId);
      if (selectedStatus) params.append('assessmentStatus', selectedStatus);
      params.append('sortBy', sortBy);
      params.append('sortDirection', sortDirection);

      const query = params.toString();
      const response = await fetchClient(`/student-exams/results${query ? `?${query}` : ''}`);

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();
      setResults(Array.isArray(data) ? data : (data.items || data.data || []));
    } catch (loadError) {
      console.error('Failed to fetch student results', loadError);
      setResults([]);
      setError('Không thể tải danh sách kết quả học sinh.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedExamId, selectedClassId, selectedStudentId, selectedStatus, sortBy, sortDirection]);

  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  const handleSort = (column: 'finishedAt' | 'assessedAt' | 'score' | 'studentName' | 'examName') => {
    if (sortBy === column) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortBy(column);
    setSortDirection(column === 'score' ? 'desc' : 'asc');
  };

  const fetchAssessmentDetail = useCallback(async (studentExamId: string, silent = false) => {
    try {
      if (!silent) setIsDetailLoading(true);
      const encodedStudentExamId = encodeURIComponent(studentExamId);

      const response = await fetchClient(`/student-exams/${encodedStudentExamId}/assessment`);

      if (!response.ok) {
        throw new Error('Load detail failed');
      }

      const data: AssessmentResult = await response.json();
      setSelectedResult(data);
      return data;
    } catch (detailError) {
      console.error('Failed to load result detail', detailError);
      setError('Không thể tải chi tiết bài đánh giá.');
      return null;
    } finally {
      if (!silent) setIsDetailLoading(false);
    }
  }, []);

  const fetchAntiCheatDetail = useCallback(async (studentExamId: string) => {
    try {
      setIsAntiCheatLoading(true);
      setAntiCheatError('');
      setIsAntiCheatEmpty(false);
      const encodedStudentExamId = encodeURIComponent(studentExamId);

      const response = await fetchClient(`/student-exams/${encodedStudentExamId}/anti-cheat/details?recentEventLimit=${RECENT_ANTI_CHEAT_EVENT_LIMIT}`);

      if (response.status === 404) {
        setAntiCheatDetail(null);
        setIsAntiCheatEmpty(true);
        return null;
      }

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data: AntiCheatDetailsResponse = await response.json();
      setAntiCheatDetail(data);
      return data;
    } catch (detailError) {
      console.error('Failed to load anti-cheat detail', detailError);
      setAntiCheatDetail(null);
      setAntiCheatError('Không thể tải dữ liệu vi phạm.');
      return null;
    } finally {
      setIsAntiCheatLoading(false);
    }
  }, []);

  const handleViewDetails = async (resultSummary: StudentResultSummary) => {
    setDetailTab('assessment');
    setSelectedResultSummary(resultSummary);
    setAntiCheatDetail(null);
    setAntiCheatError('');
    setIsAntiCheatEmpty(false);
    await Promise.allSettled([
      fetchAssessmentDetail(resultSummary.studentExamId),
      fetchAntiCheatDetail(resultSummary.studentExamId),
    ]);
  };

  useEffect(() => {
    if (!selectedResult?.studentExamId || selectedResult.assessmentStatus !== 'Pending') {
      return;
    }

    const intervalId = window.setInterval(() => {
      fetchAssessmentDetail(selectedResult.studentExamId, true);
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [fetchAssessmentDetail, selectedResult?.assessmentStatus, selectedResult?.studentExamId]);

  useEffect(() => {
    if (!selectedResultSummary && !selectedResult) {
      setDetailTab('assessment');
      setAntiCheatDetail(null);
      setAntiCheatError('');
      setIsAntiCheatEmpty(false);
    }
  }, [selectedResult, selectedResultSummary]);

  const formatDateTime = (value?: string | null) => {
    if (!value) return '—';
    return new Date(value).toLocaleString('vi-VN');
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col lg:flex-row group/design-root">
      <MobileHeaderBar
        title="Kết quả học sinh"
        subtitle="Theo dõi điểm số và phản hồi AI với bố cục tối ưu cho mobile."
        onOpenMenu={() => setIsSidebarOpen(true)}
      />

      <Sidebar user={mockUser} isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} onLogout={onLogout} />
      <MobileBottomNav onOpenMenu={() => setIsSidebarOpen(true)} />

      <main className="mobile-safe-bottom min-h-[calc(100dvh-var(--mobile-app-header-height))] flex-1 overflow-x-hidden overflow-y-auto px-4 py-8 sm:px-8 lg:h-screen lg:p-8 lg:pb-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-8">
          <div className="rounded-3xl border border-slate-200/80 bg-gradient-to-r from-white via-amber-50 to-orange-50 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-2">
              <span className="inline-flex w-fit items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                Phân tích kết quả
              </span>
              <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Kết Quả Học Sinh</h1>
              <p className="text-base text-gray-600 dark:text-gray-400">Theo dõi điểm số và phản hồi AI của học sinh theo thời gian thực</p>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
            <select value={selectedExamId} onChange={(e) => setSelectedExamId(e.target.value)} className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white">
              <option value="">Tất cả bài thi</option>
              {exams.map((exam) => (
                <option key={exam.id} value={exam.id}>{exam.name}</option>
              ))}
            </select>

            <select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)} className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white">
              <option value="">Tất cả lớp</option>
              {classes.map((schoolClass) => (
                <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>
              ))}
            </select>

            <select value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)} className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white">
              <option value="">Tất cả học sinh</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>{student.name}</option>
              ))}
            </select>

            <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white">
              <option value="">Tất cả trạng thái</option>
              <option value="Pending">Đang chấm</option>
              <option value="Completed">Đã hoàn thành</option>
              <option value="Failed">Đánh giá lỗi</option>
            </select>

          </div>

          <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-gray-500 dark:text-gray-400">Đang tải...</p>
              </div>
            ) : results.length > 0 ? (
              <>
                <div className="space-y-3 p-3 sm:hidden">
                  {results.map((result) => (
                    <div key={result.studentExamId} className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800/40">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{result.examName}</p>
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{result.studentName} · {result.schoolClassName}</p>
                          <div className="mt-2">
                            <AntiCheatStatusBadge status={result.antiCheatStatus} />
                          </div>
                        </div>
                        <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{result.score ?? '—'}</span>
                      </div>
                      <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                        {getAssessmentStatusLabel(result.assessmentStatus)} · {formatDateTime(result.finishedAt)}
                      </p>
                      <div className="mt-3 space-y-2 text-sm text-gray-500 dark:text-gray-400">
                        <div className="font-medium text-gray-700 dark:text-gray-200">
                          {result.completedExamCount ? `${result.completedExamCount} bài đã tính` : 'Chưa có lịch sử'}
                        </div>
                        <div className="space-y-2">
                          <ProgressChip label="Điều chỉnh hành vi" accumulation={result.behaviorAdjustmentAccumulation} />
                          <ProgressChip label="Phát triển bản thân" accumulation={result.selfDevelopmentAccumulation} />
                          <ProgressChip label="Tìm hiểu Tham gia KT-XH" accumulation={result.economicSocialParticipationAccumulation} />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleViewDetails(result)}
                        className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark"
                      >
                        <Eye size={16} />
                        Xem chi tiết
                      </button>
                    </div>
                  ))}
                </div>

                <div className="hidden overflow-x-auto sm:block">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300"><button type="button" onClick={() => handleSort('examName')} className="hover:text-gray-900 dark:hover:text-white">Bài Thi {sortBy === 'examName' ? (sortDirection === 'asc' ? '^' : 'v') : '<->'}</button></th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300"><button type="button" onClick={() => handleSort('studentName')} className="hover:text-gray-900 dark:hover:text-white">Học Sinh {sortBy === 'studentName' ? (sortDirection === 'asc' ? '^' : 'v') : '<->'}</button></th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Lớp</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300"><button type="button" onClick={() => handleSort('score')} className="hover:text-gray-900 dark:hover:text-white">Điểm {sortBy === 'score' ? (sortDirection === 'asc' ? '^' : 'v') : '<->'}</button></th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Tiến độ</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Trạng Thái</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Anti-cheat</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300"><button type="button" onClick={() => handleSort('finishedAt')} className="hover:text-gray-900 dark:hover:text-white">Nộp Lúc {sortBy === 'finishedAt' ? (sortDirection === 'asc' ? '^' : 'v') : '<->'}</button></th>
                        <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700 dark:text-gray-300">Chi Tiết</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((result) => (
                        <tr key={result.studentExamId} className="border-b border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                          <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{result.examName}</td>
                          <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{result.studentName}</td>
                          <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{result.schoolClassName}</td>
                          <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{result.score ?? '—'}</td>
                          <td className="px-6 py-4 align-top">
                            <div className="min-w-[280px] space-y-2 text-sm text-gray-500 dark:text-gray-400">
                              <div className="font-medium text-gray-700 dark:text-gray-200">
                                {result.completedExamCount ? `${result.completedExamCount} bài đã tính` : 'Chưa có lịch sử'}
                              </div>
                              <div className="space-y-2">
                                <ProgressChip label="Điều chỉnh hành vi" accumulation={result.behaviorAdjustmentAccumulation} />
                                <ProgressChip label="Phát triển bản thân" accumulation={result.selfDevelopmentAccumulation} />
                                <ProgressChip label="Tìm hiểu Tham gia KT-XH" accumulation={result.economicSocialParticipationAccumulation} />
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{getAssessmentStatusLabel(result.assessmentStatus)}</td>
                          <td className="px-6 py-4">
                            <AntiCheatStatusBadge status={result.antiCheatStatus} />
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{formatDateTime(result.finishedAt)}</td>
                          <td className="px-6 py-4 text-center">
                            <button
                              type="button"
                              onClick={() => handleViewDetails(result)}
                              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 transition-colors"
                            >
                              <Eye size={16} />
                              Xem
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center py-12 text-gray-500 dark:text-gray-400">
                Chưa có kết quả nào phù hợp với bộ lọc hiện tại.
              </div>
            )}
          </div>
        </div>
      </main>

      {(selectedResultSummary || selectedResult || isDetailLoading) && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
          <div className="flex max-h-[var(--mobile-modal-max-height)] w-full flex-col rounded-t-3xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900 sm:max-w-2xl sm:rounded-xl">
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200 dark:border-gray-700 sm:px-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Chi Tiết Kết Quả</h3>
                {selectedResultSummary?.antiCheatStatus && (
                  <div className="mt-2">
                    <AntiCheatStatusBadge status={selectedResultSummary.antiCheatStatus} />
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedResult(null);
                  setSelectedResultSummary(null);
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                Đóng
              </button>
            </div>

            <div
              className="flex overflow-x-auto border-b border-gray-200 px-4 dark:border-gray-700 sm:px-6"
              role="tablist"
              aria-label="Điều hướng tab chi tiết kết quả"
            >
              <button
                type="button"
                onClick={() => setDetailTab('assessment')}
                role="tab"
                aria-selected={detailTab === 'assessment'}
                className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                  detailTab === 'assessment'
                    ? 'border-primary text-primary dark:border-blue-400 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}
              >
                Đánh giá
              </button>
              <button
                type="button"
                onClick={() => setDetailTab('antiCheat')}
                role="tab"
                aria-selected={detailTab === 'antiCheat'}
                className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                  detailTab === 'antiCheat'
                    ? 'border-primary text-primary dark:border-blue-400 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}
              >
                Vi phạm
              </button>
            </div>

            <div className="max-h-[calc(90dvh-var(--mobile-modal-header-height))] space-y-4 overflow-y-auto p-4 sm:p-6">
              {detailTab === 'assessment' && isDetailLoading ? (
                <p className="text-gray-500 dark:text-gray-400">Đang tải chi tiết...</p>
              ) : detailTab === 'assessment' && selectedResult ? (
                <>
                  <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-4 border border-blue-200 dark:border-blue-800">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Điểm tổng</p>
                    <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">{selectedResult.score?.toFixed(1) ?? '—'}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Trạng thái: {getAssessmentStatusLabel(selectedResult.assessmentStatus)}</p>
                  </div>

                  {selectedResult.overallFeedback && (
                    <div>
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Nhận xét chung</p>
                      <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600 dark:text-gray-400">
                        {getFeedbackItems(selectedResult.overallFeedback).map((item, index) => (
                          <li key={index}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="space-y-3">
                    {selectedResult.behaviorAdjustmentScore !== null && (
                      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Năng lực điều chỉnh hành vi</p>
                          <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                            {formatCompetencyPercent(selectedResult.behaviorAdjustmentScore, { fractionDigits: 0, clamp: true })}
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                          <div className="h-full rounded-full bg-indigo-500 dark:bg-indigo-400" style={{ width: `${competencyScoreToPercent(selectedResult.behaviorAdjustmentScore, { clamp: true })}%` }} />
                        </div>
                        {selectedResult.behaviorAdjustmentFeedback && (
                          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{selectedResult.behaviorAdjustmentFeedback}</p>
                        )}
                      </div>
                    )}
                    {selectedResult.selfDevelopmentScore !== null && (
                      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Năng lực phát triển bản thân</p>
                          <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                            {formatCompetencyPercent(selectedResult.selfDevelopmentScore, { fractionDigits: 0, clamp: true })}
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                          <div className="h-full rounded-full bg-indigo-500 dark:bg-indigo-400" style={{ width: `${competencyScoreToPercent(selectedResult.selfDevelopmentScore, { clamp: true })}%` }} />
                        </div>
                        {selectedResult.selfDevelopmentFeedback && (
                          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{selectedResult.selfDevelopmentFeedback}</p>
                        )}
                      </div>
                    )}
                    {selectedResult.economicSocialParticipationScore !== null && (
                      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Năng lực tìm hiểu và tham gia hoạt động kinh tế - xã hội</p>
                          <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                            {formatCompetencyPercent(selectedResult.economicSocialParticipationScore, { fractionDigits: 0, clamp: true })}
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                          <div className="h-full rounded-full bg-indigo-500 dark:bg-indigo-400" style={{ width: `${competencyScoreToPercent(selectedResult.economicSocialParticipationScore, { clamp: true })}%` }} />
                        </div>
                        {selectedResult.economicSocialParticipationFeedback && (
                          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{selectedResult.economicSocialParticipationFeedback}</p>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Danh sách câu cần học lại</p>

                    {selectedResult.assessmentStatus === 'Pending' && (
                      <div className="mb-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-200">
                        Bài đang được AI đánh giá. Thông tin sẽ tự cập nhật sau mỗi vài giây.
                      </div>
                    )}

                    {(selectedResult.wrongAnswers || []).length === 0 ? (
                      <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 text-sm text-green-700 dark:text-green-300">
                        Không có câu sai nào cần xem lại.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {groupWrongAnswerItems(selectedResult.wrongAnswers || []).map((section) =>
                          section.type === 'group' ? (
                            <div key={`group-${section.key}`} className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
                              {section.passageText && (
                                <div className="rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 text-sm text-slate-700 dark:text-slate-200">
                                  <p className="font-semibold mb-1">Đoạn văn chung</p>
                                  <p>{section.passageText}</p>
                                </div>
                              )}

                              <p className="text-sm font-semibold text-gray-900 dark:text-white">Nhóm mệnh đề Đúng / Sai</p>

                              <div className="space-y-3">
                                {section.items.map((item, index) => (
                                  <div key={item.questionId} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-800/40 p-4 space-y-3">
                                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Mệnh đề {item.statementOrder ?? index + 1}</p>
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.questionContent}</p>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                      <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
                                        <p className="font-semibold text-red-700 dark:text-red-300">Học sinh đã chọn</p>
                                        <p className="mt-1 text-red-600 dark:text-red-200">{item.selectedAnswer || 'Không có câu trả lời'}</p>
                                      </div>
                                      <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3">
                                        <p className="font-semibold text-green-700 dark:text-green-300">Đáp án đúng</p>
                                        <p className="mt-1 text-green-700 dark:text-green-200">{item.correctAnswer || 'Không có dữ liệu'}</p>
                                      </div>
                                    </div>

                                    {(item.errorExplanation || item.highlightText) && (
                                      <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-3 text-sm text-yellow-800 dark:text-yellow-200">
                                        <p className="font-semibold mb-1">Vì sao đáp án đã chọn chưa đúng</p>
                                        <p>{item.errorExplanation || item.highlightText}</p>
                                      </div>
                                    )}

                                    {item.guidanceNote && (
                                      <p className="text-sm text-gray-600 dark:text-gray-300">
                                        <span className="font-semibold">Gợi ý:</span> {item.guidanceNote}
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div key={section.item.questionId} className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3">
                              {section.item.passageText && (
                                <div className="rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 text-sm text-slate-700 dark:text-slate-200">
                                  <p className="font-semibold mb-1">Đoạn văn chung</p>
                                  <p>{section.item.passageText}</p>
                                </div>
                              )}

                              <p className="text-sm font-semibold text-gray-900 dark:text-white">{section.item.questionContent}</p>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
                                  <p className="font-semibold text-red-700 dark:text-red-300">Học sinh đã chọn</p>
                                  <p className="mt-1 text-red-600 dark:text-red-200">{section.item.selectedAnswer || 'Không có câu trả lời'}</p>
                                </div>
                                <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3">
                                  <p className="font-semibold text-green-700 dark:text-green-300">Đáp án đúng</p>
                                  <p className="mt-1 text-green-700 dark:text-green-200">{section.item.correctAnswer || 'Không có dữ liệu'}</p>
                                </div>
                              </div>

                              {(section.item.errorExplanation || section.item.highlightText) && (
                                <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-3 text-sm text-yellow-800 dark:text-yellow-200">
                                  <p className="font-semibold mb-1">Vì sao đáp án đã chọn chưa đúng</p>
                                  <p>{section.item.errorExplanation || section.item.highlightText}</p>
                                </div>
                              )}

                              {section.item.guidanceNote && (
                                <p className="text-sm text-gray-600 dark:text-gray-300">
                                  <span className="font-semibold">Gợi ý:</span> {section.item.guidanceNote}
                                </p>
                              )}
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </div>
                </>
              ) : detailTab === 'antiCheat' ? (
                isAntiCheatLoading ? (
                  <p className="text-gray-500 dark:text-gray-400">Đang tải dữ liệu vi phạm...</p>
                ) : antiCheatError ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                    {antiCheatError}
                  </div>
                ) : isAntiCheatEmpty ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                    Chưa có dữ liệu vi phạm.
                  </div>
                ) : antiCheatDetail ? (
                  <>
                    {!isAntiCheatEnabled(antiCheatDetail) ? (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                        Giám sát vi phạm đang tắt.
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                          <div className={`rounded-xl border p-4 ${getAntiCheatSummaryToneClassName(antiCheatDetail.summary.violationStatus)}`}>
                            <p className="text-sm text-gray-700 dark:text-gray-300">Trạng thái vi phạm</p>
                            <div className="mt-2">
                              <AntiCheatStatusBadge status={antiCheatDetail.summary.violationStatus} />
                            </div>
                          </div>
                          <AntiCheatMetricCard
                            label="Điểm nghi vấn"
                            value={antiCheatDetail.summary.suspiciousScore ?? '—'}
                            tone={(antiCheatDetail.summary.suspiciousScore ?? 0) > 0 ? 'warning' : 'default'}
                          />
                          <AntiCheatMetricCard label="Tổng sự kiện" value={antiCheatDetail.summary.totalEventCount} />
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          <AntiCheatMetricCard label="Rời tab / ẩn trang" value={antiCheatDetail.summary.hiddenIncidentCount} />
                          <AntiCheatMetricCard label="Mất focus cửa sổ" value={antiCheatDetail.summary.blurIncidentCount} />
                          <AntiCheatMetricCard label="Sao chép" value={antiCheatDetail.summary.copyCount} />
                          <AntiCheatMetricCard label="Dán" value={antiCheatDetail.summary.pasteCount} />
                          <AntiCheatMetricCard label="Chuyển tab" value={antiCheatDetail.summary.tabSwitchCount} />
                          <AntiCheatMetricCard label="Thoát toàn màn hình" value={antiCheatDetail.summary.fullscreenExitCount} />
                          <AntiCheatMetricCard label="Tải lại trang" value={antiCheatDetail.summary.reloadCount} />
                          <AntiCheatMetricCard label="Mất mạng" value={antiCheatDetail.summary.offlineCount} />
                          <AntiCheatMetricCard label="Ẩn trang (giây)" value={antiCheatDetail.summary.totalHiddenSeconds} />
                          <AntiCheatMetricCard label="Mất focus (giây)" value={antiCheatDetail.summary.totalBlurSeconds} />
                        </div>

                        <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">Phân rã theo loại sự kiện</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Cập nhật: {formatDateTime(antiCheatDetail.summary.lastUpdatedAt)}
                            </p>
                          </div>
                          {antiCheatDetail.breakdown.length === 0 ? (
                            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Chưa có dữ liệu phân rã.</p>
                          ) : (
                            <div className="mt-3 overflow-x-auto">
                              <table className="w-full min-w-[520px] text-sm">
                                <thead>
                                  <tr className="border-b border-gray-200 text-left dark:border-gray-700">
                                    <th className="py-2 pr-3 font-semibold text-gray-700 dark:text-gray-300">Sự kiện</th>
                                    <th className="py-2 pr-3 font-semibold text-gray-700 dark:text-gray-300">Hợp lệ</th>
                                    <th className="py-2 pr-3 font-semibold text-gray-700 dark:text-gray-300">Trùng lặp</th>
                                    <th className="py-2 pr-3 font-semibold text-gray-700 dark:text-gray-300">Nhận được</th>
                                    <th className="py-2 font-semibold text-gray-700 dark:text-gray-300">Gần nhất</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {antiCheatDetail.breakdown.map((item: AntiCheatBreakdownItem) => (
                                    <tr key={item.eventType} className="border-b border-gray-100 dark:border-gray-800">
                                      <td className="py-2 pr-3 text-gray-900 dark:text-white">{formatEventTypeLabel(item.eventType)}</td>
                                      <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">{item.acceptedCount}</td>
                                      <td className="py-2 pr-3 text-amber-700 dark:text-amber-300">{item.duplicateCount}</td>
                                      <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">{item.totalReceivedCount}</td>
                                      <td className="py-2 text-gray-600 dark:text-gray-300">{formatDateTime(item.lastOccurredAt)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>

                        <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">Sự kiện gần đây</p>
                          {antiCheatDetail.recentEvents.length === 0 ? (
                            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Chưa có sự kiện gần đây.</p>
                          ) : (
                            <div className="mt-3 space-y-3">
                              {antiCheatDetail.recentEvents.map((event: AntiCheatRecentEvent) => (
                                <div
                                  key={event.id}
                                  className={`rounded-xl border p-4 ${
                                    event.isDuplicate
                                      ? 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20'
                                      : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900'
                                  }`}
                                >
                                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                        {formatEventTypeLabel(event.eventType)}
                                      </span>
                                      {event.isDuplicate && (
                                        <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-200">
                                          Trùng lặp / nhiễu
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                      {formatDateTime(event.occurredAt)}
                                    </span>
                                  </div>
                                  <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-gray-600 dark:text-gray-300 sm:grid-cols-2">
                                    <p>
                                      <span className="font-semibold">Ghi nhận:</span> {formatDateTime(event.receivedAt)}
                                    </p>
                                    <p>
                                      <span className="font-semibold">Metadata:</span> {formatMetadata(event.metadata)}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                    Chưa có dữ liệu vi phạm.
                  </div>
                )
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherResults;
