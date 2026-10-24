import React, { useEffect, useRef, useState } from 'react';
import { AssessmentResult, EssayAnswerReview, EssayGradeResult } from '../../../types';
import { fetchClient } from '../../../api/fetchClient';
import {
  ESSAY_FEEDBACK_MAX_LENGTH,
  formatEssayScore,
  formatPoints,
  getEssayGradingStatusLabel,
  parseEssayNumber,
  validateEssayScore,
} from '../../../utils/essay';

interface EssayAnswerListProps {
  items: EssayAnswerReview[];
  /** 'student' = read-only; 'teacher' = shows sample answer, override form and AI re-grade. */
  mode: 'student' | 'teacher';
  studentExamId?: string;
  onGraded?: (result: EssayGradeResult) => void;
}

const statusBadgeClass = (status: string) => {
  switch (status) {
    case 'Pending':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
    case 'AwaitingTeacher':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
    case 'TeacherGraded':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
    case 'NoAnswer':
      return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300';
    default:
      return 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300';
  }
};

/** "Chấm lại bằng AI" is asynchronous: poll the assessment while the answer is Pending. */
export const ESSAY_REGRADE_POLL_INTERVAL_MS = 4000;
export const ESSAY_REGRADE_POLL_MAX_MS = 120000;

const REGRADE_DONE_MESSAGE = 'AI đã chấm lại câu tự luận.';
const REGRADE_FAILED_MESSAGE = 'AI vẫn chưa chấm được câu này. Thầy/cô có thể chấm thủ công.';
const REGRADE_TIMEOUT_MESSAGE = 'AI vẫn đang chấm câu này. Vui lòng tải lại trang sau ít phút.';

/** Builds the same shape as the grade endpoints from a fresh assessment result. */
export const toEssayGradeResult = (assessment: AssessmentResult, answer: EssayAnswerReview): EssayGradeResult => ({
  studentExamId: assessment.studentExamId,
  answer,
  score: assessment.score,
  behaviorAdjustmentScore: assessment.behaviorAdjustmentScore,
  selfDevelopmentScore: assessment.selfDevelopmentScore,
  economicSocialParticipationScore: assessment.economicSocialParticipationScore,
  pendingEssayCount: assessment.pendingEssayCount ?? 0,
  awaitingTeacherEssayCount: assessment.awaitingTeacherEssayCount ?? 0,
});

const REGRADE_TEACHER_MESSAGE = 'Câu này đã được giáo viên chấm điểm.';

/** Message matching the final grading status after an AI re-grade request. */
export const regradeOutcomeMessage = (status: string) => {
  switch (status) {
    case 'AwaitingTeacher':
      return REGRADE_FAILED_MESSAGE;
    case 'TeacherGraded':
      return REGRADE_TEACHER_MESSAGE;
    case 'AiGraded':
      return REGRADE_DONE_MESSAGE;
    default:
      return getEssayGradingStatusLabel(status) || REGRADE_DONE_MESSAGE;
  }
};

const readApiMessage = async (response: Response, fallback: string) => {
  const data = await response.json().catch(() => null);
  if (data && typeof data.message === 'string' && data.message.trim()) return data.message as string;
  return fallback;
};

const EssayAnswerCard: React.FC<{
  item: EssayAnswerReview;
  index: number;
  mode: 'student' | 'teacher';
  studentExamId?: string;
  onGraded?: (result: EssayGradeResult) => void;
}> = ({ item, index, mode, studentExamId, onGraded }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [scoreInput, setScoreInput] = useState(item.score !== null && item.score !== undefined ? String(item.score) : '');
  const [feedbackInput, setFeedbackInput] = useState(item.gradingFeedback || '');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRegrading, setIsRegrading] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollTimerRef.current = null;
    setIsPolling(false);
  };

  useEffect(() => () => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
  }, []);

  const startPolling = (examId: string) => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    const startedAt = Date.now();
    setIsPolling(true);

    pollTimerRef.current = setInterval(async () => {
      if (Date.now() - startedAt >= ESSAY_REGRADE_POLL_MAX_MS) {
        stopPolling();
        setMessage(REGRADE_TIMEOUT_MESSAGE);
        return;
      }

      try {
        const response = await fetchClient(`/student-exams/${encodeURIComponent(examId)}/assessment`);
        if (!response.ok) return;
        const assessment: AssessmentResult = await response.json();
        const fresh = (assessment.essayAnswers || []).find((x) => x.answerId === item.answerId);
        if (!fresh || fresh.gradingStatus === 'Pending') return;

        stopPolling();
        setMessage(regradeOutcomeMessage(fresh.gradingStatus));
        onGraded?.(toEssayGradeResult(assessment, fresh));
      } catch {
        // transient error: keep polling until the cap
      }
    }, ESSAY_REGRADE_POLL_INTERVAL_MS);
  };

  const statusLabel = item.gradingStatusLabel || getEssayGradingStatusLabel(item.gradingStatus);
  const isPending = item.gradingStatus === 'Pending';
  const isAwaitingTeacher = item.gradingStatus === 'AwaitingTeacher';

  const openEditor = () => {
    setScoreInput(item.score !== null && item.score !== undefined ? String(item.score) : '');
    setFeedbackInput(item.gradingFeedback || '');
    setError(null);
    setMessage(null);
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!studentExamId) return;
    const validation = validateEssayScore(scoreInput, item.maxPoints);
    if (validation) {
      setError(validation);
      return;
    }
    if (feedbackInput.trim().length > ESSAY_FEEDBACK_MAX_LENGTH) {
      setError('Nhận xét không được vượt quá 2000 ký tự.');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const response = await fetchClient(
        `/student-exams/${encodeURIComponent(studentExamId)}/essay-answers/${encodeURIComponent(item.answerId)}/grade`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ score: parseEssayNumber(scoreInput), feedback: feedbackInput.trim() || null }),
        }
      );
      if (!response.ok) {
        setError(await readApiMessage(response, 'Không thể lưu điểm. Vui lòng thử lại.'));
        return;
      }
      const result: EssayGradeResult = await response.json();
      // A manual grade ends any AI re-grade polling (the teacher grade is final and never overwritten).
      stopPolling();
      setIsEditing(false);
      setMessage('Đã lưu điểm và cập nhật lại tổng điểm bài làm.');
      onGraded?.(result);
    } catch {
      setError('Không thể lưu điểm. Vui lòng kiểm tra kết nối rồi thử lại.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAiRegrade = async () => {
    if (!studentExamId) return;
    setIsRegrading(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetchClient(
        `/student-exams/${encodeURIComponent(studentExamId)}/essay-answers/${encodeURIComponent(item.answerId)}/ai-regrade`,
        { method: 'POST' }
      );
      if (!response.ok) {
        setError(await readApiMessage(response, 'Không thể chấm lại bằng AI. Vui lòng thử lại.'));
        return;
      }
      const result: EssayGradeResult = await response.json();
      onGraded?.(result);

      if (result.answer.gradingStatus === 'Pending') {
        // 202: grading runs in the background -> show "Đang chấm" and poll for the outcome.
        setMessage('AI đang chấm lại câu này...');
        startPolling(studentExamId);
      } else {
        setMessage(regradeOutcomeMessage(result.answer.gradingStatus));
      }
    } catch {
      setError('Không thể chấm lại bằng AI. Vui lòng kiểm tra kết nối rồi thử lại.');
    } finally {
      setIsRegrading(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 p-3 space-y-3 dark:border-gray-700 sm:rounded-lg sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-semibold text-gray-900 dark:text-white whitespace-pre-line">
          <span className="text-xs font-bold text-violet-600 dark:text-violet-400">Câu tự luận {index + 1}:</span>{' '}
          {item.questionContent}
        </p>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClass(item.gradingStatus)}`}>
          {statusLabel}
        </span>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400">
        {item.competencyLabel && <span className="text-indigo-600 dark:text-indigo-400">{item.competencyLabel}</span>}
        <span>Điểm tối đa: {formatPoints(item.maxPoints)}</span>
      </div>

      <div className="rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 p-3 text-sm">
        <p className="font-semibold text-gray-700 dark:text-gray-200">Bài làm {mode === 'student' ? 'của em' : 'của học sinh'}</p>
        <p className="mt-1 whitespace-pre-line text-gray-700 dark:text-gray-300">
          {item.studentAnswer?.trim() ? item.studentAnswer : 'Không có câu trả lời'}
        </p>
      </div>

      {mode === 'teacher' && (item.rubricItems || []).length > 0 && (
        <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3 text-sm" data-testid="essay-rubric">
          <p className="font-semibold text-green-700 dark:text-green-300">Danh sách ý {item.rubricResults?.length ? '– điểm AI từng ý' : ''}</p>
          <ol className="mt-1 space-y-1.5">
            {(item.rubricItems || []).map((rubricItem, itemIndex) => {
              const result = item.rubricResults?.find((r) => r.order === itemIndex + 1);
              return (
                <li key={itemIndex} className="text-green-800 dark:text-green-200">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <span className="whitespace-pre-line">
                      <span className="font-semibold">Ý {itemIndex + 1}:</span> {rubricItem.content}
                    </span>
                    <span className="shrink-0 font-semibold">
                      {result ? `${formatPoints(result.points)} / ` : ''}
                      {formatPoints(rubricItem.points ?? null)} điểm
                    </span>
                  </div>
                  {result?.comment && <p className="text-xs text-gray-600 dark:text-gray-300">{result.comment}</p>}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {mode === 'teacher' && !(item.rubricItems || []).length && item.sampleAnswer && (
        <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3 text-sm">
          <p className="font-semibold text-green-700 dark:text-green-300">Đáp án mẫu / tiêu chí chấm</p>
          <p className="mt-1 whitespace-pre-line text-green-800 dark:text-green-200">{item.sampleAnswer}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold text-gray-700 dark:text-gray-300">Điểm:</span>
        <span className={isPending || isAwaitingTeacher || isPolling ? 'font-semibold text-amber-700 dark:text-amber-300' : 'font-bold text-blue-700 dark:text-blue-300'}>
          {isPolling ? 'Đang chấm' : formatEssayScore(item.score, item.maxPoints, item.gradingStatus)}
        </span>
      </div>

      {item.gradingFeedback && (
        <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-3 text-sm text-yellow-800 dark:text-yellow-200">
          <p className="font-semibold mb-1">
            {item.gradingStatus === 'TeacherGraded' ? 'Nhận xét của giáo viên' : item.gradingStatus === 'AiGraded' ? 'Nhận xét của AI' : 'Nhận xét'}
          </p>
          <p className="whitespace-pre-line">{item.gradingFeedback}</p>
        </div>
      )}

      {mode === 'student' && isAwaitingTeacher && (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          Câu này đang chờ giáo viên chấm; điểm tạm thời được tính là 0 cho đến khi có kết quả.
        </p>
      )}

      {mode === 'teacher' && studentExamId && (
        <div className="space-y-3">
          {message && <p className="text-xs text-emerald-700 dark:text-emerald-300">{message}</p>}
          {error && <p className="text-xs text-red-600 dark:text-red-300">{error}</p>}

          {isEditing ? (
            <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-800 dark:bg-blue-900/10">
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                Điểm (0 - {formatPoints(item.maxPoints)})
                <input
                  type="number"
                  min={0}
                  max={item.maxPoints}
                  step={0.25}
                  value={scoreInput}
                  onChange={(e) => setScoreInput(e.target.value)}
                  className="mt-1 block w-32 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
              </label>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                Nhận xét cho học sinh
                <textarea
                  value={feedbackInput}
                  onChange={(e) => setFeedbackInput(e.target.value)}
                  rows={3}
                  maxLength={ESSAY_FEEDBACK_MAX_LENGTH}
                  className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSaving ? 'Đang lưu...' : 'Lưu điểm'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  disabled={isSaving}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  Hủy
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={openEditor}
                className="rounded-lg border border-blue-300 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900/20"
              >
                {item.gradingStatus === 'TeacherGraded' || item.gradingStatus === 'AiGraded' ? 'Sửa điểm' : 'Chấm điểm'}
              </button>
              {(item.canRegradeWithAi || isAwaitingTeacher) && !isPolling && (
                <button
                  type="button"
                  onClick={handleAiRegrade}
                  disabled={isRegrading}
                  className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
                >
                  {isRegrading ? 'AI đang chấm...' : 'Chấm lại bằng AI'}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const EssayAnswerList: React.FC<EssayAnswerListProps> = ({ items, mode, studentExamId, onGraded }) => {
  if (!items || items.length === 0) return null;

  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        // Shared situation (round 8 F): shown once above the first essay of its group.
        const groupKey = item.passageGroupKey?.trim();
        const startsGroup =
          !!item.passageText?.trim() && (!groupKey || items[index - 1]?.passageGroupKey?.trim() !== groupKey);
        return (
          <React.Fragment key={item.answerId}>
            {startsGroup && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Tình huống</p>
                <p className="whitespace-pre-line">{item.passageText}</p>
              </div>
            )}
            <EssayAnswerCard item={item} index={index} mode={mode} studentExamId={studentExamId} onGraded={onGraded} />
            {/* Explanation from the source file (sent only for ý that lost points). Several ý of one question share it:
                show it once, after the last ý that carries it. */}
            {item.explanation && !items.slice(index + 1).some((next) => next.explanation === item.explanation) && (
              <div data-testid="essay-explanation" className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-900 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-100">
                <span className="font-semibold">Giải thích:</span>{' '}
                <span className="whitespace-pre-line">{item.explanation}</span>
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default EssayAnswerList;
