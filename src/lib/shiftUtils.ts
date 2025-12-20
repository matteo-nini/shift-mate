import { startOfWeek, endOfWeek, isSameWeek, parseISO, format, isValid } from 'date-fns';
import { it } from 'date-fns/locale';

export function calculateHours(startTime: string, endTime: string): number {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  let hours = endH - startH;
  let minutes = endM - startM;

  // Handle overnight shifts
  if (hours < 0) hours += 24;

  if (minutes < 0) {
    hours--;
    minutes += 60;
  }

  return hours + minutes / 60;
}

export function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(d)) return '';
  return format(d, 'dd MMM yyyy', { locale: it });
}

export function formatTime(time: string): string {
  return time.slice(0, 5);
}

export function getLocalISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

interface Shift {
  date: string;
  start_time: string;
  end_time: string;
}

export function calculateShiftType(
  shift: Shift,
  allShifts: Shift[],
  weeklyContract: number,
  contractStartDate: string | null
): 'contract' | 'extra' {
  if (!contractStartDate) return 'extra';
  
  const shiftDate = parseISO(shift.date);
  const contractStart = parseISO(contractStartDate);

  // If shift is before contract start, it's extra
  if (shiftDate < contractStart) return 'extra';

  // Find all shifts in the same week
  const weekStart = startOfWeek(shiftDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(shiftDate, { weekStartsOn: 1 });

  const weekShifts = allShifts
    .filter(s => {
      const d = parseISO(s.date);
      return d >= contractStart && d >= weekStart && d <= weekEnd;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  // Calculate hours used before this shift
  let contractHoursUsed = 0;
  for (const s of weekShifts) {
    if (s.date === shift.date && s.start_time === shift.start_time && s.end_time === shift.end_time) {
      // This is the current shift
      const hours = calculateHours(s.start_time, s.end_time);
      const remaining = weeklyContract - contractHoursUsed;
      return hours <= remaining ? 'contract' : 'extra';
    }

    const hours = calculateHours(s.start_time, s.end_time);
    const remaining = weeklyContract - contractHoursUsed;
    contractHoursUsed += Math.min(hours, remaining);
  }

  return 'contract';
}

export function calculateEarnings(
  hours: number,
  shiftCount: number,
  paymentMethod: 'hourly' | 'per_shift',
  hourlyRate: number,
  shiftRate: number
): number {
  if (paymentMethod === 'hourly') {
    return hours * hourlyRate;
  }
  return shiftCount * shiftRate;
}

export function getShiftsForMonth(shifts: Shift[], year: number, month: number): Shift[] {
  return shifts.filter(s => {
    const d = parseISO(s.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });
}

export function getShiftsForWeek(shifts: Shift[], referenceDate: Date): Shift[] {
  return shifts.filter(s => {
    const d = parseISO(s.date);
    return isSameWeek(d, referenceDate, { weekStartsOn: 1 });
  });
}
