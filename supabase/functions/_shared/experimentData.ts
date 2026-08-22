/// <reference path="../deno.d.ts" />

// ==============================================================================
// Shared Module: experimentData.ts
// Shared data-fetching logic for PDF and DOCX document generation edge functions.
// ==============================================================================

export const SECTION_TITLES: Record<string, string> = {
  aim: '1. Aim / Objective',
  apparatus: '2. Apparatus & Reagents',
  procedure: '3. Procedure & Protocol',
  observation: '4. Observations & Data',
  calculation: '5. Calculations & Formulas',
  result: '6. Results & Conclusion',
  precautions: '7. Precautions & Safety',
};

export const DEFAULT_SECTION_ORDER = [
  'aim',
  'apparatus',
  'procedure',
  'observation',
  'calculation',
  'result',
  'precautions',
];

export interface ExperimentRecordPayload {
  experiment: any;
  templateConfig: {
    section_order: string[];
    header_font: string;
    header_color: string;
    include_graph: boolean;
    accent_color?: string;
  };
  sections: any[];
  sectionMap: Record<string, any>;
  tables: any[];
  calculations: any[];
  chartTable: any | null;
}

/**
 * Fetches all experiment data, sections, tables, calculations, and template configurations.
 */
export async function fetchExperimentRecordData(
  supabase: any,
  experiment_id: string
): Promise<ExperimentRecordPayload> {
  // 1. Fetch Experiment
  const { data: exp, error: expErr } = await supabase
    .from('experiments')
    .select('*')
    .eq('id', experiment_id)
    .single();

  if (expErr || !exp) {
    throw new Error(`Experiment not found: ${expErr?.message || ''}`);
  }

  // 2. Fetch Selected Template (or default fallback)
  let templateConfig = {
    section_order: DEFAULT_SECTION_ORDER,
    header_font: 'Helvetica',
    header_color: '#059669',
    include_graph: true,
  };

  if (exp.template_id) {
    const { data: tplData } = await supabase
      .from('templates')
      .select('*')
      .eq('id', exp.template_id)
      .single();

    if (tplData && tplData.configuration) {
      templateConfig = { ...templateConfig, ...tplData.configuration };
    }
  }

  // 3. Fetch Documents, Sections, Observation Tables & Calculations
  const { data: docs } = await supabase
    .from('documents')
    .select('*')
    .eq('experiment_id', experiment_id);

  const docIds = (docs || []).map((d: any) => d.id);

  let sections: any[] = [];
  let tables: any[] = [];

  if (docIds.length > 0) {
    const { data: secData } = await supabase
      .from('sections')
      .select('*')
      .in('document_id', docIds);
    if (secData) sections = secData;

    const { data: tblData } = await supabase
      .from('observation_tables')
      .select('*')
      .in('document_id', docIds);
    if (tblData) tables = tblData;
  }

  const { data: calculations } = await supabase
    .from('calculations')
    .select('*')
    .eq('experiment_id', experiment_id);

  // Map Sections by Section Type
  const sectionMap: Record<string, any> = {};
  sections.forEach((sec) => {
    sectionMap[(sec.section_type || '').toLowerCase()] = sec;
  });

  // Find Table with Saved Graph Config
  const chartTable = tables.find((t: any) => t.data_json && t.data_json.chartConfig) || null;

  return {
    experiment: exp,
    templateConfig,
    sections,
    sectionMap,
    tables,
    calculations: calculations || [],
    chartTable,
  };
}
