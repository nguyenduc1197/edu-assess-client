import React, { useCallback, useEffect, useState } from 'react';
import { Eye, Menu } from 'lucide-react';
import {
  AssessmentResult,
  Class as SchoolClass,
  Student,
  StudentResultSummary,
  User,
} from '../../../types';
import Sidebar from '../../Common/Sidebar/Sidebar';
import { fetchClient } from '../../../api/fetchClient';

interface TeacherResultsProps {
  onLogout?: () => void;
}

const mockUser: User = {
  id: '81114DB7-EF7C-4CEC-97B1-4428AA7AADA6',
  name: localStorage.getItem('name') || 'An Nguyen',
  email: localStorage.getItem('email') || 'an.nguyen@school.edu',
  avatarUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBaWbkVJIW-UxVbQAZVdNrwMze37EFXHpuuLhTSw7WJksMYe3RyK6MlICHa5M_rj6rAY8fmpaTsje51sF_GaYmBr15LrSN-IPsN9CSad_0QSDbvg69dUedrdiq4gN0Ev5352TfW0E_YrYXi0ugbxl2tDCdOwo84g_5dR-RxAreLeGB0Bs-5JS0tvLlFklj1uRh9wPZecX3HEGBS1Cgfm6tBuHD_pCTa6Z_JZN2Vzxo69eS-QEJjRqrhjg5yFrZfRnFYPL7VgejfRtgj',
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
  }, [selectedExamId, selectedClassId, selectedStudentId, selectedStatus]);

  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  const handleViewDetails = async (studentExamId: string) => {
    try {
      setIsDetailLoading(true);
      const response = await fetchClient(`/student-exams/${studentExamId}/assessment`);

      if (!response.ok) {
        throw new Error('Load detail failed');
      }

      const data: AssessmentResult = await response.json();
      setSelectedResult(data);
    } catch (detailError) {
      console.error('Failed to load result detail', detailError);
      setError('Không thể tải chi tiết bài đánh giá.');
    } finally {
      setIsDetailLoading(false);
    }
  };

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
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Kết Quả Học Sinh</h1>
            <p className="text-base text-gray-500 dark:text-gray-400">Theo dõi điểm số và phản hồi AI của học sinh</p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
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
              <option value="Pending">Pending</option>
              <option value="Completed">Completed</option>
              <option value="Failed">Failed</option>
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
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Bài Thi</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Học Sinh</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Lớp</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Điểm</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Trạng Thái</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Nộp Lúc</th>
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
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{result.assessmentStatus}</td>
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
                    <p className="text-sm text-gray-500 dark:text-gray-400">Trạng thái: {selectedResult.assessmentStatus}</p>
                  </div>

                  {selectedResult.overallFeedback && (
                    <div>
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Nhận xét chung</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{selectedResult.overallFeedback}</p>
                    </div>
                  )}

                  <div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Các năng lực được đánh giá</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedResult.behaviorAdjustmentScore !== null && (
                        <span className="inline-flex items-center rounded-full bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1 text-sm font-medium text-indigo-700 dark:text-indigo-300">
                          Năng lực điều chỉnh hành vi
                        </span>
                      )}
                      {selectedResult.selfDevelopmentScore !== null && (
                        <span className="inline-flex items-center rounded-full bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1 text-sm font-medium text-indigo-700 dark:text-indigo-300">
                          Năng lực phát triển bản thân
                        </span>
                      )}
                      {selectedResult.economicSocialParticipationScore !== null && (
                        <span className="inline-flex items-center rounded-full bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1 text-sm font-medium text-indigo-700 dark:text-indigo-300">
                          Năng lực tìm hiểu và tham gia hoạt động kinh tế - xã hội
                        </span>
                      )}
                    </div>
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
