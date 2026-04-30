import React, { useState } from 'react';
import { Bot, Loader2, Save, UploadCloud, X } from 'lucide-react';
import {
  AIExamScanGenerateResponse,
  AIExamVariant,
  AIQuestionGenerateResponse,
  Choice,
  CompetencyOption,
  Question,
} from '../../../types';
import { fetchClient } from '../../../api/fetchClient';

type SourceMode = 'text' | 'pdf' | 'url' | 'youtube';
type GeneratorTab = 'content' | 'scan';

type GeneratedQuestion = Question & {
  sourceEvidence?: string;
  choices: Choice[];
};

interface AIQuestionGeneratorModalProps {
  competencyOptions: CompetencyOption[];
  onClose: () => void;
  onSaved?: (result: { message: string; savedQuestionIds?: string[] }) => void;
  enableExamVariantMode?: boolean;
  initialTab?: GeneratorTab;
}

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];
const DIFFICULTY_LABELS: Record<string, string> = {
  Easy: 'Dễ',
  Medium: 'Trung bình',
  Hard: 'Khó',
};

const FORMAT_LABELS: Record<string, string> = {
  SingleChoice: 'Trắc nghiệm một đáp án',
  TrueFalse: 'Đúng / Sai',
};

const getCompetencyLabel = (value?: string, options: CompetencyOption[] = []) =>
  options.find((option) => option.value === value)?.label || value || 'Chưa chọn năng lực';

const countWords = (value?: string | null) =>
  (value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

const AIQuestionGeneratorModal: React.FC<AIQuestionGeneratorModalProps> = ({
  competencyOptions,
  onClose,
  onSaved,
  enableExamVariantMode = false,
  initialTab = 'content',
}) => {
  const [activeTab, setActiveTab] = useState<GeneratorTab>(enableExamVariantMode ? initialTab : 'content');
  const [sourceMode, setSourceMode] = useState<SourceMode>('text');
  const [sourceText, setSourceText] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [selectedCompetencies, setSelectedCompetencies] = useState<string[]>([]);
  const [questionCount, setQuestionCount] = useState(5);
  const [variantCount, setVariantCount] = useState(3);
  const [saveToQuestionBank, setSaveToQuestionBank] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingDrafts, setIsSavingDrafts] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[]>([]);
  const [responseMeta, setResponseMeta] = useState<AIQuestionGenerateResponse | null>(null);
  const [scanResponseMeta, setScanResponseMeta] = useState<AIExamScanGenerateResponse | null>(null);
  const [scanVariants, setScanVariants] = useState<AIExamVariant[]>([]);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState<number>(0);

  const toggleCompetency = (value: string) => {
    setSelectedCompetencies((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
  };

  const validateSource = () => {
    if (activeTab === 'scan') {
      if (!scanFile) {
        return 'Vui lòng tải lên ảnh scan hoặc file PDF của đề bài.';
      }

      if (variantCount < 1 || variantCount > 5) {
        return 'Số lượng biến thể phải nằm trong khoảng từ 1 đến 5.';
      }

      return '';
    }

    if (selectedCompetencies.length === 0) {
      return 'Vui lòng chọn ít nhất một năng lực cần đánh giá.';
    }

    if (questionCount < 1 || questionCount > 40) {
      return 'Số câu hỏi phải từ 1 đến 40.';
    }

    if (sourceMode === 'text' && !sourceText.trim()) {
      return 'Vui lòng nhập nội dung bài học.';
    }

    if ((sourceMode === 'url' || sourceMode === 'youtube') && !sourceUrl.trim()) {
      return 'Vui lòng nhập liên kết nguồn.';
    }

    if (sourceMode === 'pdf' && !file) {
      return 'Vui lòng chọn tệp PDF để tải lên.';
    }

    return '';
  };

  const normalizeQuestions = (items: Question[] = []): GeneratedQuestion[] => {
    const seed = Date.now();

    return items.map((question, questionIndex) => {
      const questionFormat = question.questionFormat || 'SingleChoice';
      const rawChoices = question.choices || [];
      const choices = (questionFormat === 'TrueFalse'
        ? [rawChoices[0], rawChoices[1]].map((choice, choiceIndex) => ({
            id: choice?.id || `ai-choice-${seed}-${questionIndex}-${choiceIndex}`,
            optionLabel: OPTION_LABELS[choiceIndex],
            content: choice?.content || (choiceIndex === 0 ? 'Đúng' : 'Sai'),
            isCorrect: !!choice?.isCorrect,
          }))
        : rawChoices.map((choice, choiceIndex) => ({
            id: choice.id || `ai-choice-${seed}-${questionIndex}-${choiceIndex}`,
            optionLabel: choice.optionLabel || OPTION_LABELS[choiceIndex] || String(choiceIndex + 1),
            content: choice.content || '',
            isCorrect: !!choice.isCorrect,
          }))) as Choice[];

      return {
        ...question,
        id: question.id || `ai-${seed}-${questionIndex}`,
        competencyType: question.competencyType || selectedCompetencies[0] || '',
        questionFormat,
        difficultyLevel: question.difficultyLevel || 'Medium',
        choices,
      };
    });
  };

  const resetGeneratedState = () => {
    setGeneratedQuestions([]);
    setResponseMeta(null);
    setScanResponseMeta(null);
    setScanVariants([]);
    setSelectedVariantIndex(0);
  };

  const handleGenerate = async () => {
    const validationMessage = validateSource();

    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    try {
      setIsGenerating(true);
      setError('');
      setSuccessMessage('');
      resetGeneratedState();

      const formData = new FormData();

      if (activeTab === 'scan') {
        formData.append('file', scanFile as Blob);
        formData.append('variantCount', String(variantCount));
        formData.append('saveToQuestionBank', String(saveToQuestionBank));

        const response = await fetchClient('/exams/ai-generate-from-scan', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.message || body?.title || 'Tạo đề từ ảnh scan thất bại.');
        }

        const data: AIExamScanGenerateResponse = await response.json();
        const normalizedVariants = (data.examVariants || []).map((variant) => ({
          ...variant,
          questions: normalizeQuestions((variant.questions || []) as GeneratedQuestion[]),
        }));

        setScanResponseMeta(data);
        setScanVariants(normalizedVariants);
        setSelectedVariantIndex(0);

        if (saveToQuestionBank) {
          const selectedVariant = normalizedVariants[0];
          const savedIds = selectedVariant?.savedQuestionIds || [];

          if (savedIds.length > 0) {
            const message = `Đã tạo ${normalizedVariants.length} biến thể và nạp sẵn câu hỏi của biến thể ${selectedVariant.variantIndex} vào quy trình tạo bài thi.`;
            setSuccessMessage(message);
            onSaved?.({ message, savedQuestionIds: savedIds });
          }
        }

        return;
      }

      if (sourceMode === 'text') {
        formData.append('sourceText', sourceText.trim());
      }

      if (sourceMode === 'pdf' && file) {
        formData.append('file', file);
      }

      if ((sourceMode === 'url' || sourceMode === 'youtube') && sourceUrl.trim()) {
        formData.append('sourceUrl', sourceUrl.trim());
      }

      selectedCompetencies.forEach((competency) => {
        formData.append('competencies', competency);
      });

      formData.append('questionCount', String(questionCount));
      formData.append('saveToQuestionBank', String(saveToQuestionBank));

      const response = await fetchClient('/questions/ai-generate', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message || body?.title || 'Tạo câu hỏi bằng AI thất bại.');
      }

      const data: AIQuestionGenerateResponse = await response.json();
      const normalizedQuestions = normalizeQuestions(data.questions || []);

      setResponseMeta(data);
      setGeneratedQuestions(normalizedQuestions);

      if (saveToQuestionBank) {
        const savedIds = data.savedQuestionIds ?? [];
        const savedCount = savedIds.length ?? normalizedQuestions.length;
        const message = `Đã tạo và lưu ${savedCount || normalizedQuestions.length} câu hỏi vào ngân hàng câu hỏi.`;
        setSuccessMessage(message);
        onSaved?.({ message, savedQuestionIds: savedIds });
        onClose();
      } else if (normalizedQuestions.length === 0) {
        setError('AI chưa trả về câu hỏi nào để xem trước.');
      }
    } catch (generateError: any) {
      console.error('AI question generation failed:', generateError);
      setError(generateError?.message || 'Không thể tạo câu hỏi bằng AI.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUseVariantForExam = () => {
    const selectedVariant = scanVariants[selectedVariantIndex];
    const savedIds = selectedVariant?.savedQuestionIds || [];

    if (!selectedVariant) {
      setError('Chưa có biến thể nào để sử dụng.');
      return;
    }

    if (savedIds.length === 0) {
      setError('Biến thể này chưa có mã câu hỏi đã lưu. Hãy bật lưu vào ngân hàng câu hỏi rồi tạo lại để dùng trực tiếp cho quy trình tạo bài thi.');
      return;
    }

    const message = `Đã chọn biến thể ${selectedVariant.variantIndex}: ${selectedVariant.examName}.`;
    setSuccessMessage(message);
    onSaved?.({ message, savedQuestionIds: savedIds });
    onClose();
  };

  const selectedVariant = scanVariants[selectedVariantIndex] || null;

  const updateQuestionContent = (questionIndex: number, value: string) => {
    setGeneratedQuestions((prev) =>
      prev.map((question, index) =>
        index === questionIndex ? { ...question, content: value } : question
      )
    );
  };

  const updateQuestionCompetency = (questionIndex: number, value: string) => {
    const label = competencyOptions.find((item) => item.value === value)?.label;

    setGeneratedQuestions((prev) =>
      prev.map((question, index) =>
        index === questionIndex
          ? { ...question, competencyType: value, competencyLabel: label }
          : question
      )
    );
  };

  const updateQuestionDifficulty = (questionIndex: number, value: string) => {
    setGeneratedQuestions((prev) =>
      prev.map((question, index) =>
        index === questionIndex ? { ...question, difficultyLevel: value as any } : question
      )
    );
  };

  const updateGroupCompetency = (groupKey: string, value: string) => {
    const label = competencyOptions.find((item) => item.value === value)?.label;

    setGeneratedQuestions((prev) =>
      prev.map((question) =>
        question.passageGroupKey === groupKey
          ? { ...question, competencyType: value, competencyLabel: label }
          : question
      )
    );
  };

  const updateGroupDifficulty = (groupKey: string, value: string) => {
    setGeneratedQuestions((prev) =>
      prev.map((question) =>
        question.passageGroupKey === groupKey
          ? { ...question, difficultyLevel: value as any }
          : question
      )
    );
  };

  const updatePassageTextForGroup = (groupKey: string, value: string) => {
    setGeneratedQuestions((prev) =>
      prev.map((question) =>
        question.passageGroupKey === groupKey ? { ...question, passageText: value } : question
      )
    );
  };

  const removeGeneratedQuestion = (questionIndex: number) => {
    setGeneratedQuestions((prev) => prev.filter((_, index) => index !== questionIndex));
  };

  const removeGeneratedGroup = (groupKey: string) => {
    setGeneratedQuestions((prev) => prev.filter((question) => question.passageGroupKey !== groupKey));
  };

  const updateChoiceContent = (questionIndex: number, choiceIndex: number, value: string) => {
    setGeneratedQuestions((prev) =>
      prev.map((question, index) => {
        if (index !== questionIndex) return question;

        return {
          ...question,
          choices: question.choices.map((choice, idx) =>
            idx === choiceIndex ? { ...choice, content: value } : choice
          ),
        };
      })
    );
  };

  const setCorrectChoice = (questionIndex: number, choiceIndex: number) => {
    setGeneratedQuestions((prev) =>
      prev.map((question, index) => {
        if (index !== questionIndex) return question;

        return {
          ...question,
          choices: question.choices.map((choice, idx) => ({
            ...choice,
            isCorrect: idx === choiceIndex,
          })),
        };
      })
    );
  };

  const handleSaveDrafts = async () => {
    if (generatedQuestions.length === 0) {
      setError('Chưa có câu hỏi nào để lưu.');
      return;
    }

    const hasInvalidDraft = generatedQuestions.some((question) => {
      const filledChoices = question.choices?.filter((choice) => choice.content.trim()) || [];
      const correctChoices = filledChoices.filter((choice) => choice.isCorrect);

      return !question.content.trim() || !question.competencyType || filledChoices.length < 2 || correctChoices.length !== 1;
    });

    if (hasInvalidDraft) {
      setError('Mỗi câu hỏi cần có nội dung, năng lực, ít nhất 2 đáp án và đúng 1 đáp án đúng.');
      return;
    }

    try {
      setIsSavingDrafts(true);
      setError('');
      setSuccessMessage('');

      const payload = generatedQuestions.map((question) => ({
        content: question.content.trim(),
        competencyType: question.competencyType,
        questionFormat: question.questionFormat,
        difficultyLevel: question.difficultyLevel,
        passageText: question.passageText?.trim() || undefined,
        passageGroupKey: question.passageGroupKey?.trim() || undefined,
        statementOrder: question.statementOrder ?? undefined,
        sourceEvidence: question.sourceEvidence?.trim() || undefined,
        choices: question.choices.map((choice, index) => ({
          optionLabel: choice.optionLabel || OPTION_LABELS[index] || String(index + 1),
          content: choice.content.trim(),
          isCorrect: !!choice.isCorrect,
        })),
      }));

      const response = await fetchClient('/questions/ai-save-drafts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.message || body?.title || 'Lưu bản nháp AI thất bại.');
      }

      const savedQuestionIds = body?.questionIds || body?.savedQuestionIds || [];
      const message = `Đã lưu ${generatedQuestions.length} câu hỏi AI vào ngân hàng câu hỏi.`;
      setSuccessMessage(message);
      onSaved?.({ message, savedQuestionIds });
      onClose();
    } catch (saveError: any) {
      console.error('Saving AI drafts failed:', saveError);
      setError(saveError?.message || 'Không thể lưu bản nháp AI.');
    } finally {
      setIsSavingDrafts(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div
        className="w-full max-w-5xl rounded-xl bg-white dark:bg-gray-900 shadow-2xl border border-gray-200 dark:border-gray-700 max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-violet-100 p-2 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
              <Bot size={18} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">{enableExamVariantMode ? 'Tạo bài thi bằng AI' : 'Tạo câu hỏi bằng AI'}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {enableExamVariantMode
                  ? 'Tạo câu hỏi từ nội dung hoặc tạo biến thể đề mới từ ảnh scan'
                  : 'Hỗ trợ từ văn bản, PDF, liên kết web hoặc YouTube'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
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

          {enableExamVariantMode && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-800/50">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('content');
                  setError('');
                  setSuccessMessage('');
                  resetGeneratedState();
                }}
                className={`rounded-lg px-4 py-3 text-sm font-semibold transition-colors ${
                  activeTab === 'content'
                    ? 'bg-white text-violet-700 shadow-sm dark:bg-gray-900 dark:text-violet-300'
                    : 'text-gray-600 hover:bg-white/70 dark:text-gray-300 dark:hover:bg-gray-900/50'
                }`}
              >
                Tạo câu hỏi từ nội dung
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('scan');
                  setError('');
                  setSuccessMessage('');
                  resetGeneratedState();
                }}
                className={`rounded-lg px-4 py-3 text-sm font-semibold transition-colors ${
                  activeTab === 'scan'
                    ? 'bg-white text-violet-700 shadow-sm dark:bg-gray-900 dark:text-violet-300'
                    : 'text-gray-600 hover:bg-white/70 dark:text-gray-300 dark:hover:bg-gray-900/50'
                }`}
              >
                Tạo đề mới từ ảnh scan
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="space-y-4">
              {activeTab === 'content' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nguồn nội dung
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    { value: 'text', label: 'Văn bản' },
                    { value: 'pdf', label: 'PDF' },
                    { value: 'url', label: 'Liên kết web' },
                    { value: 'youtube', label: 'YouTube' },
                  ].map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setSourceMode(item.value as SourceMode)}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                        sourceMode === item.value
                          ? 'border-violet-500 bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:border-violet-400 dark:text-violet-300'
                          : 'border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-xl border border-dashed border-gray-300 bg-white p-4 dark:border-gray-600 dark:bg-gray-800/40">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Ảnh scan hoặc PDF đề gốc
                    </label>
                    <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800">
                      <UploadCloud size={20} />
                      <span>{scanFile ? scanFile.name : 'Tải lên file scan đề gốc (PNG, JPG, JPEG, WEBP, PDF)'}</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
                        className="hidden"
                        onChange={(e) => setScanFile(e.target.files?.[0] || null)}
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Số lượng biến thể
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={5}
                        value={variantCount}
                        onChange={(e) => setVariantCount(Number(e.target.value) || 1)}
                        className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                      />
                    </div>

                    <div className="flex items-end">
                      <label className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3 w-full bg-gray-50 dark:bg-gray-800/50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={saveToQuestionBank}
                          onChange={(e) => setSaveToQuestionBank(e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                        />
                        <span>Lưu câu hỏi của biến thể vào ngân hàng</span>
                      </label>
                    </div>
                  </div>

                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
                    Ảnh scan hoặc file PDF chỉ dùng để sinh biến thể đề mới. Quy trình tạo bài thi hiện tại vẫn giữ nguyên, và nếu bật lưu vào ngân hàng câu hỏi thì bạn có thể nạp ngay mã câu hỏi của biến thể đã chọn vào biểu mẫu tạo bài thi này.
                  </div>
                </div>
              )}

              {activeTab === 'content' && sourceMode === 'text' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nội dung bài học
                  </label>
                  <textarea
                    value={sourceText}
                    onChange={(e) => setSourceText(e.target.value)}
                    rows={8}
                    placeholder="Dán nội dung bài học để AI tạo câu hỏi..."
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none"
                  />
                </div>
              )}

              {activeTab === 'content' && (sourceMode === 'url' || sourceMode === 'youtube') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {sourceMode === 'youtube' ? 'Liên kết YouTube' : 'Liên kết trang web'}
                  </label>
                  <input
                    type="url"
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    placeholder={sourceMode === 'youtube' ? 'https://www.youtube.com/watch?v=...' : 'https://example.com/bai-hoc'}
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  />
                  {sourceMode === 'youtube' && (
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      Nếu video không có transcript, bạn có thể chuyển sang nguồn Văn bản và dán nội dung thủ công.
                    </p>
                  )}
                </div>
              )}

              {activeTab === 'content' && sourceMode === 'pdf' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tệp PDF
                  </label>
                  <label className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 px-4 py-6 text-sm text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
                    <UploadCloud size={18} />
                    <span>{file ? file.name : 'Chọn tệp PDF để tải lên'}</span>
                    <input
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                    />
                  </label>
                </div>
              )}
            </div>

            <div className="space-y-4">
              {activeTab === 'content' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Năng lực cần đánh giá
                </label>
                <div className="space-y-2 rounded-lg border border-gray-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-800/50">
                  {competencyOptions.map((option) => (
                    <label key={option.value} className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedCompetencies.includes(option.value)}
                        onChange={() => toggleCompetency(option.value)}
                        className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              ) : (
                <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900/60">
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Các bước sau khi AI sinh đề</p>
                    <ul className="mt-2 space-y-2 text-sm text-gray-600 dark:text-gray-400">
                      <li>Xem trước câu hỏi của từng biến thể ngay trong cửa sổ này.</li>
                      <li>Nếu bật lưu vào ngân hàng, dùng danh sách mã câu hỏi đã lưu để quay lại quy trình tạo bài thi hiện có.</li>
                      <li>Nếu chưa bật lưu, cửa sổ vẫn cho xem lại đầy đủ nhưng chưa thể nạp mã câu hỏi vào biểu mẫu tạo bài thi.</li>
                    </ul>
                  </div>
                </div>
              )}

              {activeTab === 'content' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Số lượng câu hỏi
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={40}
                    value={questionCount}
                    onChange={(e) => setQuestionCount(Number(e.target.value) || 1)}
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  />
                </div>

                <div className="flex items-end">
                  <label className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3 w-full bg-gray-50 dark:bg-gray-800/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={saveToQuestionBank}
                      onChange={(e) => setSaveToQuestionBank(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                    />
                    <span>Lưu trực tiếp vào ngân hàng câu hỏi</span>
                  </label>
                </div>
              </div>
              )}

              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    {activeTab === 'scan' ? 'Đang tạo biến thể đề...' : 'Đang tạo câu hỏi...'}
                  </>
                ) : (
                  <>
                    <Bot size={16} />
                    {activeTab === 'scan' ? 'Tạo đề mới từ ảnh scan' : 'Tạo câu hỏi bằng AI'}
                  </>
                )}
              </button>
            </div>
          </div>

          {activeTab === 'content' && responseMeta && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-900">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Thông tin nguồn đã trích xuất</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Loại nguồn</p>
                  <p className="font-medium text-gray-900 dark:text-white">{responseMeta.sourceType || '—'}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Tiêu đề</p>
                  <p className="font-medium text-gray-900 dark:text-white">{responseMeta.sourceTitle || '—'}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Số ký tự</p>
                  <p className="font-medium text-gray-900 dark:text-white">{responseMeta.extractedCharacterCount ?? '—'}</p>
                </div>
              </div>
              {responseMeta.sourcePreview && (
                <div className="mt-3 rounded-lg bg-gray-50 dark:bg-gray-800 p-3 text-sm text-gray-600 dark:text-gray-300">
                  {responseMeta.sourcePreview}
                </div>
              )}
            </div>
          )}

          {activeTab === 'scan' && scanResponseMeta && (
            <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Nguồn</p>
                  <p className="font-medium text-gray-900 dark:text-white">{scanResponseMeta.sourceTitle || '—'}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Môn học suy luận</p>
                  <p className="font-medium text-gray-900 dark:text-white">{scanResponseMeta.inferredSubject || '—'}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Khối lớp</p>
                  <p className="font-medium text-gray-900 dark:text-white">{scanResponseMeta.inferredGradeLevel || '—'}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Số biến thể</p>
                  <p className="font-medium text-gray-900 dark:text-white">{scanResponseMeta.variantCount ?? scanVariants.length}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                  <p className="text-gray-500 dark:text-gray-400">Chủ đề gốc được suy luận</p>
                  <p className="mt-1 font-medium text-gray-900 dark:text-white">{scanResponseMeta.inferredOriginalTopic || '—'}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                  <p className="text-gray-500 dark:text-gray-400">Tóm tắt cấu trúc đề gốc</p>
                  <p className="mt-1 text-gray-700 dark:text-gray-200">{scanResponseMeta.originalStructureSummary || '—'}</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'scan' && scanVariants.length > 0 && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {scanVariants.map((variant, index) => (
                  <button
                    key={variant.variantIndex}
                    type="button"
                    onClick={() => setSelectedVariantIndex(index)}
                    className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                      selectedVariantIndex === index
                        ? 'border-violet-500 bg-violet-50 text-violet-700 dark:border-violet-400 dark:bg-violet-900/20 dark:text-violet-300'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800'
                    }`}
                  >
                    Biến thể {variant.variantIndex}
                  </button>
                ))}
              </div>

              {selectedVariant && (
                <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900 space-y-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white">{selectedVariant.examName}</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{selectedVariant.targetTopic || 'Chưa có chủ đề đích'}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleUseVariantForExam}
                        className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 transition-colors"
                      >
                        Dùng biến thể này để tạo bài thi
                      </button>
                    </div>
                  </div>

                  {selectedVariant.generationNotes && (
                    <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                      {selectedVariant.generationNotes}
                    </div>
                  )}

                  {!saveToQuestionBank && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                      Bạn đang ở chế độ xem trước. Nếu muốn nạp trực tiếp vào quy trình tạo bài thi, hãy bật "Lưu câu hỏi của biến thể vào ngân hàng" rồi tạo lại.
                    </div>
                  )}

                  <div className="space-y-4">
                    {selectedVariant.questions
                      .map((question, originalIndex) => ({ question, originalIndex }))
                      .filter(({ question, originalIndex }) => {
                        if (question.questionFormat !== 'TrueFalse' || !question.passageGroupKey) return true;
                        return !selectedVariant.questions.some(
                          (other, otherIndex) =>
                            otherIndex < originalIndex &&
                            other.questionFormat === 'TrueFalse' &&
                            other.passageGroupKey === question.passageGroupKey
                        );
                      })
                      .map(({ question, originalIndex }) => {
                        if (question.questionFormat === 'TrueFalse' && question.passageGroupKey) {
                          const groupItems = selectedVariant.questions
                            .filter((item) => item.passageGroupKey === question.passageGroupKey)
                            .sort((a, b) => (a.statementOrder || 0) - (b.statementOrder || 0));

                          return (
                            <div key={question.passageGroupKey} className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                              <p className="text-sm font-semibold text-violet-600 dark:text-violet-400">Nhóm Đúng / Sai</p>
                              {question.passageText && (
                                <div className="mt-3 rounded-lg bg-gray-50 p-3 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                                  {question.passageText}
                                </div>
                              )}
                              <div className="mt-3 space-y-3">
                                {groupItems.map((item, index) => (
                                  <div key={`${item.id || question.passageGroupKey}-${index}`} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Mệnh đề {item.statementOrder ?? index + 1}</p>
                                    <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">{item.content}</p>
                                    <div className="mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-300">
                                      {item.choices?.slice(0, 2).map((choice, choiceIndex) => (
                                        <p key={`${item.id}-${choiceIndex}`}>
                                          <span className="font-semibold text-violet-600 dark:text-violet-300">{choice.optionLabel}.</span> {choice.content}
                                          {choice.isCorrect ? ' (Đáp án đúng)' : ''}
                                        </p>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div key={question.id || `${selectedVariant.variantIndex}-${originalIndex}`} className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                            <div className="flex flex-wrap gap-2 text-xs">
                              {question.competencyType && <span className="rounded-full bg-indigo-50 px-3 py-1 font-medium text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300">{getCompetencyLabel(question.competencyType, competencyOptions)}</span>}
                              {question.questionFormat && <span className="rounded-full bg-violet-50 px-3 py-1 font-medium text-violet-700 dark:bg-violet-900/20 dark:text-violet-300">{FORMAT_LABELS[question.questionFormat] || question.questionFormat}</span>}
                              {question.difficultyLevel && <span className="rounded-full bg-amber-50 px-3 py-1 font-medium text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">{DIFFICULTY_LABELS[question.difficultyLevel] || question.difficultyLevel}</span>}
                            </div>
                            <p className="mt-3 text-sm font-medium text-gray-900 dark:text-white">{question.content}</p>
                            {question.sourceEvidence && (
                              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Nguồn gợi ý: {question.sourceEvidence}</p>
                            )}
                            <div className="mt-3 space-y-2 text-sm text-gray-600 dark:text-gray-300">
                              {question.choices?.map((choice, choiceIndex) => (
                                <p key={`${question.id}-${choiceIndex}`}>
                                  <span className="font-semibold text-violet-600 dark:text-violet-300">{choice.optionLabel}.</span> {choice.content}
                                  {choice.isCorrect ? ' (Đáp án đúng)' : ''}
                                </p>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'content' && generatedQuestions.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Xem trước và chỉnh sửa</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Bạn có thể sửa nội dung trước khi lưu vào ngân hàng câu hỏi.</p>
                </div>
                {!saveToQuestionBank && (
                  <button
                    type="button"
                    onClick={handleSaveDrafts}
                    disabled={isSavingDrafts}
                    className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSavingDrafts ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    Lưu bản nháp đã duyệt
                  </button>
                )}
              </div>

              {generatedQuestions
                .map((question, originalIndex) => ({ question, originalIndex }))
                .filter(({ question, originalIndex }) => {
                  if (question.questionFormat !== 'TrueFalse' || !question.passageGroupKey) return true;
                  return !generatedQuestions.some(
                    (other, otherIndex) =>
                      otherIndex < originalIndex &&
                      other.questionFormat === 'TrueFalse' &&
                      other.passageGroupKey === question.passageGroupKey
                  );
                })
                .map(({ question, originalIndex }) => {
                  if (question.questionFormat === 'TrueFalse' && question.passageGroupKey) {
                    const groupItems = generatedQuestions
                      .map((item, index) => ({ item, index }))
                      .filter(({ item }) => item.passageGroupKey === question.passageGroupKey)
                      .sort((a, b) => (a.item.statementOrder || 0) - (b.item.statementOrder || 0));
                    const passageWordCount = countWords(question.passageText);
                    const shouldReviewPassage = passageWordCount > 0 && passageWordCount < 60;

                    return (
                      <div key={question.passageGroupKey} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-violet-600 dark:text-violet-400">Nhóm câu Đúng / Sai</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <span className="inline-flex items-center rounded-full bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1 text-xs font-medium text-indigo-700 dark:text-indigo-300">
                                {competencyOptions.find((option) => option.value === question.competencyType)?.label || question.competencyType || 'Chưa chọn năng lực'}
                              </span>
                              <span className="inline-flex items-center rounded-full bg-violet-50 dark:bg-violet-900/20 px-3 py-1 text-xs font-medium text-violet-700 dark:text-violet-300">
                                {FORMAT_LABELS[question.questionFormat || 'TrueFalse'] || question.questionFormat}
                              </span>
                              <span className="inline-flex items-center rounded-full bg-amber-50 dark:bg-amber-900/20 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                                {DIFFICULTY_LABELS[question.difficultyLevel || 'Medium'] || question.difficultyLevel}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeGeneratedGroup(question.passageGroupKey || '')}
                            className="text-sm font-medium text-red-600 hover:text-red-700"
                          >
                            Bỏ cả nhóm
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <select
                            value={question.competencyType || ''}
                            onChange={(e) => updateGroupCompetency(question.passageGroupKey || '', e.target.value)}
                            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white"
                          >
                            <option value="">Chọn năng lực</option>
                            {competencyOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>

                          <select
                            value={question.difficultyLevel || 'Medium'}
                            onChange={(e) => updateGroupDifficulty(question.passageGroupKey || '', e.target.value)}
                            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white"
                          >
                            <option value="Easy">Dễ</option>
                            <option value="Medium">Trung bình</option>
                            <option value="Hard">Khó</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Đoạn văn chung
                          </label>
                          <textarea
                            value={question.passageText || ''}
                            onChange={(e) => updatePassageTextForGroup(question.passageGroupKey || '', e.target.value)}
                            rows={4}
                            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none"
                          />
                          {shouldReviewPassage && (
                            <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                              Đoạn văn này đang khá ngắn cho một nhóm Đúng / Sai dùng chung. Nên rà soát và chỉnh sửa để các mệnh đề bám sát cùng một ngữ cảnh trước khi lưu.
                            </p>
                          )}
                        </div>

                        <div className="space-y-4">
                          {groupItems.map(({ item, index }) => (
                            <div key={item.id || index} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-3">
                              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                                Mệnh đề {item.statementOrder ?? index + 1}
                              </p>
                              <textarea
                                value={item.content}
                                onChange={(e) => updateQuestionContent(index, e.target.value)}
                                rows={2}
                                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none"
                              />
                              <div className="space-y-2">
                                {item.choices.slice(0, 2).map((choice, choiceIndex) => (
                                  <div key={choice.id || `${item.id}-${choiceIndex}`} className="flex items-center gap-3">
                                    <input
                                      type="radio"
                                      name={`ai-correct-${item.id}`}
                                      checked={!!choice.isCorrect}
                                      onChange={() => setCorrectChoice(index, choiceIndex)}
                                      className="h-4 w-4 text-green-600"
                                    />
                                    <span className="w-8 text-sm font-semibold text-violet-700 dark:text-violet-300">
                                      {choice.optionLabel || OPTION_LABELS[choiceIndex]}
                                    </span>
                                    <input
                                      type="text"
                                      value={choice.content}
                                      onChange={(e) => updateChoiceContent(index, choiceIndex, e.target.value)}
                                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={question.id} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-violet-600 dark:text-violet-400">Câu hỏi {originalIndex + 1}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <span className="inline-flex items-center rounded-full bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1 text-xs font-medium text-indigo-700 dark:text-indigo-300">
                              {competencyOptions.find((option) => option.value === question.competencyType)?.label || question.competencyType || 'Chưa chọn năng lực'}
                            </span>
                            <span className="inline-flex items-center rounded-full bg-violet-50 dark:bg-violet-900/20 px-3 py-1 text-xs font-medium text-violet-700 dark:text-violet-300">
                              {FORMAT_LABELS[question.questionFormat || 'SingleChoice'] || question.questionFormat}
                            </span>
                            <span className="inline-flex items-center rounded-full bg-amber-50 dark:bg-amber-900/20 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                              {DIFFICULTY_LABELS[question.difficultyLevel || 'Medium'] || question.difficultyLevel}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeGeneratedQuestion(originalIndex)}
                          className="text-sm font-medium text-red-600 hover:text-red-700"
                        >
                          Bỏ câu này
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <select
                          value={question.competencyType || ''}
                          onChange={(e) => updateQuestionCompetency(originalIndex, e.target.value)}
                          className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white"
                        >
                          <option value="">Chọn năng lực</option>
                          {competencyOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>

                        <select
                          value={question.difficultyLevel || 'Medium'}
                          onChange={(e) => updateQuestionDifficulty(originalIndex, e.target.value)}
                          className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white"
                        >
                          <option value="Easy">Dễ</option>
                          <option value="Medium">Trung bình</option>
                          <option value="Hard">Khó</option>
                        </select>
                      </div>

                      <textarea
                        value={question.content}
                        onChange={(e) => updateQuestionContent(originalIndex, e.target.value)}
                        rows={3}
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none"
                      />

                      {question.sourceEvidence && (
                        <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-300">
                          Gợi ý ngữ cảnh: {question.sourceEvidence}
                        </div>
                      )}

                      <div className="space-y-2">
                        {question.choices.slice(0, question.questionFormat === 'TrueFalse' ? 2 : question.choices.length).map((choice, choiceIndex) => (
                          <div key={choice.id || `${question.id}-${choiceIndex}`} className="flex items-center gap-3">
                            <input
                              type="radio"
                              name={`ai-correct-${question.id}`}
                              checked={!!choice.isCorrect}
                              onChange={() => setCorrectChoice(originalIndex, choiceIndex)}
                              className="h-4 w-4 text-green-600"
                            />
                            <span className="w-8 text-sm font-semibold text-violet-700 dark:text-violet-300">
                              {choice.optionLabel || OPTION_LABELS[choiceIndex] || `${choiceIndex + 1}`}
                            </span>
                            <input
                              type="text"
                              value={choice.content}
                              onChange={(e) => updateChoiceContent(originalIndex, choiceIndex, e.target.value)}
                              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIQuestionGeneratorModal;
