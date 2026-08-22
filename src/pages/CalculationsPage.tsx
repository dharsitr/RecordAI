import React, { useState } from 'react';
import { Calculator, Plus, Search, CheckCircle, AlertCircle, ShieldCheck } from 'lucide-react';
import type { Calculation } from '../types/database';

export const CalculationsPage: React.FC = () => {
  const [calculations] = useState<Calculation[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Calculator className="h-6 w-6 text-indigo-400" />
            Formula & Calculations Verifier
          </h1>
          <p className="text-sm text-gray-400">
            Automatically re-evaluate and audit mathematical expressions, stoichiometric inputs, and calculated lab results.
          </p>
        </div>

        <button className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-gray-950 shadow-md shadow-emerald-500/20 hover:opacity-95 transition-all">
          <Plus className="h-4 w-4" />
          Add Calculation
        </button>
      </div>

      {/* Search Bar */}
      <div className="glass-panel rounded-xl p-4 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search calculations by expression or verification status..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg bg-gray-900/80 border border-gray-700/60 pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Empty State */}
      <div className="glass-panel rounded-2xl p-12 text-center space-y-4 border border-gray-800">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
          <Calculator className="h-8 w-8" />
        </div>
        <div className="space-y-1 max-w-md mx-auto">
          <h3 className="text-lg font-semibold text-white">No Calculation Records</h3>
          <p className="text-sm text-gray-400">
            Calculations extracted from lab notebook documents are audited against inputs and expressions.
          </p>
        </div>
        <div className="pt-2">
          <div className="inline-flex items-center gap-2 rounded-lg bg-gray-900/90 border border-gray-800 px-3 py-1.5 text-xs text-gray-400 font-mono">
            <ShieldCheck className="h-3.5 w-3.5 text-indigo-400" />
            Calculation RLS Via Experiment Ownership (`experiment_id -&gt; user_id`)
          </div>
        </div>
      </div>
    </div>
  );
};
