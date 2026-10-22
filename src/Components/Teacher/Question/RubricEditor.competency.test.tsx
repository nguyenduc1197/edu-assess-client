import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import RubricEditor from './RubricEditor';
import { RubricItemInput, toRubricInputs, toRubricPayload } from '../../../utils/essay';
import { buildCreateQuestionPayload } from '../../../utils/questionPayload';

const options = [
  { value: 'BehaviorAdjustment', label: 'Điều chỉnh hành vi' },
  { value: 'EconomicSocialParticipation', label: 'Tìm hiểu và tham gia hoạt động kinh tế - xã hội' },
];

describe('Rubric ý competency', () => {
  it('round-trips competency per ý ("" = theo câu)', () => {
    const inputs = toRubricInputs([
      { content: '4a', points: 1, competencyType: 'BehaviorAdjustment' },
      { content: '4b', points: 1, competencyType: null },
    ]);
    expect(inputs.map((i) => i.competencyType)).toEqual(['BehaviorAdjustment', '']);
    expect(toRubricPayload(inputs)).toEqual([
      { content: '4a', points: 1, competencyType: 'BehaviorAdjustment' },
      { content: '4b', points: 1 },
    ]);
  });

  it('shows a competency select per ý only when options are given', () => {
    const items: RubricItemInput[] = [{ content: '4a', points: '1', competencyType: '' }];
    const onChange = jest.fn();
    const { rerender } = render(<RubricEditor items={items} onChange={onChange} labelPrefix="Câu 4" />);
    expect(screen.queryByLabelText('Câu 4 năng lực ý 1')).toBeNull();

    rerender(<RubricEditor items={items} onChange={onChange} labelPrefix="Câu 4" competencyOptions={options} />);
    fireEvent.change(screen.getByLabelText('Câu 4 năng lực ý 1'), { target: { value: 'EconomicSocialParticipation' } });
    expect(onChange).toHaveBeenCalledWith([{ content: '4a', points: '1', competencyType: 'EconomicSocialParticipation' }]);
  });

  it('question payload sends rubric competency', () => {
    const payload = buildCreateQuestionPayload({
      content: 'Câu 4',
      questionFormat: 'Essay',
      competencyType: 'BehaviorAdjustment',
      difficultyLevel: 'Medium',
      choices: [],
      rubricItems: [{ content: '4b', points: 1, competencyType: 'EconomicSocialParticipation' }],
    } as any);
    expect((payload as any).rubricItems).toEqual([{ content: '4b', points: 1, competencyType: 'EconomicSocialParticipation' }]);
  });
});
