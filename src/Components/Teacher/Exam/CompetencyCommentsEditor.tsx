import React from 'react';
import { CompetencyComment } from '../../../types';
import { competencyLabel } from '../../Common/CompetencyComments/CompetencyCommentList';

interface CompetencyCommentsEditorProps {
  comments: CompetencyComment[];
  onChange: (comments: CompetencyComment[]) => void;
  inputClassName: string;
}

/** "Nhận xét theo bài" per competency (from the source file), editable; shown to students whose ratio is below 80%. */
const CompetencyCommentsEditor: React.FC<CompetencyCommentsEditorProps> = ({ comments, onChange, inputClassName }) => {
  if (comments.length === 0) return null;

  return (
    <div data-testid="competency-comments" className="space-y-3 rounded-xl border border-violet-200 bg-violet-50/50 p-4 dark:border-violet-900/40 dark:bg-violet-950/10">
      <div>
        <h3 className="text-sm font-bold text-gray-900 dark:text-white">Nhận xét theo bài (từ đề gốc)</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">Hiển thị cho học sinh khi tỉ lệ đạt của năng lực dưới 80%, bên cạnh nhận xét của AI.</p>
      </div>
      {comments.map((item, index) => (
        <label key={item.competencyType} className="block text-xs font-semibold text-gray-600 dark:text-gray-300">
          {competencyLabel(item.competencyType)}
          <textarea
            aria-label={`Nhận xét theo bài – ${competencyLabel(item.competencyType)}`}
            value={item.comment}
            onChange={(e) => onChange(comments.map((c, i) => (i === index ? { ...c, comment: e.target.value } : c)))}
            rows={3}
            className={`mt-1 ${inputClassName}`}
          />
        </label>
      ))}
    </div>
  );
};

export default CompetencyCommentsEditor;
