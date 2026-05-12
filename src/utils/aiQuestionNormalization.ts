import { Choice, Question } from '../types';

const SINGLE_CHOICE_LABELS = ['A', 'B', 'C', 'D'];
const TRUE_FALSE_LABELS = ['A', 'B'];
const TRUE_FALSE_CONTENTS = ['Đúng', 'Sai'];
const getExpectedChoiceCount = (questionFormat?: Question['questionFormat']) =>
  questionFormat === 'TrueFalse' ? 2 : 4;

type NormalizeQuestionOptions = {
  defaultCompetencyType?: string;
  seed?: number | string;
};

const normalizeCorrectChoice = (choices: Choice[]) => {
  const firstCorrectIndex = choices.findIndex((choice) => choice.isCorrect);
  const correctIndex = firstCorrectIndex >= 0 ? firstCorrectIndex : 0;

  return choices.map((choice, index) => ({
    ...choice,
    isCorrect: index === correctIndex,
  }));
};

const normalizeSingleChoiceChoices = (rawChoices: Choice[], seed: number | string, questionIndex: number) =>
  normalizeCorrectChoice(
    SINGLE_CHOICE_LABELS.map((optionLabel, choiceIndex) => {
      const choice = rawChoices[choiceIndex];

      return {
        id: choice?.id || `ai-choice-${seed}-${questionIndex}-${choiceIndex}`,
        optionLabel,
        content: choice?.content || '',
        isCorrect: !!choice?.isCorrect,
      };
    })
  );

const normalizeTrueFalseChoices = (rawChoices: Choice[], seed: number | string, questionIndex: number) =>
  normalizeCorrectChoice(
    TRUE_FALSE_CONTENTS.map((content, choiceIndex) => {
      const choice = rawChoices[choiceIndex];

      return {
        id: choice?.id || `ai-choice-${seed}-${questionIndex}-${choiceIndex}`,
        optionLabel: TRUE_FALSE_LABELS[choiceIndex],
        content,
        isCorrect: !!choice?.isCorrect,
      };
    })
  );

export const normalizeAiQuestions = (
  items: Question[] = [],
  options: NormalizeQuestionOptions = {}
): Question[] => {
  const seed = options.seed ?? Date.now();

  return items.map((question, questionIndex) => {
    const questionFormat = question.questionFormat === 'TrueFalse' ? 'TrueFalse' : 'SingleChoice';
    const rawChoices = question.choices || [];
    const choices =
      questionFormat === 'TrueFalse'
        ? normalizeTrueFalseChoices(rawChoices, seed, questionIndex)
        : normalizeSingleChoiceChoices(rawChoices, seed, questionIndex);

    return {
      ...question,
      id: question.id || `ai-${seed}-${questionIndex}`,
      competencyType: question.competencyType || options.defaultCompetencyType || '',
      questionFormat,
      difficultyLevel: question.difficultyLevel || 'Medium',
      choices,
    };
  });
};

export const getAiDraftValidationError = (question: Question) => {
  if (!question.content.trim()) {
    return 'Mỗi câu hỏi cần có nội dung.';
  }

  if (!question.competencyType) {
    return 'Mỗi câu hỏi cần có năng lực.';
  }

  if (!question.choices || question.choices.length !== getExpectedChoiceCount(question.questionFormat)) {
    return question.questionFormat === 'TrueFalse'
      ? 'Câu hỏi Đúng / Sai phải có đúng 2 lựa chọn.'
      : 'Câu hỏi một đáp án phải có đúng 4 lựa chọn A, B, C, D.';
  }

  if (question.choices.some((choice) => !choice.content.trim())) {
    return 'Mỗi câu hỏi cần điền đầy đủ nội dung đáp án.';
  }

  const correctChoices = question.choices.filter((choice) => choice.isCorrect);
  if (correctChoices.length !== 1) {
    return 'Mỗi câu hỏi cần đúng 1 đáp án đúng.';
  }

  if (
    question.questionFormat === 'TrueFalse' &&
    question.choices.some((choice, index) => choice.content !== TRUE_FALSE_CONTENTS[index])
  ) {
    return 'Câu hỏi Đúng / Sai phải giữ nguyên 2 lựa chọn Đúng và Sai.';
  }

  return '';
};
