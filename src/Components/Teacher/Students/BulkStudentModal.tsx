import React, { useState, useEffect, useRef } from 'react';
import { X, PlusCircle, Trash2, FileSpreadsheet, Download, CheckCircle2 } from 'lucide-react';
import { Class } from '../../../types';
import { fetchClient } from '../../../api/fetchClient';
import { downloadFile } from '../../../utils/downloadFile';

interface StudentRow {
  name: string;
  dateOfBirth: string;
  username: string;
  password: string;
  error?: string;
}

interface CreatedAccount {
  studentId: string;
  name: string;
  username: string;
  password: string;
}

interface ParsedRow {
  rowNumber: number;
  name: string;
  dateOfBirth: string | null;
  username: string | null;
  password: string | null;
}

interface ParseResult {
  rows: ParsedRow[];
  errors: { rowNumber: number; message: string }[];
}

interface BulkStudentModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const DEFAULT_PASSWORD = '123456';

const emptyRow = (): StudentRow => ({ name: '', dateOfBirth: '', username: '', password: '' });

const isEmptyRow = (r: StudentRow) => !r.name.trim() && !r.dateOfBirth && !r.username.trim() && !r.password;

const BulkStudentModal: React.FC<BulkStudentModalProps> = ({ onClose, onSuccess }) => {
  const [schoolClassId, setSchoolClassId] = useState('');
  const [rows, setRows] = useState<StudentRow[]>([emptyRow()]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [isFetchingClasses, setIsFetchingClasses] = useState(true);
  const [error, setError] = useState('');
  const [importMessages, setImportMessages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [createdAccounts, setCreatedAccounts] = useState<CreatedAccount[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchClasses = async () => {
      setIsFetchingClasses(true);
      try {
        const response = await fetchClient('/classes?pageNumber=1&pageSize=100');
        if (response.ok) {
          const data = await response.json();
          setClasses(Array.isArray(data) ? data : (data.items || data.data || []));
        }
      } catch (err) {
        console.error('Error fetching classes:', err);
      } finally {
        setIsFetchingClasses(false);
      }
    };
    fetchClasses();
  }, []);

  const className = classes.find(c => c.id === schoolClassId)?.name ?? '';

  const updateRow = (index: number, field: keyof StudentRow, value: string) => {
    setRows(prev => prev.map((row, i) => i === index ? { ...row, [field]: value, error: undefined } : row));
  };

  const addRow = () => setRows(prev => [...prev, emptyRow()]);

  const removeRow = (index: number) => {
    if (rows.length === 1) return;
    setRows(prev => prev.filter((_, i) => i !== index));
  };

  const handleDownloadTemplate = async () => {
    setError('');
    try {
      await downloadFile('/students/import/template', 'mau-danh-sach-hoc-sinh.xlsx');
    } catch {
      setError('Không tải được file mẫu. Vui lòng thử lại.');
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setError('');
    setImportMessages([]);
    setIsImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetchClient('/students/import/parse', { method: 'POST', body: formData });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(body?.message || 'Không đọc được file Excel.');
        return;
      }

      const result = body as ParseResult;
      const errorsByRow = new Map<number, string>();
      const unattached: string[] = [];
      const parsedRowNumbers = new Set(result.rows.map(r => r.rowNumber));
      for (const err of result.errors) {
        if (parsedRowNumbers.has(err.rowNumber)) {
          errorsByRow.set(err.rowNumber, err.message);
        } else {
          unattached.push(err.rowNumber > 0 ? `Dòng ${err.rowNumber} trong file: ${err.message}` : err.message);
        }
      }

      const imported: StudentRow[] = result.rows.map(r => ({
        name: r.name,
        dateOfBirth: r.dateOfBirth ? r.dateOfBirth.slice(0, 10) : '',
        username: r.username ?? '',
        password: r.password ?? '',
        error: errorsByRow.has(r.rowNumber) ? `Dòng ${r.rowNumber} trong file: ${errorsByRow.get(r.rowNumber)}` : undefined,
      }));

      if (imported.length === 0) {
        setError('File không có học sinh nào.');
      } else {
        setRows(prev => {
          const kept = prev.filter(r => !isEmptyRow(r));
          return [...kept, ...imported];
        });
      }
      setImportMessages([
        ...(imported.length > 0 ? [`Đã đọc ${imported.length} học sinh từ file. Kiểm tra lại rồi bấm "Thêm Tất Cả".`] : []),
        ...unattached,
      ]);
    } catch {
      setError('Đã xảy ra lỗi khi đọc file. Vui lòng thử lại.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!schoolClassId) {
      setError('Vui lòng chọn lớp học');
      return;
    }

    const submitRows = rows.filter(r => !isEmptyRow(r));
    if (submitRows.length === 0) {
      setError('Vui lòng nhập ít nhất 1 học sinh');
      return;
    }

    const invalidRow = submitRows.findIndex(r => !r.name.trim());
    if (invalidRow !== -1) {
      setError(`Dòng ${invalidRow + 1}: Vui lòng nhập họ tên học sinh`);
      return;
    }

    const shortPassword = submitRows.findIndex(r => r.password && r.password.length < 6);
    if (shortPassword !== -1) {
      setError(`Dòng ${shortPassword + 1}: Mật khẩu phải có ít nhất 6 ký tự`);
      return;
    }

    const students = submitRows.map(r => ({
      name: r.name.trim(),
      dateOfBirth: r.dateOfBirth ? `${r.dateOfBirth}T00:00:00` : null,
      username: r.username.trim() || null,
      password: r.password || null,
    }));

    setIsSubmitting(true);
    try {
      const response = await fetchClient('/students/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolClassId, students }),
      });

      if (response.ok) {
        const data = await response.json();
        setCreatedAccounts(data.accounts || []);
        onSuccess();
      } else {
        const body = await response.json().catch(() => null);
        setError(body?.message || 'Lỗi không xác định');
      }
    } catch {
      setError('Đã xảy ra lỗi. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadAccounts = async () => {
    if (!createdAccounts) return;
    setError('');
    try {
      await downloadFile('/students/import/accounts-file', `tai-khoan-${className || 'hoc-sinh'}.xlsx`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ className, accounts: createdAccounts }),
      });
    } catch {
      setError('Không tải được danh sách tài khoản. Vui lòng thử lại.');
    }
  };

  const errorBox = error && (
    <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
      {error}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div
        className="w-full max-w-4xl rounded-xl bg-white dark:bg-gray-900 shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col"
        style={{ maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex-shrink-0">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            {createdAccounts ? 'Đã Tạo Tài Khoản' : 'Thêm Nhiều Học Sinh'}
          </h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            <X size={20} />
          </button>
        </div>

        {createdAccounts ? (
          <>
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {errorBox}
              <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm dark:bg-green-900/20 dark:border-green-800 dark:text-green-300">
                <CheckCircle2 size={18} className="flex-shrink-0 mt-0.5" />
                <span>
                  Đã thêm {createdAccounts.length} học sinh vào lớp {className}. Học sinh sẽ phải đổi mật khẩu ở lần đăng nhập đầu tiên.
                  Hãy tải danh sách tài khoản để phát cho học sinh — mật khẩu sẽ không hiển thị lại sau khi đóng cửa sổ này.
                </span>
              </div>
              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800 text-left text-xs uppercase text-gray-500 dark:text-gray-400">
                    <tr>
                      <th className="px-3 py-2">STT</th>
                      <th className="px-3 py-2">Họ tên</th>
                      <th className="px-3 py-2">Tên đăng nhập</th>
                      <th className="px-3 py-2">Mật khẩu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700 text-gray-900 dark:text-white">
                    {createdAccounts.map((a, i) => (
                      <tr key={a.studentId}>
                        <td className="px-3 py-2">{i + 1}</td>
                        <td className="px-3 py-2">{a.name}</td>
                        <td className="px-3 py-2 font-mono">{a.username}</td>
                        <td className="px-3 py-2 font-mono">{a.password}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800/50 flex-shrink-0">
              <button
                type="button"
                onClick={handleDownloadAccounts}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
              >
                <Download size={16} />
                Tải danh sách tài khoản (.xlsx)
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                Đóng
              </button>
            </div>
          </>
        ) : (
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 space-y-5 overflow-y-auto flex-1">
            {errorBox}
            {importMessages.length > 0 && (
              <div className="p-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-sm space-y-1 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300">
                {importMessages.map((m, i) => <p key={i}>{m}</p>)}
              </div>
            )}

            <div className="flex flex-wrap items-end gap-4">
              {/* Class selector */}
              <div className="flex-1 min-w-[200px] max-w-xs">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Lớp Học <span className="text-red-500">*</span>
                </label>
                <select
                  value={schoolClassId}
                  onChange={e => setSchoolClassId(e.target.value)}
                  disabled={isFetchingClasses}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">{isFetchingClasses ? 'Đang tải lớp học...' : 'Chọn lớp học'}</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Excel import */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <Download size={16} />
                  Tải file mẫu
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isImporting}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FileSpreadsheet size={16} />
                  {isImporting ? 'Đang đọc file...' : 'Nhập từ Excel'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx"
                  onChange={handleImportFile}
                  className="hidden"
                  data-testid="excel-file-input"
                />
              </div>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400">
              Để trống tên đăng nhập sẽ tự tạo từ họ tên (vd. Nguyễn Văn An → an.nv); để trống mật khẩu sẽ là {DEFAULT_PASSWORD}.
              Học sinh phải đổi mật khẩu ở lần đăng nhập đầu tiên.
            </p>

            {/* Student rows */}
            <div className="space-y-3">
              {/* Column headers */}
              <div className="hidden sm:grid sm:grid-cols-[1fr_160px_160px_160px_40px] gap-2 px-1">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Họ Tên <span className="text-red-500">*</span>
                </span>
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Ngày Sinh</span>
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Tên Đăng Nhập
                  <span className="ml-1 font-normal normal-case text-gray-400">(tuỳ chọn)</span>
                </span>
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Mật Khẩu
                  <span className="ml-1 font-normal normal-case text-gray-400">(tuỳ chọn)</span>
                </span>
                <span />
              </div>

              {rows.map((row, index) => (
                <div key={index}>
                <div
                  className={`grid grid-cols-1 sm:grid-cols-[1fr_160px_160px_160px_40px] gap-2 items-start p-3 sm:p-0 rounded-lg sm:rounded-none ${row.error ? 'bg-red-50 dark:bg-red-900/20 sm:p-1 sm:rounded-lg' : 'bg-gray-50 sm:bg-transparent dark:bg-gray-800/40 sm:dark:bg-transparent'}`}
                >
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1 sm:hidden">Họ Tên *</label>
                    <input
                      type="text"
                      value={row.name}
                      onChange={e => updateRow(index, 'name', e.target.value)}
                      placeholder="Nguyễn Văn A"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1 sm:hidden">Ngày Sinh</label>
                    <input
                      type="date"
                      value={row.dateOfBirth}
                      onChange={e => updateRow(index, 'dateOfBirth', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1 sm:hidden">Tên Đăng Nhập</label>
                    <input
                      type="text"
                      value={row.username}
                      onChange={e => updateRow(index, 'username', e.target.value)}
                      placeholder="Tự tạo"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1 sm:hidden">Mật Khẩu</label>
                    <input
                      type="password"
                      value={row.password}
                      onChange={e => updateRow(index, 'password', e.target.value)}
                      placeholder={DEFAULT_PASSWORD}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="flex sm:justify-center items-center">
                    <button
                      type="button"
                      onClick={() => removeRow(index)}
                      disabled={rows.length === 1}
                      title="Xóa dòng"
                      className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                {row.error && (
                  <p className="mt-1 px-1 text-xs text-red-600 dark:text-red-400">{row.error}</p>
                )}
                </div>
              ))}

              <button
                type="button"
                onClick={addRow}
                className="flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
              >
                <PlusCircle size={18} />
                Thêm dòng
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-800/50 flex-shrink-0">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {rows.filter(r => !isEmptyRow(r)).length} học sinh
            </span>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors dark:bg-blue-700 dark:hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Đang lưu...' : 'Thêm Tất Cả'}
              </button>
            </div>
          </div>
        </form>
        )}
      </div>
    </div>
  );
};

export default BulkStudentModal;
