import React, { useMemo, useState, useEffect, useRef } from 'react';
import { AnswerState, Assignment, AssessmentResult, Question, WrongAnswerReview } from '../../../types';
import ExamReview from './ExamReview';
import ExamTaking from './ExamTaking';
import { fetchClient } from '../../../api/fetchClient';
import { useAntiCheatMonitoring } from './useAntiCheatMonitoring';
import { parseApiDateTime, resolveAttemptDeadlineUtc } from '../../../utils/apiDateTime';


interface ExamSessionProps {
  assignment: Assignment;
  examId: string;
  onExit: () => void;
  onSubmitted?: () => void;
}

type SessionStep = 'taking' | 'review' | 'assessing' | 'result';

const getFeedbackItems = (feedback?: string | null) =>
  (feedback || '')
    .split(/\r?\n|•/)
    .map((item) => item.replace(/^[-•]\s*/, '').trim())
    .filter(Boolean);

const groupWrongAnswerItems = (items: WrongAnswerReview[]) => {
  const groups: Array<
    | { type: 'single'; item: WrongAnswerReview }
    | { type: 'group'; key: string; passageText?: string | null; items: WrongAnswerReview[] }
  > = [];
  const processedGroupKeys = new Set<string>();

  items.forEach((item) => {
    const groupKey = item.passageGroupKey?.trim();

    if (item.questionFormat === 'TrueFalse' && groupKey) {
      if (processedGroupKeys.has(groupKey)) return;

      const groupItems = items
        .filter((candidate) => candidate.questionFormat === 'TrueFalse' && candidate.passageGroupKey === groupKey)
        .sort(
          (a, b) =>
            (a.statementOrder ?? Number.MAX_SAFE_INTEGER) -
            (b.statementOrder ?? Number.MAX_SAFE_INTEGER)
        );

      groups.push({
        type: 'group',
        key: groupKey,
        passageText: groupItems.find((candidate) => candidate.passageText)?.passageText || item.passageText,
        items: groupItems,
      });
      processedGroupKeys.add(groupKey);
      return;
    }

    groups.push({ type: 'single', item });
  });

  return groups;
};

const getExplanationText = (item: WrongAnswerReview) => item.errorExplanation || item.highlightText;

const extractApiMessage = async (response: Response) => {
  const errorData = await response.json().catch(() => null);
  if (!errorData) return 'Đã có lỗi xảy ra. Vui lòng thử lại.';

  if (typeof errorData === 'string') return errorData;
  if (typeof errorData.message === 'string' && errorData.message.trim()) return errorData.message;
  if (typeof errorData.title === 'string' && errorData.title.trim()) return errorData.title;

  return 'Đã có lỗi xảy ra. Vui lòng thử lại.';
};

const looksLikeAttemptExpiredMessage = (message: string) =>
  /(hết giờ|quá hạn|expired|deadline|timeout)/i.test(message);

const extractAttemptTimingFromQuestions = (items: Question[]) => {
  const firstQuestionWithTiming = items.find(
    (item) => item.startedAt || item.attemptDeadlineUtc || item.durationMinutes
  );

  if (!firstQuestionWithTiming) {
    return {
      startedAt: null,
      attemptDeadlineUtc: null,
      durationMinutes: undefined,
    };
  }

  return {
    startedAt: firstQuestionWithTiming.startedAt || null,
    attemptDeadlineUtc: resolveAttemptDeadlineUtc(
      firstQuestionWithTiming.startedAt,
      firstQuestionWithTiming.durationMinutes,
      firstQuestionWithTiming.attemptDeadlineUtc
    ),
    durationMinutes:
      typeof firstQuestionWithTiming.durationMinutes === 'number'
        ? firstQuestionWithTiming.durationMinutes
        : undefined,
  };
};

const toPendingAssessmentResult = (
  studentExamId: string,
  assignment: Assignment,
  previousResult: AssessmentResult | null
): AssessmentResult => ({
  studentExamId,
  examId: previousResult?.examId || assignment.id,
  examName: previousResult?.examName || assignment.title,
  studentId: previousResult?.studentId || '',
  studentName: previousResult?.studentName || '',
  score: previousResult?.score ?? 0,
  assessmentStatus: 'Pending',
  behaviorAdjustmentScore: previousResult?.behaviorAdjustmentScore ?? null,
  selfDevelopmentScore: previousResult?.selfDevelopmentScore ?? null,
  economicSocialParticipationScore: previousResult?.economicSocialParticipationScore ?? null,
  overallFeedback: null,
  behaviorAdjustmentFeedback: null,
  selfDevelopmentFeedback: null,
  economicSocialParticipationFeedback: null,
  completedExamCount: previousResult?.completedExamCount ?? 0,
  behaviorAdjustmentAccumulation: previousResult?.behaviorAdjustmentAccumulation ?? null,
  selfDevelopmentAccumulation: previousResult?.selfDevelopmentAccumulation ?? null,
  economicSocialParticipationAccumulation: previousResult?.economicSocialParticipationAccumulation ?? null,
  wrongAnswers: [],
  assessmentError: null,
  finishedAt: previousResult?.finishedAt || new Date().toISOString(),
  assessedAt: null,
  canRetryAssessment: false,
});

const ExamSession: React.FC<ExamSessionProps> = ({ assignment, examId, onExit, onSubmitted }) => {
  const [step, setStep] = useState<SessionStep>('taking');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [assessmentResult, setAssessmentResult] = useState<AssessmentResult | null>(null);
  const [currentStudentExamId, setCurrentStudentExamId] = useState<string | null>(assignment.studentExamId || null);
  const [attemptStartedAt, setAttemptStartedAt] = useState<string | null>(assignment.startedAt || null);
  const [attemptDurationMinutes, setAttemptDurationMinutes] = useState<number | undefined>(assignment.durationMinutes);
  const [attemptDeadlineUtc, setAttemptDeadlineUtc] = useState<string | null>(assignment.attemptDeadlineUtc || null);
  const [attemptActionMessage, setAttemptActionMessage] = useState<string | null>(null);
  const [attemptEntryError, setAttemptEntryError] = useState<string | null>(null);
  const [isAttemptLocked, setIsAttemptLocked] = useState<boolean>(assignment.isAttemptExpired === true);
  const [pollingSecondsElapsed, setPollingSecondsElapsed] = useState(0);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const saveDraftIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const answersRef = useRef(answers);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    setCurrentStudentExamId(assignment.studentExamId || null);
  }, [assignment.studentExamId]);

  useEffect(() => {
    setAttemptStartedAt(assignment.startedAt || null);
    setAttemptDurationMinutes(assignment.durationMinutes);
    setAttemptDeadlineUtc(assignment.attemptDeadlineUtc || null);
    setIsAttemptLocked(assignment.isAttemptExpired === true);
  }, [assignment.attemptDeadlineUtc, assignment.durationMinutes, assignment.isAttemptExpired, assignment.startedAt]);

  const resolvedAttemptDeadlineUtc = useMemo(
    () => resolveAttemptDeadlineUtc(attemptStartedAt, attemptDurationMinutes, attemptDeadlineUtc),
    [attemptDeadlineUtc, attemptDurationMinutes, attemptStartedAt]
  );

  const antiCheatMonitoring = useAntiCheatMonitoring({
    enabled: assignment.antiCheatEnabled === true && (step === 'taking' || step === 'review'),
    studentExamId: currentStudentExamId,
  });

  const saveDraft = async () => {
    if (isAttemptLocked) return;

    const resolvedAttemptDeadlineDate = parseApiDateTime(resolvedAttemptDeadlineUtc);
    if (resolvedAttemptDeadlineDate && resolvedAttemptDeadlineDate.getTime() <= Date.now()) {
      setIsAttemptLocked(true);
      setAttemptActionMessage('Đã hết thời gian làm bài của lượt này. Em không thể lưu thêm.');
      return;
    }

    try {
      const payload = {
        answers: Object.entries(answersRef.current).map(([questionId, value]) => ({
          questionId,
          choiceId: value.choiceId ?? null,
          essayAnswer: null,
        })),
      };

      const response = await fetchClient(`/exams/${examId}/save-draft`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok && response.status === 400) {
        const message = await extractApiMessage(response);
        setAttemptActionMessage(message);
        if (looksLikeAttemptExpiredMessage(message)) {
          setIsAttemptLocked(true);
        }
      }
    } catch {
      // keep autosave silent for transient network errors
    }
  };

  // Start/stop auto-save draft every 30 seconds while taking exam
  useEffect(() => {
    if (step !== 'taking') {
      if (saveDraftIntervalRef.current) clearInterval(saveDraftIntervalRef.current);
      return;
    }
    saveDraftIntervalRef.current = setInterval(() => {
      saveDraft();
    }, 30000);
    return () => {
      if (saveDraftIntervalRef.current) clearInterval(saveDraftIntervalRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, examId, resolvedAttemptDeadlineUtc, isAttemptLocked]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchAssessmentResult = async (studentExamId: string) => {
    const response = await fetchClient(`/student-exams/${studentExamId}/assessment`);

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data: AssessmentResult = await response.json();
    setAssessmentResult(data);

    if (data.assessmentStatus === 'Completed' || data.assessmentStatus === 'Failed') {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);

      setStep('result');
      onSubmitted?.();
    } else {
      setStep('assessing');
    }

    return data;
  };

  const startPolling = async (studentExamId: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    setPollingSecondsElapsed(0);

    try {
      const initialResult = await fetchAssessmentResult(studentExamId);
      if (initialResult?.assessmentStatus === 'Completed' || initialResult?.assessmentStatus === 'Failed') {
        return;
      }
    } catch {
      // keep polling; transient errors shouldn't stop us
    }

    // Start elapsed-time counter so the assessing screen can show meaningful wait hints
    elapsedTimerRef.current = setInterval(() => {
      setPollingSecondsElapsed((prev) => prev + 1);
    }, 1000);

    // Poll every 2.5 s so retry/submit state changes surface quickly in the UI.
    pollIntervalRef.current = setInterval(async () => {
      try {
        await fetchAssessmentResult(studentExamId);
      } catch {
        // keep polling; transient errors shouldn't stop us
      }
    }, 2500);
  };

  const handleRetryAssessment = async (studentExamId: string) => {
    const previousResult = assessmentResult;

    try {
      const response = await fetchClient(`/student-exams/${studentExamId}/retry-assessment`, {
        method: 'POST',
      });
      const retryData = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          (retryData && typeof retryData === 'object' && 'message' in retryData && typeof retryData.message === 'string'
            ? retryData.message
            : null) || `API returned ${response.status}`
        );
      }

      setCurrentStudentExamId(studentExamId);
      setAssessmentResult(toPendingAssessmentResult(studentExamId, assignment, previousResult));
      setStep('assessing');
      await startPolling(studentExamId);
    } catch (error) {
      console.error('Error retrying assessment:', error);
      alert('Không thể yêu cầu chấm lại. Vui lòng thử lại sau.');
      setAssessmentResult(previousResult);
      setStep('result');
    }
  };

  // Student questions endpoint is the source of truth and triggers first attempt start at backend.
  useEffect(() => {
    if (assignment.isSubmitted && assignment.studentExamId) {
      setIsLoading(false);
      setStep('assessing');
      startPolling(assignment.studentExamId);
      return;
    }

    const fetchQuestions = async () => {
      try {
        setAttemptEntryError(null);
        setAttemptActionMessage(null);
        setIsLoading(true);
        const response = await fetchClient(`/questions?pageNumber=1&examId=${examId}&pageSize=20`);

        if (response.ok) {
          const data = await response.json();
          const items = Array.isArray(data) ? data : (data.items || data.data || []);
          const questionItems = items as Question[];
          const attemptTiming = extractAttemptTimingFromQuestions(questionItems);
          const nextStartedAt = attemptTiming.startedAt ?? assignment.startedAt ?? null;
          const nextDurationMinutes = attemptTiming.durationMinutes ?? assignment.durationMinutes;
          const nextAttemptDeadlineUtc =
            attemptTiming.attemptDeadlineUtc ??
            resolveAttemptDeadlineUtc(nextStartedAt, nextDurationMinutes, assignment.attemptDeadlineUtc);
          const nextAttemptDeadlineDate = parseApiDateTime(nextAttemptDeadlineUtc);

          setQuestions(questionItems);
          setAttemptStartedAt(nextStartedAt);
          setAttemptDurationMinutes(nextDurationMinutes);
          setAttemptDeadlineUtc(nextAttemptDeadlineUtc);
          setAttemptActionMessage(null);
          setIsAttemptLocked(
            !!nextAttemptDeadlineDate && nextAttemptDeadlineDate.getTime() <= Date.now()
          );
        } else {
          if (response.status === 400) {
            const message = await extractApiMessage(response);
            setAttemptEntryError(message);
            setIsAttemptLocked(looksLikeAttemptExpiredMessage(message));
          } else {
            setAttemptEntryError('Không thể mở đề thi. Vui lòng thử lại sau.');
          }
        }
      } catch (error) {
        console.error('Failed to load exam questions', error);
        setAttemptEntryError('Không thể mở đề thi. Vui lòng kiểm tra kết nối rồi thử lại.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchQuestions();
  }, [assignment.isSubmitted, assignment.studentExamId, examId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAnswer = (questionId: string, choiceId: string, content: string) => {
    if (isAttemptLocked) return;

    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        content,
        choiceId,
      },
    }));
  };

  const handleSubmit = async () => {
    if (isAttemptLocked) {
      setAttemptActionMessage('Đã hết thời gian làm bài của lượt này. Em không thể nộp thêm.');
      return;
    }

    try {
      const payload = {
        answers: Object.entries(answers).map(([questionId, value]) => ({
          questionId,
          choiceId: value.choiceId ?? null,
          essayAnswer: null,
        })),
      };

      const response = await fetchClient(`/exams/${examId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const submitData = await response.json();
        const studentExamId: string = submitData.studentExamId;
        await antiCheatMonitoring.flushPendingEvents(studentExamId);
        await antiCheatMonitoring.waitForPendingSends();
        onSubmitted?.();
        setCurrentStudentExamId(studentExamId);
        setStep('assessing');
        startPolling(studentExamId);
      } else {
        const message = await extractApiMessage(response);
        setAttemptActionMessage(message);
        alert(message);

        if (response.status === 400 && looksLikeAttemptExpiredMessage(message)) {
          setIsAttemptLocked(true);
          setStep('taking');
        }
      }
    } catch (error) {
      console.error('Error submitting exam:', error);
      setAttemptActionMessage('Đã xảy ra lỗi khi nộp bài. Vui lòng thử lại.');
    }
  };

  // Clean up all intervals on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
      if (saveDraftIntervalRef.current) clearInterval(saveDraftIntervalRef.current);
    };
  }, []);

  if (step === 'taking' && isLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950 text-gray-600 dark:text-gray-300">Đang tải câu hỏi...</div>;
  }

  if (step === 'taking' && attemptEntryError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6 dark:bg-gray-950">
        <div className="w-full max-w-xl rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm dark:border-red-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold text-red-700 dark:text-red-300">Không thể mở bài thi</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{attemptEntryError}</p>
          <button
            type="button"
            onClick={onExit}
            className="mt-5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Quay lại danh sách bài thi
          </button>
        </div>
      </div>
    );
  }

  if (step === 'review') {
    return (
      <ExamReview 
        questions={questions}
        answers={answers}
        onBackToExam={() => setStep('taking')}
        onSubmit={handleSubmit}
        antiCheatEvents={antiCheatMonitoring.recentEvents}
        antiCheatEventCount={antiCheatMonitoring.totalEventCount}
        antiCheatSyncErrorCount={antiCheatMonitoring.syncErrorCount}
        isAntiCheatMonitoring={antiCheatMonitoring.isMonitoring}
        antiCheatEnabled={assignment.antiCheatEnabled === true}
      />
    );
  }

  if (step === 'assessing') {
    const isLongWait = pollingSecondsElapsed > 60;

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-white p-6 dark:from-gray-950 dark:to-gray-950 sm:bg-gray-50 dark:sm:bg-gray-950">
        <div className="flex max-w-md flex-col items-center gap-5 rounded-2xl border border-slate-200 bg-white/80 p-6 text-center shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70 sm:gap-6 sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
          <div className="h-16 w-16 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">Đang chấm bài trong nền</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 sm:text-base">
            Hệ thống đang đánh giá bài làm của em. Trang sẽ tự cập nhật khi có kết quả — em không cần làm gì thêm.
          </p>

          {pollingSecondsElapsed > 5 && (
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Đã chờ {pollingSecondsElapsed} giây...
            </p>
          )}

          {isLongWait && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
              Đang mất nhiều thời gian hơn bình thường. Em có thể chờ tiếp hoặc quay lại kiểm tra sau.
            </p>
          )}

          <button
            type="button"
            onClick={() => currentStudentExamId && fetchAssessmentResult(currentStudentExamId)}
            className="rounded-xl border border-blue-300 px-5 py-2 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-900/20"
          >
            Kiểm tra kết quả ngay
          </button>

          <button
            type="button"
            onClick={onExit}
            className="text-sm text-gray-400 underline underline-offset-2 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          >
            Về trang chủ
          </button>
        </div>
      </div>
    );
  }

  if (step === 'result' && assessmentResult) {
    const {
      examName,
      studentName,
      score,
      assessmentStatus,
      assessmentError,
      behaviorAdjustmentScore,
      selfDevelopmentScore,
      economicSocialParticipationScore,
      overallFeedback,
      behaviorAdjustmentFeedback,
      selfDevelopmentFeedback,
      economicSocialParticipationFeedback,
    } = assessmentResult;

    const failed = assessmentStatus === 'Failed';
    const wrongAnswers = assessmentResult.wrongAnswers || [];
    const wrongAnswerSections = groupWrongAnswerItems(wrongAnswers);
    const feedbackItems = getFeedbackItems(overallFeedback);

    const competencies = [
      { label: 'Năng lực điều chỉnh hành vi', isShown: behaviorAdjustmentScore !== null },
      { label: 'Năng lực phát triển bản thân', isShown: selfDevelopmentScore !== null },
      { label: 'Năng lực tìm hiểu và tham gia hoạt động kinh tế - xã hội', isShown: economicSocialParticipationScore !== null },
    ].filter((item) => item.isShown);

    return (
      <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-50 to-white p-3 dark:from-gray-950 dark:to-gray-950 sm:bg-gray-50 dark:sm:bg-gray-950 sm:p-8">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 sm:gap-6">

          {/* Header */}
          <div className="mobile-premium-enter flex flex-col gap-1 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">{examName}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{studentName}</p>
          </div>

          {failed ? (
            <div className="mobile-premium-enter mobile-premium-delay-1 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300 sm:rounded-xl sm:p-5">
              <p className="font-semibold">Đánh giá thất bại</p>
              {assessmentError && <p className="mt-1 text-sm">{assessmentError}</p>}
              {assessmentResult.canRetryAssessment && (
                <button
                  onClick={() => handleRetryAssessment(assessmentResult.studentExamId)}
                  className="mt-3 w-full rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-700 sm:rounded-lg sm:py-2"
                >
                  Chấm lại
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Score card */}
              <div className="mobile-premium-enter mobile-premium-delay-1 flex flex-col items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-800 dark:bg-blue-900/20 sm:rounded-xl sm:p-6">
                <span className="text-sm font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">Điểm số</span>
                <span className="text-5xl font-extrabold text-blue-700 dark:text-blue-300">{score?.toFixed(1)}</span>
                <span className="text-sm text-gray-500 dark:text-gray-400">/ 10</span>
              </div>

              {/* Overall feedback */}
              {overallFeedback && (
                <div className="mobile-premium-enter mobile-premium-delay-2 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900 sm:rounded-xl sm:p-5 sm:shadow-none">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Nhận xét chung</p>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    {(feedbackItems.length > 0 ? feedbackItems : [overallFeedback]).map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {competencies.length > 0 && (
                <div className="mobile-premium-enter mobile-premium-delay-3 space-y-3">
                  {behaviorAdjustmentScore !== null && (
                    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900 sm:rounded-lg sm:shadow-none">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Năng lực điều chỉnh hành vi</p>
                      <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                        <div className="h-full rounded-full bg-indigo-500 dark:bg-indigo-400" style={{ width: `${Math.max(0, Math.min((behaviorAdjustmentScore / 10) * 100, 100))}%` }} />
                      </div>
                      {behaviorAdjustmentFeedback && (
                        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{behaviorAdjustmentFeedback}</p>
                      )}
                    </div>
                  )}
                  {selfDevelopmentScore !== null && (
                    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900 sm:rounded-lg sm:shadow-none">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Năng lực phát triển bản thân</p>
                      <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                        <div className="h-full rounded-full bg-indigo-500 dark:bg-indigo-400" style={{ width: `${Math.max(0, Math.min((selfDevelopmentScore / 10) * 100, 100))}%` }} />
                      </div>
                      {selfDevelopmentFeedback && (
                        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{selfDevelopmentFeedback}</p>
                      )}
                    </div>
                  )}
                  {economicSocialParticipationScore !== null && (
                    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900 sm:rounded-lg sm:shadow-none">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Năng lực tìm hiểu và tham gia hoạt động kinh tế - xã hội</p>
                      <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                        <div className="h-full rounded-full bg-indigo-500 dark:bg-indigo-400" style={{ width: `${Math.max(0, Math.min((economicSocialParticipationScore / 10) * 100, 100))}%` }} />
                      </div>
                      {economicSocialParticipationFeedback && (
                        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{economicSocialParticipationFeedback}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Per-competency accumulation metrics */}
              {assessmentResult.completedExamCount > 0 && (
                <div className="mobile-premium-enter mobile-premium-delay-4 space-y-4">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Tiến độ năng lực qua các bài kiểm tra</h3>
                  
                  {assessmentResult.behaviorAdjustmentAccumulation && (
                    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900 sm:rounded-lg sm:shadow-none">
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">Năng lực điều chỉnh hành vi</p>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="text-center">
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Lần này</p>
                          <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                            {(assessmentResult.behaviorAdjustmentAccumulation.latestScore * 10).toFixed(0)}%
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Trung bình</p>
                          <p className="text-lg font-bold text-green-600 dark:text-green-400">
                            {(assessmentResult.behaviorAdjustmentAccumulation.averageScore * 10).toFixed(0)}%
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">So với trước</p>
                          <p className={`text-lg font-bold ${
                            assessmentResult.behaviorAdjustmentAccumulation.gainVsPreviousAttempt === null
                              ? 'text-gray-400 dark:text-gray-500'
                              : assessmentResult.behaviorAdjustmentAccumulation.gainVsPreviousAttempt > 0
                              ? 'text-green-600 dark:text-green-400'
                              : assessmentResult.behaviorAdjustmentAccumulation.gainVsPreviousAttempt < 0
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-gray-600 dark:text-gray-400'
                          }`}>
                            {assessmentResult.behaviorAdjustmentAccumulation.gainVsPreviousAttempt === null
                              ? '--'
                              : assessmentResult.behaviorAdjustmentAccumulation.gainVsPreviousAttempt > 0
                              ? `+${(assessmentResult.behaviorAdjustmentAccumulation.gainVsPreviousAttempt * 10).toFixed(0)}%`
                              : `${(assessmentResult.behaviorAdjustmentAccumulation.gainVsPreviousAttempt * 10).toFixed(0)}%`}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {assessmentResult.selfDevelopmentAccumulation && (
                    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900 sm:rounded-lg sm:shadow-none">
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">Năng lực phát triển bản thân</p>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="text-center">
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Lần này</p>
                          <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                            {(assessmentResult.selfDevelopmentAccumulation.latestScore * 10).toFixed(0)}%
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Trung bình</p>
                          <p className="text-lg font-bold text-green-600 dark:text-green-400">
                            {(assessmentResult.selfDevelopmentAccumulation.averageScore * 10).toFixed(0)}%
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">So với trước</p>
                          <p className={`text-lg font-bold ${
                            assessmentResult.selfDevelopmentAccumulation.gainVsPreviousAttempt === null
                              ? 'text-gray-400 dark:text-gray-500'
                              : assessmentResult.selfDevelopmentAccumulation.gainVsPreviousAttempt > 0
                              ? 'text-green-600 dark:text-green-400'
                              : assessmentResult.selfDevelopmentAccumulation.gainVsPreviousAttempt < 0
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-gray-600 dark:text-gray-400'
                          }`}>
                            {assessmentResult.selfDevelopmentAccumulation.gainVsPreviousAttempt === null
                              ? '--'
                              : assessmentResult.selfDevelopmentAccumulation.gainVsPreviousAttempt > 0
                              ? `+${(assessmentResult.selfDevelopmentAccumulation.gainVsPreviousAttempt * 10).toFixed(0)}%`
                              : `${(assessmentResult.selfDevelopmentAccumulation.gainVsPreviousAttempt * 10).toFixed(0)}%`}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {assessmentResult.economicSocialParticipationAccumulation && (
                    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900 sm:rounded-lg sm:shadow-none">
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">Năng lực Tìm hiểu Tham gia KT-XH</p>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="text-center">
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Lần này</p>
                          <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                            {(assessmentResult.economicSocialParticipationAccumulation.latestScore * 10).toFixed(0)}%
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Trung bình</p>
                          <p className="text-lg font-bold text-green-600 dark:text-green-400">
                            {(assessmentResult.economicSocialParticipationAccumulation.averageScore * 10).toFixed(0)}%
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">So với trước</p>
                          <p className={`text-lg font-bold ${
                            assessmentResult.economicSocialParticipationAccumulation.gainVsPreviousAttempt === null
                              ? 'text-gray-400 dark:text-gray-500'
                              : assessmentResult.economicSocialParticipationAccumulation.gainVsPreviousAttempt > 0
                              ? 'text-green-600 dark:text-green-400'
                              : assessmentResult.economicSocialParticipationAccumulation.gainVsPreviousAttempt < 0
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-gray-600 dark:text-gray-400'
                          }`}>
                            {assessmentResult.economicSocialParticipationAccumulation.gainVsPreviousAttempt === null
                              ? '--'
                              : assessmentResult.economicSocialParticipationAccumulation.gainVsPreviousAttempt > 0
                              ? `+${(assessmentResult.economicSocialParticipationAccumulation.gainVsPreviousAttempt * 10).toFixed(0)}%`
                              : `${(assessmentResult.economicSocialParticipationAccumulation.gainVsPreviousAttempt * 10).toFixed(0)}%`}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="mobile-premium-enter mobile-premium-delay-5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900 sm:rounded-xl sm:p-5 sm:shadow-none">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Học lại để lần sau không sai</p>

                {wrongAnswers.length === 0 ? (
                  <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 text-sm text-green-700 dark:text-green-300">
                    Tuyệt vời! Em không có câu sai nào cần xem lại.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {wrongAnswerSections.map((section) =>
                      section.type === 'group' ? (
                        <div key={`group-${section.key}`} className="rounded-xl border border-gray-200 p-3 space-y-3 dark:border-gray-700 sm:rounded-lg sm:p-4">
                          {section.passageText && (
                            <div className="rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 text-sm text-slate-700 dark:text-slate-200">
                              <p className="font-semibold mb-1">Đoạn văn chung</p>
                              <p>{section.passageText}</p>
                            </div>
                          )}

                          <p className="text-sm font-semibold text-gray-900 dark:text-white">Nhóm mệnh đề Đúng / Sai</p>
                          <p className="text-sm leading-6 text-gray-600 dark:text-gray-300">
                            Dựa vào đoạn văn chung để đối chiếu từng mệnh đề theo đúng nội dung của bài đọc.
                          </p>

                          <div className="space-y-3">
                            {section.items.map((item, index) => (
                              <div key={item.questionId} className="rounded-lg border border-gray-200 bg-gray-50/70 p-3 space-y-3 dark:border-gray-700 dark:bg-gray-800/40 sm:p-4">
                                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Mệnh đề {item.statementOrder ?? index + 1}</p>
                                <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.questionContent}</p>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                  <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
                                    <p className="font-semibold text-red-700 dark:text-red-300">Em chọn gì</p>
                                    <p className="mt-1 text-red-600 dark:text-red-200">{item.selectedAnswer || 'Không có câu trả lời'}</p>
                                  </div>
                                  <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3">
                                    <p className="font-semibold text-green-700 dark:text-green-300">Đáp án đúng là gì</p>
                                    <p className="mt-1 text-green-700 dark:text-green-200">{item.correctAnswer || 'Không có dữ liệu'}</p>
                                  </div>
                                </div>

                                {getExplanationText(item) && (
                                  <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-3 text-sm text-yellow-800 dark:text-yellow-200">
                                    <p className="font-semibold mb-1">Vì sao đáp án em chọn chưa đúng</p>
                                    <p>{getExplanationText(item)}</p>
                                  </div>
                                )}

                                {item.guidanceNote && (
                                  <div className="text-sm text-gray-600 dark:text-gray-300">
                                    <span className="font-semibold">Gợi ý:</span> {item.guidanceNote}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div key={section.item.questionId} className="rounded-xl border border-gray-200 p-3 space-y-3 dark:border-gray-700 sm:rounded-lg sm:p-4">
                          {section.item.passageText && (
                            <div className="rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 text-sm text-slate-700 dark:text-slate-200">
                              <p className="font-semibold mb-1">Đoạn văn chung</p>
                              <p>{section.item.passageText}</p>
                            </div>
                          )}

                          <div>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">{section.item.questionContent}</p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
                              <p className="font-semibold text-red-700 dark:text-red-300">Em chọn gì</p>
                              <p className="mt-1 text-red-600 dark:text-red-200">{section.item.selectedAnswer || 'Không có câu trả lời'}</p>
                            </div>
                            <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3">
                              <p className="font-semibold text-green-700 dark:text-green-300">Đáp án đúng là gì</p>
                              <p className="mt-1 text-green-700 dark:text-green-200">{section.item.correctAnswer || 'Không có dữ liệu'}</p>
                            </div>
                          </div>

                          {getExplanationText(section.item) && (
                            <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-3 text-sm text-yellow-800 dark:text-yellow-200">
                              <p className="font-semibold mb-1">Vì sao đáp án em chọn chưa đúng</p>
                              <p>{getExplanationText(section.item)}</p>
                            </div>
                          )}

                          {section.item.guidanceNote && (
                            <div className="text-sm text-gray-600 dark:text-gray-300">
                              <span className="font-semibold">Gợi ý:</span> {section.item.guidanceNote}
                            </div>
                          )}
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Exit button */}
          <button
            onClick={onExit}
            className="mt-2 w-full rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 sm:rounded-lg"
          >
            Về trang chủ
          </button>
        </div>
      </div>
    );
  }

  return (
    <ExamTaking
      examTitle={assignment.title}
      attemptDeadlineUtc={resolvedAttemptDeadlineUtc}
      questions={questions}
      answers={answers}
      onAnswer={handleAnswer}
      onReview={() => setStep('review')}
      onExit={onExit}
      antiCheatEvents={antiCheatMonitoring.recentEvents}
      antiCheatEventCount={antiCheatMonitoring.totalEventCount}
      antiCheatSyncErrorCount={antiCheatMonitoring.syncErrorCount}
      isAntiCheatMonitoring={antiCheatMonitoring.isMonitoring}
      antiCheatEnabled={assignment.antiCheatEnabled === true}
      disableExamActions={isAttemptLocked}
      lockMessage={attemptActionMessage}
    />
  );
};

export default ExamSession;
