import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Experiment } from '../types/database';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  FlaskConical,
  History,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  Tag,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';

interface ExperimentWithRelations extends Experiment {
  documents?: any[];
  generated_documents?: any[];
}

export const HistoryPage: React.FC = () => {
  const navigate = useNavigate();

  const [experiments, setExperiments] = useState<ExperimentWithRelations[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Delete Modal State
  const [deleteTarget, setDeleteTarget] = useState<ExperimentWithRelations | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Downloading Action State
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Load Experiments and linked documents / generated_documents
  const fetchExperiments = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: err } = await supabase
        .from('experiments')
        .select('*, documents(*), generated_documents(*)')
        .order('created_at', { ascending: false });

      if (err) throw err;
      setExperiments((data as ExperimentWithRelations[]) || []);
    } catch (err: any) {
      console.error('[HistoryPage] Load error:', err);
      setError(err?.message || 'Failed loading experiment history records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExperiments();
  }, []);

  // Compute Subject list for filter dropdown
  const availableSubjects = useMemo(() => {
    const set = new Set<string>();
    experiments.forEach((exp) => {
      if (exp.subject) set.add(exp.subject);
    });
    return Array.from(set);
  }, [experiments]);

  // Derive status for an experiment
  const getExperimentStatus = (exp: ExperimentWithRelations) => {
    const genDocs = exp.generated_documents || [];
    const docs = exp.documents || [];

    if (genDocs.length > 0) return 'generated';
    if (docs.length > 0 && docs.every((d) => d.processing_status === 'extracted')) return 'verified';
    if (docs.length > 0 && docs.some((d) => d.processing_status === 'processing')) return 'processing';
    return 'draft';
  };

  // Filtered Experiments list
  const filteredExperiments = useMemo(() => {
    return experiments.filter((exp) => {
      // 1. Search Query Filter (Title or Experiment Number)
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (exp.title || '').toLowerCase().includes(q) ||
        (exp.experiment_number || '').toLowerCase().includes(q);

      // 2. Subject Filter
      const matchesSubject =
        selectedSubject === 'all' || (exp.subject || '').toLowerCase() === selectedSubject.toLowerCase();

      // 3. Status Filter
      const status = getExperimentStatus(exp);
      const matchesStatus = selectedStatus === 'all' || status === selectedStatus;

      return matchesSearch && matchesSubject && matchesStatus;
    });
  }, [experiments, searchQuery, selectedSubject, selectedStatus]);

  // Row Action: View Navigation
  const handleViewExperiment = (exp: ExperimentWithRelations) => {
    const status = getExperimentStatus(exp);
    if (status === 'generated') {
      navigate(`/generate/${exp.id}`);
    } else if (status === 'verified') {
      navigate(`/verify/${exp.id}`);
    } else {
      navigate(`/process/${exp.id}`);
    }
  };

  // Row Action: Direct Download PDF
  const handleDownloadPdf = async (exp: ExperimentWithRelations) => {
    setDownloadingId(`pdf-${exp.id}`);
    try {
      // Check if PDF already exists in generated_documents
      const existingPdf = (exp.generated_documents || []).find((d) => d.format === 'pdf');

      if (existingPdf?.file_path) {
        const { data } = await supabase.storage
          .from('generated-records')
          .createSignedUrl(existingPdf.file_path, 3600);

        if (data?.signedUrl) {
          window.open(data.signedUrl, '_blank');
          return;
        }
      }

      // Invoke Edge Function if not generated yet
      const { data, error: fnErr } = await supabase.functions.invoke('generate-record-pdf', {
        body: { experiment_id: exp.id },
      });

      if (fnErr) throw new Error(fnErr.message);
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
        fetchExperiments();
      }
    } catch (err: any) {
      console.error('[HistoryPage] PDF download error:', err);
      alert(`PDF download failed: ${err?.message || 'Error creating PDF'}`);
    } finally {
      setDownloadingId(null);
    }
  };

  // Row Action: Direct Download DOCX
  const handleDownloadDocx = async (exp: ExperimentWithRelations) => {
    setDownloadingId(`docx-${exp.id}`);
    try {
      const existingDocx = (exp.generated_documents || []).find((d) => d.format === 'docx');

      if (existingDocx?.file_path) {
        const { data } = await supabase.storage
          .from('generated-records')
          .createSignedUrl(existingDocx.file_path, 3600);

        if (data?.signedUrl) {
          window.open(data.signedUrl, '_blank');
          return;
        }
      }

      const { data, error: fnErr } = await supabase.functions.invoke('generate-record-docx', {
        body: { experiment_id: exp.id },
      });

      if (fnErr) throw new Error(fnErr.message);
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
        fetchExperiments();
      }
    } catch (err: any) {
      console.error('[HistoryPage] DOCX download error:', err);
      alert(`Word download failed: ${err?.message || 'Error creating DOCX'}`);
    } finally {
      setDownloadingId(null);
    }
  };

  /**
   * REQUIREMENT 3 & CONSTRAINT: DELETE EXPERIMENT WITH COMPLETE STORAGE CLEANUP
   */
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    setDeleteError(null);

    try {
      const expId = deleteTarget.id;

      // 1. Fetch File Paths from lab-uploads bucket
      const { data: uploadDocs } = await supabase
        .from('documents')
        .select('file_path')
        .eq('experiment_id', expId);

      const uploadPaths = (uploadDocs || []).map((d) => d.file_path).filter(Boolean);

      // Delete files from lab-uploads bucket if any exist
      if (uploadPaths.length > 0) {
        const { error: uploadRemoveErr } = await supabase.storage
          .from('lab-uploads')
          .remove(uploadPaths);
        if (uploadRemoveErr) console.warn('[Delete] lab-uploads cleanup warning:', uploadRemoveErr);
      }

      // 2. Fetch File Paths from generated-records bucket
      const { data: genDocs } = await supabase
        .from('generated_documents')
        .select('file_path')
        .eq('experiment_id', expId);

      const genPaths = (genDocs || []).map((g) => g.file_path).filter(Boolean);

      // Delete files from generated-records bucket if any exist
      if (genPaths.length > 0) {
        const { error: genRemoveErr } = await supabase.storage
          .from('generated-records')
          .remove(genPaths);
        if (genRemoveErr) console.warn('[Delete] generated-records cleanup warning:', genRemoveErr);
      }

      // 3. Delete Experiment Database Row (relying on FK cascade for dependent tables)
      const { error: expDeleteErr } = await supabase
        .from('experiments')
        .delete()
        .eq('id', expId);

      if (expDeleteErr) throw expDeleteErr;

      // Remove from local UI state
      setExperiments((prev) => prev.filter((e) => e.id !== expId));
      setDeleteTarget(null);
    } catch (err: any) {
      console.error('[HistoryPage] Delete experiment error:', err);
      setDeleteError(err?.message || 'Failed deleting experiment record.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-16">
      {/* 1. HEADER & SEARCH/FILTER CONTROLS BAR */}
      <div className="glass-panel rounded-2xl p-6 border border-gray-800 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800/80 pb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <History className="h-6 w-6 text-emerald-400" />
              <span>Experiment Records History</span>
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Review, filter, download, or delete all digitized lab notebook records and reports.
            </p>
          </div>

          <button
            onClick={fetchExperiments}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-800 bg-gray-900 px-4 py-2 text-xs font-semibold text-gray-300 hover:text-white transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Search & Subject/Status Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
          {/* Search Input (sm:col-span-6) */}
          <div className="sm:col-span-6 relative">
            <Search className="h-4 w-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search experiments by title or EXP number..."
              className="w-full rounded-xl bg-gray-950/80 border border-gray-800 pl-10 pr-4 py-2.5 text-xs text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Subject Filter (sm:col-span-3) */}
          <div className="sm:col-span-3 flex items-center gap-2">
            <Tag className="h-4 w-4 text-gray-500 flex-shrink-0" />
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full rounded-xl bg-gray-950/80 border border-gray-800 px-3 py-2.5 text-xs text-gray-200 focus:border-emerald-500 focus:outline-none"
            >
              <option value="all">All Subjects</option>
              {availableSubjects.map((subj) => (
                <option key={subj} value={subj}>
                  {subj}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter (sm:col-span-3) */}
          <div className="sm:col-span-3 flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500 flex-shrink-0" />
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full rounded-xl bg-gray-950/80 border border-gray-800 px-3 py-2.5 text-xs text-gray-200 focus:border-emerald-500 focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="generated">Exported / Complete</option>
              <option value="verified">Verified</option>
              <option value="processing">Processing</option>
              <option value="draft">Draft</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-xs text-red-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-400" />
            <span>{error}</span>
          </div>
          <button onClick={fetchExperiments} className="text-red-400 underline cursor-pointer">
            Retry
          </button>
        </div>
      )}

      {/* Initial Loading State */}
      {loading && (
        <div className="glass-panel rounded-2xl p-16 text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-emerald-400" />
          <p className="text-sm text-gray-400 font-medium">Loading historical experiment records...</p>
        </div>
      )}

      {/* 2. EXPERIMENTS TABLE */}
      {!loading && (
        <div className="glass-panel rounded-2xl border border-gray-800 overflow-hidden shadow-xl">
          {filteredExperiments.length === 0 ? (
            <div className="p-16 text-center space-y-3">
              <FlaskConical className="h-10 w-10 mx-auto text-gray-600" />
              <h3 className="text-base font-bold text-white">No Experiment Records Found</h3>
              <p className="text-xs text-gray-400 max-w-sm mx-auto">
                No experiments match your search filter criteria. Try resetting search parameters.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-800 bg-gray-950/60 text-[11px] font-mono uppercase text-gray-400">
                    <th className="py-3.5 px-4 font-bold">Experiment / Code</th>
                    <th className="py-3.5 px-4 font-bold">Subject</th>
                    <th className="py-3.5 px-4 font-bold">Processing Status</th>
                    <th className="py-3.5 px-4 font-bold">Created Date</th>
                    <th className="py-3.5 px-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60 text-xs">
                  {filteredExperiments.map((exp) => {
                    const status = getExperimentStatus(exp);
                    const formattedDate = new Date(exp.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    });

                    return (
                      <tr key={exp.id} className="hover:bg-gray-900/40 transition-colors group">
                        {/* Title & Number */}
                        <td className="py-3.5 px-4 space-y-0.5">
                          <div className="font-bold text-white group-hover:text-emerald-300 transition-colors">
                            {exp.title}
                          </div>
                          <div className="font-mono text-[11px] text-emerald-400">
                            {exp.experiment_number || 'EXP-RECORD'}
                          </div>
                        </td>

                        {/* Subject Badge */}
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-0.5 rounded-full">
                            <Tag className="h-3 w-3" />
                            {exp.subject || 'General'}
                          </span>
                        </td>

                        {/* Status Badge */}
                        <td className="py-3.5 px-4">
                          {status === 'generated' ? (
                            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Exported / Complete
                            </span>
                          ) : status === 'verified' ? (
                            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 px-2.5 py-0.5 rounded-full">
                              <Sparkles className="h-3.5 w-3.5" /> Verified
                            </span>
                          ) : status === 'processing' ? (
                            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 rounded-full animate-pulse">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Processing
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-gray-400 bg-gray-800 border border-gray-700 px-2.5 py-0.5 rounded-full">
                              <Clock className="h-3.5 w-3.5" /> Draft
                            </span>
                          )}
                        </td>

                        {/* Created Date */}
                        <td className="py-3.5 px-4 font-mono text-gray-400">
                          {formattedDate}
                        </td>

                        {/* Row Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* View Action */}
                            <button
                              onClick={() => handleViewExperiment(exp)}
                              className="inline-flex items-center gap-1 rounded-lg border border-gray-800 bg-gray-900 px-2.5 py-1 text-xs font-semibold text-gray-200 hover:border-emerald-500/40 hover:text-emerald-300 transition-all cursor-pointer"
                              title="View Experiment details"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span>View</span>
                            </button>

                            {/* Download PDF Action */}
                            <button
                              onClick={() => handleDownloadPdf(exp)}
                              disabled={downloadingId === `pdf-${exp.id}`}
                              className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs font-semibold text-red-300 hover:bg-red-500/20 transition-all cursor-pointer disabled:opacity-50"
                              title="Download PDF Report"
                            >
                              {downloadingId === `pdf-${exp.id}` ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <FileText className="h-3.5 w-3.5" />
                              )}
                              <span>PDF</span>
                            </button>

                            {/* Download DOCX Action */}
                            <button
                              onClick={() => handleDownloadDocx(exp)}
                              disabled={downloadingId === `docx-${exp.id}`}
                              className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20 transition-all cursor-pointer disabled:opacity-50"
                              title="Download Word DOCX Document"
                            >
                              {downloadingId === `docx-${exp.id}` ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <FileSpreadsheet className="h-3.5 w-3.5" />
                              )}
                              <span>DOCX</span>
                            </button>

                            {/* Delete Action */}
                            <button
                              onClick={() => setDeleteTarget(exp)}
                              className="p-1 text-gray-500 hover:text-red-400 transition-colors cursor-pointer"
                              title="Delete experiment record"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 3. DELETE CONFIRMATION MODAL & STORAGE CLEANUP */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="glass-panel w-full max-w-md rounded-2xl p-6 border border-red-500/40 bg-gray-950 space-y-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 flex-shrink-0">
                <AlertTriangle className="h-5 w-5 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">Delete Experiment Record?</h3>
                <p className="text-xs text-gray-300 leading-relaxed">
                  Are you sure you want to permanently delete <strong className="text-white">{deleteTarget.title}</strong> ({deleteTarget.experiment_number})?
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-[11px] text-red-300 space-y-1">
              <p className="font-bold uppercase tracking-wider">Warning: Permanent Storage Removal</p>
              <p className="text-red-300/90 leading-snug">
                This action will delete all scan images in storage (<code className="font-mono">lab-uploads</code>), generated PDF/DOCX reports (<code className="font-mono">generated-records</code>), extracted sections, observation tables, and calculation records.
              </p>
            </div>

            {deleteError && (
              <div className="text-xs text-red-400 bg-red-500/10 p-2.5 rounded-lg border border-red-500/30">
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-800">
              <button
                type="button"
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteError(null);
                }}
                disabled={deleting}
                className="rounded-xl border border-gray-800 bg-gray-900 px-4 py-2 text-xs font-semibold text-gray-300 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 rounded-xl bg-red-500 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-red-500/20 hover:bg-red-600 transition-all cursor-pointer disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
                    <span>Removing Storage Files & Row...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5 text-white" />
                    <span>Delete Permanently</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
