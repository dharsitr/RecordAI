import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useExperiments } from '../hooks/useExperiments';
import { useAuth } from '../context/AuthContext';
import {
  AlertCircle,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  FilePlus,
  FlaskConical,
  FolderOpen,
  Loader2,
  RefreshCw,
  Tag,
  XCircle,
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { experiments, loading, error, refetch } = useExperiments();

  const userName = user?.user_metadata?.full_name || 'Researcher';

  // Format date helper
  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  // Processing status badge renderer
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
    <div className="space-y-8">
      {/* Dashboard Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <span>Welcome back, {userName}</span>
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Manage your digitized laboratory records, experiment data, and automated calculations.
          </p>
        </div>

        <button
          onClick={() => navigate('/new-record')}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-5 py-2.5 text-sm font-semibold text-gray-950 shadow-lg shadow-emerald-500/20 transition-all hover:brightness-110 hover:shadow-emerald-500/30 cursor-pointer"
        >
          <FilePlus className="h-4 w-4" />
          <span>New Record</span>
        </button>
      </div>

      {/* Main Content Area: Handling Loading, Error, Empty, and Data states */}

      {/* 1. LOADING STATE */}
      {loading && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
            <span>Loading research records...</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="glass-panel rounded-2xl p-6 border border-gray-800 animate-pulse space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="h-4 w-24 bg-gray-800 rounded" />
                  <div className="h-5 w-20 bg-gray-800 rounded-full" />
                </div>
                <div className="h-6 w-3/4 bg-gray-800 rounded" />
                <div className="h-4 w-1/2 bg-gray-800 rounded" />
                <div className="pt-4 border-t border-gray-800/60 flex justify-between">
                  <div className="h-3 w-16 bg-gray-800 rounded" />
                  <div className="h-3 w-24 bg-gray-800 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. ERROR STATE */}
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

      {/* 3. EMPTY STATE */}
      {!loading && !error && experiments.length === 0 && (
        <div className="glass-panel rounded-2xl p-12 text-center border border-gray-800/80 shadow-xl space-y-6 max-w-2xl mx-auto my-8">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-tr from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 shadow-inner">
            <FolderOpen className="h-10 w-10 text-emerald-400" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white">No Experiments Found</h2>
            <p className="text-sm text-gray-400 max-w-md mx-auto">
              You haven't digitized any laboratory records yet. Start by digitizing your first handwritten notebook page or upload.
            </p>
          </div>
          <button
            onClick={() => navigate('/new-record')}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-6 py-3 text-sm font-semibold text-gray-950 shadow-lg shadow-emerald-500/20 transition-all hover:brightness-110 hover:shadow-emerald-500/30 cursor-pointer"
          >
            <FilePlus className="h-4 w-4" />
            <span>New Record</span>
          </button>
        </div>
      )}

      {/* 4. EXPERIMENTS DATA CARDS GRID */}
      {!loading && !error && experiments.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs font-semibold text-gray-400 px-1">
            <span className="uppercase tracking-wider">Recent Experiments ({experiments.length})</span>
            <button
              onClick={() => refetch()}
              className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              Refresh
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {experiments.map((exp) => (
              <div
                key={exp.id}
                onClick={() => navigate(`/experiments`)}
                className="glass-card rounded-2xl p-6 border border-gray-800/80 flex flex-col justify-between space-y-4 cursor-pointer group"
              >
                {/* Header: Experiment Number & Status */}
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-mono font-medium text-emerald-400/90 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                    <FlaskConical className="h-3.5 w-3.5" />
                    {exp.experiment_number || 'EXP-RECORD'}
                  </span>
                  {renderStatusBadge(exp.processing_status)}
                </div>

                {/* Title & Subject */}
                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-white group-hover:text-emerald-300 transition-colors line-clamp-2">
                    {exp.title}
                  </h3>
                  {exp.subject ? (
                    <p className="text-xs text-gray-400 flex items-center gap-1.5">
                      <Tag className="h-3 w-3 text-gray-500" />
                      <span>{exp.subject}</span>
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500 italic flex items-center gap-1.5">
                      <BookOpen className="h-3 w-3 text-gray-600" />
                      <span>General Science</span>
                    </p>
                  )}
                </div>

                {/* Card Footer: Date */}
                <div className="pt-4 border-t border-gray-800/60 flex items-center justify-between text-xs text-gray-500">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-gray-400" />
                    {formatDate(exp.created_at)}
                  </span>
                  <span className="text-emerald-400 font-medium group-hover:translate-x-1 transition-transform">
                    View &rarr;
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
