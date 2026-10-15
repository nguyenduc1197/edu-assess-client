import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, FileText, Loader2, Plus, Trash2, UploadCloud, X } from 'lucide-react';
import { Class, CompetencyOption, DifficultyLevel, ExamScanResult, SubjectLabel } from '../../../types';
import { fetchClient } from '../../../api/fetchClient';
import {
  buildCreateFromScanPayload,
  collectScanReviewErrors,
  ReviewQuestion,
  SCAN_ACCEPT,
  ScanExamFields,
  setCorrectChoice,
  toReviewQuestions,
  validateScanFiles,
} from '../../../utils/scanExam';
import { validateRubric } from '../../../utils/essay';
import { isStructuredFormat, validateStructuredQuestion } from '../../../utils/structuredQuestion';
import RubricEditor from '../Question/RubricEditor';
import StructuredChoicesEditor from '../Question/StructuredChoicesEditor';
import TrueFalseScoringModePicker from './TrueFalseScoringModePicker';

/** Exam fields the teacher already entered elsewhere (e.g. in "Tạo bài kiểm tra"); non-empty values win over file suggestions. */
export type ScanExamInitialFields = Partial<ScanExamFields>;

interface ScanExamFlowProps {
  /** Cancel / close (shows the "Hủy" button). Also called after the exam was created. */
  onClose?: () => void;
  /** Called with the new exam id after the exam was created. */
  onCreated?: (examId: string) => void;
  initialExamFields?: ScanExamInitialFields | null;
}

const hasValue = (value: unknown) =>
  value !== undefined && value !== null && (typeof value !== 'string' || value.trim() !== '');

const DEFAULT_DURATION_MINUTES = 45;
const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

const FORMAT_BADGES: Record<string, { label: string; className: string }> = {
  SingleChoice: { label: 'Trắc nghiệm', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  TrueFalse: { label: 'Đúng / Sai', className: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300' },
  Essay: { label: 'Tự luận', className: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' },
  FillInBlank: { label: 'Điền khuyết', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
  Matching: { label: 'Ghép đôi', className: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300' },
};

const flagClass = 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold';

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white';

const readApiMessage = async (response: Response, fallback: string) => {
  const data = await response.json().catch(() => null);
  return data && typeof data.message === 'string' && data.message.trim() ? (data.message as string) : fallback;
};

/**
 * "Tạo đề giống file gốc": upload an exam file -> AI extraction -> review / edit -> exam fields -> create.
 * Reusable flow (rendered inside the "Tạo bài thi bằng AI" window); logic lives in utils/scanExam.ts.
 */
const ScanExamFlow: React.FC<ScanExamFlowProps> = ({ onClose, onCreated, initialExamFields }) => {
  const [step, setStep] = useState<'upload' | 'review'>('upload');
  const [files, setFiles] = useState<File[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExamScanResult | null>(null);
  const [questions, setQuestions] = useState<ReviewQuestion[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [competencyOptions, setCompetencyOptions] = useState<CompetencyOption[]>([]);
  const [fields, setFields] = useState<ScanExamFields>(() => ({
    name: initialExamFields?.name ?? '',
    schoolClassId: initialExamFields?.schoolClassId ?? '',
    start: initialExamFields?.start ?? '',
    end: initialExamFields?.end ?? '',
    durationMinutes: hasValue(initialExamFields?.durationMinutes)
      ? String(initialExamFields!.durationMinutes)
      : String(DEFAULT_DURATION_MINUTES),
    antiCheatEnabled: initialExamFields?.antiCheatEnabled ?? false,
    trueFalseScoringMode: initialExamFields?.trueFalseScoringMode ?? 'Tiered',
  }));

  useEffect(() => {
    const load = async () => {
      try {
        const [classResponse, competencyResponse] = await Promise.all([
          fetchClient('/classes?pageNumber=1&pageSize=100'),
          fetchClient('/questions/competency-types'),
        ]);
        if (classResponse?.ok) {
          const data = await classResponse.json();
          setClasses(Array.isArray(data) ? data : data.items || data.data || []);
        }
        if (competencyResponse?.ok) {
          const data = await competencyResponse.json();
          setCompetencyOptions(Array.isArray(data) ? data : []);
        }
      } catch {
        // dropdowns stay empty; validation will ask the teacher to choose
      }
    };
    load();
  }, []);

  const fileError = files.length > 0 ? validateScanFiles(files) : null;
  const reviewErrors = useMemo(() => collectScanReviewErrors(questions, fields), [questions, fields]);

  // ---- Upload step ---------------------------------------------------------------------------
  const handleFilesChosen = (list: FileList | null) => {
    setError(null);
    setFiles(list ? Array.from(list) : []);
  };

  const moveFile = (index: number, delta: number) => {
    setFiles((current) => {
      const next = [...current];
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const handleScan = async () => {
    const validation = validateScanFiles(files);
    if (validation) {
      setError(validation);
      return;
    }

    setIsScanning(true);
    setError(null);
    try {
      const formData = new FormData();
      files.forEach((file) => formData.append('files', file));
      const response = await fetchClient('/exams/scan-file', { method: 'POST', body: formData });
      if (!response.ok) {
        setError(await readApiMessage(response, 'Không thể đọc đề thi. Vui lòng thử lại.'));
        return;
      }

      const data: ExamScanResult = await response.json();
      setResult(data);
      setQuestions(toReviewQuestions(data));
      // File suggestions only fill fields the teacher has not entered.
      setFields((current) => ({
        ...current,
        name: current.name.trim() ? current.name : data.suggestedTitle?.trim() || current.name,
        durationMinutes:
          !hasValue(initialExamFields?.durationMinutes) && data.suggestedDurationMinutes
            ? String(data.suggestedDurationMinutes)
            : current.durationMinutes,
      }));
      setStep('review');
    } catch {
      setError('Không thể đọc đề thi. Vui lòng kiểm tra kết nối rồi thử lại.');
    } finally {
      setIsScanning(false);
    }
  };

  // ---- Review step ---------------------------------------------------------------------------
  const updateQuestion = (key: string, change: (question: ReviewQuestion) => ReviewQuestion) =>
    setQuestions((current) => current.map((question) => (question.key === key ? change(question) : question)));

  const updatePassage = (groupKey: string, passageText: string) =>
    setQuestions((current) => current.map((question) => (question.passageGroupKey === groupKey ? { ...question, passageText } : question)));

  const deleteQuestion = (key: string) => setQuestions((current) => current.filter((question) => question.key !== key));

  const handleCreate = async () => {
    if (reviewErrors.length > 0) return;
    setIsCreating(true);
    setError(null);
    try {
      const response = await fetchClient('/exams/from-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildCreateFromScanPayload(questions, fields)),
      });
      if (!response.ok) {
        setError(await readApiMessage(response, 'Tạo đề thi thất bại. Vui lòng thử lại.'));
        return;
      }
      const data = await response.json().catch(() => null);
      onCreated?.(data?.examId);
      onClose?.();
    } catch {
      setError('Tạo đề thi thất bại. Vui lòng kiểm tra kết nối rồi thử lại.');
    } finally {
      setIsCreating(false);
    }
  };

  const renderQuestion = (question: ReviewQuestion, index: number) => {
    const badge = FORMAT_BADGES[question.questionFormat] || FORMAT_BADGES.SingleChoice;
    const correctCount = question.choices.filter((choice) => choice.isCorrect).length;
    const isEssay = question.questionFormat === 'Essay';
    const isTrueFalse = question.questionFormat === 'TrueFalse';
    const isStructured = isStructuredFormat(question.questionFormat);
    const rubricIncomplete = isEssay && !!validateRubric(question.rubricInputs);
    const answerMissing = isStructured ? !!validateStructuredQuestion(question) : !isEssay && correctCount !== 1;

    return (
      <div key={question.key} data-testid="scan-question" className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-gray-900 dark:text-white">
              Câu {index + 1}
              {question.sourceNumber && <span className="ml-1 font-normal text-gray-500">({question.sourceNumber} trong đề gốc{isTrueFalse && question.statementOrder ? `, mệnh đề ${question.statementOrder}` : ''})</span>}
            </span>
            <span className={`${flagClass} ${badge.className}`}>{badge.label}</span>
            {question.isAnswerAiGuessed && (
              <span className={`${flagClass} bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300`}>AI đoán – cần kiểm tra</span>
            )}
            {question.hasFigure && (
              <span className={`${flagClass} bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300`}>Có hình – đã mô tả bằng chữ</span>
            )}
            {answerMissing && (
              <span className={`${flagClass} bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300`}>
                {isStructured ? 'Đáp án chưa đầy đủ' : 'Chưa có đáp án đúng'}
              </span>
            )}
            {rubricIncomplete && (
              <span className={`${flagClass} bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300`}>Danh sách ý / điểm chưa đầy đủ</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => deleteQuestion(question.key)}
            className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
            title={`Xóa câu ${index + 1}`}
            aria-label={`Xóa câu ${index + 1}`}
          >
            <Trash2 size={16} />
          </button>
        </div>

        {question.hasFigure && question.figureDescription && (
          <p className="text-xs text-sky-700 dark:text-sky-300">Mô tả hình: {question.figureDescription}</p>
        )}

        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300">
          {isTrueFalse ? 'Nội dung mệnh đề' : question.questionFormat === 'FillInBlank' ? 'Đoạn văn (chỗ trống là [[1]], [[2]], ...)' : 'Nội dung câu hỏi'}
          <textarea
            aria-label={`Nội dung câu ${index + 1}`}
            value={question.content}
            onChange={(e) => updateQuestion(question.key, (q) => ({ ...q, content: e.target.value }))}
            rows={isEssay || question.questionFormat === 'FillInBlank' ? 3 : 2}
            className={`mt-1 ${inputClass}`}
          />
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300">
            Năng lực
            <select
              aria-label={`Năng lực câu ${index + 1}`}
              value={question.competencyType}
              onChange={(e) => updateQuestion(question.key, (q) => ({ ...q, competencyType: e.target.value }))}
              className={`mt-1 ${inputClass}`}
            >
              {competencyOptions.length === 0 && <option value={question.competencyType}>{question.competencyType}</option>}
              {competencyOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300">
            Độ khó
            <select
              aria-label={`Độ khó câu ${index + 1}`}
              value={question.difficultyLevel}
              onChange={(e) => updateQuestion(question.key, (q) => ({ ...q, difficultyLevel: e.target.value as DifficultyLevel }))}
              className={`mt-1 ${inputClass}`}
            >
              <option value="Easy">Dễ</option>
              <option value="Medium">Trung bình</option>
              <option value="Hard">Khó</option>
            </select>
          </label>
        </div>

        {isEssay ? (
          <div className="space-y-2">
            <RubricEditor
              items={question.rubricInputs}
              onChange={(items) => updateQuestion(question.key, (q) => ({ ...q, rubricInputs: items }))}
              labelPrefix={`Câu ${index + 1}`}
              inputClassName={inputClass}
            />
            {question.statedPoints !== null && question.statedPoints !== undefined && (
              <p className="text-xs text-gray-500 dark:text-gray-400">Đề gốc ghi: {question.statedPoints} điểm.</p>
            )}
          </div>
        ) : isStructured ? (
          <StructuredChoicesEditor
            format={question.questionFormat as 'FillInBlank' | 'Matching'}
            content={question.content}
            matchingPrompts={question.matchingPrompts || []}
            choices={question.choices}
            onChange={(patch) =>
              updateQuestion(question.key, (q) => ({
                ...q,
                ...(patch.matchingPrompts ? { matchingPrompts: patch.matchingPrompts } : {}),
                ...(patch.choices ? { choices: patch.choices.map((c) => ({ ...c, isCorrect: c.correctSlot != null })) } : {}),
                // Only changing an answer key confirms an AI-guessed answer; editing text does not.
                answerConfirmed:
                  q.answerConfirmed ||
                  (!!patch.choices &&
                    patch.choices.length === q.choices.length &&
                    patch.choices.some((c, i) => (c.correctSlot ?? null) !== (q.choices[i]?.correctSlot ?? null))),
              }))
            }
            labelPrefix={`Câu ${index + 1}`}
            inputClassName={inputClass}
          />
        ) : isTrueFalse ? (
          <div className="flex flex-wrap gap-4 text-sm" role="radiogroup" aria-label={`Đáp án câu ${index + 1}`}>
            {question.choices.map((choice, choiceIndex) => (
              <label key={choiceIndex} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`correct-${question.key}`}
                  checked={choice.isCorrect}
                  onChange={() => updateQuestion(question.key, (q) => setCorrectChoice(q, choiceIndex))}
                />
                {choice.content}
              </label>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {question.choices.map((choice, choiceIndex) => (
              <div key={choiceIndex} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`correct-${question.key}`}
                  checked={choice.isCorrect}
                  onChange={() => updateQuestion(question.key, (q) => setCorrectChoice(q, choiceIndex))}
                  aria-label={`Câu ${index + 1}: đáp án đúng là ${choice.optionLabel}`}
                />
                <span className="w-6 text-sm font-bold text-primary">{choice.optionLabel}.</span>
                <input
                  aria-label={`Câu ${index + 1} phương án ${choice.optionLabel}`}
                  value={choice.content}
                  onChange={(e) =>
                    updateQuestion(question.key, (q) => ({
                      ...q,
                      choices: q.choices.map((c, i) => (i === choiceIndex ? { ...c, content: e.target.value } : c)),
                    }))
                  }
                  className={inputClass}
                />
                {question.choices.length > 2 && (
                  <button
                    type="button"
                    onClick={() =>
                      updateQuestion(question.key, (q) => ({
                        ...q,
                        choices: q.choices
                          .filter((_, i) => i !== choiceIndex)
                          .map((c, i) => ({ ...c, optionLabel: OPTION_LABELS[i] || c.optionLabel })),
                      }))
                    }
                    className="rounded p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                    aria-label={`Xóa phương án ${choice.optionLabel} câu ${index + 1}`}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
            {question.choices.length < OPTION_LABELS.length && (
              <button
                type="button"
                onClick={() =>
                  updateQuestion(question.key, (q) => ({
                    ...q,
                    choices: [...q.choices, { optionLabel: OPTION_LABELS[q.choices.length], content: '', isCorrect: false }],
                  }))
                }
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                <Plus size={14} /> Thêm phương án
              </button>
            )}
          </div>
        )}

        {!isEssay && question.isAnswerAiGuessed && (
          <label className="flex items-center gap-2 text-xs font-medium text-amber-800 dark:text-amber-300">
            <input
              type="checkbox"
              checked={question.answerConfirmed}
              onChange={(e) => updateQuestion(question.key, (q) => ({ ...q, answerConfirmed: e.target.checked }))}
              aria-label={`Đã kiểm tra đáp án câu ${index + 1}`}
            />
            Tôi đã kiểm tra đáp án do AI đề xuất
          </label>
        )}
      </div>
    );
  };

  const renderQuestions = () => {
    const nodes: React.ReactNode[] = [];
    let index = 0;
    while (index < questions.length) {
      const question = questions[index];
      const isGroupFormat = question.questionFormat === 'TrueFalse' || question.questionFormat === 'Essay';
      const groupKey = isGroupFormat ? question.passageGroupKey : null;
      if (groupKey) {
        const start = index;
        const groupFormat = question.questionFormat;
        const isEssayGroup = groupFormat === 'Essay';
        while (index < questions.length && questions[index].passageGroupKey === groupKey && questions[index].questionFormat === groupFormat) {
          index += 1;
        }
        const members = questions.slice(start, index);
        nodes.push(
          <div key={`group-${groupKey}-${start}`} className="space-y-3 rounded-2xl border border-teal-200 bg-teal-50/40 p-3 dark:border-teal-900/40 dark:bg-teal-950/10">
            <label className="block text-xs font-semibold text-teal-800 dark:text-teal-300">
              {isEssayGroup ? 'Tình huống chung của nhóm câu tự luận' : 'Đoạn tư liệu chung của nhóm Đúng/Sai'}
              <textarea
                aria-label={`Đoạn tư liệu nhóm câu ${start + 1}`}
                value={members[0].passageText || ''}
                onChange={(e) => updatePassage(groupKey, e.target.value)}
                rows={3}
                className={`mt-1 ${inputClass}`}
              />
            </label>
            {members.map((member, offset) => renderQuestion(member, start + offset))}
          </div>
        );
        continue;
      }
      nodes.push(renderQuestion(question, index));
      index += 1;
    }
    return nodes;
  };

  return (
    <div data-testid="scan-exam-flow" className="flex flex-col rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-background-dark">
        <div className="space-y-5 p-4 sm:p-6">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            AI đọc toàn bộ câu hỏi trong đề (giữ nguyên nội dung và thứ tự). Thầy/cô kiểm tra lại trước khi tạo bài thi.
          </p>
          {error && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </div>
          )}

          {step === 'upload' ? (
            <div className="space-y-4">
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 p-8 text-center hover:border-primary dark:border-gray-600">
                <UploadCloud size={32} className="text-primary" />
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">Chọn file đề thi</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  1 file PDF, hoặc nhiều ảnh (mỗi ảnh là một trang, theo thứ tự), hoặc 1 file Word (.docx). Tối đa 20MB.
                </span>
                <input
                  type="file"
                  multiple
                  accept={SCAN_ACCEPT}
                  className="sr-only"
                  aria-label="Chọn file đề thi"
                  onChange={(e) => handleFilesChosen(e.target.files)}
                />
              </label>

              {files.length > 0 && (
                <ol className="space-y-2">
                  {files.map((file, index) => (
                    <li key={`${file.name}-${index}`} className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700">
                      <span className="flex items-center gap-2 text-gray-800 dark:text-gray-200">
                        <FileText size={16} />
                        {files.length > 1 ? `Trang ${index + 1}: ` : ''}{file.name}
                      </span>
                      {files.length > 1 && (
                        <span className="flex gap-1">
                          <button type="button" onClick={() => moveFile(index, -1)} disabled={index === 0} aria-label={`Đưa ${file.name} lên`} className="rounded p-1 disabled:opacity-40"><ArrowUp size={14} /></button>
                          <button type="button" onClick={() => moveFile(index, 1)} disabled={index === files.length - 1} aria-label={`Đưa ${file.name} xuống`} className="rounded p-1 disabled:opacity-40"><ArrowDown size={14} /></button>
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              )}

              {fileError && <p className="text-sm text-red-600 dark:text-red-300">{fileError}</p>}
            </div>
          ) : (
            <div className="space-y-5">
              <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-sm text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-100">
                Đã đọc {questions.length} câu hỏi từ {result?.sourceFileNames?.join(', ')}.
                {result && result.skippedQuestions.length > 0 && ` Bỏ qua ${result.skippedQuestions.length} câu chưa hỗ trợ.`}
              </div>

              {result && result.warnings.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                  <p className="mb-1 flex items-center gap-2 font-semibold"><AlertTriangle size={16} /> Lưu ý</p>
                  <ul className="list-disc space-y-1 pl-5">
                    {result.warnings.map((warning, index) => <li key={index}>{warning}</li>)}
                  </ul>
                </div>
              )}

              {result && result.skippedQuestions.length > 0 && (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm dark:border-gray-700 dark:bg-gray-800/40">
                  <p className="mb-2 font-semibold text-gray-800 dark:text-gray-200">Câu hỏi bị bỏ qua (dạng chưa hỗ trợ)</p>
                  <ul className="space-y-1 text-gray-700 dark:text-gray-300">
                    {result.skippedQuestions.map((item, index) => (
                      <li key={index}>
                        <span className="font-medium">{item.number || `Mục ${index + 1}`}</span> — {item.reason}
                        {item.excerpt && <span className="text-gray-500 dark:text-gray-400">: “{item.excerpt}”</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="space-y-3">{renderQuestions()}</div>

              <div className="space-y-4 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Thông tin bài thi</h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Tên bài thi
                    <input aria-label="Tên bài thi" value={fields.name} onChange={(e) => setFields({ ...fields, name: e.target.value })} className={`mt-1 ${inputClass}`} />
                  </label>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Môn học
                    <input value={SubjectLabel.GD_KTPL} disabled className={`mt-1 ${inputClass} cursor-not-allowed opacity-70`} />
                    {result?.suggestedSubject && <span className="mt-1 block text-xs text-gray-500">Môn ghi trong đề: {result.suggestedSubject}</span>}
                  </label>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Lớp
                    <select aria-label="Lớp" value={fields.schoolClassId} onChange={(e) => setFields({ ...fields, schoolClassId: e.target.value })} className={`mt-1 ${inputClass}`}>
                      <option value="">Chọn lớp học</option>
                      {classes.map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>)}
                    </select>
                  </label>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Thời lượng làm bài (phút)
                    <input aria-label="Thời lượng làm bài (phút)" type="number" min={1} step={1} value={fields.durationMinutes} onChange={(e) => setFields({ ...fields, durationMinutes: e.target.value })} className={`mt-1 ${inputClass}`} />
                  </label>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Thời gian bắt đầu cho phép vào làm
                    <input aria-label="Thời gian bắt đầu" type="datetime-local" value={fields.start} onChange={(e) => setFields({ ...fields, start: e.target.value })} className={`mt-1 ${inputClass}`} />
                  </label>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Thời gian kết thúc cho phép vào làm
                    <input aria-label="Thời gian kết thúc" type="datetime-local" value={fields.end} onChange={(e) => setFields({ ...fields, end: e.target.value })} className={`mt-1 ${inputClass}`} />
                  </label>
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input type="checkbox" checked={fields.antiCheatEnabled} onChange={(e) => setFields({ ...fields, antiCheatEnabled: e.target.checked })} />
                  Bật giám sát vi phạm
                </label>
              </div>
              <TrueFalseScoringModePicker value={fields.trueFalseScoringMode} onChange={(mode) => setFields({ ...fields, trueFalseScoringMode: mode })} />

              {reviewErrors.length > 0 && (
                <div data-testid="scan-review-errors" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                  <p className="mb-1 font-semibold">Cần hoàn thiện trước khi tạo bài thi ({reviewErrors.length}):</p>
                  <ul className="list-disc space-y-1 pl-5">
                    {reviewErrors.slice(0, 12).map((message, index) => <li key={index}>{message}</li>)}
                    {reviewErrors.length > 12 && <li>… và {reviewErrors.length - 12} mục khác.</li>}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 rounded-b-xl border-t border-gray-100 bg-gray-50/50 px-6 py-4 dark:border-gray-700 dark:bg-gray-800/50">
          {step === 'review' && (
            <button type="button" onClick={() => setStep('upload')} className="mr-auto text-sm text-gray-600 hover:underline dark:text-gray-300">
              Chọn file khác
            </button>
          )}
          {onClose && (
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700">
              Hủy
            </button>
          )}
          {step === 'upload' ? (
            <button
              type="button"
              onClick={handleScan}
              disabled={isScanning || files.length === 0 || !!fileError}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isScanning && <Loader2 size={16} className="animate-spin" />}
              {isScanning ? 'AI đang đọc đề...' : 'Đọc đề bằng AI'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCreate}
              disabled={isCreating || reviewErrors.length > 0}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isCreating && <Loader2 size={16} className="animate-spin" />}
              {isCreating ? 'Đang tạo...' : 'Tạo bài thi'}
            </button>
          )}
        </div>
    </div>
  );
};

export default ScanExamFlow;
