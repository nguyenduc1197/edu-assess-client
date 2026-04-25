import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Search, PlusCircle, Menu, Trash2, Edit2 } from 'lucide-react';
import { User, Teacher } from '../../../types';
import Sidebar from '../../Common/Sidebar/Sidebar';
import TeacherFormModal from './TeacherFormModal';
import { fetchClient } from '../../../api/fetchClient';

interface TeacherManagementProps {
  onLogout?: () => void;
}

const mockUser: User = {
  id: "81114DB7-EF7C-4CEC-97B1-4428AA7AADA6",
  name: `An Nguyen`,
  email: localStorage.getItem('email') || 'an.nguyen@school.edu',
  avatarUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuBaWbkVJIW-UxVbQAZVdNrwMze37EFXHpuuLhTSw7WJksMYe3RyK6MlICHa5M_rj6rAY8fmpaTsje51sF_GaYmBr15LrSN-IPsN9CSad_0QSDbvg69dUedrdiq4gN0Ev5352TfW0E_YrYXi0ugbxl2tDCdOwo84g_5dR-RxAreLeGB0Bs-5JS0tvLlFklj1uRh9wPZecX3HEGBS1Cgfm6tBuHD_pCTa6Z_JZN2Vzxo69eS-QEJjRqrhjg5yFrZfRnFYPL7VgejfRtgj"
};

const TeacherManagement: React.FC<TeacherManagementProps> = ({ onLogout }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'dateCreated' | 'dateModified' | 'email'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchTeachers = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');
      const query = new URLSearchParams({
        pageNumber: '1',
        pageSize: '100',
        isDeleted: 'false',
        sortBy,
        sortDirection,
      });
      const response = await fetchClient(`/teachers?${query.toString()}`);

      if (response.ok) {
        const data = await response.json();
        const items = Array.isArray(data) ? data : (data.data || []);
        const mapped: Teacher[] = items.map((item: any) => ({
          id: item.id,
          name: item.name,
          dateOfBirth: item.dateOfBirth || '',
          email: item.email || '',
          subject: item.subject || '',
          username: item.username,
          dateCreated: item.dateCreated ? new Date(item.dateCreated).toLocaleDateString('vi-VN') : '',
        }));
        setTeachers(mapped);
      } else {
        setError('Không thể tải danh sách giáo viên');
      }
    } catch (err) {
      console.error('Failed to fetch teachers', err);
      setError('Lỗi khi tải danh sách giáo viên');
    } finally {
      setIsLoading(false);
    }
  }, [sortBy, sortDirection]);

  useEffect(() => {
    fetchTeachers();
  }, [fetchTeachers]);

  const filteredTeachers = useMemo(() =>
    teachers.filter(t =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.subject.toLowerCase().includes(searchQuery.toLowerCase())
    ), [teachers, searchQuery]);

  const handleSort = (column: 'name' | 'dateCreated' | 'dateModified' | 'email') => {
    if (sortBy === column) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortBy(column);
    setSortDirection('asc');
  };

  const handleOpenCreate = () => {
    setEditingTeacher(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (payload: any) => {
    const isEdit = !!editingTeacher;
    const response = await fetchClient(
      isEdit ? `/teachers/${editingTeacher!.id}` : '/teachers',
      {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    if (response.ok || response.status === 201 || response.status === 204) {
      fetchTeachers();
      setIsModalOpen(false);
    } else {
      const body = await response.json().catch(() => null);
      throw new Error(body?.message || 'Lỗi không xác định');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa giáo viên này không?')) return;
    try {
      const response = await fetchClient(`/teachers/${id}`, { method: 'DELETE' });
      if (response.ok || response.status === 204) {
        fetchTeachers();
      } else {
        setError('Xóa giáo viên thất bại. Vui lòng thử lại.');
      }
    } catch (err) {
      console.error('Error deleting teacher', err);
      setError('Đã xảy ra lỗi khi xóa giáo viên.');
    }
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col lg:flex-row group/design-root">
      {/* Mobile Header */}
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
        <TeacherFormModal
          teacher={editingTeacher}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleFormSubmit}
        />
      )}

      <main className="flex-1 px-4 py-8 sm:px-8 lg:p-8 overflow-y-auto h-screen">
        <div className="mx-auto flex max-w-7xl flex-col gap-8">

          <div className="rounded-3xl border border-slate-200/80 bg-gradient-to-r from-white via-indigo-50 to-violet-50 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-2">
                <span className="inline-flex w-fit items-center rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                  Quản trị nhân sự
                </span>
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Quản Lý Giáo Viên</h1>
                <p className="text-base text-gray-600 dark:text-gray-400">Tổng cộng: {teachers.length} giáo viên trong hệ thống</p>
              </div>
              <button
                onClick={handleOpenCreate}
                className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 hover:from-blue-700 hover:to-violet-700 transition-colors"
              >
                <PlusCircle size={20} />
                <span>Thêm Giáo Viên</span>
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
                placeholder="Tìm giáo viên..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="block h-10 w-full rounded-lg border border-gray-300 bg-white pl-10 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400 dark:focus:border-blue-500 dark:focus:ring-blue-500"
              />
            </div>

          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-gray-500 dark:text-gray-400">Đang tải...</p>
              </div>
            ) : filteredTeachers.length > 0 ? (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300"><button type="button" onClick={() => handleSort('name')} className="hover:text-gray-900 dark:hover:text-white">Họ Tên {sortBy === 'name' ? (sortDirection === 'asc' ? '^' : 'v') : '<->'}</button></th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300"><button type="button" onClick={() => handleSort('email')} className="hover:text-gray-900 dark:hover:text-white">Email {sortBy === 'email' ? (sortDirection === 'asc' ? '^' : 'v') : '<->'}</button></th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Môn Học</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Ngày Sinh</th>
                    <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700 dark:text-gray-300">Hành Động</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTeachers.map(teacher => (
                    <tr key={teacher.id} className="border-b border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{teacher.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{teacher.email}</td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{teacher.subject}</td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {teacher.dateOfBirth ? new Date(teacher.dateOfBirth).toLocaleDateString('vi-VN') : '—'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleOpenEdit(teacher)}
                            className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors dark:text-blue-400"
                            title="Chỉnh sửa"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(teacher.id)}
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
                    {searchQuery ? 'Không tìm thấy giáo viên nào' : 'Chưa có giáo viên nào'}
                  </p>
                  <button onClick={handleOpenCreate} className="text-primary hover:underline text-sm font-medium dark:text-blue-400">
                    Thêm giáo viên đầu tiên
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

export default TeacherManagement;
