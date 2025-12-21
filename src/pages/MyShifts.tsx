import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  parseISO,
  startOfWeek,
  endOfWeek,
} from 'date-fns';
import { it } from 'date-fns/locale';
import { useShifts } from '@/hooks/useShifts';
import { useUserSettings } from '@/hooks/useUserSettings';
import { calculateHours, formatHours, getLocalISODate, calculateShiftType } from '@/lib/shiftUtils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Play,
  Square,
  Clock,
  Edit,
  Trash2,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';

interface ActiveShift {
  startTime: string;
  startDisplay: string;
}

interface ShiftFormData {
  date: string;
  start_time: string;
  end_time: string;
  notes: string;
}

const initialFormData: ShiftFormData = {
  date: getLocalISODate(new Date()),
  start_time: '09:00',
  end_time: '17:00',
  notes: '',
};

export function MyShifts() {
  const { shifts, loading, addShift, updateShift, deleteShift } = useShifts();
  const { settings } = useUserSettings();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDayModalOpen, setIsDayModalOpen] = useState(false);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ShiftFormData>(initialFormData);
  const [activeShift, setActiveShift] = useState<ActiveShift | null>(() => {
    const saved = localStorage.getItem('activeShift');
    return saved ? JSON.parse(saved) : null;
  });
  const [elapsedTime, setElapsedTime] = useState('0h 0m');

  // Timer for active shift
  useState(() => {
    if (!activeShift) return;

    const updateTimer = () => {
      const start = new Date(activeShift.startTime);
      const now = new Date();
      const diff = now.getTime() - start.getTime();
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      setElapsedTime(`${hours}h ${minutes}m`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000);
    return () => clearInterval(interval);
  });

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentMonth]);

  const shiftsMap = useMemo(() => {
    const map = new Map<string, typeof shifts>();
    shifts.forEach(shift => {
      const key = shift.date;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(shift);
    });
    return map;
  }, [shifts]);

  const getShiftType = (shift: { date: string; start_time: string; end_time: string }) => {
    return calculateShiftType(
      shift,
      shifts.map(s => ({ date: s.date, start_time: s.start_time, end_time: s.end_time })),
      settings?.weekly_hours || 18,
      settings?.contract_start_date || null
    );
  };

  const handleStartShift = () => {
    const now = new Date();
    const shift: ActiveShift = {
      startTime: now.toISOString(),
      startDisplay: format(now, 'HH:mm'),
    };
    setActiveShift(shift);
    localStorage.setItem('activeShift', JSON.stringify(shift));
    toast.success('Turno iniziato alle ' + shift.startDisplay);
  };

  const handleEndShift = () => {
    if (!activeShift) return;

    const now = new Date();
    setFormData({
      date: getLocalISODate(now),
      start_time: activeShift.startDisplay,
      end_time: format(now, 'HH:mm'),
      notes: '',
    });
    setEditingShiftId(null);
    setIsFormOpen(true);
    setActiveShift(null);
    localStorage.removeItem('activeShift');
  };

  const handleDayClick = (day: Date) => {
    setSelectedDay(day);
    setIsDayModalOpen(true);
  };

  const handleAddShift = (day?: Date) => {
    const date = day || selectedDay || new Date();
    setFormData({
      ...initialFormData,
      date: getLocalISODate(date),
    });
    setEditingShiftId(null);
    setIsFormOpen(true);
    setIsDayModalOpen(false);
  };

  const handleEditShift = (shift: typeof shifts[0]) => {
    setFormData({
      date: shift.date,
      start_time: shift.start_time.slice(0, 5),
      end_time: shift.end_time.slice(0, 5),
      notes: shift.notes || '',
    });
    setEditingShiftId(shift.id);
    setIsFormOpen(true);
    setIsDayModalOpen(false);
  };

  const handleDeleteShift = async (id: string) => {
    await deleteShift(id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingShiftId) {
      await updateShift(editingShiftId, {
        date: formData.date,
        start_time: formData.start_time,
        end_time: formData.end_time,
        notes: formData.notes || null,
      });
    } else {
      await addShift({
        date: formData.date,
        start_time: formData.start_time,
        end_time: formData.end_time,
        notes: formData.notes || null,
        status: 'pending',
      });
    }

    setIsFormOpen(false);
    setFormData(initialFormData);
    setEditingShiftId(null);
  };

  const dayShifts = useMemo(() => {
    if (!selectedDay) return [];
    return shiftsMap.get(getLocalISODate(selectedDay)) || [];
  }, [selectedDay, shiftsMap]);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[500px] w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">I Miei Turni</h1>
          <p className="text-muted-foreground">Gestisci il tuo calendario personale</p>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-3">
          {activeShift ? (
            <div className="flex items-center gap-3">
              <div className="bg-shift-extra/10 border border-shift-extra/30 rounded-lg px-4 py-2 flex items-center gap-2">
                <Clock className="w-4 h-4 text-shift-extra animate-pulse" />
                <span className="text-shift-extra font-medium">{elapsedTime}</span>
              </div>
              <Button variant="destructive" onClick={handleEndShift}>
                <Square className="w-4 h-4 mr-2" />
                Termina Turno
              </Button>
            </div>
          ) : (
            <Button variant="default" onClick={handleStartShift}>
              <Play className="w-4 h-4 mr-2" />
              Inizia Turno
            </Button>
          )}
          <Button variant="outline" onClick={() => handleAddShift()}>
            <Plus className="w-4 h-4 mr-2" />
            Aggiungi Manualmente
          </Button>
        </div>
      </div>

      {/* Calendar Navigation */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold capitalize">
              {format(currentMonth, 'MMMM yyyy', { locale: it })}
            </h2>
            <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date())}>
              Oggi
            </Button>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Weekday Headers */}
          {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(day => (
            <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
              {day}
            </div>
          ))}

          {/* Days */}
          {calendarDays.map((day, idx) => {
            const dateKey = getLocalISODate(day);
            const dayShifts = shiftsMap.get(dateKey) || [];
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isSelected = selectedDay && isSameDay(day, selectedDay);

            return (
              <motion.div
                key={idx}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleDayClick(day)}
                className={cn(
                  'min-h-[100px] p-2 rounded-lg border cursor-pointer transition-colors',
                  isCurrentMonth ? 'bg-card' : 'bg-muted/30',
                  isToday(day) && 'border-primary border-2',
                  isSelected && 'ring-2 ring-primary',
                  !isCurrentMonth && 'opacity-50'
                )}
              >
                <div className={cn(
                  'text-sm font-medium mb-1',
                  isToday(day) ? 'text-primary' : 'text-foreground'
                )}>
                  {format(day, 'd')}
                </div>

                <div className="space-y-1">
                  {dayShifts.slice(0, 2).map(shift => {
                    const type = getShiftType(shift);
                    return (
                      <div
                        key={shift.id}
                        className={cn(
                          'text-xs px-1.5 py-0.5 rounded truncate',
                          type === 'contract'
                            ? 'bg-shift-contract/20 text-shift-contract border-l-2 border-shift-contract'
                            : 'bg-shift-extra/20 text-shift-extra border-l-2 border-shift-extra'
                        )}
                      >
                        {shift.start_time.slice(0, 5)}-{shift.end_time.slice(0, 5)}
                      </div>
                    );
                  })}
                  {dayShifts.length > 2 && (
                    <div className="text-xs text-muted-foreground">
                      +{dayShifts.length - 2} altri
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </Card>

      {/* Day Details Modal */}
      <Dialog open={isDayModalOpen} onOpenChange={setIsDayModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              {selectedDay && format(selectedDay, 'd MMMM yyyy', { locale: it })}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {dayShifts.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                Nessun turno per questo giorno
              </p>
            ) : (
              dayShifts.map(shift => {
                const type = getShiftType(shift);
                const hours = calculateHours(shift.start_time, shift.end_time);

                return (
                  <div
                    key={shift.id}
                    className={cn(
                      'p-3 rounded-lg border-l-4 bg-card',
                      type === 'contract' ? 'border-l-shift-contract' : 'border-l-shift-extra'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {shift.start_time.slice(0, 5)} - {shift.end_time.slice(0, 5)}
                          </span>
                          <Badge variant={type === 'contract' ? 'default' : 'secondary'}>
                            {type === 'contract' ? 'Contratto' : 'Extra'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {formatHours(hours)}
                          {shift.notes && ` • ${shift.notes}`}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => handleEditShift(shift)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => handleDeleteShift(shift.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter>
            <Button onClick={() => handleAddShift(selectedDay || undefined)}>
              <Plus className="w-4 h-4 mr-2" />
              Aggiungi Turno
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Shift Modal */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingShiftId ? 'Modifica Turno' : 'Aggiungi Turno'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="date">Data</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={e => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start_time">Ora Inizio</Label>
                <Input
                  id="start_time"
                  type="time"
                  value={formData.start_time}
                  onChange={e => setFormData({ ...formData, start_time: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="end_time">Ora Fine</Label>
                <Input
                  id="end_time"
                  type="time"
                  value={formData.end_time}
                  onChange={e => setFormData({ ...formData, end_time: e.target.value })}
                  required
                />
              </div>
            </div>

            {formData.start_time && formData.end_time && (
              <div className="text-sm text-muted-foreground">
                Durata: {formatHours(calculateHours(formData.start_time, formData.end_time))}
              </div>
            )}

            <div>
              <Label htmlFor="notes">Note (opzionale)</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                Annulla
              </Button>
              <Button type="submit">
                {editingShiftId ? 'Salva Modifiche' : 'Aggiungi Turno'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
