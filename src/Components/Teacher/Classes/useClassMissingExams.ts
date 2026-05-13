import { useCallback, useEffect, useState } from 'react';
import { ClassMissingExamsSummary } from '../../../types';
import {
  ClassMissingExamsNotFoundError,
  fetchClassMissingExams,
} from './missingExamsApi';

interface UseClassMissingExamsResult {
  data: ClassMissingExamsSummary | null;
  error: string;
  isLoading: boolean;
  isNotFound: boolean;
  refetch: () => Promise<void>;
}

export const useClassMissingExams = (
  classId?: string,
  enabled = true
): UseClassMissingExamsResult => {
  const [data, setData] = useState<ClassMissingExamsSummary | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isNotFound, setIsNotFound] = useState(false);

  const load = useCallback(async () => {
    if (!enabled || !classId) {
      setData(null);
      setError('');
      setIsLoading(false);
      setIsNotFound(false);
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      setIsNotFound(false);
      const nextData = await fetchClassMissingExams(classId);
      setData(nextData);
    } catch (loadError) {
      setData(null);
      if (loadError instanceof ClassMissingExamsNotFoundError) {
        setIsNotFound(true);
        setError('');
      } else {
        console.error('Failed to fetch missing exams for class', loadError);
        setIsNotFound(false);
        setError('Không thể tải thống kê học sinh thiếu bài.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [classId, enabled]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    data,
    error,
    isLoading,
    isNotFound,
    refetch: load,
  };
};
