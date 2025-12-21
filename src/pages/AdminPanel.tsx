import { useState } from 'react';
import { motion } from 'framer-motion';
import { useUsers } from '@/hooks/useUsers';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { formatDate, formatCurrency } from '@/lib/shiftUtils';
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
} from 'lucide-react';
import { Database } from '@/integrations/supabase/types';

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

export function AdminPanel() {
  const { users, loading: usersLoading, updateUser, deleteUser } = useUsers();
  const { settings, loading: settingsLoading, updateMultipleSettings } = useSystemSettings();
  
  const [editingUser, setEditingUser] = useState<EditUserData | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [pendingSettings, setPendingSettings] = useState(settings);

  // Update pending settings when loaded
  useState(() => {
    if (!settingsLoading) {
      setPendingSettings(settings);
    }
  });

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
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Pannello Admin</h1>
        <p className="text-muted-foreground">Gestisci utenti e impostazioni di sistema</p>
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
              <div className="p-3 bg-shift-contract/10 rounded-xl">
                <UserCheck className="w-6 h-6 text-shift-contract" />
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
              <div className="p-3 bg-shift-extra/10 rounded-xl">
                <DollarSign className="w-6 h-6 text-shift-extra" />
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

            {/* Permissions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Permessi Utenti
                </CardTitle>
                <CardDescription>
                  Configura cosa possono fare gli utenti
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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

                {!pendingSettings.users_can_edit_rates && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-sm">
                    <p>
                      Quando disabilitato, gli utenti non potranno modificare le loro tariffe personali.
                      Solo gli amministratori potranno impostarle.
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
