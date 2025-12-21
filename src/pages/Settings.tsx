import { useState } from 'react';
import { motion } from 'framer-motion';
import { format, subMonths, startOfMonth, endOfMonth, parseISO, isWithinInterval } from 'date-fns';
import { it } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { useUserSettings, useSystemSettings } from '@/hooks/useUserSettings';
import { useShifts } from '@/hooks/useShifts';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency, calculateHours, calculateShiftType } from '@/lib/shiftUtils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Settings as SettingsIcon,
  FileText,
  Key,
  Trash2,
  Save,
  Calculator,
  AlertTriangle,
} from 'lucide-react';

export function Settings() {
  const { user, signOut } = useAuth();
  const { settings, loading: settingsLoading, updateSettings } = useUserSettings();
  const { settings: systemSettings, loading: systemLoading } = useSystemSettings();
  const { shifts, updateShift } = useShifts();

  const [contractStartDate, setContractStartDate] = useState(settings?.contract_start_date || '');
  const [weeklyHours, setWeeklyHours] = useState(settings?.weekly_hours?.toString() || '18');
  const [extraRate, setExtraRate] = useState(settings?.extra_rate?.toString() || '10');
  
  const [isPayslipOpen, setIsPayslipOpen] = useState(false);
  const [payslipMonth, setPayslipMonth] = useState('');
  const [payslipHours, setPayslipHours] = useState('');
  const [payslipAmount, setPayslipAmount] = useState('');

  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [isSaving, setIsSaving] = useState(false);

  // Generate month options for payslip
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const date = subMonths(new Date(), i);
    return {
      value: format(date, 'yyyy-MM'),
      label: format(date, 'MMMM yyyy', { locale: it }),
    };
  });

  const canEditRates = systemSettings.users_can_edit_rates !== '0';

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      await updateSettings({
        contract_start_date: contractStartDate || null,
        weekly_hours: parseFloat(weeklyHours) || 18,
        extra_rate: parseFloat(extraRate) || 10,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegisterPayslip = async () => {
    if (!payslipMonth || !payslipHours || !payslipAmount) {
      toast.error('Compila tutti i campi');
      return;
    }

    const hours = parseFloat(payslipHours);
    const amount = parseFloat(payslipAmount);
    
    if (hours <= 0 || amount <= 0) {
      toast.error('Valori non validi');
      return;
    }

    const calculatedRate = amount / hours;

    // Get shifts for that month and mark them as paid
    const [year, month] = payslipMonth.split('-').map(Number);
    const monthStart = startOfMonth(new Date(year, month - 1));
    const monthEnd = endOfMonth(monthStart);

    const monthShifts = shifts.filter(shift => {
      const shiftDate = parseISO(shift.date);
      const isInMonth = isWithinInterval(shiftDate, { start: monthStart, end: monthEnd });
      if (!isInMonth) return false;

      // Only mark contract shifts as paid
      const type = calculateShiftType(
        { date: shift.date, start_time: shift.start_time, end_time: shift.end_time },
        shifts.map(s => ({ date: s.date, start_time: s.start_time, end_time: s.end_time })),
        settings?.weekly_hours || 18,
        settings?.contract_start_date || null
      );
      return type === 'contract';
    });

    // Update all contract shifts to paid
    for (const shift of monthShifts) {
      await updateShift(shift.id, { status: 'paid' });
    }

    // Update custom hourly rate
    await updateSettings({
      custom_hourly_rate: calculatedRate,
      use_custom_rates: true,
    });

    toast.success(`Busta registrata! Nuova tariffa: ${formatCurrency(calculatedRate)}/h`);
    setIsPayslipOpen(false);
    setPayslipMonth('');
    setPayslipHours('');
    setPayslipAmount('');
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error('Le password non corrispondono');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('La password deve essere almeno 6 caratteri');
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast.success('Password aggiornata con successo');
      setIsPasswordOpen(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.message || 'Errore nel cambio password');
    }
  };

  const handleDeleteProfile = async () => {
    try {
      // Sign out will trigger cleanup
      await signOut();
      toast.success('Profilo eliminato');
    } catch (err: any) {
      toast.error(err.message || 'Errore nella cancellazione');
    }
  };

  const loading = settingsLoading || systemLoading;

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6">
          <Skeleton className="h-[200px]" />
          <Skeleton className="h-[150px]" />
          <Skeleton className="h-[150px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Impostazioni</h1>
        <p className="text-muted-foreground">Configura il tuo profilo e contratto</p>
      </div>

      {/* Contract Settings */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SettingsIcon className="w-5 h-5" />
              Informazioni Contratto
            </CardTitle>
            <CardDescription>
              Configura i parametri del tuo contratto lavorativo
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contract_start">Data Inizio Contratto</Label>
                <Input
                  id="contract_start"
                  type="date"
                  value={contractStartDate}
                  onChange={e => setContractStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="weekly_hours">Ore Settimanali</Label>
                <Input
                  id="weekly_hours"
                  type="number"
                  step="0.5"
                  value={weeklyHours}
                  onChange={e => setWeeklyHours(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="extra_rate">Tariffa Ore Extra (€/h)</Label>
              <Input
                id="extra_rate"
                type="number"
                step="0.01"
                value={extraRate}
                onChange={e => setExtraRate(e.target.value)}
                disabled={!canEditRates}
              />
              {!canEditRates && (
                <p className="text-xs text-muted-foreground">
                  Le tariffe sono gestite dall'amministratore
                </p>
              )}
            </div>

            <Button onClick={handleSaveSettings} disabled={isSaving}>
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? 'Salvataggio...' : 'Salva Impostazioni'}
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      {/* Register Payslip */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Registra Busta Paga
            </CardTitle>
            <CardDescription>
              Inserisci i dati della busta per calcolare la tua tariffa reale
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setIsPayslipOpen(true)}>
              <Calculator className="w-4 h-4 mr-2" />
              Registra Busta Paga
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      {/* Change Password */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              Sicurezza
            </CardTitle>
            <CardDescription>
              Gestisci la password del tuo account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => setIsPasswordOpen(true)}>
              <Key className="w-4 h-4 mr-2" />
              Cambia Password
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      {/* Danger Zone */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Zona Pericolosa
            </CardTitle>
            <CardDescription>
              Azioni irreversibili sul tuo account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Elimina Profilo
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Sei sicuro?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Questa azione è irreversibile. Verranno eliminati tutti i tuoi dati,
                    inclusi turni, impostazioni e cronologia.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annulla</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteProfile} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Elimina Profilo
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </motion.div>

      {/* Payslip Modal */}
      <Dialog open={isPayslipOpen} onOpenChange={setIsPayslipOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registra Busta Paga</DialogTitle>
            <DialogDescription>
              Inserisci i dati dalla tua busta paga per calcolare la tariffa oraria effettiva
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Mese</Label>
              <Select value={payslipMonth} onValueChange={setPayslipMonth}>
                <SelectTrigger>
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

            <div className="space-y-2">
              <Label htmlFor="payslip_hours">Ore Lavorate (dalla busta)</Label>
              <Input
                id="payslip_hours"
                type="number"
                step="0.5"
                placeholder="es. 72"
                value={payslipHours}
                onChange={e => setPayslipHours(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payslip_amount">Importo Netto (€)</Label>
              <Input
                id="payslip_amount"
                type="number"
                step="0.01"
                placeholder="es. 650.00"
                value={payslipAmount}
                onChange={e => setPayslipAmount(e.target.value)}
              />
            </div>

            {payslipHours && payslipAmount && parseFloat(payslipHours) > 0 && (
              <div className="p-4 bg-primary/10 rounded-lg">
                <p className="text-sm text-muted-foreground">Tariffa calcolata:</p>
                <p className="text-2xl font-bold text-primary">
                  {formatCurrency(parseFloat(payslipAmount) / parseFloat(payslipHours))}/h
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPayslipOpen(false)}>
              Annulla
            </Button>
            <Button onClick={handleRegisterPayslip}>
              Registra
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Modal */}
      <Dialog open={isPasswordOpen} onOpenChange={setIsPasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambia Password</DialogTitle>
            <DialogDescription>
              Inserisci una nuova password per il tuo account
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new_password">Nuova Password</Label>
              <Input
                id="new_password"
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm_password">Conferma Password</Label>
              <Input
                id="confirm_password"
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPasswordOpen(false)}>
              Annulla
            </Button>
            <Button onClick={handleChangePassword}>
              Aggiorna Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
