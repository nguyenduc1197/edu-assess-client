export const getAssessmentStatusLabel = (status?: string | null) => {
  switch (status) {
    case 'Pending':
      return 'Đang chấm';
    case 'Completed':
      return 'Đã hoàn thành';
    case 'Failed':
      return 'Đánh giá lỗi';
    case 'NotStarted':
      return 'Chưa bắt đầu';
    default:
      return status || '—';
  }
};
