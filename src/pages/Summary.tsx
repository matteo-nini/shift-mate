import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { format, startOfMonth, endOfMonth, subMonths, parseISO, isWithinInterval } from 'date-fns';
import { it } from 'date-fns/locale';
import { useShifts } from '@/hooks/useShifts';
import { useUserSettings, useSystemSettings } from '@/hooks/useUserSettings';
import {
  calculateHours,
  formatHours,
  formatCurrency,
  formatDate,
  calculateShiftType,
  calculateEarnings,
} from '@/lib/shiftUtils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { cn } from '@/lib/utils';
import {
  Calendar,
  Clock,
  DollarSign,
  TrendingUp,
  Edit,
  Trash2,
  CheckCircle,
  AlertCircle,
  Filter,
} from 'lucide-react';
import { toast } from 'sonner';

interface ShiftFormData {
  date: string;
  start_time: string;
  end_time: string;
  notes: string;
}

export function Summary() {
  const { shifts, loading: shiftsLoading, updateShift, deleteShift } = useShifts();
  const { settings: userSettings, loading: userSettingsLoading } = useUserSettings();
  const { settings: systemSettings, loading: systemLoading } = useSystemSettings();

  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [editingShift, setEditingShift] = useState<string | null>(null);
  const [formData, setFormData] = useState<ShiftFormData>({
    date: '',
    start_time: '',
    end_time: '',
    notes: '',
  });

  // Generate month options
  const monthOptions = useMemo(() => {
    const options = [{ value: 'all', label: 'Tutti i mesi' }];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = subMonths(now, i);
      options.push({
        value: format(date, 'yyyy-MM'),
        label: format(date, 'MMMM yyyy', { locale: it }),
      });
    }
    return options;
  }, []);

  // Filter shifts by selected month
  const filteredShifts = useMemo(() => {
    if (selectedMonth === 'all') return shifts;

    const [year, month] = selectedMonth.split('-').map(Number);
    const monthStart = startOfMonth(new Date(year, month - 1));
    const monthEnd = endOfMonth(monthStart);

    return shifts.filter(shift => {
      const shiftDate = parseISO(shift.date);
      return isWithinInterval(shiftDate, { start: monthStart, end: monthEnd });
    });
  }, [shifts, selectedMonth]);

  // Calculate statistics
  const stats = useMemo(() => {
    let totalHours = 0;
    let contractHours = 0;
    let extraHours = 0;
    let paidContract = 0;
    let unpaidContract = 0;
    let paidExtra = 0;
    let unpaidExtra = 0;

    const paymentMethod = systemSettings.payment_method || 'hourly';
    const hourlyRate = userSettings?.use_custom_rates && userSettings?.custom_hourly_rate
      ? userSettings.custom_hourly_rate
      : parseFloat(systemSettings.default_hourly_rate) || 10;
    const shiftRate = userSettings?.use_custom_rates && userSettings?.custom_shift_rate
      ? userSettings.custom_shift_rate
      : parseFloat(systemSettings.default_shift_rate) || 50;
    const extraRate = userSettings?.extra_rate || 10;

    filteredShifts.forEach(shift => {
      const hours = calculateHours(shift.start_time, shift.end_time);
      totalHours += hours;

      const type = calculateShiftType(
        { date: shift.date, start_time: shift.start_time, end_time: shift.end_time },
        shifts.map(s => ({ date: s.date, start_time: s.start_time, end_time: s.end_time })),
        userSettings?.weekly_hours || 18,
        userSettings?.contract_start_date || null
      );

      if (type === 'contract') {
        contractHours += hours;
        const earnings = paymentMethod === 'hourly' ? hours * hourlyRate : shiftRate;
        if (shift.status === 'paid') paidContract += earnings;
        else unpaidContract += earnings;
      } else {
        extraHours += hours;
        const earnings = hours * extraRate;
        if (shift.status === 'paid') paidExtra += earnings;
        else unpaidExtra += earnings;
      }
    });

    return {
      totalShifts: filteredShifts.length,
      totalHours,
      contractHours,
      extraHours,
      contractEarnings: paidContract + unpaidContract,
      extraEarnings: paidExtra + unpaidExtra,
      totalEarnings: paidContract + unpaidContract + paidExtra + unpaidExtra,
      paidContract,
      unpaidContract,
      paidExtra,
      unpaidExtra,
    };
  }, [filteredShifts, shifts, userSettings, systemSettings]);

  const getShiftType = (shift: { date: string; start_time: string; end_time: string }) => {
    return calculateShiftType(
      shift,
      shifts.map(s => ({ date: s.date, start_time: s.start_time, end_time: s.end_time })),
      userSettings?.weekly_hours || 18,
      userSettings?.contract_start_date || null
    );
  };

  const handleToggleStatus = async (shift: typeof shifts[0]) => {
    const newStatus = shift.status === 'paid' ? 'pending' : 'paid';
    await updateShift(shift.id, { status: newStatus });
    toast.success(`Stato aggiornato a ${newStatus === 'paid' ? 'Pagato' : 'In attesa'}`);
  };

  const handleEditShift = (shift: typeof shifts[0]) => {
    setFormData({
      date: shift.date,
      start_time: shift.start_time.slice(0, 5),
      end_time: shift.end_time.slice(0, 5),
      notes: shift.notes || '',
    });
    setEditingShift(shift.id);
  };

  const handleSaveEdit = async () => {
    if (!editingShift) return;
    await updateShift(editingShift, {
      date: formData.date,
      start_time: formData.start_time,
      end_time: formData.end_time,
      notes: formData.notes || null,
    });
    setEditingShift(null);
  };

  const handleDeleteShift = async (id: string) => {
    await deleteShift(id);
  };

  const loading = shiftsLoading || userSettingsLoading || systemLoading;

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Riepilogo</h1>
          <p className="text-muted-foreground">Statistiche e dettagli dei tuoi turni</p>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Seleziona mese" />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="p-3 bg-primary/10 rounded-xl">
                <Calendar className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Turni Totali</p>
                <p className="text-2xl font-bold">{stats.totalShifts}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="p-3 bg-muted rounded-xl">
                <Clock className="w-6 h-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ore Totali</p>
                <p className="text-2xl font-bold">{formatHours(stats.totalHours)}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="p-3 bg-shift-contract/10 rounded-xl">
                <TrendingUp className="w-6 h-6 text-shift-contract" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ore Contratto</p>
                <p className="text-2xl font-bold">{formatHours(stats.contractHours)}</p>
                <p className="text-xs text-shift-contract">{formatCurrency(stats.contractEarnings)}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="p-3 bg-shift-extra/10 rounded-xl">
                <DollarSign className="w-6 h-6 text-shift-extra" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ore Extra</p>
                <p className="text-2xl font-bold">{formatHours(stats.extraHours)}</p>
                <p className="text-xs text-shift-extra">{formatCurrency(stats.extraEarnings)}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Payment Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-shift-contract/5 border-shift-contract/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-shift-contract" />
              <span className="text-sm font-medium">Pagato Busta</span>
            </div>
            <p className="text-xl font-bold text-shift-contract">{formatCurrency(stats.paidContract)}</p>
          </CardContent>
        </Card>

        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Da Ricevere Busta</span>
            </div>
            <p className="text-xl font-bold">{formatCurrency(stats.unpaidContract)}</p>
          </CardContent>
        </Card>

        <Card className="bg-shift-extra/5 border-shift-extra/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-shift-extra" />
              <span className="text-sm font-medium">Extra Pagati</span>
            </div>
            <p className="text-xl font-bold text-shift-extra">{formatCurrency(stats.paidExtra)}</p>
          </CardContent>
        </Card>

        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Extra da Ricevere</span>
            </div>
            <p className="text-xl font-bold">{formatCurrency(stats.unpaidExtra)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Total Earnings */}
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Guadagno Totale Stimato</p>
              <p className="text-3xl font-bold text-primary">{formatCurrency(stats.totalEarnings)}</p>
            </div>
            <DollarSign className="w-12 h-12 text-primary/30" />
          </div>
        </CardContent>
      </Card>

      {/* Shifts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Dettaglio Turni</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredShifts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nessun turno nel periodo selezionato</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Entrata</TableHead>
                    <TableHead>Uscita</TableHead>
                    <TableHead>Ore</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead className="text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredShifts
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map(shift => {
                      const type = getShiftType(shift);
                      const hours = calculateHours(shift.start_time, shift.end_time);

                      return (
                        <TableRow key={shift.id}>
                          <TableCell className="font-medium">{formatDate(shift.date)}</TableCell>
                          <TableCell>{shift.start_time.slice(0, 5)}</TableCell>
                          <TableCell>{shift.end_time.slice(0, 5)}</TableCell>
                          <TableCell>{formatHours(hours)}</TableCell>
                          <TableCell>
                            <Badge
                              variant={type === 'contract' ? 'default' : 'secondary'}
                              className={cn(
                                type === 'contract'
                                  ? 'bg-shift-contract/20 text-shift-contract hover:bg-shift-contract/30'
                                  : 'bg-shift-extra/20 text-shift-extra hover:bg-shift-extra/30'
                              )}
                            >
                              {type === 'contract' ? 'Contratto' : 'Extra'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleStatus(shift)}
                              className={cn(
                                'h-auto py-1 px-2',
                                shift.status === 'paid'
                                  ? 'text-shift-contract'
                                  : 'text-muted-foreground'
                              )}
                            >
                              <Badge
                                variant={shift.status === 'paid' ? 'default' : 'outline'}
                                className={cn(
                                  shift.status === 'paid'
                                    ? 'bg-shift-contract/20 text-shift-contract'
                                    : ''
                                )}
                              >
                                {shift.status === 'paid' ? 'Pagato' : 'In attesa'}
                              </Badge>
                            </Button>
                          </TableCell>
                          <TableCell className="max-w-[150px] truncate">
                            {shift.notes || '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button size="icon" variant="ghost" onClick={() => handleEditShift(shift)}>
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => handleDeleteShift(shift.id)}>
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Modal */}
      <Dialog open={!!editingShift} onOpenChange={() => setEditingShift(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifica Turno</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-date">Data</Label>
              <Input
                id="edit-date"
                type="date"
                value={formData.date}
                onChange={e => setFormData({ ...formData, date: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-start">Ora Inizio</Label>
                <Input
                  id="edit-start"
                  type="time"
                  value={formData.start_time}
                  onChange={e => setFormData({ ...formData, start_time: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-end">Ora Fine</Label>
                <Input
                  id="edit-end"
                  type="time"
                  value={formData.end_time}
                  onChange={e => setFormData({ ...formData, end_time: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="edit-notes">Note</Label>
              <Textarea
                id="edit-notes"
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingShift(null)}>
              Annulla
            </Button>
            <Button onClick={handleSaveEdit}>Salva</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
