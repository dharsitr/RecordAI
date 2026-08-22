import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import type { Template } from '../types/database';
import {
  BarChart2,
  Check,
  CheckCircle2,
  FileText,
  FlaskConical,
  Layout,
  Palette,
  Sparkles,
  Type,
} from 'lucide-react';

// Fallback Default Templates (Used if database is offline or unseeded)
export const DEFAULT_TEMPLATES: Template[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    user_id: 'system',
    name: 'Physics/Chemistry Standard',
    subject: 'Physics/Chemistry',
    configuration: {
      section_order: ['aim', 'apparatus', 'procedure', 'observation', 'calculation', 'result', 'precautions'],
      header_font: 'Inter',
      header_color: '#059669',
      include_graph: true,
      accent_color: '#10b981',
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    user_id: 'system',
    name: 'Electronics/CS Standard',
    subject: 'Electronics/CS',
    configuration: {
      section_order: ['aim', 'apparatus', 'procedure', 'observation', 'calculation', 'result'],
      header_font: 'Roboto',
      header_color: '#2563eb',
      include_graph: false,
      accent_color: '#3b82f6',
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export interface TemplatePickerProps {
  selectedTemplateId: string | null;
  subject?: string | null;
  onSelectTemplate: (template: Template) => void;
  readOnly?: boolean;
}

export const TemplatePicker: React.FC<TemplatePickerProps> = ({
  selectedTemplateId,
  subject,
  onSelectTemplate,
  readOnly = false,
}) => {
  const [templates, setTemplates] = useState<Template[]>(DEFAULT_TEMPLATES);
  const [loading, setLoading] = useState<boolean>(true);

  // Fetch templates from database
  useEffect(() => {
    async function fetchTemplates() {
      try {
        setLoading(true);
        const { data, error } = await supabase.from('templates').select('*');
        if (!error && data && data.length > 0) {
          setTemplates(data as Template[]);
        }
      } catch (err) {
        console.error('[TemplatePicker] Error fetching templates:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchTemplates();
  }, []);

  /**
   * REQUIREMENT 2: Auto-suggest default template based on chosen subject
   */
  useEffect(() => {
    if (!subject || selectedTemplateId) return;

    const lowerSubj = subject.toLowerCase();
    const suggested = templates.find((t) => {
      const tSubj = (t.subject || '').toLowerCase();
      if (lowerSubj.includes('physic') || lowerSubj.includes('chem')) {
        return tSubj.includes('physic') || tSubj.includes('chem');
      }
      if (lowerSubj.includes('electr') || lowerSubj.includes('cs') || lowerSubj.includes('computer')) {
        return tSubj.includes('electr') || tSubj.includes('cs');
      }
      return false;
    });

    if (suggested) {
      onSelectTemplate(suggested);
    }
  }, [subject, templates, selectedTemplateId, onSelectTemplate]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider">
          <Layout className="h-4 w-4 text-emerald-400" />
          <span>Select Document Report Layout Template</span>
        </div>

        {subject && (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-0.5 rounded-full">
            <Sparkles className="h-3 w-3" /> Auto-suggested for {subject}
          </span>
        )}
      </div>

      {/* Grid of Template Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map((tpl) => {
          const isSelected = selectedTemplateId === tpl.id;
          const config = (tpl.configuration as any) || {};
          const headerColor = config.header_color || '#059669';
          const accentColor = config.accent_color || '#10b981';
          const font = config.header_font || 'Inter';
          const includeGraph = config.include_graph ?? true;
          const sectionOrder: string[] = config.section_order || [];

          return (
            <div
              key={tpl.id}
              onClick={() => !readOnly && onSelectTemplate(tpl)}
              className={`rounded-2xl border p-5 transition-all cursor-pointer relative flex flex-col justify-between space-y-4 shadow-lg ${
                isSelected
                  ? 'border-2 border-emerald-500 bg-gradient-to-br from-emerald-500/10 via-gray-900 to-cyan-500/10 shadow-emerald-500/10'
                  : 'border-gray-800 bg-gray-900/60 hover:border-gray-700 hover:bg-gray-900/90'
              }`}
            >
              {/* Top Row: Template Title & Selection Checkmark */}
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <h4 className="font-bold text-white text-base flex items-center gap-2">
                    <span>{tpl.name}</span>
                    {tpl.subject && (
                      <span className="text-[10px] font-mono font-bold bg-gray-800 text-gray-300 border border-gray-700 px-2 py-0.5 rounded">
                        {tpl.subject}
                      </span>
                    )}
                  </h4>
                </div>

                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full border transition-all ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-500 text-gray-950 font-bold'
                      : 'border-gray-700 bg-gray-900 text-transparent'
                  }`}
                >
                  <Check className="h-3.5 w-3.5" />
                </div>
              </div>

              {/* Template Features Preview */}
              <div className="space-y-3 pt-1 text-xs">
                {/* Font & Color Swatch Badges */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5 font-mono text-gray-300">
                    <Type className="h-3.5 w-3.5 text-gray-400" />
                    <span>Font: <strong>{font}</strong></span>
                  </div>

                  <div className="flex items-center gap-1.5 font-mono text-gray-300">
                    <Palette className="h-3.5 w-3.5 text-gray-400" />
                    <span>Header Color:</span>
                    <span
                      className="h-3.5 w-3.5 rounded-full inline-block border border-white/20 shadow-sm"
                      style={{ backgroundColor: headerColor }}
                    />
                  </div>
                </div>

                {/* Graph Included Indicator */}
                <div className="flex items-center gap-2 font-mono text-xs">
                  <BarChart2 className={`h-4 w-4 ${includeGraph ? 'text-emerald-400' : 'text-gray-600'}`} />
                  <span className={includeGraph ? 'text-emerald-300' : 'text-gray-500'}>
                    {includeGraph ? 'Automatic Graph Generation Included' : 'No Graph Section'}
                  </span>
                </div>

                {/* Section Order Pills Preview */}
                <div className="space-y-1">
                  <span className="text-[10px] font-mono uppercase text-gray-500">Section Flow:</span>
                  <div className="flex flex-wrap gap-1">
                    {sectionOrder.map((sec, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] font-mono bg-gray-950/80 text-gray-300 border border-gray-800 px-2 py-0.5 rounded capitalize"
                      >
                        {sec}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Selection Status Bar */}
              {isSelected && (
                <div className="pt-2 border-t border-emerald-500/20 text-[11px] font-mono text-emerald-400 flex items-center gap-1.5 font-bold">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Selected Layout Template</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
