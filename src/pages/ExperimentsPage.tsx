import React, { useState } from 'react';
import { Plus, Search, Layers, FileText, Calendar, Tag, ShieldCheck } from 'lucide-react';
import type { Experiment } from '../types/database';

export const ExperimentsPage: React.FC = () => {
  const [experiments] = useState<Experiment[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

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

        <button className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-gray-950 shadow-md shadow-emerald-500/20 hover:opacity-95 transition-all">
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

      {/* Experiments List / Empty State */}
      {experiments.length === 0 ? (
        <div className="glass-panel rounded-2xl p-12 text-center space-y-4 border border-gray-800">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <FileText className="h-8 w-8" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-lg font-semibold text-white">No Experiments Found</h3>
            <p className="text-sm text-gray-400">
              You have not created any experiments yet. Create your first experiment to start uploading lab notebook pages.
            </p>
          </div>
          <div className="pt-2">
            <div className="inline-flex items-center gap-2 rounded-lg bg-gray-900/90 border border-gray-800 px-3 py-1.5 text-xs text-gray-400 font-mono">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              Row Level Security Enforced (auth.uid())
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {experiments.map((exp) => (
            <div key={exp.id} className="glass-card rounded-xl p-5 space-y-3">
              <div className="flex items-start justify-between">
                <span className="text-xs font-mono text-emerald-400 font-semibold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                  {exp.experiment_number || 'EXP-000'}
                </span>
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(exp.created_at).toLocaleDateString()}
                </span>
              </div>
              <h3 className="font-semibold text-white text-base">{exp.title}</h3>
              {exp.subject && (
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <Tag className="h-3 w-3 text-cyan-400" />
                  {exp.subject}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
