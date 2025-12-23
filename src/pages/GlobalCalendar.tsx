import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
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
  startOfWeek,
  endOfWeek,
} from 'date-fns';
import { it } from 'date-fns/locale';
import { useGlobalShifts } from '@/hooks/useShifts';
import { useUsers } from '@/hooks/useUsers';
import { useAuth } from '@/contexts/AuthContext';
import { calculateHours, formatHours, getLocalISODate } from '@/lib/shiftUtils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar,
  Edit,
  Trash2,
  User,
  Filter,
  X,
} from 'lucide-react';

interface ShiftFormData {
  assigned_to_user_id: string;
  date: string;
  start_time: string;
  end_time: string;
  notes: string;
}

const initialFormData: ShiftFormData = {
  assigned_to_user_id: '',
  date: getLocalISODate(new Date()),
  start_time: '09:00',
  end_time: '17:00',
  notes: '',
};

export function GlobalCalendar() {
  const { user, isAdmin } = useAuth();
  const { shifts, loading: shiftsLoading, addGlobalShift, updateGlobalShift, deleteGlobalShift } = useGlobalShifts();
  const { users, loading: usersLoading } = useUsers();
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [isDayModalOpen, setIsDayModalOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ShiftFormData>(initialFormData);
  const [filterUserId, setFilterUserId] = useState<string>('all');

  // Filter shifts by selected user
  const filteredShifts = useMemo(() => {
    if (filterUserId === 'all') return shifts;
    return shifts.filter(s => s.assigned_to_user_id === filterUserId);
  }, [shifts, filterUserId]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentMonth]);

  const shiftsMap = useMemo(() => {
    const map = new Map<string, typeof shifts>();
    filteredShifts.forEach(shift => {
      const key = shift.date;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(shift);
    });
    return map;
  }, [filteredShifts]);

  const dayShifts = useMemo(() => {
    if (!selectedDay) return [];
    return shiftsMap.get(getLocalISODate(selectedDay)) || [];
  }, [selectedDay, shiftsMap]);

  const activeUsers = useMemo(() => {
    return users.filter(u => u.is_active);
  }, [users]);

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
      assigned_to_user_id: shift.assigned_to_user_id,
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
    await deleteGlobalShift(id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingShiftId) {
      await updateGlobalShift(editingShiftId, {
        assigned_to_user_id: formData.assigned_to_user_id,
        date: formData.date,
        start_time: formData.start_time,
        end_time: formData.end_time,
        notes: formData.notes || null,
      });
    } else {
      await addGlobalShift({
        assigned_to_user_id: formData.assigned_to_user_id,
        date: formData.date,
        start_time: formData.start_time,
        end_time: formData.end_time,
        notes: formData.notes || null,
      });
    }

    setIsFormOpen(false);
    setFormData(initialFormData);
    setEditingShiftId(null);
  };

  const getUserDisplay = (userId: string, profile?: { username: string; full_name?: string | null }) => {
    if (profile) {
      return profile.full_name || profile.username;
    }
    const found = users.find(u => u.id === userId);
    return found?.full_name || found?.username || 'Sconosciuto';
  };

  const loading = shiftsLoading || usersLoading;

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
          <h1 className="text-3xl font-display font-bold text-foreground">Calendario Globale</h1>
          <p className="text-muted-foreground">
            {isAdmin ? 'Gestisci tutti i turni' : 'Visualizza i turni di tutti'}
          </p>
        </div>

        {isAdmin && (
          <Button onClick={() => handleAddShift()}>
            <Plus className="w-4 h-4 mr-2" />
            Aggiungi Turno
          </Button>
        )}
      </div>

      {/* Filter & Legend */}
      <div className="flex flex-wrap items-center gap-4">
        {/* User Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select value={filterUserId} onValueChange={setFilterUserId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filtra per utente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti gli utenti</SelectItem>
              {activeUsers.map(u => (
                <SelectItem key={u.id} value={u.id}>
                  {u.full_name || u.username}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filterUserId !== 'all' && (
            <Button variant="ghost" size="icon" onClick={() => setFilterUserId('all')}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        <div className="flex-1" />

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-primary" />
            <span>Turni miei</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-muted-foreground" />
            <span>Turni altri</span>
          </div>
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
                  {dayShifts.slice(0, 3).map(shift => {
                    const isOwnShift = shift.assigned_to_user_id === user?.id;
                    return (
                      <div
                        key={shift.id}
                        className={cn(
                          'text-xs px-1.5 py-0.5 rounded truncate border-l-2',
                          isOwnShift
                            ? 'bg-primary/20 text-primary border-l-primary'
                            : 'bg-muted text-muted-foreground border-l-muted-foreground'
                        )}
                      >
                        <span className="font-medium">
                          {getUserDisplay(shift.assigned_to_user_id, shift.profile).slice(0, 8)}
                        </span>{' '}
                        {shift.start_time.slice(0, 5)}
                      </div>
                    );
                  })}
                  {dayShifts.length > 3 && (
                    <div className="text-xs text-muted-foreground">
                      +{dayShifts.length - 3} altri
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              {selectedDay && format(selectedDay, 'd MMMM yyyy', { locale: it })}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {dayShifts.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                Nessun turno per questo giorno
              </p>
            ) : (
              dayShifts.map(shift => {
                const hours = calculateHours(shift.start_time, shift.end_time);
                const isOwnShift = shift.assigned_to_user_id === user?.id;
                const canEdit = isAdmin || isOwnShift;

                return (
                  <div
                    key={shift.id}
                    className={cn(
                      'p-3 rounded-lg border-l-4 bg-card',
                      isOwnShift ? 'border-l-primary' : 'border-l-muted-foreground'
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">
                            {getUserDisplay(shift.assigned_to_user_id, shift.profile)}
                          </span>
                          {isOwnShift && (
                            <Badge variant="outline" className="text-xs">Tu</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>
                            {shift.start_time.slice(0, 5)} - {shift.end_time.slice(0, 5)}
                          </span>
                          <span>•</span>
                          <span>{formatHours(hours)}</span>
                        </div>
                        {shift.notes && (
                          <p className="text-sm text-muted-foreground mt-1">{shift.notes}</p>
                        )}
                      </div>
                      {canEdit && (
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => handleEditShift(shift)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          {isAdmin && (
                            <Button size="icon" variant="ghost" onClick={() => handleDeleteShift(shift.id)}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {isAdmin && (
            <DialogFooter>
              <Button onClick={() => handleAddShift(selectedDay || undefined)}>
                <Plus className="w-4 h-4 mr-2" />
                Aggiungi Turno
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Add/Edit Shift Modal (Admin only) */}
      {isAdmin && (
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingShiftId ? 'Modifica Turno' : 'Aggiungi Turno'}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="user">Assegna a</Label>
                <Select
                  value={formData.assigned_to_user_id}
                  onValueChange={value => setFormData({ ...formData, assigned_to_user_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona utente" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeUsers.map(u => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.full_name || u.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

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
                <Button type="submit" disabled={!formData.assigned_to_user_id}>
                  {editingShiftId ? 'Salva Modifiche' : 'Aggiungi Turno'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
