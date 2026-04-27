import React, { useState, useEffect, useRef } from 'react';
import { AnswerState, Assignment, AssessmentResult, Question, WrongAnswerReview } from '../../../types';
import ExamReview from './ExamReview';
import ExamTaking from './ExamTaking';
import { fetchClient } from '../../../api/fetchClient';


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

const ExamSession: React.FC<ExamSessionProps> = ({ assignment, examId, onExit, onSubmitted }) => {
  const [step, setStep] = useState<SessionStep>('taking');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [assessmentResult, setAssessmentResult] = useState<AssessmentResult | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const saveDraftIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const answersRef = useRef(answers);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const saveDraft = async () => {
    try {
      const payload = {
        answers: Object.entries(answersRef.current).map(([questionId, value]) => ({
          questionId,
          choiceId: value.choiceId ?? null,
          essayAnswer: null,
        })),
      };
      await fetchClient(`/exams/${examId}/save-draft`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      // silently ignore draft save errors
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
  }, [step, examId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchAssessmentResult = async (studentExamId: string) => {
    const response = await fetchClient(`/student-exams/${studentExamId}/assessment`);

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data: AssessmentResult = await response.json();

    if (data.assessmentStatus === 'Completed' || data.assessmentStatus === 'Failed') {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }

      setAssessmentResult(data);
      setStep('result');
    } else {
      setStep('assessing');
    }

    return data;
  };

  const startPolling = async (studentExamId: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    try {
      const initialResult = await fetchAssessmentResult(studentExamId);

      if (initialResult?.assessmentStatus === 'Completed' || initialResult?.assessmentStatus === 'Failed') {
        return;
      }
    } catch {
      // keep polling; transient errors shouldn't stop us
    }

    pollIntervalRef.current = setInterval(async () => {
      try {
        await fetchAssessmentResult(studentExamId);
      } catch {
        // keep polling; transient errors shouldn't stop us
      }
    }, 3000);
  };

  const handleRetryAssessment = async (studentExamId: string) => {
    try {
      setStep('assessing');
      setAssessmentResult(null);

      const response = await fetchClient(`/student-exams/${studentExamId}/retry-assessment`, {
        method: 'POST',
      });
      const retryData = await response.json().catch(() => ({}));

      if (!response.ok || !retryData?.studentExamId) {
        throw new Error(retryData?.message || `API returned ${response.status}`);
      }

      onSubmitted?.();
      await startPolling(retryData.studentExamId);
    } catch (error) {
      console.error('Error retrying assessment:', error);
      alert('Không thể yêu cầu chấm lại. Vui lòng thử lại sau.');
      setStep('result');
    }
  };

  // Fetch questions specifically for this exam context
  // Note: Using the general questions endpoint for demo purposes as per instructions
  useEffect(() => {
    if (assignment.isSubmitted && assignment.studentExamId) {
      setIsLoading(false);
      setStep('assessing');
      startPolling(assignment.studentExamId);
      return;
    }

    const fetchQuestions = async () => {
      try {
        setIsLoading(true);
        const response = await fetchClient(`/questions?pageNumber=1&examId=${examId}&pageSize=20`);
        
        if (response.ok) {
          const data = await response.json();
          const items = Array.isArray(data) ? data : (data.items || data.data || []);
          setQuestions(items);
        } else {
            throw new Error('API Error');
        }
      } catch (error) {
        console.warn("Failed to load exam questions, using mock data.", error);
        // Fallback mock data
        const mockQuestions: Question[] = [
            { id: 'q1', content: 'Quyền bình đẳng của công dân trong lao động được thể hiện ở việc mọi công dân đều có quyền?' },
            { id: 'q2', content: 'Nội dung nào dưới đây không phải là bình đẳng trong hôn nhân và gia đình?'},
            { id: 'q3', content: 'Hành vi nào dưới đây vi phạm quyền bình đẳng của công dân trước pháp luật?'},
            { id: 'q4', content: 'Quyền bình đẳng giữa các dân tộc được hiểu là các dân tộc trong cộng đồng dân cư Việt Nam có quyền dùng tiếng nói, chữ viết của dân tộc mình là thể hiện quyền bình đẳng về?'},
            { id: 'q5', content: 'Công dân bình đẳng về trách nhiệm pháp lí là?'}
        ];
        setQuestions(mockQuestions);
      } finally {
        setIsLoading(false);
      }
    };
    fetchQuestions();
  }, [assignment.isSubmitted, assignment.studentExamId, examId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAnswer = (questionId: string, choiceId: string, content: string) => {
   setAnswers(prev => ({
  ...prev,
  [questionId]: {
    content,
    choiceId,
  },
}));
  }

  const handleSubmit = async () => {
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
        onSubmitted?.();
        setStep('assessing');
        startPolling(studentExamId);
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert(`Nộp bài thất bại: ${errorData.message || 'Lỗi không xác định'}`);
      }
    } catch (error) {
      console.error('Error submitting exam:', error);
      alert('Đã xảy ra lỗi khi nộp bài. Vui lòng thử lại.');
    }
  };

  // Clean up intervals on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (saveDraftIntervalRef.current) clearInterval(saveDraftIntervalRef.current);
    };
  }, []);

  if (step === 'taking' && isLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950 text-gray-600 dark:text-gray-300">Đang tải câu hỏi...</div>;
  }

  if (step === 'review') {
    return (
      <ExamReview 
        questions={questions}
        answers={answers}
        onBackToExam={() => setStep('taking')}
        onSubmit={handleSubmit}
      />
    );
  }

  if (step === 'assessing') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-white p-6 dark:from-gray-950 dark:to-gray-950 sm:bg-gray-50 dark:sm:bg-gray-950">
        <div className="flex max-w-md flex-col items-center gap-5 rounded-2xl border border-slate-200 bg-white/80 p-6 text-center shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70 sm:gap-6 sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
          <div className="h-16 w-16 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">Đang đánh giá bài làm</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 sm:text-base">
            Vui lòng chờ trong giây lát, bài làm đang được đánh giá...
          </p>
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
                    </div>
                  )}
                  {selfDevelopmentScore !== null && (
                    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900 sm:rounded-lg sm:shadow-none">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Năng lực phát triển bản thân</p>
                      <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                        <div className="h-full rounded-full bg-indigo-500 dark:bg-indigo-400" style={{ width: `${Math.max(0, Math.min((selfDevelopmentScore / 10) * 100, 100))}%` }} />
                      </div>
                    </div>
                  )}
                  {economicSocialParticipationScore !== null && (
                    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900 sm:rounded-lg sm:shadow-none">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Năng lực tìm hiểu và tham gia hoạt động kinh tế - xã hội</p>
                      <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                        <div className="h-full rounded-full bg-indigo-500 dark:bg-indigo-400" style={{ width: `${Math.max(0, Math.min((economicSocialParticipationScore / 10) * 100, 100))}%` }} />
                      </div>
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
      examEnd={assignment.deadline}
      questions={questions}
      answers={answers}
      onAnswer={handleAnswer}
      onReview={() => setStep('review')}
      onExit={onExit}
    />
  );
};

export default ExamSession;
