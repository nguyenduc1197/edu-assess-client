import React, { useCallback, useEffect, useState } from 'react';
import { Eye, Menu } from 'lucide-react';
import {
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
import { getAssessmentStatusLabel } from '../../../utils/assessmentStatus';

interface TeacherResultsProps {
  onLogout?: () => void;
}

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
  if (value === null || value === undefined) return '--';
  return value.toFixed(1);
};

const formatGainChipValue = (value?: number | null) => {
  if (value === null || value === undefined) return '--';
  if (value > 0) return `+${value.toFixed(1)}`;
  return value.toFixed(1);
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
  const [selectedResult, setSelectedResult] = useState<AssessmentResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
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

      const response = await fetchClient(`/student-exams/${studentExamId}/assessment`);

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

  const handleViewDetails = async (studentExamId: string) => {
    await fetchAssessmentDetail(studentExamId);
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

  const formatDateTime = (value?: string | null) => {
    if (!value) return '—';
    return new Date(value).toLocaleString('vi-VN');
  };

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
        <span className="font-bold text-lg text-gray-900 dark:text-white tracking-tight">StudentHub</span>
      </div>

      <Sidebar user={mockUser} isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} onLogout={onLogout} />

      <main className="flex-1 px-4 py-8 sm:px-8 lg:p-8 overflow-y-auto h-screen">
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

          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-gray-500 dark:text-gray-400">Đang tải...</p>
              </div>
            ) : results.length > 0 ? (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300"><button type="button" onClick={() => handleSort('examName')} className="hover:text-gray-900 dark:hover:text-white">Bài Thi {sortBy === 'examName' ? (sortDirection === 'asc' ? '^' : 'v') : '<->'}</button></th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300"><button type="button" onClick={() => handleSort('studentName')} className="hover:text-gray-900 dark:hover:text-white">Học Sinh {sortBy === 'studentName' ? (sortDirection === 'asc' ? '^' : 'v') : '<->'}</button></th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Lớp</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300"><button type="button" onClick={() => handleSort('score')} className="hover:text-gray-900 dark:hover:text-white">Điểm {sortBy === 'score' ? (sortDirection === 'asc' ? '^' : 'v') : '<->'}</button></th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Tiến độ</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Trạng Thái</th>
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
                            <ProgressChip label="Tìm hiểu và tham gia KT-XH" accumulation={result.economicSocialParticipationAccumulation} />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{getAssessmentStatusLabel(result.assessmentStatus)}</td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{formatDateTime(result.finishedAt)}</td>
                      <td className="px-6 py-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleViewDetails(result.studentExamId)}
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
            ) : (
              <div className="flex items-center justify-center py-12 text-gray-500 dark:text-gray-400">
                Chưa có kết quả nào phù hợp với bộ lọc hiện tại.
              </div>
            )}
          </div>
        </div>
      </main>

      {(selectedResult || isDetailLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Chi Tiết Đánh Giá</h3>
              <button type="button" onClick={() => setSelectedResult(null)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                Đóng
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {isDetailLoading ? (
                <p className="text-gray-500 dark:text-gray-400">Đang tải chi tiết...</p>
              ) : selectedResult && (
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
                        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Năng lực điều chỉnh hành vi</p>
                        <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                          <div className="h-full rounded-full bg-indigo-500 dark:bg-indigo-400" style={{ width: `${Math.max(0, Math.min((selectedResult.behaviorAdjustmentScore / 10) * 100, 100))}%` }} />
                        </div>
                      </div>
                    )}
                    {selectedResult.selfDevelopmentScore !== null && (
                      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Năng lực phát triển bản thân</p>
                        <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                          <div className="h-full rounded-full bg-indigo-500 dark:bg-indigo-400" style={{ width: `${Math.max(0, Math.min((selectedResult.selfDevelopmentScore / 10) * 100, 100))}%` }} />
                        </div>
                      </div>
                    )}
                    {selectedResult.economicSocialParticipationScore !== null && (
                      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Năng lực tìm hiểu và tham gia hoạt động kinh tế - xã hội</p>
                        <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                          <div className="h-full rounded-full bg-indigo-500 dark:bg-indigo-400" style={{ width: `${Math.max(0, Math.min((selectedResult.economicSocialParticipationScore / 10) * 100, 100))}%` }} />
                        </div>
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
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherResults;
