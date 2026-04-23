import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Edit2, Menu, PlusCircle, Search, Trash2 } from 'lucide-react';
import { Class as SchoolClass, SchoolYear, Teacher, User } from '../../../types';
import Sidebar from '../../Common/Sidebar/Sidebar';
import ClassFormModal from './ClassFormModal';
import { fetchClient } from '../../../api/fetchClient';

interface ClassManagementProps {
  onLogout?: () => void;
}

const mockUser: User = {
  id: '81114DB7-EF7C-4CEC-97B1-4428AA7AADA6',
  name: localStorage.getItem('name') || 'An Nguyen',
  email: localStorage.getItem('email') || 'an.nguyen@school.edu',
  avatarUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBaWbkVJIW-UxVbQAZVdNrwMze37EFXHpuuLhTSw7WJksMYe3RyK6MlICHa5M_rj6rAY8fmpaTsje51sF_GaYmBr15LrSN-IPsN9CSad_0QSDbvg69dUedrdiq4gN0Ev5352TfW0E_YrYXi0ugbxl2tDCdOwo84g_5dR-RxAreLeGB0Bs-5JS0tvLlFklj1uRh9wPZecX3HEGBS1Cgfm6tBuHD_pCTa6Z_JZN2Vzxo69eS-QEJjRqrhjg5yFrZfRnFYPL7VgejfRtgj',
};

const ClassManagement: React.FC<ClassManagementProps> = ({ onLogout }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'teacherName' | 'schoolYearStart'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<SchoolClass | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');

      const [classResponse, teacherResponse, schoolYearResponse] = await Promise.all([
        fetchClient(`/classes?pageNumber=1&pageSize=100&sortBy=${sortBy}&sortDirection=${sortDirection}`),
        fetchClient('/teachers?pageNumber=1&pageSize=100&isDeleted=false'),
        fetchClient('/school-years'),
      ]);

      if (!classResponse.ok || !teacherResponse.ok || !schoolYearResponse.ok) {
        throw new Error('Load data failed');
      }

      const classData = await classResponse.json();
      const teacherData = await teacherResponse.json();
      const schoolYearData = await schoolYearResponse.json();

      setClasses(Array.isArray(classData) ? classData : (classData.items || classData.data || []));
      setTeachers(Array.isArray(teacherData) ? teacherData : (teacherData.items || teacherData.data || []));
      setSchoolYears(Array.isArray(schoolYearData) ? schoolYearData : (schoolYearData.items || schoolYearData.data || []));
    } catch (loadError) {
      console.error('Failed to fetch class management data', loadError);
      setError('Không thể tải dữ liệu lớp học.');
    } finally {
      setIsLoading(false);
    }
  }, [sortBy, sortDirection]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredClasses = useMemo(() => {
    return classes.filter((schoolClass) => {
      const query = searchQuery.toLowerCase();
      return (
        schoolClass.name.toLowerCase().includes(query) ||
        (schoolClass.homeRoomTeacherName || '').toLowerCase().includes(query)
      );
    });
  }, [classes, searchQuery]);

  const handleSort = (column: 'name' | 'teacherName' | 'schoolYearStart') => {
    if (sortBy === column) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortBy(column);
    setSortDirection('asc');
  };

  const handleOpenCreate = () => {
    setEditingClass(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (schoolClass: SchoolClass) => {
    setEditingClass(schoolClass);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (payload: any) => {
    const isEdit = !!editingClass;
    const response = await fetchClient(isEdit ? `/classes/${editingClass!.id}` : '/classes', {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (response.ok || response.status === 201 || response.status === 204) {
      setIsModalOpen(false);
      fetchData();
      return;
    }

    const body = await response.json().catch(() => null);
    throw new Error(body?.message || 'Lỗi không xác định');
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa lớp học này không?')) return;

    try {
      const response = await fetchClient(`/classes/${id}`, { method: 'DELETE' });
      if (response.ok || response.status === 204) {
        fetchData();
      } else {
        setError('Xóa lớp học thất bại. Vui lòng thử lại.');
      }
    } catch (deleteError) {
      console.error('Error deleting class', deleteError);
      setError('Đã xảy ra lỗi khi xóa lớp học.');
    }
  };

  const formatSchoolYear = (schoolClass: SchoolClass) => {
    if (!schoolClass.schoolYearStart || !schoolClass.schoolYearEnd) return '—';
    return `${new Date(schoolClass.schoolYearStart).getFullYear()} - ${new Date(schoolClass.schoolYearEnd).getFullYear()}`;
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

      {isModalOpen && (
        <ClassFormModal
          schoolClass={editingClass}
          teachers={teachers}
          schoolYears={schoolYears}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleFormSubmit}
        />
      )}

      <main className="flex-1 px-4 py-8 sm:px-8 lg:p-8 overflow-y-auto h-screen">
        <div className="mx-auto flex max-w-7xl flex-col gap-8">
          <div className="rounded-3xl border border-slate-200/80 bg-gradient-to-r from-white via-emerald-50 to-teal-50 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-2">
                <span className="inline-flex w-fit items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                  Tổ chức lớp học
                </span>
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Quản Lý Lớp Học</h1>
                <p className="text-base text-gray-600 dark:text-gray-400">Tổng cộng: {classes.length} lớp học đang được quản lý</p>
              </div>
              <button
                onClick={handleOpenCreate}
                className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 hover:from-emerald-700 hover:to-teal-700 transition-colors"
              >
                <PlusCircle size={20} />
                <span>Thêm Lớp Học</span>
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full max-w-xs">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                <Search size={20} />
              </div>
              <input
                type="text"
                placeholder="Tìm lớp học..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block h-10 w-full rounded-lg border border-gray-300 bg-white pl-10 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400 dark:focus:border-blue-500 dark:focus:ring-blue-500"
              />
            </div>

          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-gray-500 dark:text-gray-400">Đang tải...</p>
              </div>
            ) : filteredClasses.length > 0 ? (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300"><button type="button" onClick={() => handleSort('name')} className="hover:text-gray-900 dark:hover:text-white">Tên Lớp {sortBy === 'name' ? (sortDirection === 'asc' ? '^' : 'v') : '<->'}</button></th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300"><button type="button" onClick={() => handleSort('teacherName')} className="hover:text-gray-900 dark:hover:text-white">GVCN {sortBy === 'teacherName' ? (sortDirection === 'asc' ? '^' : 'v') : '<->'}</button></th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300"><button type="button" onClick={() => handleSort('schoolYearStart')} className="hover:text-gray-900 dark:hover:text-white">Niên Khóa {sortBy === 'schoolYearStart' ? (sortDirection === 'asc' ? '^' : 'v') : '<->'}</button></th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Trạng Thái</th>
                    <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700 dark:text-gray-300">Hành Động</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClasses.map((schoolClass) => (
                    <tr key={schoolClass.id} className="border-b border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{schoolClass.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{schoolClass.homeRoomTeacherName || '—'}</td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{formatSchoolYear(schoolClass)}</td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{schoolClass.isActive === false ? 'Không hoạt động' : 'Đang hoạt động'}</td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleOpenEdit(schoolClass)}
                            className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors dark:text-blue-400"
                            title="Chỉnh sửa"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(schoolClass.id)}
                            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors dark:text-red-400"
                            title="Xóa"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <p className="text-gray-500 dark:text-gray-400 mb-2">
                    {searchQuery ? 'Không tìm thấy lớp học nào' : 'Chưa có lớp học nào'}
                  </p>
                  <button onClick={handleOpenCreate} className="text-primary hover:underline text-sm font-medium dark:text-blue-400">
                    Tạo lớp đầu tiên
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default ClassManagement;
