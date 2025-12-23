import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useShifts } from '@/hooks/useShifts';
import { useUserSettings, useSystemSettings } from '@/hooks/useUserSettings';
import { useSyncShifts } from '@/hooks/useSyncShifts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, TrendingUp, Wallet, Zap, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useMemo } from 'react';
import { calculateHours, formatHours, formatCurrency, getShiftsForMonth, getShiftsForWeek } from '@/lib/shiftUtils';
import { parseISO } from 'date-fns';

export function Dashboard() {
  const { user } = useAuth();
  const { shifts, loading: shiftsLoading, refetch } = useShifts();
  const { settings: userSettings, loading: settingsLoading } = useUserSettings();
  const { settings: systemSettings } = useSystemSettings();
  const [showEarnings, setShowEarnings] = useState(true);
  
  // Sync shifts on login
  useSyncShifts();

  const loading = shiftsLoading || settingsLoading;

  const stats = useMemo(() => {
    const now = new Date();
    const weekShifts = getShiftsForWeek(shifts, now);
    const monthShifts = getShiftsForMonth(shifts, now.getFullYear(), now.getMonth());

    const weeklyHours = weekShifts.reduce((sum, s) => sum + calculateHours(s.start_time, s.end_time), 0);
    const monthlyHours = monthShifts.reduce((sum, s) => sum + calculateHours(s.start_time, s.end_time), 0);

    const weeklyContract = userSettings?.weekly_hours ? Number(userSettings.weekly_hours) : 18;
    const hourlyRate = userSettings?.use_custom_rates && userSettings?.custom_hourly_rate
      ? Number(userSettings.custom_hourly_rate)
      : Number(systemSettings.default_hourly_rate || 10);
    const extraRate = userSettings?.extra_rate ? Number(userSettings.extra_rate) : 10;

    const contractHours = Math.min(monthlyHours, weeklyContract * 4);
    const extraHours = Math.max(0, monthlyHours - contractHours);

    const contractEarnings = contractHours * hourlyRate;
    const extraEarnings = extraHours * extraRate;

    return {
      weeklyHours,
      monthlyHours,
      weeklyContract,
      contractEarnings,
      extraEarnings,
      progress: Math.min(100, (weeklyHours / weeklyContract) * 100),
    };
  }, [shifts, userSettings, systemSettings]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Bentornato! Ecco il riepilogo della tua attività.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowEarnings(!showEarnings)}
          className="gap-2"
        >
          {showEarnings ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          {showEarnings ? 'Nascondi' : 'Mostra'} guadagni
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
        >
          <Card className="stat-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Ore Settimana
              </CardTitle>
              <Clock className="w-4 h-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-display">
                {formatHours(stats.weeklyHours)}
              </div>
              <div className="mt-2">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Progresso</span>
                  <span>{stats.weeklyContract}h obiettivo</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${stats.progress}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className="h-full bg-primary rounded-full"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="stat-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Ore Mese
              </CardTitle>
              <TrendingUp className="w-4 h-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-display">
                {formatHours(stats.monthlyHours)}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {shifts.length} turni questo mese
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="stat-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Guadagno Busta
              </CardTitle>
              <Wallet className="w-4 h-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold font-display ${!showEarnings && 'blur-value'}`}>
                {formatCurrency(stats.contractEarnings)}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Ore contratto mese
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="stat-card border-accent/30">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Guadagno Extra
              </CardTitle>
              <Zap className="w-4 h-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold font-display text-accent ${!showEarnings && 'blur-value'}`}>
                {formatCurrency(stats.extraEarnings)}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Ore extra mese
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Recent Shifts */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display">Turni Recenti</CardTitle>
        </CardHeader>
        <CardContent>
          {shifts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nessun turno registrato. Inizia ad aggiungere i tuoi turni!
            </p>
          ) : (
            <div className="space-y-3">
              {shifts.slice(0, 5).map((shift) => (
                <div
                  key={shift.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-secondary/50"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{new Date(shift.date + 'T00:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                      <p className="text-sm text-muted-foreground">
                        {shift.start_time.slice(0, 5)} - {shift.end_time.slice(0, 5)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatHours(calculateHours(shift.start_time, shift.end_time))}</p>
                    <span className={shift.status === 'paid' ? 'status-badge-paid' : 'status-badge-pending'}>
                      {shift.status === 'paid' ? 'Pagato' : 'In attesa'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
