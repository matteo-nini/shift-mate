import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth, eachMonthOfInterval } from 'date-fns';
import { it } from 'date-fns/locale';
import { calculateHours } from '@/lib/shiftUtils';

interface Shift {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: 'pending' | 'paid' | null;
}

interface MonthlyChartsProps {
  shifts: Shift[];
  weeklyContract: number;
  hourlyRate: number;
  extraRate: number;
}

const chartConfig = {
  hours: { label: 'Ore', color: 'hsl(var(--primary))' },
  earnings: { label: 'Guadagni', color: 'hsl(var(--success))' },
  contract: { label: 'Contratto', color: 'hsl(var(--primary))' },
  extra: { label: 'Extra', color: 'hsl(var(--accent))' },
  paid: { label: 'Pagato', color: 'hsl(var(--success))' },
  pending: { label: 'In attesa', color: 'hsl(var(--warning))' },
};

export function MonthlyCharts({ shifts, weeklyContract, hourlyRate, extraRate }: MonthlyChartsProps) {
  const now = new Date();

  // Generate last 6 months data
  const monthlyData = useMemo(() => {
    const months = eachMonthOfInterval({
      start: subMonths(startOfMonth(now), 5),
      end: startOfMonth(now),
    });

    return months.map(month => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);

      const monthShifts = shifts.filter(s => {
        const shiftDate = new Date(s.date);
        return shiftDate >= monthStart && shiftDate <= monthEnd;
      });

      const totalHours = monthShifts.reduce((sum, s) => sum + calculateHours(s.start_time, s.end_time), 0);
      const monthlyContractHours = weeklyContract * 4;
      const contractHours = Math.min(totalHours, monthlyContractHours);
      const extraHours = Math.max(0, totalHours - contractHours);

      const contractEarnings = contractHours * hourlyRate;
      const extraEarnings = extraHours * extraRate;

      return {
        month: format(month, 'MMM', { locale: it }),
        fullMonth: format(month, 'MMMM yyyy', { locale: it }),
        hours: Math.round(totalHours * 10) / 10,
        contractHours: Math.round(contractHours * 10) / 10,
        extraHours: Math.round(extraHours * 10) / 10,
        earnings: Math.round((contractEarnings + extraEarnings) * 100) / 100,
        contractEarnings: Math.round(contractEarnings * 100) / 100,
        extraEarnings: Math.round(extraEarnings * 100) / 100,
        shifts: monthShifts.length,
      };
    });
  }, [shifts, weeklyContract, hourlyRate, extraRate]);

  // Current month payment status
  const paymentData = useMemo(() => {
    const currentMonthShifts = shifts.filter(s => {
      const shiftDate = new Date(s.date);
      return shiftDate >= startOfMonth(now) && shiftDate <= endOfMonth(now);
    });

    const paid = currentMonthShifts.filter(s => s.status === 'paid').length;
    const pending = currentMonthShifts.filter(s => s.status !== 'paid').length;

    return [
      { name: 'Pagato', value: paid, color: 'hsl(var(--success))' },
      { name: 'In attesa', value: pending, color: 'hsl(var(--warning))' },
    ].filter(d => d.value > 0);
  }, [shifts]);

  // Calculate comparison with previous month
  const comparison = useMemo(() => {
    if (monthlyData.length < 2) return null;
    const current = monthlyData[monthlyData.length - 1];
    const previous = monthlyData[monthlyData.length - 2];

    const hoursChange = previous.hours > 0
      ? Math.round(((current.hours - previous.hours) / previous.hours) * 100)
      : 0;
    const earningsChange = previous.earnings > 0
      ? Math.round(((current.earnings - previous.earnings) / previous.earnings) * 100)
      : 0;

    return { hoursChange, earningsChange };
  }, [monthlyData]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Hours Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium flex items-center justify-between">
            <span>Trend Ore Mensili</span>
            {comparison && (
              <span className={`text-sm ${comparison.hoursChange >= 0 ? 'text-success' : 'text-destructive'}`}>
                {comparison.hoursChange >= 0 ? '+' : ''}{comparison.hoursChange}% vs mese scorso
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[250px]">
            <BarChart data={monthlyData}>
              <XAxis dataKey="month" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <ChartTooltip 
                content={<ChartTooltipContent />} 
                formatter={(value, name) => [`${value} ore`, name === 'contractHours' ? 'Contratto' : 'Extra']}
              />
              <Bar dataKey="contractHours" stackId="a" fill="hsl(var(--primary))" radius={[0, 0, 4, 4]} name="Contratto" />
              <Bar dataKey="extraHours" stackId="a" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} name="Extra" />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Earnings Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium flex items-center justify-between">
            <span>Trend Guadagni</span>
            {comparison && (
              <span className={`text-sm ${comparison.earningsChange >= 0 ? 'text-success' : 'text-destructive'}`}>
                {comparison.earningsChange >= 0 ? '+' : ''}{comparison.earningsChange}% vs mese scorso
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[250px]">
            <LineChart data={monthlyData}>
              <XAxis dataKey="month" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `€${v}`} />
              <ChartTooltip 
                content={<ChartTooltipContent />}
                formatter={(value) => [`€${value}`, 'Guadagni']}
              />
              <Line 
                type="monotone" 
                dataKey="earnings" 
                stroke="hsl(var(--success))" 
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--success))' }}
                name="Guadagni"
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Payment Status Pie */}
      {paymentData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium">Stato Pagamenti Mese</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px]">
              <PieChart>
                <Pie
                  data={paymentData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {paymentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Legend />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Monthly Summary Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium">Riepilogo Ultimi 6 Mesi</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {monthlyData.slice().reverse().map((month, idx) => (
              <div 
                key={month.month}
                className={`flex items-center justify-between p-3 rounded-lg ${idx === 0 ? 'bg-primary/10 border border-primary/20' : 'bg-muted/50'}`}
              >
                <div>
                  <p className="font-medium capitalize">{month.fullMonth}</p>
                  <p className="text-sm text-muted-foreground">{month.shifts} turni</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">{month.hours}h</p>
                  <p className="text-sm text-success">€{month.earnings.toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
