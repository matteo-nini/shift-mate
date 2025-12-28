import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useUsers } from '@/hooks/useUsers';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { formatDate, formatCurrency } from '@/lib/shiftUtils';
import { parseShiftsCSV, generateSampleCSV, ParsedShift } from '@/lib/csvUtils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
  Users,
  Settings,
  Edit,
  Trash2,
  DollarSign,
  UserCheck,
  Clock,
  Shield,
  Save,
  UserPlus,
  Upload,
  Download,
  AlertCircle,
  CheckCircle,
  Loader2,
  Building2,
  Palette,
} from 'lucide-react';
import { Database } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type UserRole = Database['public']['Enums']['user_role'];

interface EditUserData {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  contract_start_date: string;
  weekly_hours: number;
  extra_rate: number;
  use_custom_rates: boolean;
  custom_hourly_rate: number | null;
  custom_shift_rate: number | null;
}

interface NewUserData {
  email: string;
  password: string;
  username: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
}

export function AdminPanel() {
  const { users, loading: usersLoading, updateUser, deleteUser, refetch } = useUsers();
  const { settings, loading: settingsLoading, updateMultipleSettings } = useSystemSettings();
  
  const [editingUser, setEditingUser] = useState<EditUserData | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [pendingSettings, setPendingSettings] = useState(settings);
  
  // New user state
  const [isNewUserModalOpen, setIsNewUserModalOpen] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [newUser, setNewUser] = useState<NewUserData>({
    email: '',
    password: '',
    username: '',
    fullName: '',
    role: 'user',
    isActive: true,
  });

  // CSV import state
  const [isCSVModalOpen, setIsCSVModalOpen] = useState(false);
  const [csvShifts, setCsvShifts] = useState<ParsedShift[]>([]);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update pending settings when loaded
  useEffect(() => {
    if (!settingsLoading) {
      setPendingSettings(settings);
    }
  }, [settings, settingsLoading]);

  const handleEditUser = (user: typeof users[0]) => {
    setEditingUser({
      id: user.id,
      full_name: user.full_name || '',
      email: user.email || '',
      role: user.role || 'user',
      is_active: user.is_active ?? true,
      contract_start_date: user.settings?.contract_start_date || '',
      weekly_hours: user.settings?.weekly_hours || 18,
      extra_rate: user.settings?.extra_rate || 10,
      use_custom_rates: user.settings?.use_custom_rates || false,
      custom_hourly_rate: user.settings?.custom_hourly_rate || null,
      custom_shift_rate: user.settings?.custom_shift_rate || null,
    });
    setIsEditModalOpen(true);
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;

    await updateUser(editingUser.id, {
      profile: {
        full_name: editingUser.full_name || null,
        email: editingUser.email || null,
        is_active: editingUser.is_active,
      },
      role: editingUser.role,
      settings: {
        contract_start_date: editingUser.contract_start_date || null,
        weekly_hours: editingUser.weekly_hours,
        extra_rate: editingUser.extra_rate,
        use_custom_rates: editingUser.use_custom_rates,
        custom_hourly_rate: editingUser.custom_hourly_rate,
        custom_shift_rate: editingUser.custom_shift_rate,
      },
    });

    setIsEditModalOpen(false);
    setEditingUser(null);
  };

  const handleDeleteUser = async () => {
    if (!deleteUserId) return;
    await deleteUser(deleteUserId);
    setDeleteUserId(null);
  };

  const handleSaveSettings = async () => {
    await updateMultipleSettings(pendingSettings);
  };

  // Create new user
  const handleCreateUser = async () => {
    if (!newUser.email || !newUser.password || !newUser.username) {
      toast.error('Compila tutti i campi obbligatori');
      return;
    }

    if (newUser.password.length < 6) {
      toast.error('La password deve avere almeno 6 caratteri');
      return;
    }

    setIsCreatingUser(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          email: newUser.email,
          password: newUser.password,
          username: newUser.username,
          fullName: newUser.fullName || null,
          role: newUser.role,
          isActive: newUser.isActive,
        },
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || 'Errore nella creazione utente');
      }

      toast.success('Utente creato con successo');
      setIsNewUserModalOpen(false);
      setNewUser({
        email: '',
        password: '',
        username: '',
        fullName: '',
        role: 'user',
        isActive: true,
      });
      refetch();
    } catch (err) {
      console.error('Error creating user:', err);
      toast.error(err instanceof Error ? err.message : 'Errore nella creazione utente');
    } finally {
      setIsCreatingUser(false);
    }
  };

  // CSV Import handlers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const userMappings = users.map(u => ({
        id: u.id,
        username: u.username,
        full_name: u.full_name,
      }));

      const result = parseShiftsCSV(content, userMappings);
      setCsvShifts(result.shifts);
      setCsvErrors(result.errors);
      setIsCSVModalOpen(true);
    };
    reader.readAsText(file);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDownloadSample = () => {
    const csv = generateSampleCSV();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'esempio_turni.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportCSV = async () => {
    const validShifts = csvShifts.filter(s => s.userId);
    if (validShifts.length === 0) {
      toast.error('Nessun turno valido da importare');
      return;
    }

    setIsImporting(true);

    try {
      const shiftsToInsert = validShifts.map(shift => ({
        assigned_to_user_id: shift.userId!,
        created_by_user_id: shift.userId!, // Will be overwritten by current admin
        date: shift.date,
        start_time: shift.startTime,
        end_time: shift.endTime,
        notes: shift.notes || null,
        status: shift.status,
      }));

      const { error } = await supabase
        .from('global_shifts')
        .insert(shiftsToInsert);

      if (error) throw error;

      toast.success(`${validShifts.length} turni importati con successo`);
      setIsCSVModalOpen(false);
      setCsvShifts([]);
      setCsvErrors([]);
    } catch (err) {
      console.error('Error importing shifts:', err);
      toast.error('Errore nell\'importazione dei turni');
    } finally {
      setIsImporting(false);
    }
  };

  const totalUsers = users.length;
  const activeUsers = users.filter(u => u.is_active).length;

  if (usersLoading || settingsLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Pannello Admin</h1>
          <p className="text-muted-foreground">Gestisci utenti e impostazioni di sistema</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDownloadSample}>
            <Download className="w-4 h-4 mr-2" />
            Esempio CSV
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-4 h-4 mr-2" />
            Importa CSV
          </Button>
          <Button onClick={() => setIsNewUserModalOpen(true)}>
            <UserPlus className="w-4 h-4 mr-2" />
            Nuovo Utente
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="p-3 bg-primary/10 rounded-xl">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Utenti Totali</p>
                <p className="text-2xl font-bold">{totalUsers}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="p-3 bg-success/10 rounded-xl">
                <UserCheck className="w-6 h-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Utenti Attivi</p>
                <p className="text-2xl font-bold">{activeUsers}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="p-3 bg-accent/10 rounded-xl">
                <DollarSign className="w-6 h-6 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tariffa Default</p>
                <p className="text-2xl font-bold">
                  {settings.payment_method === 'hourly'
                    ? formatCurrency(settings.default_hourly_rate) + '/h'
                    : formatCurrency(settings.default_shift_rate) + '/turno'}
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Gestione Utenze
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Impostazioni Sistema
          </TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>Utenti Registrati</CardTitle>
              <CardDescription>Gestisci gli account e le impostazioni degli utenti</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Username</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Ruolo</TableHead>
                      <TableHead>Stato</TableHead>
                      <TableHead>Ore Sett.</TableHead>
                      <TableHead>Data Creazione</TableHead>
                      <TableHead className="text-right">Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map(user => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.username}</TableCell>
                        <TableCell>{user.full_name || '-'}</TableCell>
                        <TableCell>{user.email || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                            {user.role === 'admin' ? 'Admin' : 'Utente'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.is_active ? 'outline' : 'destructive'}>
                            {user.is_active ? 'Attivo' : 'Disabilitato'}
                          </Badge>
                        </TableCell>
                        <TableCell>{user.settings?.weekly_hours || 18}h</TableCell>
                        <TableCell>{formatDate(user.created_at || '')}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" onClick={() => handleEditUser(user)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setDeleteUserId(user.id)}
                              disabled={user.role === 'admin'}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Payment Method */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Metodo di Pagamento
                </CardTitle>
                <CardDescription>
                  Scegli come calcolare i pagamenti degli utenti
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Tipo di Calcolo</Label>
                  <Select
                    value={pendingSettings.payment_method}
                    onValueChange={(value: 'hourly' | 'per_shift') =>
                      setPendingSettings({ ...pendingSettings, payment_method: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">Orario (€/ora)</SelectItem>
                      <SelectItem value="per_shift">Per Turno (€/turno)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {pendingSettings.payment_method === 'hourly' ? (
                  <div className="space-y-2">
                    <Label htmlFor="hourly_rate">Tariffa Oraria Default (€)</Label>
                    <Input
                      id="hourly_rate"
                      type="number"
                      step="0.01"
                      value={pendingSettings.default_hourly_rate}
                      onChange={e =>
                        setPendingSettings({
                          ...pendingSettings,
                          default_hourly_rate: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="shift_rate">Tariffa per Turno Default (€)</Label>
                    <Input
                      id="shift_rate"
                      type="number"
                      step="0.01"
                      value={pendingSettings.default_shift_rate}
                      onChange={e =>
                        setPendingSettings({
                          ...pendingSettings,
                          default_shift_rate: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                )}

                <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
                  {pendingSettings.payment_method === 'hourly' ? (
                    <p>
                      <strong>Metodo Orario:</strong> I guadagni sono calcolati moltiplicando le ore lavorate per la tariffa oraria.
                    </p>
                  ) : (
                    <p>
                      <strong>Metodo per Turno:</strong> Ogni turno ha un valore fisso, indipendentemente dalla durata.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Brand Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Brand Aziendale
                </CardTitle>
                <CardDescription>
                  Personalizza l'aspetto dell'applicazione con il tuo brand
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="company_name">Nome Azienda</Label>
                  <Input
                    id="company_name"
                    value={pendingSettings.company_name || ''}
                    onChange={e =>
                      setPendingSettings({ ...pendingSettings, company_name: e.target.value })
                    }
                    placeholder="La Tua Azienda"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company_logo">URL Logo Aziendale</Label>
                  <Input
                    id="company_logo"
                    value={pendingSettings.company_logo_url || ''}
                    onChange={e =>
                      setPendingSettings({ ...pendingSettings, company_logo_url: e.target.value })
                    }
                    placeholder="https://esempio.it/logo.png"
                  />
                  {pendingSettings.company_logo_url && (
                    <div className="mt-2 p-4 bg-muted/50 rounded-lg flex items-center justify-center">
                      <img
                        src={pendingSettings.company_logo_url}
                        alt="Logo anteprima"
                        className="max-h-16 max-w-full object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="primary_color" className="flex items-center gap-2">
                    <Palette className="w-4 h-4" />
                    Colore Primario
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="primary_color"
                      type="color"
                      value={pendingSettings.primary_color || '#2962FF'}
                      onChange={e =>
                        setPendingSettings({ ...pendingSettings, primary_color: e.target.value })
                      }
                      className="w-16 h-10 p-1 cursor-pointer"
                    />
                    <Input
                      value={pendingSettings.primary_color || ''}
                      onChange={e =>
                        setPendingSettings({ ...pendingSettings, primary_color: e.target.value })
                      }
                      placeholder="#2962FF"
                      className="flex-1"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Lascia vuoto per usare il colore predefinito
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Permissions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Permessi e Accesso
                </CardTitle>
                <CardDescription>
                  Configura i permessi degli utenti e l'accesso al sistema
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Modifica Tariffe Personali</Label>
                    <p className="text-sm text-muted-foreground">
                      Permetti agli utenti di impostare tariffe personalizzate
                    </p>
                  </div>
                  <Switch
                    checked={pendingSettings.users_can_edit_rates}
                    onCheckedChange={checked =>
                      setPendingSettings({ ...pendingSettings, users_can_edit_rates: checked })
                    }
                  />
                </div>

                <div className="border-t pt-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Registrazione Pubblica</Label>
                      <p className="text-sm text-muted-foreground">
                        Permetti a chiunque di registrarsi autonomamente
                      </p>
                    </div>
                    <Switch
                      checked={pendingSettings.allow_public_registration}
                      onCheckedChange={checked =>
                        setPendingSettings({ ...pendingSettings, allow_public_registration: checked })
                      }
                    />
                  </div>
                </div>

                {!pendingSettings.allow_public_registration && (
                  <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 text-sm">
                    <p>
                      <strong>Registrazione Disabilitata:</strong> Solo gli amministratori potranno creare nuovi account utente dalla gestione utenze.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Save Button */}
            <div className="lg:col-span-2">
              <Button onClick={handleSaveSettings} className="w-full sm:w-auto">
                <Save className="w-4 h-4 mr-2" />
                Salva Impostazioni
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* New User Modal */}
      <Dialog open={isNewUserModalOpen} onOpenChange={setIsNewUserModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              Crea Nuovo Utente
            </DialogTitle>
            <DialogDescription>Inserisci i dati del nuovo utente</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-email">Email *</Label>
              <Input
                id="new-email"
                type="email"
                value={newUser.email}
                onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                placeholder="email@esempio.it"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-password">Password *</Label>
              <Input
                id="new-password"
                type="password"
                value={newUser.password}
                onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                placeholder="Minimo 6 caratteri"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-username">Username *</Label>
              <Input
                id="new-username"
                type="text"
                value={newUser.username}
                onChange={e => setNewUser({ ...newUser, username: e.target.value })}
                placeholder="nomeutente"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-fullname">Nome Completo</Label>
              <Input
                id="new-fullname"
                type="text"
                value={newUser.fullName}
                onChange={e => setNewUser({ ...newUser, fullName: e.target.value })}
                placeholder="Mario Rossi"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ruolo</Label>
                <Select
                  value={newUser.role}
                  onValueChange={(value: UserRole) => setNewUser({ ...newUser, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Utente</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Stato</Label>
                <div className="flex items-center gap-2 h-10">
                  <Switch
                    checked={newUser.isActive}
                    onCheckedChange={checked => setNewUser({ ...newUser, isActive: checked })}
                  />
                  <span className="text-sm">{newUser.isActive ? 'Attivo' : 'Disabilitato'}</span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewUserModalOpen(false)}>
              Annulla
            </Button>
            <Button onClick={handleCreateUser} disabled={isCreatingUser}>
              {isCreatingUser ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creazione...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Crea Utente
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Import Modal */}
      <Dialog open={isCSVModalOpen} onOpenChange={setIsCSVModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Importa Turni da CSV
            </DialogTitle>
            <DialogDescription>
              Verifica i turni prima dell'importazione
            </DialogDescription>
          </DialogHeader>

          {csvErrors.length > 0 && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <h4 className="font-medium text-destructive flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4" />
                Errori nel file CSV
              </h4>
              <ul className="text-sm text-destructive space-y-1">
                {csvErrors.map((error, i) => (
                  <li key={i}>• {error}</li>
                ))}
              </ul>
            </div>
          )}

          {csvShifts.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {csvShifts.filter(s => s.userId).length} turni validi su {csvShifts.length} totali
                </p>
              </div>

              <div className="overflow-x-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Stato</TableHead>
                      <TableHead>Dipendente</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Orario</TableHead>
                      <TableHead>Note</TableHead>
                      <TableHead>Stato Turno</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {csvShifts.map((shift, i) => (
                      <TableRow key={i} className={cn(!shift.userId && 'bg-destructive/5')}>
                        <TableCell>
                          {shift.userId ? (
                            <CheckCircle className="w-4 h-4 text-success" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-destructive" />
                          )}
                        </TableCell>
                        <TableCell>
                          <div>
                            <span className="font-medium">{shift.userName}</span>
                            {shift.error && (
                              <p className="text-xs text-destructive">{shift.error}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{formatDate(shift.date)}</TableCell>
                        <TableCell>{shift.startTime} - {shift.endTime}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{shift.notes || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={shift.status === 'paid' ? 'default' : 'secondary'}>
                            {shift.status === 'paid' ? 'Pagato' : 'In Attesa'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCSVModalOpen(false)}>
              Annulla
            </Button>
            <Button 
              onClick={handleImportCSV} 
              disabled={isImporting || csvShifts.filter(s => s.userId).length === 0}
            >
              {isImporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importazione...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Importa {csvShifts.filter(s => s.userId).length} Turni
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifica Utente</DialogTitle>
            <DialogDescription>Aggiorna le informazioni e impostazioni dell'utente</DialogDescription>
          </DialogHeader>

          {editingUser && (
            <div className="space-y-6">
              {/* Personal Info */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Dati Personali
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome Completo</Label>
                    <Input
                      value={editingUser.full_name}
                      onChange={e => setEditingUser({ ...editingUser, full_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={editingUser.email}
                      onChange={e => setEditingUser({ ...editingUser, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Ruolo</Label>
                    <Select
                      value={editingUser.role}
                      onValueChange={(value: UserRole) => setEditingUser({ ...editingUser, role: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">Utente</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <Switch
                      checked={editingUser.is_active}
                      onCheckedChange={checked => setEditingUser({ ...editingUser, is_active: checked })}
                    />
                    <Label>Utente Attivo</Label>
                  </div>
                </div>
              </div>

              {/* Work Settings */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Impostazioni Lavorative
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Data Inizio Contratto</Label>
                    <Input
                      type="date"
                      value={editingUser.contract_start_date}
                      onChange={e => setEditingUser({ ...editingUser, contract_start_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Ore Settimanali</Label>
                    <Input
                      type="number"
                      value={editingUser.weekly_hours}
                      onChange={e => setEditingUser({ ...editingUser, weekly_hours: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tariffa Extra (€/h)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={editingUser.extra_rate}
                      onChange={e => setEditingUser({ ...editingUser, extra_rate: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>
              </div>

              {/* Custom Rates */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Tariffe Personalizzate
                  </h3>
                  <Switch
                    checked={editingUser.use_custom_rates}
                    onCheckedChange={checked => setEditingUser({ ...editingUser, use_custom_rates: checked })}
                  />
                </div>

                {editingUser.use_custom_rates && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Tariffa Oraria (€)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={editingUser.custom_hourly_rate || ''}
                        onChange={e =>
                          setEditingUser({
                            ...editingUser,
                            custom_hourly_rate: e.target.value ? parseFloat(e.target.value) : null,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tariffa per Turno (€)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={editingUser.custom_shift_rate || ''}
                        onChange={e =>
                          setEditingUser({
                            ...editingUser,
                            custom_shift_rate: e.target.value ? parseFloat(e.target.value) : null,
                          })
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Annulla
            </Button>
            <Button onClick={handleSaveUser}>Salva Modifiche</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma Eliminazione</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare questo utente? Questa azione eliminerà anche tutti i suoi turni e
              impostazioni. L'operazione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive hover:bg-destructive/90">
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
