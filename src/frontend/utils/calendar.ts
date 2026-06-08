import { format } from 'date-fns';
import { solarHolidays, lunarHolidays2026 } from '@/database';

/**
 * 주어진 날짜가 공휴일(양력 또는 2026년 음력 환산)인지 판별한다.
 * page.tsx와 calendar/page.tsx에 중복돼 있던 정의를 단일화.
 */
export const isHoliday = (date: Date) =>
  solarHolidays.includes(format(date, 'MM-dd')) ||
  lunarHolidays2026.includes(format(date, 'yyyy-MM-dd'));
