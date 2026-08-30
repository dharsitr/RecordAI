import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { Experiment } from '../types/database';

export interface ExperimentWithStatus extends Experiment {
  processing_status: 'pending' | 'processing' | 'completed' | 'failed' | string;
}

export interface UseExperimentsReturn {
  experiments: ExperimentWithStatus[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useExperiments(): UseExperimentsReturn {
  const { user } = useAuth();
  const [experiments, setExperiments] = useState<ExperimentWithStatus[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExperiments = useCallback(async () => {
    if (!user) {
      setExperiments([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch experiments owned by user, joined with document processing_status, newest first
      const { data, error: fetchErr } = await supabase
        .from('experiments')
        .select(`
          *,
          documents (
            processing_status
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchErr) {
        console.error('[useExperiments] Database query failed:', fetchErr);
        throw new Error(fetchErr.message || 'Failed to fetch experiments from database.');
      }

      // Map response to include single processing_status field
      const mapped: ExperimentWithStatus[] = (data || []).map((exp: any) => {
        const docs = exp.documents;
        const status =
          Array.isArray(docs) && docs.length > 0
            ? docs[0].processing_status
            : 'completed'; // default fallback status

        return {
          id: exp.id,
          user_id: exp.user_id,
          title: exp.title,
          subject: exp.subject,
          experiment_number: exp.experiment_number,
          template_id: exp.template_id ?? null,
          created_at: exp.created_at,
          updated_at: exp.updated_at,
          processing_status: status,
        };
      });

      setExperiments(mapped);
    } catch (err: any) {
      console.error('[useExperiments] Fetch error:', err);
      setError(err?.message || 'An unexpected error occurred while loading your experiments.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchExperiments();
  }, [fetchExperiments]);

  return {
    experiments,
    loading,
    error,
    refetch: fetchExperiments,
  };
}
