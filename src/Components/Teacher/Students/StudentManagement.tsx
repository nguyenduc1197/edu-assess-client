import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Search, PlusCircle, Menu, Trash2, Edit2 } from 'lucide-react';
import { User, Student } from '../../../types';
import Sidebar from '../../Common/Sidebar/Sidebar';
import StudentFormModal from './StudentFormModal';
import { fetchClient } from '../../../api/fetchClient';

interface StudentManagementProps {
  onLogout?: () => void;
}

const mockUser: User = {
  id: "81114DB7-EF7C-4CEC-97B1-4428AA7AADA6",
  name: `An Nguyen`,
  email: localStorage.getItem('email') || 'an.nguyen@school.edu',
  avatarUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuBaWbkVJIW-UxVbQAZVdNrwMze37EFXHpuuLhTSw7WJksMYe3RyK6MlICHa5M_rj6rAY8fmpaTsje51sF_GaYmBr15LrSN-IPsN9CSad_0QSDbvg69dUedrdiq4gN0Ev5352TfW0E_YrYXi0ugbxl2tDCdOwo84g_5dR-RxAreLeGB0Bs-5JS0tvLlFklj1uRh9wPZecX3HEGBS1Cgfm6tBuHD_pCTa6Z_JZN2Vzxo69eS-QEJjRqrhjg5yFrZfRnFYPL7VgejfRtgj"
};

const StudentManagement: React.FC<StudentManagementProps> = ({ onLogout }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStudents = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');
      const response = await fetchClient('/students?pageNumber=1&pageSize=100&isDeleted=false');

      if (response.ok) {
        const data = await response.json();
        const items = Array.isArray(data) ? data : (data.data || []);
        const mapped: Student[] = items.map((item: any) => ({
          id: item.id,
          name: item.name,
          dateOfBirth: item.dateOfBirth || '',
          schoolClassId: item.schoolClassId || '',
          schoolClassName: item.schoolClassName || item.schoolClassId || '',
          username: item.username,
          dateCreated: item.dateCreated ? new Date(item.dateCreated).toLocaleDateString('vi-VN') : '',
        }));
        setStudents(mapped);
      } else {
        setError('Không thể tải danh sách học sinh');
      }
    } catch (err) {
      console.error('Failed to fetch students', err);
      setError('Lỗi khi tải danh sách học sinh');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const filteredStudents = useMemo(() =>
    students.filter(s =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.username || '').toLowerCase().includes(searchQuery.toLowerCase())
    ), [students, searchQuery]);

  const handleOpenCreate = () => {
    setEditingStudent(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (student: Student) => {
    setEditingStudent(student);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (payload: any) => {
    const isEdit = !!editingStudent;
    const response = await fetchClient(
      isEdit ? `/students/${editingStudent!.id}` : '/students',
      {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    if (response.ok || response.status === 201 || response.status === 204) {
      fetchStudents();
      setIsModalOpen(false);
    } else {
      const body = await response.json().catch(() => null);
      throw new Error(body?.message || 'Lỗi không xác định');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa học sinh này không?')) return;
    try {
      const response = await fetchClient(`/students/${id}`, { method: 'DELETE' });
      if (response.ok || response.status === 204) {
        fetchStudents();
      } else {
        setError('Xóa học sinh thất bại. Vui lòng thử lại.');
      }
    } catch (err) {
      console.error('Error deleting student', err);
      setError('Đã xảy ra lỗi khi xóa học sinh.');
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
        <StudentFormModal
          student={editingStudent}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleFormSubmit}
        />
      )}

      <main className="flex-1 px-4 py-8 sm:px-8 lg:p-8 overflow-y-auto h-screen">
        <div className="mx-auto flex max-w-7xl flex-col gap-8">

          <div className="rounded-3xl border border-slate-200/80 bg-gradient-to-r from-white via-sky-50 to-cyan-50 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-2">
                <span className="inline-flex w-fit items-center rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
                  Quản lý học sinh
                </span>
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Quản Lý Học Sinh</h1>
                <p className="text-base text-gray-600 dark:text-gray-400">Tổng cộng: {students.length} học sinh đang có trong hệ thống</p>
              </div>
              <button
                onClick={handleOpenCreate}
                className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 hover:from-blue-700 hover:to-cyan-700 transition-colors"
              >
                <PlusCircle size={20} />
                <span>Thêm Học Sinh</span>
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="relative w-full max-w-xs">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
              <Search size={20} />
            </div>
            <input
              type="text"
              placeholder="Tìm học sinh..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="block h-10 w-full rounded-lg border border-gray-300 bg-white pl-10 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400 dark:focus:border-blue-500 dark:focus:ring-blue-500"
            />
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-gray-500 dark:text-gray-400">Đang tải...</p>
              </div>
            ) : filteredStudents.length > 0 ? (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Họ Tên</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Tên Đăng Nhập</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Lớp Học</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Ngày Sinh</th>
                    <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700 dark:text-gray-300">Hành Động</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map(student => (
                    <tr key={student.id} className="border-b border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{student.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{student.username || '—'}</td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 font-mono">
                        {student.schoolClassName || student.schoolClassId || '—'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString('vi-VN') : '—'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleOpenEdit(student)}
                            className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors dark:text-blue-400"
                            title="Chỉnh sửa"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(student.id)}
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
                    {searchQuery ? 'Không tìm thấy học sinh nào' : 'Chưa có học sinh nào'}
                  </p>
                  <button onClick={handleOpenCreate} className="text-primary hover:underline text-sm font-medium dark:text-blue-400">
                    Thêm học sinh đầu tiên
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

export default StudentManagement;
