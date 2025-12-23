import { useState } from 'react';
import { motion } from 'framer-motion';
import { format, differenceInDays } from 'date-fns';
import { it } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { useLeaveRequests, LeaveRequestType, LeaveRequestStatus } from '@/hooks/useLeaveRequests';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  Plus,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Trash2,
  User,
} from 'lucide-react';
import { getLocalISODate } from '@/lib/shiftUtils';

const REQUEST_TYPE_LABELS: Record<LeaveRequestType, string> = {
  ferie: 'Ferie',
  permesso: 'Permesso',
  malattia: 'Malattia',
  altro: 'Altro',
};

const STATUS_CONFIG: Record<LeaveRequestStatus, { label: string; icon: React.ElementType; className: string }> = {
  pending: { label: 'In Attesa', icon: AlertCircle, className: 'bg-warning/20 text-warning border-warning/30' },
  approved: { label: 'Approvata', icon: CheckCircle2, className: 'bg-success/20 text-success border-success/30' },
  rejected: { label: 'Rifiutata', icon: XCircle, className: 'bg-destructive/20 text-destructive border-destructive/30' },
};

export function LeaveRequests() {
  const { user, isAdmin } = useAuth();
  const { requests, loading, createRequest, reviewRequest, deleteRequest, isCreating, isReviewing } = useLeaveRequests();
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [formData, setFormData] = useState({
    request_type: 'ferie' as LeaveRequestType,
    start_date: getLocalISODate(new Date()),
    end_date: getLocalISODate(new Date()),
    reason: '',
  });

  const myRequests = requests.filter(r => r.user_id === user?.id);
  const pendingRequests = requests.filter(r => r.status === 'pending');
  const allRequests = requests;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createRequest(formData);
    setIsFormOpen(false);
    setFormData({
      request_type: 'ferie',
      start_date: getLocalISODate(new Date()),
      end_date: getLocalISODate(new Date()),
      reason: '',
    });
  };

  const handleReview = async (status: 'approved' | 'rejected') => {
    if (!selectedRequest) return;
    await reviewRequest({ id: selectedRequest, status, review_notes: reviewNotes });
    setIsReviewOpen(false);
    setSelectedRequest(null);
    setReviewNotes('');
  };

  const openReviewModal = (id: string) => {
    setSelectedRequest(id);
    setReviewNotes('');
    setIsReviewOpen(true);
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  const RequestCard = ({ request, showUser = false }: { request: typeof requests[0]; showUser?: boolean }) => {
    const status = STATUS_CONFIG[request.status];
    const StatusIcon = status.icon;
    const days = differenceInDays(new Date(request.end_date), new Date(request.start_date)) + 1;
    const canDelete = request.status === 'pending' && request.user_id === user?.id;
    const canReview = isAdmin && request.status === 'pending';

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 rounded-lg border bg-card"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline">{REQUEST_TYPE_LABELS[request.request_type]}</Badge>
              <Badge className={cn('border', status.className)}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {status.label}
              </Badge>
            </div>
            
            {showUser && request.profile && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <User className="w-4 h-4" />
                <span>{request.profile.full_name || request.profile.username}</span>
              </div>
            )}

            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span>
                  {format(new Date(request.start_date), 'd MMM', { locale: it })} - {format(new Date(request.end_date), 'd MMM yyyy', { locale: it })}
                </span>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>{days} {days === 1 ? 'giorno' : 'giorni'}</span>
              </div>
            </div>

            {request.reason && (
              <p className="text-sm text-muted-foreground mt-2">{request.reason}</p>
            )}

            {request.review_notes && (
              <p className="text-sm text-muted-foreground mt-2 italic">
                Nota admin: {request.review_notes}
              </p>
            )}
          </div>

          <div className="flex gap-2">
            {canReview && (
              <Button size="sm" onClick={() => openReviewModal(request.id)}>
                Rivedi
              </Button>
            )}
            {canDelete && (
              <Button size="icon" variant="ghost" onClick={() => deleteRequest(request.id)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Ferie & Permessi</h1>
          <p className="text-muted-foreground">
            {isAdmin ? 'Gestisci le richieste di ferie e permessi' : 'Richiedi ferie e permessi'}
          </p>
        </div>
        <Button onClick={() => setIsFormOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nuova Richiesta
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">In Attesa</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{pendingRequests.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Approvate (mese)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {requests.filter(r => r.status === 'approved').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Le Mie Richieste</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{myRequests.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue={isAdmin ? 'pending' : 'my'} className="space-y-4">
        <TabsList>
          <TabsTrigger value="my">Le Mie</TabsTrigger>
          {isAdmin && <TabsTrigger value="pending">In Attesa ({pendingRequests.length})</TabsTrigger>}
          {isAdmin && <TabsTrigger value="all">Tutte</TabsTrigger>}
        </TabsList>

        <TabsContent value="my" className="space-y-3">
          {myRequests.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              Nessuna richiesta inviata
            </Card>
          ) : (
            myRequests.map(request => (
              <RequestCard key={request.id} request={request} />
            ))
          )}
        </TabsContent>

        {isAdmin && (
          <TabsContent value="pending" className="space-y-3">
            {pendingRequests.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">
                Nessuna richiesta in attesa
              </Card>
            ) : (
              pendingRequests.map(request => (
                <RequestCard key={request.id} request={request} showUser />
              ))
            )}
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="all" className="space-y-3">
            {allRequests.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">
                Nessuna richiesta
              </Card>
            ) : (
              allRequests.map(request => (
                <RequestCard key={request.id} request={request} showUser />
              ))
            )}
          </TabsContent>
        )}
      </Tabs>

      {/* Create Request Modal */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuova Richiesta</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Tipo</Label>
              <Select
                value={formData.request_type}
                onValueChange={(value: LeaveRequestType) => setFormData({ ...formData, request_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ferie">Ferie</SelectItem>
                  <SelectItem value="permesso">Permesso</SelectItem>
                  <SelectItem value="malattia">Malattia</SelectItem>
                  <SelectItem value="altro">Altro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data Inizio</Label>
                <Input
                  type="date"
                  value={formData.start_date}
                  onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Data Fine</Label>
                <Input
                  type="date"
                  value={formData.end_date}
                  onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                  min={formData.start_date}
                  required
                />
              </div>
            </div>

            <div>
              <Label>Motivazione (opzionale)</Label>
              <Textarea
                value={formData.reason}
                onChange={e => setFormData({ ...formData, reason: e.target.value })}
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                Annulla
              </Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? 'Invio...' : 'Invia Richiesta'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Review Modal */}
      <Dialog open={isReviewOpen} onOpenChange={setIsReviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rivedi Richiesta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Note (opzionale)</Label>
              <Textarea
                value={reviewNotes}
                onChange={e => setReviewNotes(e.target.value)}
                placeholder="Aggiungi una nota..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReviewOpen(false)}>
              Annulla
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleReview('rejected')}
              disabled={isReviewing}
            >
              <XCircle className="w-4 h-4 mr-2" />
              Rifiuta
            </Button>
            <Button onClick={() => handleReview('approved')} disabled={isReviewing}>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Approva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
