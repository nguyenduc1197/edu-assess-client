import React, { useState } from 'react';
import { CheckCircle2, FileText, Loader2, UploadCloud, X, XCircle } from 'lucide-react';
import { fetchClient } from '../../../api/fetchClient';
import { CompetencyComment, ExamScanResult } from '../../../types';
import { SCAN_ACCEPT, validateScanFiles } from '../../../utils/scanExam';
import {
  SourceFeedbackPreview,
  buildApplySourceFeedbackPayload,
  hasFileFeedback,
} from '../../../utils/sourceFeedback';
import CompetencyCommentsEditor from './CompetencyCommentsEditor';

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white';

const readApiMessage = async (response: Response, fallback: string) => {
  const data = await response.json().catch(() => null);
  return data && typeof data.message === 'string' && data.message.trim() ? (data.message as string) : fallback;
};

interface SourceFeedbackUpdateModalProps {
  examId: string;
  examTitle: string;
  onClose: () => void;
  /** Called after saving (e.g. to reload the exam questions). */
  onSaved?: (message: string) => void;
}

/**
 * "Cập nhật phản hồi từ file gốc" for an existing exam: upload the source file -> AI scan -> match to the exam's
 * questions -> review -> save feedback / explanations / "nhận xét theo bài". Never changes questions, answers or scores.
 */
const SourceFeedbackUpdateModal: React.FC<SourceFeedbackUpdateModalProps> = ({ examId, examTitle, onClose, onSaved }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<SourceFeedbackPreview | null>(null);
  const [competencyComments, setCompetencyComments] = useState<CompetencyComment[]>([]);

  const fileError = files.length > 0 ? validateScanFiles(files) : null;

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
      const scanResponse = await fetchClient('/exams/scan-file', { method: 'POST', body: formData });
      if (!scanResponse.ok) {
        setError(await readApiMessage(scanResponse, 'Không thể đọc file. Vui lòng thử lại.'));
        return;
      }
      const scan: ExamScanResult = await scanResponse.json();

      const matchResponse = await fetchClient(`/exams/${encodeURIComponent(examId)}/source-feedback/match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scan),
      });
      if (!matchResponse.ok) {
        setError(await readApiMessage(matchResponse, 'Không thể đối chiếu file với bài thi. Vui lòng thử lại.'));
        return;
      }
      const data: SourceFeedbackPreview = await matchResponse.json();
      setPreview(data);
      setCompetencyComments((data.competencyComments || []).map((item) => ({ ...item })));
    } catch {
      setError('Không thể đọc file. Vui lòng kiểm tra kết nối rồi thử lại.');
    } finally {
      setIsScanning(false);
    }
  };

  const payload = preview ? buildApplySourceFeedbackPayload(preview, competencyComments) : null;
  const canSave = !!payload && (payload.questions.length > 0 || payload.competencyComments !== null);

  const handleSave = async () => {
    if (!payload || !canSave) return;
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetchClient(`/exams/${encodeURIComponent(examId)}/source-feedback/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        setError(await readApiMessage(response, 'Lưu phản hồi thất bại. Vui lòng thử lại.'));
        return;
      }
      const result = await response.json().catch(() => null);
      onSaved?.(`Đã cập nhật phản hồi cho ${result?.updatedQuestionCount ?? payload.questions.length} câu hỏi. Điểm của học sinh không thay đổi.`);
      onClose();
    } catch {
      setError('Lưu phản hồi thất bại. Vui lòng kiểm tra kết nối rồi thử lại.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-label="Cập nhật phản hồi từ file gốc"
        className="flex max-h-[var(--mobile-modal-max-height)] w-full flex-col rounded-t-3xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900 sm:max-w-4xl sm:rounded-xl"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-4 dark:border-gray-700 sm:px-6">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Cập nhật phản hồi từ file gốc</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">{examTitle}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng" className="text-gray-500 hover:text-gray-700 dark:text-gray-400">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-4 sm:p-6">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Tải lại file đề gốc (có phản hồi từng phương án, giải thích, nhận xét theo bài). Hệ thống chỉ cập nhật phần phản hồi;
            câu hỏi, đáp án và điểm của học sinh giữ nguyên. Câu không có phản hồi trong file vẫn do AI giải thích.
          </p>

          {error && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </div>
          )}

          {!preview ? (
            <div className="space-y-3">
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 p-6 text-center hover:border-primary dark:border-gray-600">
                <UploadCloud size={28} className="text-primary" />
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">Chọn file đề gốc</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">1 file Word (.docx) hoặc PDF, hoặc nhiều ảnh theo thứ tự trang. Tối đa 20MB.</span>
                <input
                  type="file"
                  multiple
                  accept={SCAN_ACCEPT}
                  className="sr-only"
                  aria-label="Chọn file đề gốc"
                  onChange={(e) => {
                    setError(null);
                    setFiles(e.target.files ? Array.from(e.target.files) : []);
                  }}
                />
              </label>
              {files.length > 0 && (
                <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                  {files.map((file, index) => (
                    <li key={`${file.name}-${index}`} className="flex items-center gap-2"><FileText size={14} />{file.name}</li>
                  ))}
                </ul>
              )}
              {fileError && <p className="text-sm text-red-600 dark:text-red-300">{fileError}</p>}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3 text-sm text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-100">
                Khớp {preview.matchedCount}/{preview.questions.length} câu của bài thi; {preview.withFeedbackCount} câu có phản hồi trong file.
                {preview.unmatchedScanned.length > 0 && (
                  <span> Không khớp được trong file: {preview.unmatchedScanned.join(', ')}.</span>
                )}
              </div>

              <ol className="space-y-3" data-testid="source-feedback-preview">
                {preview.questions.map((question, index) => (
                  <li key={question.questionId} className="space-y-2 rounded-xl border border-gray-200 p-3 text-sm dark:border-gray-700">
                    <div className="flex items-start gap-2">
                      {hasFileFeedback(question) ? (
                        <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-green-600" aria-label="Có phản hồi" />
                      ) : (
                        <XCircle size={16} className="mt-0.5 shrink-0 text-gray-400" aria-label={question.matched ? 'Không có phản hồi' : 'Không khớp'} />
                      )}
                      <p className="text-gray-900 dark:text-white">
                        <span className="font-semibold">Câu {question.examOrder ?? index + 1}</span>
                        {question.scannedNumber && <span className="text-gray-500"> ({question.scannedNumber} trong file)</span>}: {question.questionContent}
                      </p>
                    </div>
                    {!question.matched ? (
                      <p className="pl-6 text-xs text-amber-700 dark:text-amber-300">Không tìm thấy câu này trong file – giữ nguyên (AI giải thích nếu cần).</p>
                    ) : (
                      <div className="space-y-1 pl-6 text-xs text-gray-700 dark:text-gray-300">
                        {question.choices.filter((choice) => choice.feedback).map((choice) => (
                          <p key={choice.choiceId}>
                            <span className={choice.isCorrect ? 'font-semibold text-green-700 dark:text-green-400' : 'font-semibold'}>{choice.content}</span>
                            {' → '}{choice.feedback}
                          </p>
                        ))}
                        {question.explanation && <p><span className="font-semibold">Giải thích:</span> {question.explanation}</p>}
                        {!hasFileFeedback(question) && <p className="text-gray-500">File không có phản hồi cho câu này – AI vẫn giải thích.</p>}
                      </div>
                    )}
                  </li>
                ))}
              </ol>

              <CompetencyCommentsEditor comments={competencyComments} onChange={setCompetencyComments} inputClassName={inputClass} />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 px-4 py-3 dark:border-gray-700 sm:px-6">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">
            Hủy
          </button>
          {!preview ? (
            <button
              type="button"
              onClick={handleScan}
              disabled={isScanning || files.length === 0 || !!fileError}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {isScanning && <Loader2 size={14} className="animate-spin" />}
              {isScanning ? 'Đang đọc file...' : 'Đọc file và đối chiếu'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !canSave}
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {isSaving && <Loader2 size={14} className="animate-spin" />}
              {isSaving ? 'Đang lưu...' : 'Lưu phản hồi'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SourceFeedbackUpdateModal;
