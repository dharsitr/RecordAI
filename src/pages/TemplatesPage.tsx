import React, { useState } from 'react';
import { FileText, Plus, Search, Code, ShieldCheck } from 'lucide-react';
import type { Template } from '../types/database';

export const TemplatesPage: React.FC = () => {
  const [templates] = useState<Template[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileText className="h-6 w-6 text-cyan-400" />
            Extraction Templates
          </h1>
          <p className="text-sm text-gray-400">
            Define custom layout templates and JSON configurations for specialized chemistry, biology, or physics lab notebook parsing.
          </p>
        </div>

        <button className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-gray-950 shadow-md shadow-emerald-500/20 hover:opacity-95 transition-all">
          <Plus className="h-4 w-4" />
          Create Template
        </button>
      </div>

      {/* Search Bar */}
      <div className="glass-panel rounded-xl p-4 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search templates by name or subject..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg bg-gray-900/80 border border-gray-700/60 pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </div>
      </div>

      {/* Empty State */}
      <div className="glass-panel rounded-2xl p-12 text-center space-y-4 border border-gray-800">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
          <Code className="h-8 w-8" />
        </div>
        <div className="space-y-1 max-w-md mx-auto">
          <h3 className="text-lg font-semibold text-white">No Custom Templates Built</h3>
          <p className="text-sm text-gray-400">
            Templates allow you to enforce custom table columns, expected formula expressions, and section headers.
          </p>
        </div>
        <div className="pt-2">
          <div className="inline-flex items-center gap-2 rounded-lg bg-gray-900/90 border border-gray-800 px-3 py-1.5 text-xs text-gray-400 font-mono">
            <ShieldCheck className="h-3.5 w-3.5 text-cyan-400" />
            Template RLS Restricted (`templates.user_id = auth.uid()`)
          </div>
        </div>
      </div>
    </div>
  );
};
