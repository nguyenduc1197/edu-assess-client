import React from 'react';
import { Lightbulb } from 'lucide-react';
import { CompetencyComment } from '../../../types';

export const COMPETENCY_LABELS: Record<string, string> = {
  BehaviorAdjustment: 'Điều chỉnh hành vi',
  SelfDevelopment: 'Phát triển bản thân',
  EconomicSocialParticipation: 'Tìm hiểu và tham gia hoạt động kinh tế - xã hội',
};

export const competencyLabel = (competencyType: string) => COMPETENCY_LABELS[competencyType] || competencyType;

interface CompetencyCommentListProps {
  comments?: CompetencyComment[] | null;
}

/** "Nhận xét theo bài" from the source file, for competencies whose ratio is below 80% (filtered by the API). */
const CompetencyCommentList: React.FC<CompetencyCommentListProps> = ({ comments }) => {
  if (!comments || comments.length === 0) return null;

  return (
    <div data-testid="competency-comment-list" className="space-y-2 rounded-xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-900/40 dark:bg-violet-950/20">
      <p className="flex items-center gap-2 text-sm font-bold text-violet-900 dark:text-violet-200">
        <Lightbulb size={16} /> Nhận xét theo năng lực
      </p>
      {comments.map((item) => (
        <div key={item.competencyType} className="text-sm text-violet-900 dark:text-violet-100">
          <p className="font-semibold">{competencyLabel(item.competencyType)}</p>
          <p className="whitespace-pre-line">{item.comment}</p>
        </div>
      ))}
    </div>
  );
};

export default CompetencyCommentList;
