import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  FlaskConical,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Tag,
  XCircle,
} from 'lucide-react';
import { useExperiments } from '../hooks/useExperiments';

export const ExperimentsPage: React.FC = () => {
  const navigate = useNavigate();
  const { experiments, loading, error, refetch } = useExperiments();
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (error) {
      console.error('[ExperimentsPage] Experiments query failure:', error);
    }
  }, [error]);

  const filteredExperiments = experiments.filter((exp) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    return (
      exp.title.toLowerCase().includes(term) ||
      (exp.subject && exp.subject.toLowerCase().includes(term)) ||
      (exp.experiment_number && exp.experiment_number.toLowerCase().includes(term))
    );
  });

  const renderStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'completed') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
          <CheckCircle2 className="h-3 w-3" />
          Completed
        </span>
      );
    }
    if (s === 'processing') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-xs font-medium text-cyan-400 animate-pulse">
          <Loader2 className="h-3 w-3 animate-spin" />
          Processing
        </span>
      );
    }
    if (s === 'failed') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-400">
          <XCircle className="h-3 w-3" />
          Failed
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-400">
        <Clock className="h-3 w-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Layers className="h-6 w-6 text-emerald-400" />
            Lab Experiments
          </h1>
          <p className="text-sm text-gray-400">
            Manage your digitized lab notebook experiments, documents, and observation records.
          </p>
        </div>

        <button
          onClick={() => navigate('/new-record')}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-gray-950 shadow-md shadow-emerald-500/20 hover:opacity-95 transition-all cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          New Experiment
        </button>
      </div>

      {/* Search & Filters */}
      <div className="glass-panel rounded-xl p-4 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search experiments by title, subject, or experiment number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg bg-gray-900/80 border border-gray-700/60 pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
            <span>Loading experiments...</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="glass-card rounded-xl p-5 border border-gray-800 animate-pulse space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="h-4 w-20 bg-gray-800 rounded" />
                  <div className="h-3 w-16 bg-gray-800 rounded" />
                </div>
                <div className="h-5 w-3/4 bg-gray-800 rounded" />
                <div className="h-3 w-1/2 bg-gray-800 rounded" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-red-400 space-y-4 animate-fadeIn">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-6 w-6 flex-shrink-0 text-red-400 mt-0.5" />
            <div>
              <h3 className="font-semibold text-base text-red-300">Failed to load experiments</h3>
              <p className="text-sm mt-1 text-red-400/90">{error}</p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 rounded-xl bg-red-500/20 border border-red-500/40 px-4 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/30 transition-all cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Retry Loading</span>
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredExperiments.length === 0 && (
        <div className="glass-panel rounded-2xl p-12 text-center space-y-4 border border-gray-800">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <FileText className="h-8 w-8" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-lg font-semibold text-white">
              {searchTerm ? 'No Matching Experiments' : 'No Experiments Found'}
            </h3>
            <p className="text-sm text-gray-400">
              {searchTerm
                ? `No experiment records matched "${searchTerm}". Try a different search query.`
                : 'You have not created any experiments yet. Create your first experiment to start uploading lab notebook pages.'}
            </p>
          </div>
          <div className="pt-2">
            <div className="inline-flex items-center gap-2 rounded-lg bg-gray-900/90 border border-gray-800 px-3 py-1.5 text-xs text-gray-400 font-mono">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              Row Level Security Enforced (auth.uid())
            </div>
          </div>
        </div>
      )}

      {/* Experiments List */}
      {!loading && !error && filteredExperiments.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredExperiments.map((exp) => (
            <div
              key={exp.id}
              onClick={() => navigate('/history')}
              className="glass-card rounded-xl p-5 space-y-3 cursor-pointer group hover:border-emerald-500/40 transition-colors"
            >
              <div className="flex items-start justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-mono font-medium text-emerald-400/90 bg-emerald-500/10 px-2.5 py-0.5 rounded-lg border border-emerald-500/20">
                  <FlaskConical className="h-3.5 w-3.5" />
                  {exp.experiment_number || 'EXP-RECORD'}
                </span>
                {renderStatusBadge(exp.processing_status)}
              </div>
              <h3 className="font-semibold text-white text-base group-hover:text-emerald-300 transition-colors line-clamp-2">
                {exp.title}
              </h3>
              <div className="flex items-center justify-between pt-2 border-t border-gray-800/60 text-xs text-gray-400">
                {exp.subject ? (
                  <div className="flex items-center gap-1">
                    <Tag className="h-3 w-3 text-cyan-400" />
                    <span>{exp.subject}</span>
                  </div>
                ) : (
                  <span className="text-gray-500 italic">General Science</span>
                )}
                <span className="text-gray-500 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(exp.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
