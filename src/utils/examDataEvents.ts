export const EXAM_DATA_CHANGED_EVENT = 'edu-assess:exam-data-changed';

export const emitExamDataChangedEvent = () => {
  window.dispatchEvent(new Event(EXAM_DATA_CHANGED_EVENT));
};
