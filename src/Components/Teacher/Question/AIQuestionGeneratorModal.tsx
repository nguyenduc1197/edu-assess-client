import React, { useState } from 'react';
import { Bot, Loader2, Save, UploadCloud, X } from 'lucide-react';
import { Choice, CompetencyOption, Question } from '../../../types';
import { fetchClient } from '../../../api/fetchClient';

type SourceMode = 'text' | 'pdf' | 'url' | 'youtube';

type GeneratedQuestion = Question & {
  sourceEvidence?: string;
  choices: Choice[];
};

interface GenerateResponse {
  sourceType?: string;
  sourceTitle?: string;
  sourcePreview?: string;
  extractedCharacterCount?: number;
  requestedCompetencies?: string[];
  questions?: GeneratedQuestion[];
  savedQuestionIds?: string[];
}

interface AIQuestionGeneratorModalProps {
  competencyOptions: CompetencyOption[];
  onClose: () => void;
  onSaved?: (message: string) => void;
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

const AIQuestionGeneratorModal: React.FC<AIQuestionGeneratorModalProps> = ({
  competencyOptions,
  onClose,
  onSaved,
}) => {
  const [sourceMode, setSourceMode] = useState<SourceMode>('text');
  const [sourceText, setSourceText] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [selectedCompetencies, setSelectedCompetencies] = useState<string[]>([]);
  const [questionCount, setQuestionCount] = useState(5);
  const [saveToQuestionBank, setSaveToQuestionBank] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingDrafts, setIsSavingDrafts] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[]>([]);
  const [responseMeta, setResponseMeta] = useState<GenerateResponse | null>(null);

  const toggleCompetency = (value: string) => {
    setSelectedCompetencies((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
  };

  const validateSource = () => {
    if (selectedCompetencies.length === 0) {
      return 'Vui lòng chọn ít nhất một năng lực cần đánh giá.';
    }

    if (questionCount < 1 || questionCount > 20) {
      return 'Số lượng câu hỏi phải nằm trong khoảng từ 1 đến 20.';
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

  const normalizeQuestions = (items: GeneratedQuestion[] = []) => {
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

      const formData = new FormData();

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

      const data: GenerateResponse = await response.json();
      const normalizedQuestions = normalizeQuestions(data.questions || []);

      setResponseMeta(data);
      setGeneratedQuestions(normalizedQuestions);

      if (saveToQuestionBank) {
        const savedCount = data.savedQuestionIds?.length ?? normalizedQuestions.length;
        const message = `Đã tạo và lưu ${savedCount} câu hỏi vào ngân hàng câu hỏi.`;
        setSuccessMessage(message);
        onSaved?.(message);
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

  const removeGeneratedQuestion = (questionIndex: number) => {
    setGeneratedQuestions((prev) => prev.filter((_, index) => index !== questionIndex));
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

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message || body?.title || 'Lưu bản nháp AI thất bại.');
      }

      const message = `Đã lưu ${generatedQuestions.length} câu hỏi AI vào ngân hàng câu hỏi.`;
      setSuccessMessage(message);
      onSaved?.(message);
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
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Tạo câu hỏi bằng AI</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Hỗ trợ từ văn bản, PDF, liên kết web hoặc YouTube</p>
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

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nguồn nội dung
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    { value: 'text', label: 'Văn bản' },
                    { value: 'pdf', label: 'PDF' },
                    { value: 'url', label: 'Web URL' },
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

              {sourceMode === 'text' && (
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

              {(sourceMode === 'url' || sourceMode === 'youtube') && (
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

              {sourceMode === 'pdf' && (
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Số lượng câu hỏi
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
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

              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Đang tạo câu hỏi...
                  </>
                ) : (
                  <>
                    <Bot size={16} />
                    Tạo câu hỏi bằng AI
                  </>
                )}
              </button>
            </div>
          </div>

          {responseMeta && (
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

          {generatedQuestions.length > 0 && (
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

              {generatedQuestions.map((question, questionIndex) => (
                <div key={question.id} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-violet-600 dark:text-violet-400">Câu hỏi {questionIndex + 1}</p>
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
                      onClick={() => removeGeneratedQuestion(questionIndex)}
                      className="text-sm font-medium text-red-600 hover:text-red-700"
                    >
                      Bỏ câu này
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <select
                      value={question.competencyType || ''}
                      onChange={(e) => updateQuestionCompetency(questionIndex, e.target.value)}
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
                      onChange={(e) => updateQuestionDifficulty(questionIndex, e.target.value)}
                      className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white"
                    >
                      <option value="Easy">Dễ</option>
                      <option value="Medium">Trung bình</option>
                      <option value="Hard">Khó</option>
                    </select>
                  </div>

                  <textarea
                    value={question.content}
                    onChange={(e) => updateQuestionContent(questionIndex, e.target.value)}
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
                          onChange={() => setCorrectChoice(questionIndex, choiceIndex)}
                          className="h-4 w-4 text-green-600"
                        />
                        <span className="w-8 text-sm font-semibold text-violet-700 dark:text-violet-300">
                          {choice.optionLabel || OPTION_LABELS[choiceIndex] || `${choiceIndex + 1}`}
                        </span>
                        <input
                          type="text"
                          value={choice.content}
                          onChange={(e) => updateChoiceContent(questionIndex, choiceIndex, e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIQuestionGeneratorModal;
