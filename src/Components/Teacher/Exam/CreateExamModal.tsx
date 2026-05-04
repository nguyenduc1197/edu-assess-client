import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles } from 'lucide-react';
import { Class, CompetencyOption, Question, SubjectLabel } from '../../../types';
import { fetchClient } from '../../../api/fetchClient';
import AIQuestionGeneratorModal from '../Question/AIQuestionGeneratorModal';

interface ExamToEdit {
  id: string;
  name: string;
  start: string;
  end: string;
  questionIds: string[];
  schoolClassId: string;
}

interface CreateExamModalProps {
  onClose: () => void;
  onSuccess?: () => void;
  examToEdit?: ExamToEdit | null;
}

const CreateExamModal: React.FC<CreateExamModalProps> = ({ onClose, onSuccess, examToEdit }) => {
  const isEditing = !!examToEdit;
  const [name, setName] = useState(examToEdit?.name || '');
  const toLocalDatetime = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const [start, setStart] = useState(examToEdit ? toLocalDatetime(examToEdit.start) : '');
  const [end, setEnd] = useState(examToEdit ? toLocalDatetime(examToEdit.end) : '');
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>(examToEdit?.questionIds || []);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [competencyOptions, setCompetencyOptions] = useState<CompetencyOption[]>([]);
  
  // State for fetching questions
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isFetchingQuestions, setIsFetchingQuestions] = useState(true);
  
  // State for fetching classes
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>(examToEdit?.schoolClassId || '');
  const [isFetchingClasses, setIsFetchingClasses] = useState(true);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchQuestions = useCallback(async () => {
    setIsFetchingQuestions(true);
    try {
      const requests: Promise<Response>[] = [
        fetchClient('/questions/without-exam?pageNumber=1&pageSize=100'),
      ];
      if (isEditing && examToEdit?.id) {
        requests.push(fetchClient(`/questions?examId=${examToEdit.id}&pageNumber=1&pageSize=200`));
      }

      const [availableRes, examQuestionsRes] = await Promise.all(requests);

      let questionsList: Question[] = [];

      if (availableRes.ok) {
        const data = await availableRes.json();
        questionsList = Array.isArray(data) ? data : (data.items || data.data || []);
      } else {
        console.error('Failed to fetch questions:', availableRes.status);
      }

      if (examQuestionsRes && examQuestionsRes.ok) {
        const data = await examQuestionsRes.json();
        const examQuestions: Question[] = Array.isArray(data) ? data : (data.items || data.data || []);
        const existingIds = new Set(questionsList.map((q) => q.id));
        examQuestions.forEach((q) => {
          if (!existingIds.has(q.id)) {
            questionsList.push(q);
            existingIds.add(q.id);
          }
        });
      }

      setQuestions(questionsList);
    } catch (err) {
      console.error('Error fetching questions:', err);
    } finally {
      setIsFetchingQuestions(false);
    }
  }, [isEditing, examToEdit?.id]);

  const fetchCompetencies = useCallback(async () => {
    try {
      const response = await fetchClient('/questions/competency-types');
      if (!response.ok) return;

      const data = await response.json();
      setCompetencyOptions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching competency options:', err);
    }
  }, []);

  useEffect(() => {
    fetchQuestions();
    fetchCompetencies();
  }, [fetchQuestions, fetchCompetencies]);

  // Fetch classes on mount
  useEffect(() => {
    const fetchClasses = async () => {
      setIsFetchingClasses(true);
      try {
        const response = await fetchClient('/classes?pageNumber=1&pageSize=100');

        if (response.ok) {
          const data = await response.json();
          const classList = Array.isArray(data) ? data : (data.items || data.data || []);
          setClasses(classList);
        } else {
          console.error("Failed to fetch classes:", response.status);
          throw new Error("Failed to fetch classes");
        }
      } catch (err) {
        console.warn("Error fetching classes, using mock data:", err);
        setClasses([
          { id: "81114db7-ef7c-4cec-97b1-4428aa7aada5", name: "10A1" },
          { id: "mock-2", name: "10A2" },
          { id: "mock-3", name: "11B1" }
        ]);
      } finally {
        setIsFetchingClasses(false);
      }
    };

    fetchClasses();
  }, []);


  const handleQuestionToggle = (id: string) => {
    setSelectedQuestionIds(prev => 
      prev.includes(id) ? prev.filter(qId => qId !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (!name || !start || !end || !selectedClassId) {
      setError('Vui lòng nhập đầy đủ tên bài thi, thời gian và lớp học.');
      setIsLoading(false);
      return;
    }

    if (selectedQuestionIds.length === 0) {
      setError('Vui lòng chọn ít nhất một câu hỏi.');
      setIsLoading(false);
      return;
    }

    const payload = {
      name,
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString(),
      questionIds: selectedQuestionIds,
      schoolClassId: selectedClassId
    };

    try {
    const url = isEditing ? `/exams/${examToEdit!.id}` : '/exams';
    const method = isEditing ? 'PUT' : 'POST';
    const response = await fetchClient(url,
    {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

      if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
      }

      // Success
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error("Failed to save exam:", err);
      setError(isEditing ? "Cập nhật bài thi thất bại. Vui lòng thử lại." : "Failed to create exam. Please ensure the server is running.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl rounded-xl bg-white dark:bg-background-dark shadow-2xl border border-gray-200 dark:border-gray-700 max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {isAIModalOpen && (
          <AIQuestionGeneratorModal
            competencyOptions={competencyOptions}
            enableExamVariantMode={true}
            onClose={() => setIsAIModalOpen(false)}
            onSaved={(result) => {
              setSuccessMessage(result.message);
              setIsAIModalOpen(false);
              fetchQuestions();

              if ((result.savedQuestionIds || []).length > 0) {
                setSelectedQuestionIds((prev) => Array.from(new Set([...prev, ...(result.savedQuestionIds || [])])));
              }
            }}
          />
        )}
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 px-6 py-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{isEditing ? 'Chỉnh Sửa Bài Kiểm Tra' : 'Tạo Bài Kiểm Tra'}</h2>
          <button 
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-500 dark:hover:bg-gray-800 transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto p-6 flex-1">
          <form id="create-exam-form" onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
                {error}
              </div>
            )}

            {successMessage && (
              <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm border border-green-100 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300">
                {successMessage}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Tên Bài Tập
                </label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ví dụ: Kiểm tra 15 phút"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="subject" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Môn Học
                </label>
                <input
                  type="text"
                  id="subject"
                  value={SubjectLabel.GD_KTPL}
                  disabled
                  className="w-full rounded-lg border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-500 focus:border-primary focus:outline-none dark:border-gray-600 dark:bg-gray-800/50 dark:text-gray-400 cursor-not-allowed"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="classId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Lớp
              </label>
              <div className="relative">
                <select
                  id="classId"
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                >
                  <option value="" disabled>Chọn lớp học</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              {isFetchingClasses && (
                 <p className="text-xs text-gray-500">Đang tải danh sách lớp...</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="start" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Thời Gian Bắt Dầu
                </label>
                <input
                  type="datetime-local"
                  id="start"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:[color-scheme:dark]"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="end" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Thời Gian Kết Thúc
                </label>
                <input
                  type="datetime-local"
                  id="end"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:[color-scheme:dark]"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Chọn Câu Hỏi ({selectedQuestionIds.length})
                  </label>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {isFetchingQuestions ? 'Đang tải câu hỏi...' : 'Chọn câu hỏi cho bài kiểm tra'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setIsAIModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700 transition-colors"
                >
                  <Sparkles size={16} />
                  Tạo câu hỏi bằng AI
                </button>
              </div>
              
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 h-64 overflow-y-auto p-2 space-y-2">
                {isFetchingQuestions ? (
                  <div className="flex h-full w-full items-center justify-center text-gray-500 dark:text-gray-400 gap-2">
                    <span className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></span>
                    <span>Đang tải...</span>
                  </div>
                ) : questions.length === 0 ? (
                  <div className="flex h-full w-full items-center justify-center text-gray-500 dark:text-gray-400 text-sm">
                    Chưa có câu hỏi nào.
                  </div>
                ) : (
                  questions.map(q => (
                    <label 
                      key={q.id} 
                      className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-all ${
                        selectedQuestionIds.includes(q.id) 
                          ? 'bg-primary/5 border-primary/30 dark:bg-primary/10 dark:border-primary/30' 
                          : 'bg-white border-transparent hover:border-gray-200 dark:bg-gray-800 dark:hover:border-gray-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary dark:border-gray-600 dark:bg-gray-700"
                        checked={selectedQuestionIds.includes(q.id)}
                        onChange={() => handleQuestionToggle(q.id)}
                      />
                      <div className="flex-1">
                        <p className="text-sm text-gray-900 dark:text-gray-200">{q.content}</p>
                        <div className="mt-1 flex flex-wrap gap-2 text-xs">
                          {q.competencyLabel && <span className="text-indigo-600 dark:text-indigo-400">{q.competencyLabel}</span>}
                          {q.questionFormatLabel && <span className="text-violet-600 dark:text-violet-400">{q.questionFormatLabel}</span>}
                          {q.difficultyLabel && <span className="text-amber-600 dark:text-amber-400">{q.difficultyLabel}</span>}
                        </div>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-100 dark:border-gray-700 px-6 py-4 bg-gray-50/50 dark:bg-gray-800/50 rounded-b-xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white rounded-lg transition-colors"
          >
            Hủy
          </button>
          <button
            type="submit"
            form="create-exam-form"
            disabled={isLoading}
            className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
             {isLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  Đang lưu...
                </>
             ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">save</span>
                  {isEditing ? 'Cập nhật' : 'Tạo bài kiểm tra'}
                </>
             )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateExamModal;
