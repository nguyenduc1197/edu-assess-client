import React, { useState, useEffect, useCallback } from 'react';
import { Menu } from 'lucide-react';
import { StudentAnalytics, AnalyticsProgressItem, User } from '../../../types';
import Sidebar from '../../Common/Sidebar/Sidebar';
import { fetchClient, getCurrentProfileId } from '../../../api/fetchClient';

interface StudentAnalyticsPageProps {
  onLogout?: () => void;
}

const CHART_HEIGHT = 200;
const CHART_PADDING = { top: 20, right: 20, bottom: 40, left: 40 };

interface LineChartProps {
  data: AnalyticsProgressItem[];
}

const LineChart: React.FC<LineChartProps> = ({ data }) => {
  if (data.length === 0) return null;

  const width = 600;
  const height = CHART_HEIGHT;
  const innerWidth = width - CHART_PADDING.left - CHART_PADDING.right;
  const innerHeight = height - CHART_PADDING.top - CHART_PADDING.bottom;

  const xScale = (index: number) =>
    CHART_PADDING.left + (data.length === 1 ? innerWidth / 2 : (index / (data.length - 1)) * innerWidth);

  const yScale = (value: number | null) => {
    if (value === null) return null;
    return CHART_PADDING.top + innerHeight - (value / 10) * innerHeight;
  };

  const buildPath = (getValue: (item: AnalyticsProgressItem) => number | null) => {
    const points = data
      .map((item, idx) => {
        const x = xScale(idx);
        const y = yScale(getValue(item));
        return y !== null ? `${x},${y}` : null;
      })
      .filter(Boolean);
    if (points.length === 0) return '';
    return `M ${points.join(' L ')}`;
  };

  const overallPath = buildPath((item) => item.score);
  const behaviorPath = buildPath((item) => item.behaviorAdjustmentScore);
  const selfDevPath = buildPath((item) => item.selfDevelopmentScore);
  const econPath = buildPath((item) => item.economicSocialParticipationScore);

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[400px]">
        {/* Y-axis labels */}
        {[0, 2, 4, 6, 8, 10].map((tick) => {
          const y = CHART_PADDING.top + innerHeight - (tick / 10) * innerHeight;
          return (
            <g key={tick}>
              <line
                x1={CHART_PADDING.left}
                x2={CHART_PADDING.left + innerWidth}
                y1={y}
                y2={y}
                stroke="#e5e7eb"
                strokeWidth="1"
              />
              <text
                x={CHART_PADDING.left - 5}
                y={y + 4}
                textAnchor="end"
                fontSize="10"
                fill="#9ca3af"
              >
                {tick}
              </text>
            </g>
          );
        })}

        {/* X-axis labels */}
        {data.map((item, idx) => {
          const x = xScale(idx);
          const label = new Date(item.finishedAt).toLocaleDateString('vi-VN', {
            month: 'short',
            day: 'numeric',
          });
          return (
            <text
              key={item.studentExamId}
              x={x}
              y={height - 5}
              textAnchor="middle"
              fontSize="9"
              fill="#9ca3af"
            >
              {label}
            </text>
          );
        })}

        {/* Lines */}
        {overallPath && (
          <path d={overallPath} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        )}
        {behaviorPath && (
          <path d={behaviorPath} fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        )}
        {selfDevPath && (
          <path d={selfDevPath} fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        )}
        {econPath && (
          <path d={econPath} fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        )}

        {/* Dots */}
        {data.map((item, idx) => {
          const x = xScale(idx);
          return (
            <g key={`dots-${item.studentExamId}`}>
              {yScale(item.score) !== null && (
                <circle cx={x} cy={yScale(item.score)!} r="3" fill="#3b82f6" />
              )}
              {item.behaviorAdjustmentScore !== null && yScale(item.behaviorAdjustmentScore) !== null && (
                <circle cx={x} cy={yScale(item.behaviorAdjustmentScore)!} r="3" fill="#8b5cf6" />
              )}
              {item.selfDevelopmentScore !== null && yScale(item.selfDevelopmentScore) !== null && (
                <circle cx={x} cy={yScale(item.selfDevelopmentScore)!} r="3" fill="#10b981" />
              )}
              {item.economicSocialParticipationScore !== null && yScale(item.economicSocialParticipationScore) !== null && (
                <circle cx={x} cy={yScale(item.economicSocialParticipationScore)!} r="3" fill="#f59e0b" />
              )}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-600 dark:text-gray-400">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-5 rounded-full bg-blue-500" />
          <span>Điểm tổng</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-5 rounded-full bg-violet-500" />
          <span>Điều chỉnh hành vi</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-5 rounded-full bg-emerald-500" />
          <span>Phát triển bản thân</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-5 rounded-full bg-amber-500" />
          <span>Tìm hiểu Tham gia KT-XH</span>
        </div>
      </div>
    </div>
  );
};

const StudentAnalyticsPage: React.FC<StudentAnalyticsPageProps> = ({ onLogout }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [analytics, setAnalytics] = useState<StudentAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const sidebarUser: User = {
    id: localStorage.getItem('profileId') || '',
    name: localStorage.getItem('name') || 'Học sinh',
    email: localStorage.getItem('email') || '',
    avatarUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBaWbkVJIW-UxVbQAZVdNrwMze37EFXHpuuLhTSw7WJksMYe3RyK6MlICHa5M_rj6rAY8fmpaTsje51sF_GaYmBr15LrSN-IPsN9CSad_0QSDbvg69dUedrdiq4gN0Ev5352TfW0E_YrYXi0ugbxl2tDCdOwo84g_5dR-RxAreLeGB0Bs-5JS0tvLlFklj1uRh9wPZecX3HEGBS1Cgfm6tBuHD_pCTa6Z_JZN2Vzxo69eS-QEJjRqrhjg5yFrZfRnFYPL7VgejfRtgj',
  };

  const fetchAnalytics = useCallback(async () => {
    const studentId = getCurrentProfileId();
    if (!studentId) {
      setError('Không xác định được tài khoản học sinh. Vui lòng đăng nhập lại.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const response = await fetchClient(`/students/${studentId}/analytics`);
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      const data: StudentAnalytics = await response.json();
      setAnalytics(data);
    } catch (err) {
      console.error('Failed to fetch analytics', err);
      setError('Không thể tải dữ liệu phân tích.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const fmt = (v: number | null | undefined) =>
    v !== null && v !== undefined ? v.toFixed(2) : '--';

  return (
    <div className="relative flex min-h-screen w-full flex-col lg:flex-row group/design-root">
      <div className="lg:hidden flex items-center justify-start px-4 py-3 bg-white border-b border-gray-200 dark:bg-background-dark dark:border-gray-800 sticky top-0 z-20 shadow-sm gap-3">
        <button
          className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg dark:text-gray-300 dark:hover:bg-white/5"
          onClick={() => setIsSidebarOpen(true)}
          aria-label="Mở menu"
        >
          <Menu size={24} />
        </button>
        <span className="font-bold text-lg text-gray-900 dark:text-white tracking-tight">StudentHub</span>
      </div>

      <Sidebar
        user={sidebarUser}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onLogout={onLogout}
      />

      <main className="h-screen flex-1 overflow-y-auto px-3 py-5 sm:px-6 sm:py-7 lg:p-8">
        <div className="mx-auto flex max-w-4xl flex-col gap-6">
          <div className="rounded-3xl border border-slate-200/80 bg-gradient-to-r from-white via-violet-50 to-fuchsia-50 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
              Phân Tích Năng Lực
            </h1>
            {analytics && (
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                {analytics.studentName} · {analytics.completedExamCount} bài đã hoàn thành
              </p>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-gray-500 dark:text-gray-400">Đang tải...</p>
            </div>
          ) : analytics ? (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-800 dark:bg-violet-900/20">
                  <p className="text-xs font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400 mb-1">
                    Điều chỉnh hành vi
                  </p>
                  <p className="text-3xl font-bold text-violet-700 dark:text-violet-300">
                    {fmt(analytics.behaviorAdjustmentAverageScore)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Trung bình</p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 mb-1">
                    Phát triển bản thân
                  </p>
                  <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-300">
                    {fmt(analytics.selfDevelopmentAverageScore)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Trung bình</p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400 mb-1">
                    Tìm hiểu Tham gia KT-XH
                  </p>
                  <p className="text-3xl font-bold text-amber-700 dark:text-amber-300">
                    {fmt(analytics.economicSocialParticipationAverageScore)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Trung bình</p>
                </div>
              </div>

              {/* Line chart */}
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
                  Tiến độ theo thời gian
                </h2>
                {analytics.progressOverTime.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Chưa có dữ liệu tiến độ.</p>
                ) : (
                  <LineChart data={analytics.progressOverTime} />
                )}
              </div>

              {/* Progress table */}
              {analytics.progressOverTime.length > 0 && (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-800/60">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Bài thi</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Ngày</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Điểm</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-violet-500">HV</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-emerald-500">PT</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-amber-500">KT</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-transparent">
                      {analytics.progressOverTime.map((item) => (
                        <tr key={item.studentExamId} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white max-w-[180px] truncate">
                            {item.examName}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                            {new Date(item.finishedAt).toLocaleDateString('vi-VN')}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-bold text-blue-600 dark:text-blue-400">
                            {item.score.toFixed(1)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-violet-600 dark:text-violet-400">
                            {fmt(item.behaviorAdjustmentScore)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-emerald-600 dark:text-emerald-400">
                            {fmt(item.selfDevelopmentScore)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-amber-600 dark:text-amber-400">
                            {fmt(item.economicSocialParticipationScore)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
};

export default StudentAnalyticsPage;
