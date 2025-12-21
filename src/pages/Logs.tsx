import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { format, parseISO, subDays } from 'date-fns';
import { it } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  FileText,
  Users,
  Calendar,
  Edit,
  Trash2,
  Plus,
  Search,
  Clock,
  UserCog,
} from 'lucide-react';

interface ChangeLog {
  id: string;
  user_id: string | null;
  action: string;
  details: string;
  created_at: string | null;
}

interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  details: string | null;
  performed_by_user_id: string | null;
  created_at: string | null;
}

interface Profile {
  id: string;
  username: string;
  full_name: string | null;
}

export function Logs() {
  const [changeLogs, setChangeLogs] = useState<ChangeLog[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const [changeLogsRes, auditLogsRes, profilesRes] = await Promise.all([
          supabase
            .from('change_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100),
          supabase
            .from('user_audit_log')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100),
          supabase
            .from('profiles')
            .select('id, username, full_name'),
        ]);

        if (changeLogsRes.error) throw changeLogsRes.error;
        if (auditLogsRes.error) throw auditLogsRes.error;
        if (profilesRes.error) throw profilesRes.error;

        setChangeLogs(changeLogsRes.data || []);
        setAuditLogs(auditLogsRes.data || []);
        setProfiles(profilesRes.data || []);
      } catch (err) {
        console.error('Error fetching logs:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, []);

  const getProfileName = (userId: string | null) => {
    if (!userId) return 'Sistema';
    const profile = profiles.find(p => p.id === userId);
    return profile?.full_name || profile?.username || 'Sconosciuto';
  };

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case 'add':
      case 'create':
      case 'insert':
        return <Plus className="w-4 h-4" />;
      case 'edit':
      case 'update':
        return <Edit className="w-4 h-4" />;
      case 'delete':
      case 'remove':
        return <Trash2 className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action.toLowerCase()) {
      case 'add':
      case 'create':
      case 'insert':
        return 'text-shift-contract bg-shift-contract/10';
      case 'edit':
      case 'update':
        return 'text-primary bg-primary/10';
      case 'delete':
      case 'remove':
        return 'text-destructive bg-destructive/10';
      default:
        return 'text-muted-foreground bg-muted';
    }
  };

  const formatTimestamp = (timestamp: string | null) => {
    if (!timestamp) return '-';
    try {
      const date = parseISO(timestamp);
      return format(date, "d MMM yyyy 'alle' HH:mm", { locale: it });
    } catch {
      return timestamp;
    }
  };

  const filteredChangeLogs = useMemo(() => {
    if (!searchTerm) return changeLogs;
    const term = searchTerm.toLowerCase();
    return changeLogs.filter(log =>
      log.details.toLowerCase().includes(term) ||
      log.action.toLowerCase().includes(term)
    );
  }, [changeLogs, searchTerm]);

  const filteredAuditLogs = useMemo(() => {
    if (!searchTerm) return auditLogs;
    const term = searchTerm.toLowerCase();
    return auditLogs.filter(log =>
      (log.details?.toLowerCase().includes(term)) ||
      log.action.toLowerCase().includes(term)
    );
  }, [auditLogs, searchTerm]);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[500px]" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Logs</h1>
          <p className="text-muted-foreground">Cronologia delle modifiche e azioni</p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cerca nei log..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="p-3 bg-primary/10 rounded-xl">
                <Calendar className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Modifiche Calendario</p>
                <p className="text-2xl font-bold">{changeLogs.length}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="p-3 bg-shift-extra/10 rounded-xl">
                <UserCog className="w-6 h-6 text-shift-extra" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Azioni Utenti</p>
                <p className="text-2xl font-bold">{auditLogs.length}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="calendar" className="space-y-4">
        <TabsList>
          <TabsTrigger value="calendar" className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Modifiche Calendario
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Audit Utenti
          </TabsTrigger>
        </TabsList>

        {/* Calendar Changes Tab */}
        <TabsContent value="calendar">
          <Card>
            <CardHeader>
              <CardTitle>Cronologia Modifiche Calendario</CardTitle>
              <CardDescription>
                Tutte le modifiche apportate al calendario globale
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredChangeLogs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nessun log trovato</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredChangeLogs.map((log, idx) => (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.02 }}
                      className="flex items-start gap-4 p-4 rounded-lg bg-muted/30 border"
                    >
                      <div className={cn(
                        'p-2 rounded-lg',
                        getActionColor(log.action)
                      )}>
                        {getActionIcon(log.action)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="capitalize">
                            {log.action}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            da {getProfileName(log.user_id)}
                          </span>
                        </div>
                        <p className="text-sm">{log.details}</p>
                        <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {formatTimestamp(log.created_at)}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* User Audit Tab */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>Audit Log Utenti</CardTitle>
              <CardDescription>
                Tracciamento azioni sugli account utente
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredAuditLogs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nessun log trovato</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredAuditLogs.map((log, idx) => (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.02 }}
                      className="flex items-start gap-4 p-4 rounded-lg bg-muted/30 border"
                    >
                      <div className={cn(
                        'p-2 rounded-lg',
                        getActionColor(log.action)
                      )}>
                        {getActionIcon(log.action)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="capitalize">
                            {log.action}
                          </Badge>
                          <span className="text-sm font-medium">
                            Utente: {getProfileName(log.user_id)}
                          </span>
                        </div>
                        {log.details && (
                          <p className="text-sm text-muted-foreground">{log.details}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {formatTimestamp(log.created_at)}
                          {log.performed_by_user_id && (
                            <>
                              <span>•</span>
                              <span>Eseguito da: {getProfileName(log.performed_by_user_id)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
