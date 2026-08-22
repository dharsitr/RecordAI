import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Document, Experiment } from '../types/database';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Cpu,
  FileText,
  FlaskConical,
  Loader2,
  RefreshCw,
  Sparkles,
  XCircle,
} from 'lucide-react';

export const ProcessingPage: React.FC = () => {
  const { experimentId } = useParams<{ experimentId: string }>();
  const navigate = useNavigate();

  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState<boolean>(false);
  const [retryingDocId, setRetryingDocId] = useState<string | null>(null);

  // Ref to track which documents we've already triggered edge function extraction for
  const triggeredDocsRef = useRef<Set<string>>(new Set());

  // Helper to invoke extract-lab-record Edge Function for a given document ID
  const triggerExtraction = useCallback(async (docId: string) => {
    try {
      console.log(`[ProcessingPage] Invoking extract-lab-record for document "${docId}"...`);

      // Optimistically update document status to 'processing' in local state
      setDocuments((prev) =>
        prev.map((d) => (d.id === docId ? { ...d, processing_status: 'processing' } : d))
      );

      const { data, error: fnErr } = await supabase.functions.invoke('extract-lab-record', {
        body: { document_id: docId },
      });

      if (fnErr) {
        console.error(`[ProcessingPage] Edge function invocation error for ${docId}:`, fnErr);
        setDocuments((prev) =>
          prev.map((d) => (d.id === docId ? { ...d, processing_status: 'failed' } : d))
        );
      } else if (data?.status === 'extracted') {
        console.log(`[ProcessingPage] Extraction succeeded for ${docId}:`, data);
        setDocuments((prev) =>
          prev.map((d) => (d.id === docId ? { ...d, processing_status: 'extracted' } : d))
        );
      }
    } catch (err: any) {
      console.error(`[ProcessingPage] Failed triggering extraction for ${docId}:`, err);
      setDocuments((prev) =>
        prev.map((d) => (d.id === docId ? { ...d, processing_status: 'failed' } : d))
      );
    }
  }, []);

  // Fetch initial experiment & documents data
  const fetchExperimentAndDocuments = useCallback(async () => {
    if (!experimentId) return;

    try {
      // 1. Fetch Experiment
      const { data: expData, error: expErr } = await supabase
        .from('experiments')
        .select('*')
        .eq('id', experimentId)
        .single();

      if (expErr) throw new Error(`Failed loading experiment: ${expErr.message}`);
      setExperiment(expData);

      // 2. Fetch Documents for Experiment
      const { data: docsData, error: docsErr } = await supabase
        .from('documents')
        .select('*')
        .eq('experiment_id', experimentId)
        .order('created_at', { ascending: true });

      if (docsErr) throw new Error(`Failed loading documents: ${docsErr.message}`);
      setDocuments(docsData || []);

      // 3. Trigger extraction for documents that are not yet 'extracted'
      if (docsData && docsData.length > 0) {
        (docsData as Document[]).forEach((doc: Document) => {
          if (doc.processing_status !== 'extracted' && !triggeredDocsRef.current.has(doc.id)) {
            triggeredDocsRef.current.add(doc.id);
            triggerExtraction(doc.id);
          }
        });
      }
    } catch (err: any) {
      console.error('[ProcessingPage] Fetch error:', err);
      setError(err?.message || 'Error initializing record processing page');
    } finally {
      setLoading(false);
    }
  }, [experimentId, triggerExtraction]);

  // Initial load effect
  useEffect(() => {
    fetchExperimentAndDocuments();
  }, [fetchExperimentAndDocuments]);

  // Supabase Realtime Subscription + Polling Fallback logic
  useEffect(() => {
    if (!experimentId) return;

    // 1. Realtime subscription to postgres_changes on table 'documents'
    const channel = supabase
      .channel(`documents-experiment-${experimentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'documents',
          filter: `experiment_id=eq.${experimentId}`,
        },
        (payload) => {
          console.log('[ProcessingPage Realtime] Document status update received:', payload);
          if (payload.new && (payload.new as Document).id) {
            const updatedDoc = payload.new as Document;
            setDocuments((prev) =>
              prev.map((d) => (d.id === updatedDoc.id ? { ...d, ...updatedDoc } : d))
            );
          }
        }
      )
      .subscribe();

    // 2. Polling interval fallback (every 3 seconds)
    const intervalId = setInterval(async () => {
      const { data: updatedDocs } = await supabase
        .from('documents')
        .select('*')
        .eq('experiment_id', experimentId)
        .order('created_at', { ascending: true });

      if (updatedDocs && updatedDocs.length > 0) {
        setDocuments(updatedDocs);
      }
    }, 3000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(intervalId);
    };
  }, [experimentId]);

  // Check completion and navigate to /verify/:experimentId
  useEffect(() => {
    if (loading || documents.length === 0 || redirecting) return;

    const allExtracted = documents.every((doc) => doc.processing_status === 'extracted');

    if (allExtracted) {
      setRedirecting(true);
      const timer = setTimeout(() => {
        navigate(`/verify/${experimentId}`);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [documents, loading, redirecting, experimentId, navigate]);

  // Retry handler for individual failed document
  const handleRetryDocument = async (docId: string) => {
    setRetryingDocId(docId);
    triggeredDocsRef.current.add(docId);
    await triggerExtraction(docId);
    setRetryingDocId(null);
  };

  // Helper to extract basename from file_path
  const getFileName = (filePath: string) => {
    if (!filePath) return 'Notebook Page Document';
    const parts = filePath.split('/');
    return parts[parts.length - 1];
  };

  const extractedCount = documents.filter((d) => d.processing_status === 'extracted').length;
  const failedCount = documents.filter((d) => d.processing_status === 'failed').length;
  const inProgressCount = documents.filter(
    (d) => d.processing_status === 'pending' || d.processing_status === 'processing'
  ).length;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Navigation Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white font-medium transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </button>

        <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
          Experiment #{experiment?.experiment_number || 'EXP-RECORD'}
        </span>
      </div>

      {/* Main Glass Panel */}
      <div className="glass-panel rounded-2xl p-6 sm:p-8 border border-gray-800 space-y-6">
        {/* Page Title & Status Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800/80 pb-6">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 text-emerald-400">
              <Cpu className="h-6 w-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">
                {experiment?.title || 'AI Document Extraction Pipeline'}
              </h1>
              <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
                <span>Subject: {experiment?.subject || 'General Chemistry'}</span>
                <span>•</span>
                <span className="font-mono text-emerald-400">ID: {experimentId}</span>
              </p>
            </div>
          </div>

          {/* Top Status Badge */}
          {redirecting ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/20 px-4 py-1.5 text-xs font-semibold text-emerald-300 animate-pulse">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              Redirecting to Verification...
            </span>
          ) : inProgressCount > 0 ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-xs font-semibold text-cyan-400">
              <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
              Extracting Records ({extractedCount}/{documents.length})
            </span>
          ) : failedCount > 0 ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-4 py-1.5 text-xs font-semibold text-red-400">
              <AlertCircle className="h-4 w-4 text-red-400" />
              {failedCount} Page(s) Failed Extraction
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-400">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              All Documents Extracted
            </span>
          )}
        </div>

        {/* Global Redirecting Banner */}
        {redirecting && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex items-center justify-between text-emerald-300 animate-fadeIn">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-emerald-400 animate-bounce" />
              <div>
                <p className="text-sm font-bold">All Lab Notebook Pages Successfully Processed!</p>
                <p className="text-xs text-emerald-400/90">
                  Navigating to structured data verification interface...
                </p>
              </div>
            </div>
            <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
          </div>
        )}

        {/* Global Initial Loading State */}
        {loading && (
          <div className="p-12 text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-emerald-400" />
            <p className="text-sm text-gray-400 font-medium">Loading uploaded document records...</p>
          </div>
        )}

        {/* Global Error Alert */}
        {!loading && error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-400 text-sm flex items-center gap-3">
            <XCircle className="h-5 w-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Documents Status List */}
        {!loading && documents.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs font-semibold text-gray-400 px-1">
              <span className="uppercase tracking-wider">
                Document Extraction Queue ({documents.length})
              </span>
              <span className="font-mono text-emerald-400">
                {extractedCount} / {documents.length} Extracted
              </span>
            </div>

            <div className="space-y-3">
              {documents.map((doc, idx) => {
                const isProcessing =
                  doc.processing_status === 'pending' || doc.processing_status === 'processing';
                const isExtracted = doc.processing_status === 'extracted';
                const isFailed = doc.processing_status === 'failed';
                const isRetryingThis = retryingDocId === doc.id;

                return (
                  <div
                    key={doc.id}
                    className={`rounded-xl border p-4 transition-all ${
                      isExtracted
                        ? 'border-emerald-500/30 bg-emerald-500/5'
                        : isFailed
                        ? 'border-red-500/30 bg-red-500/5'
                        : 'border-cyan-500/30 bg-cyan-500/5'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Document Details */}
                      <div className="flex items-start gap-3">
                        <div
                          className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-semibold ${
                            isExtracted
                              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                              : isFailed
                              ? 'border-red-500/30 bg-red-500/10 text-red-400'
                              : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400'
                          }`}
                        >
                          <FileText className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-white">
                              Page {idx + 1}: {getFileName(doc.file_path)}
                            </span>
                            <span className="text-[10px] font-mono text-gray-400 px-1.5 py-0.5 rounded bg-gray-800 border border-gray-700">
                              {doc.file_type || 'image/png'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {isExtracted && (
                              <span className="text-emerald-400 flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3 inline" />
                                Extraction complete. Sections, observation tables, & math parsed.
                              </span>
                            )}
                            {isProcessing && (
                              <span className="text-cyan-400 flex items-center gap-1">
                                <Loader2 className="h-3 w-3 inline animate-spin" />
                                Anthropic Vision AI analyzing handwriting and tabular layout...
                              </span>
                            )}
                            {isFailed && (
                              <span className="text-red-400 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3 inline" />
                                AI Vision extraction failed. Click retry to re-analyze page.
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Status & Retry Actions */}
                      <div className="flex items-center gap-3 self-end sm:self-center">
                        {isExtracted && (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Extracted
                          </span>
                        )}

                        {isProcessing && (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-400">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Processing...
                          </span>
                        )}

                        {isFailed && (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-medium text-red-400">
                              <XCircle className="h-3.5 w-3.5" />
                              Failed
                            </span>
                            <button
                              onClick={() => handleRetryDocument(doc.id)}
                              disabled={isRetryingThis}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/30 transition-all cursor-pointer disabled:opacity-50"
                            >
                              <RefreshCw
                                className={`h-3.5 w-3.5 ${isRetryingThis ? 'animate-spin' : ''}`}
                              />
                              <span>{isRetryingThis ? 'Retrying...' : 'Retry'}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Bottom Actions for Multi-Document Scenarios */}
        {!loading && documents.length > 0 && (
          <div className="pt-4 border-t border-gray-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-gray-400">
              <span>Realtime updates active. Status syncs automatically via Supabase.</span>
            </div>

            <div className="flex items-center gap-3">
              {/* If at least 1 document succeeded and some failed, allow proceeding without blocking */}
              {extractedCount > 0 && failedCount > 0 && (
                <button
                  onClick={() => navigate(`/verify/${experimentId}`)}
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition-all cursor-pointer"
                >
                  <span>Proceed with Succeeded Pages ({extractedCount})</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}

              {/* Manual Verify Navigate button if all extracted */}
              {extractedCount === documents.length && (
                <button
                  onClick={() => navigate(`/verify/${experimentId}`)}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-5 py-2.5 text-xs font-semibold text-gray-950 shadow-md shadow-emerald-500/20 hover:brightness-110 transition-all cursor-pointer"
                >
                  <span>Proceed to Verification</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
