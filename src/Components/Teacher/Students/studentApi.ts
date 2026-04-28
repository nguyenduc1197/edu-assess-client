import { fetchClient } from '../../../api/fetchClient';
import { Class as SchoolClass } from '../../../types';

const CLASS_PAGE_SIZE = 100;

const getClassItems = (data: any): SchoolClass[] => {
  if (Array.isArray(data)) return data;
  return data?.items || data?.data || [];
};

const getTotalPages = (data: any): number | null => {
  const value = data?.totalPages || data?.totalPageCount || data?.pagination?.totalPages;
  return typeof value === 'number' && value > 0 ? value : null;
};

export const fetchAllClasses = async (): Promise<SchoolClass[]> => {
  const allClasses: SchoolClass[] = [];
  let pageNumber = 1;

  while (true) {
    const response = await fetchClient(`/classes?pageNumber=${pageNumber}&pageSize=${CLASS_PAGE_SIZE}`);
    if (!response.ok) {
      throw new Error(`Không thể tải danh sách lớp (HTTP ${response.status}).`);
    }

    const data = await response.json();
    const items = getClassItems(data);
    allClasses.push(...items);

    const totalPages = getTotalPages(data);
    const reachedLastPage = totalPages ? pageNumber >= totalPages : items.length < CLASS_PAGE_SIZE;

    if (Array.isArray(data) || reachedLastPage) {
      return allClasses;
    }

    pageNumber += 1;
  }
};
