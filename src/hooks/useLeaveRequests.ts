import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type LeaveRequestStatus = 'pending' | 'approved' | 'rejected';
export type LeaveRequestType = 'ferie' | 'permesso' | 'malattia' | 'altro';

export interface LeaveRequest {
  id: string;
  user_id: string;
  request_type: LeaveRequestType;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: LeaveRequestStatus;
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
  profile?: {
    username: string;
    full_name: string | null;
  };
  reviewer?: {
    username: string;
    full_name: string | null;
  };
}

export function useLeaveRequests() {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const { data: requests = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['leave-requests', user?.id, isAdmin],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leave_requests')
        .select(`
          *,
          profile:profiles!leave_requests_user_id_fkey(username, full_name),
          reviewer:profiles!leave_requests_reviewed_by_user_id_fkey(username, full_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as LeaveRequest[];
    },
    enabled: !!user,
  });

  const createRequestMutation = useMutation({
    mutationFn: async (request: {
      request_type: LeaveRequestType;
      start_date: string;
      end_date: string;
      reason?: string;
    }) => {
      const { error } = await supabase
        .from('leave_requests')
        .insert({
          user_id: user!.id,
          request_type: request.request_type,
          start_date: request.start_date,
          end_date: request.end_date,
          reason: request.reason || null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      toast.success('Richiesta inviata con successo');
    },
    onError: (error) => {
      console.error('Error creating leave request:', error);
      toast.error('Errore nell\'invio della richiesta');
    },
  });

  const reviewRequestMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      review_notes,
    }: {
      id: string;
      status: 'approved' | 'rejected';
      review_notes?: string;
    }) => {
      const { error } = await supabase
        .from('leave_requests')
        .update({
          status,
          reviewed_by_user_id: user!.id,
          reviewed_at: new Date().toISOString(),
          review_notes: review_notes || null,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      toast.success('Richiesta aggiornata');
    },
    onError: (error) => {
      console.error('Error reviewing leave request:', error);
      toast.error('Errore nell\'aggiornamento della richiesta');
    },
  });

  const deleteRequestMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('leave_requests')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      toast.success('Richiesta eliminata');
    },
    onError: (error) => {
      console.error('Error deleting leave request:', error);
      toast.error('Errore nell\'eliminazione della richiesta');
    },
  });

  return {
    requests,
    loading,
    refetch,
    createRequest: createRequestMutation.mutateAsync,
    reviewRequest: reviewRequestMutation.mutateAsync,
    deleteRequest: deleteRequestMutation.mutateAsync,
    isCreating: createRequestMutation.isPending,
    isReviewing: reviewRequestMutation.isPending,
  };
}
