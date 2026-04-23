import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Search, PlusCircle, Menu, Trash2, Edit2, Sparkles } from 'lucide-react';
import { CompetencyOption, Question, User } from '../../../types';
import Sidebar from '../../Common/Sidebar/Sidebar';
import AddQuestionMenu from '../Exam/AddQuestionMenu';
import AIQuestionGeneratorModal from './AIQuestionGeneratorModal';
import { fetchClient } from '../../../api/fetchClient';

interface QuestionManagementProps {
  onLogout?: () => void;
}

const mockUser: User = {
  id: '81114DB7-EF7C-4CEC-97B1-4428AA7AADA6',
  name: localStorage.getItem('name') || 'An Nguyen',
  email: localStorage.getItem('email') || 'an.nguyen@school.edu',
  avatarUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBaWbkVJIW-UxVbQAZVdNrwMze37EFXHpuuLhTSw7WJksMYe3RyK6MlICHa5M_rj6rAY8fmpaTsje51sF_GaYmBr15LrSN-IPsN9CSad_0QSDbvg69dUedrdiq4gN0Ev5352TfW0E_YrYXi0ugbxl2tDCdOwo84g_5dR-RxAreLeGB0Bs-5JS0tvLlFklj1uRh9wPZecX3HEGBS1Cgfm6tBuHD_pCTa6Z_JZN2Vzxo69eS-QEJjRqrhjg5yFrZfRnFYPL7VgejfRtgj'
};

const QuestionManagement: React.FC<QuestionManagementProps> = ({ onLogout }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'dateCreated' | 'content' | 'competencyType' | 'difficultyLevel'>('dateCreated');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [competencyOptions, setCompetencyOptions] = useState<CompetencyOption[]>([]);
  const [selectedCompetency, setSelectedCompetency] = useState('');

  const loadCompetencyOptions = useCallback(async () => {
    try {
      const response = await fetchClient('/questions/competency-types');
      if (!response.ok) return;

      const data: CompetencyOption[] = await response.json();
      setCompetencyOptions(Array.isArray(data) ? data : []);
    } catch (loadError) {
      console.error('Failed to load competency options', loadError);
    }
  }, []);

  const fetchQuestions = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');

      const query = new URLSearchParams({
        pageNumber: '1',
        pageSize: '100',
        sortBy,
        sortDirection,
      });

      if (selectedCompetency) {
        query.append('competencyType', selectedCompetency);
      }

      const response = await fetchClient(`/questions/without-exam?${query.toString()}`);

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();
      const items = Array.isArray(data) ? data : (data.data || data.items || []);

      const mappedQuestions: Question[] = items.map((item: any) => ({
        id: item.id,
        content: item.content,
        competencyType: item.competencyType,
        competencyLabel: item.competencyLabel,
        questionFormat: item.questionFormat,
        questionFormatLabel: item.questionFormatLabel,
        difficultyLevel: item.difficultyLevel,
        difficultyLabel: item.difficultyLabel,
        passageText: item.passageText,
        passageGroupKey: item.passageGroupKey,
        statementOrder: item.statementOrder,
        sourceEvidence: item.sourceEvidence,
        choices: (item.choices || []).map((choice: any) => ({
          id: choice.id,
          optionLabel: choice.optionLabel,
          content: choice.content,
          isCorrect: choice.isCorrect || false,
        })),
        dateCreated: item.dateCreated ? new Date(item.dateCreated).toLocaleDateString('vi-VN') : '',
      }));

      setQuestions(mappedQuestions);
    } catch (fetchError) {
      console.error('Failed to fetch questions', fetchError);
      setQuestions([]);
      setError('Lỗi khi tải danh sách câu hỏi');
    } finally {
      setIsLoading(false);
    }
  }, [selectedCompetency, sortBy, sortDirection]);

  useEffect(() => {
    loadCompetencyOptions();
  }, [loadCompetencyOptions]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const filteredQuestions = useMemo(() => {
    return questions.filter((question) =>
      question.content.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [questions, searchQuery]);

  const handleSort = (column: 'dateCreated' | 'content' | 'competencyType' | 'difficultyLevel') => {
    if (sortBy === column) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortBy(column);
    setSortDirection(column === 'dateCreated' ? 'desc' : 'asc');
  };

  const mapQuestionPayload = (question: Question) => ({
    content: question.content.trim(),
    competencyType: question.competencyType,
    questionFormat: question.questionFormat,
    difficultyLevel: question.difficultyLevel,
    passageText: question.passageText?.trim() || undefined,
    passageGroupKey: question.passageGroupKey?.trim() || undefined,
    statementOrder: question.statementOrder ?? undefined,
    sourceEvidence: question.sourceEvidence?.trim() || undefined,
    choices: (question.choices || []).map((choice) => ({
      optionLabel: choice.optionLabel,
      content: choice.content.trim(),
      isCorrect: !!choice.isCorrect,
    })),
  });

  const handleAddQuestion = async (newQuestion: Question) => {
    try {
      setError('');
      setSuccessMessage('');

      const response = await fetchClient('/questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mapQuestionPayload(newQuestion)),
      });

      if (!response.ok) {
        throw new Error('Thêm câu hỏi thất bại');
      }

      setSuccessMessage('Thêm câu hỏi thành công.');
      setIsAddModalOpen(false);
      fetchQuestions();
    } catch (submitError) {
      console.error('Error adding question:', submitError);
      setError('Thêm câu hỏi thất bại. Vui lòng thử lại.');
    }
  };

  const handleAddQuestions = async (newQuestions: Question[]) => {
    if (newQuestions.length === 0) return;

    try {
      setError('');
      setSuccessMessage('');

      const response = await fetchClient('/questions/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newQuestions.map(mapQuestionPayload)),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message || 'Bulk create failed');
      }

      const result = await response.json().catch(() => null);
      const createdCount = result?.count ?? newQuestions.length;

      setSuccessMessage(`Đã thêm ${createdCount} câu hỏi thành công.`);
      setIsAddModalOpen(false);
      fetchQuestions();
    } catch (submitError) {
      console.error('Error adding questions:', submitError);
      setError('Đã xảy ra lỗi khi thêm bộ câu hỏi.');
    }
  };

  const handleDeleteQuestion = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa câu hỏi này không?')) return;

    try {
      const response = await fetchClient(`/questions/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Delete failed');
      }

      fetchQuestions();
    } catch (deleteError) {
      console.error('Error deleting question:', deleteError);
      setError('Đã xảy ra lỗi khi xóa câu hỏi.');
    }
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

      {isAddModalOpen && (
        <AddQuestionMenu
          onClose={() => setIsAddModalOpen(false)}
          onAddQuestion={handleAddQuestion}
          onAddQuestions={handleAddQuestions}
        />
      )}

      {isAIModalOpen && (
        <AIQuestionGeneratorModal
          competencyOptions={competencyOptions}
          onClose={() => setIsAIModalOpen(false)}
          onSaved={(result) => {
            setError('');
            setSuccessMessage(result.message);
            setIsAIModalOpen(false);
            fetchQuestions();
          }}
        />
      )}

      <main className="flex-1 px-4 py-8 sm:px-8 lg:p-8 overflow-y-auto h-screen">
        <div className="mx-auto flex max-w-7xl flex-col gap-8">
          <div className="rounded-3xl border border-slate-200/80 bg-gradient-to-r from-white via-violet-50 to-fuchsia-50 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-2">
                <span className="inline-flex w-fit items-center rounded-full bg-fuchsia-100 px-3 py-1 text-xs font-semibold text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-300">
                  Ngân hàng câu hỏi
                </span>
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
                  Quản Lý Câu Hỏi
                </h1>
                <p className="text-base text-gray-600 dark:text-gray-400">
                  Tổng cộng: {questions.length} câu hỏi chưa gán vào bài thi
                </p>
              </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => setIsAIModalOpen(true)}
                className="flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-violet-700 transition-colors"
              >
                <Sparkles size={18} />
                <span>Tạo Câu Hỏi Bằng AI</span>
              </button>

              <button
                onClick={() => setIsAddModalOpen(true)}
                className="flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary/90 transition-colors dark:bg-blue-700 dark:hover:bg-blue-800"
              >
                <PlusCircle size={20} />
                <span>Thêm Thủ Công</span>
              </button>
            </div>
          </div>
        </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm dark:bg-green-900/20 dark:border-green-800 dark:text-green-300">
              {successMessage}
            </div>
          )}

          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="relative w-full max-w-xs">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                <Search size={20} />
              </div>
              <input
                type="text"
                placeholder="Tìm câu hỏi..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block h-10 w-full rounded-lg border border-gray-300 bg-white pl-10 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-primary focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400 dark:focus:border-blue-500 dark:focus:ring-blue-500"
              />
            </div>

            <select
              value={selectedCompetency}
              onChange={(e) => setSelectedCompetency(e.target.value)}
              className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-primary focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            >
              <option value="">Tất cả năng lực</option>
              {competencyOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-gray-500 dark:text-gray-400">Đang tải...</p>
              </div>
            ) : filteredQuestions.length > 0 ? (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300"><button type="button" onClick={() => handleSort('content')} className="hover:text-gray-900 dark:hover:text-white">Câu Hỏi {sortBy === 'content' ? (sortDirection === 'asc' ? '^' : 'v') : '<->'}</button></th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300"><button type="button" onClick={() => handleSort('competencyType')} className="hover:text-gray-900 dark:hover:text-white">Năng Lực {sortBy === 'competencyType' ? (sortDirection === 'asc' ? '^' : 'v') : '<->'}</button></th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Số Đáp Án</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300"><button type="button" onClick={() => handleSort('dateCreated')} className="hover:text-gray-900 dark:hover:text-white">Ngày Tạo {sortBy === 'dateCreated' ? (sortDirection === 'asc' ? '^' : 'v') : '<->'}</button></th>
                    <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700 dark:text-gray-300">Hành Động</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQuestions.map((question) => (
                    <tr
                      key={question.id}
                      className="border-b border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white max-w-xs truncate">
                        {question.content}
                      </td>
                      <td className="px-6 py-4 text-sm text-indigo-600 dark:text-indigo-400">
                        {question.competencyLabel || question.competencyType || '—'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {question.choices?.length || 0} đáp án
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {question.dateCreated || '—'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors dark:text-blue-400"
                            title="Chỉnh sửa"
                            disabled
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => handleDeleteQuestion(question.id)}
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
                    {searchQuery || selectedCompetency ? 'Không tìm thấy câu hỏi nào' : 'Chưa có câu hỏi nào'}
                  </p>
                  <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="text-primary hover:underline text-sm font-medium dark:text-blue-400"
                  >
                    Tạo câu hỏi đầu tiên
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

export default QuestionManagement;