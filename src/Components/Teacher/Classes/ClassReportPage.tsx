import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ArrowLeft, Download, RefreshCw } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { ClassReport, ClassReportStudent, User } from '../../../types';
import Sidebar from '../../Common/Sidebar/Sidebar';
import { fetchClient } from '../../../api/fetchClient';
import { MobileBottomNav, MobileHeaderBar } from '../../Common/MobileAppChrome/MobileAppChrome';
import { downloadFile } from '../../../utils/downloadFile';
import { formatCompetencyPercent } from '../../../utils/competencyPercent';
import { EXAM_DATA_CHANGED_EVENT } from '../../../utils/examDataEvents';

interface ClassReportPageProps {
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

const fmtScore = (v: number | null | undefined) =>
  v == null ? '—' : v.toFixed(1);

const fmtCompetency = (v: number | null | undefined) =>
  formatCompetencyPercent(v, { fractionDigits: 0 });

const fmtPercent = (v: number) => `${Math.round(v * 100)}%`;

const StudentReportRow: React.FC<{ student: ClassReportStudent }> = ({ student }) => (
  <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{student.studentName}</td>
    <td className="px-4 py-3 text-sm text-center text-gray-500 dark:text-gray-400">{student.completedExams}/{student.totalExams}</td>
    <td className="px-4 py-3 text-sm text-center text-gray-500 dark:text-gray-400">{fmtPercent(student.completionRate)}</td>
    <td className="px-4 py-3 text-sm text-center font-bold text-blue-600 dark:text-blue-400">{fmtScore(student.averageScore)}</td>
    <td className="px-4 py-3 text-sm text-center text-violet-600 dark:text-violet-400">{fmtCompetency(student.averageBehaviorAdjustmentScore)}</td>
    <td className="px-4 py-3 text-sm text-center text-emerald-600 dark:text-emerald-400">{fmtCompetency(student.averageSelfDevelopmentScore)}</td>
    <td className="px-4 py-3 text-sm text-center text-amber-600 dark:text-amber-400">{fmtCompetency(student.averageEconomicSocialParticipationScore)}</td>
  </tr>
);

const StudentReportCard: React.FC<{ student: ClassReportStudent }> = ({ student }) => (
  <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800/40">
    <div className="flex items-start justify-between gap-3">
      <p className="text-sm font-semibold text-gray-900 dark:text-white">{student.studentName}</p>
      <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{fmtScore(student.averageScore)}</span>
    </div>
    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
      Hoàn thành: {student.completedExams}/{student.totalExams} ({fmtPercent(student.completionRate)})
    </p>
    <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
      <div className="rounded-xl bg-violet-50 px-2 py-2 text-violet-700 dark:bg-violet-900/20 dark:text-violet-300">
        <p className="font-semibold">HV</p>
        <p>{fmtCompetency(student.averageBehaviorAdjustmentScore)}</p>
      </div>
      <div className="rounded-xl bg-emerald-50 px-2 py-2 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
        <p className="font-semibold">PT</p>
        <p>{fmtCompetency(student.averageSelfDevelopmentScore)}</p>
      </div>
      <div className="rounded-xl bg-amber-50 px-2 py-2 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
        <p className="font-semibold">KT</p>
        <p>{fmtCompetency(student.averageEconomicSocialParticipationScore)}</p>
      </div>
    </div>
  </div>
);

const ClassReportPage: React.FC<ClassReportPageProps> = ({ onLogout }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [report, setReport] = useState<ClassReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isNotFound, setIsNotFound] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  const { classId = '' } = useParams<{ classId: string }>();

  const fetchReport = useCallback(async () => {
    setIsLoading(true);
    setError('');
    setIsNotFound(false);
    try {
      const response = await fetchClient(`/classes/${classId}/report`);
      if (response.status === 404) {
        setIsNotFound(true);
        return;
      }
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      const data: ClassReport = await response.json();
      setReport(data);
    } catch (err) {
      console.error('Failed to fetch class report', err);
      setError('Không thể tải báo cáo lớp học.');
    } finally {
      setIsLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  useEffect(() => {
    const handleExamDataChanged = () => {
      fetchReport();
    };

    window.addEventListener(EXAM_DATA_CHANGED_EVENT, handleExamDataChanged);
    return () => window.removeEventListener(EXAM_DATA_CHANGED_EVENT, handleExamDataChanged);
  }, [fetchReport]);

  const handleExport = async () => {
    setIsExporting(true);
    setExportError('');
    try {
      await downloadFile(
        `/classes/${classId}/report/export`,
        `bao-cao-lop-${classId}.xlsx`
      );
    } catch (err) {
      console.error('Export failed', err);
      setExportError('Xuất báo cáo thất bại. Vui lòng thử lại.');
    } finally {
      setIsExporting(false);
    }
  };

  const className = report?.className || '';

  return (
    <div className="relative flex min-h-screen w-full flex-col lg:flex-row group/design-root">
      <MobileHeaderBar
        title="Báo cáo lớp học"
        subtitle="Thống kê điểm số và năng lực của học sinh trong lớp."
        onOpenMenu={() => setIsSidebarOpen(true)}
      />

      <Sidebar user={mockUser} isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} onLogout={onLogout} />
      <MobileBottomNav onOpenMenu={() => setIsSidebarOpen(true)} />

      <main className="mobile-safe-bottom flex-1 overflow-y-auto px-4 py-8 sm:px-8 lg:h-screen lg:p-8 lg:pb-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-6">
          <div className="rounded-3xl border border-slate-200/80 bg-gradient-to-r from-white via-blue-50 to-indigo-50 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-2">
                <span className="inline-flex w-fit items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                  Báo cáo học tập
                </span>
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
                  {className || 'Báo Cáo Lớp Học'}
                </h1>
                {report && (
                  <p className="text-base text-gray-600 dark:text-gray-400">
                    {report.students.length} học sinh · {report.totalExams} bài thi
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={isExporting || isLoading || isNotFound}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition-colors hover:from-blue-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Download size={18} />
                  {isExporting ? 'Đang xuất...' : 'Xuất báo cáo lớp'}
                </button>
                <Link
                  to="/teacher/classes"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  <ArrowLeft size={18} />
                  Quay lại danh sách lớp
                </Link>
              </div>
            </div>
          </div>

          {exportError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
              {exportError}
            </div>
          )}

          {isLoading ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500 shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
              Đang tải báo cáo lớp học...
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
                onClick={fetchReport}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700"
              >
                <RefreshCw size={16} />
                Thử lại
              </button>
            </div>
          ) : report ? (
            <>
              {/* Mobile cards */}
              <div className="space-y-3 sm:hidden">
                {report.students.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    Chưa có dữ liệu học sinh trong lớp này.
                  </div>
                ) : (
                  report.students.map((student) => (
                    <StudentReportCard key={student.studentId} student={student} />
                  ))
                )}
              </div>

              {/* Desktop table */}
              <div className="hidden overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900 sm:block">
                {report.students.length === 0 ? (
                  <div className="px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                    Chưa có dữ liệu học sinh trong lớp này.
                  </div>
                ) : (
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-800/60">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Học sinh</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Hoàn thành</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Tỷ lệ</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-blue-500">Điểm TB</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-violet-500">HV</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-emerald-500">PT</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-amber-500">KT</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-transparent">
                      {report.students.map((student) => (
                        <StudentReportRow key={student.studentId} student={student} />
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
};

export default ClassReportPage;
