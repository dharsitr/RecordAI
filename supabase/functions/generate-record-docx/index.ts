/// <reference path="../deno.d.ts" />

// ==============================================================================
// Supabase Edge Function: generate-record-docx
// Description: Formatted Microsoft Word (.docx) document generation for verified
// laboratory records using the docx package and shared experimentData module.
// ==============================================================================

import { createClient } from '@supabase/supabase-js';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  ShadingType,
} from 'https://esm.sh/docx@9.0.3';
import {
  fetchExperimentRecordData,
  SECTION_TITLES,
  DEFAULT_SECTION_ORDER,
} from '../_shared/experimentData.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const { experiment_id } = await req.json();

    if (!experiment_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required "experiment_id" parameter.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Initialize Supabase Client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || '';

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch Experiment Data using Shared Module
    const {
      experiment: exp,
      templateConfig,
      sections,
      sectionMap,
      tables,
      calculations,
      chartTable,
    } = await fetchExperimentRecordData(supabase, experiment_id);

    // Document Children Elements Array
    const docChildren: any[] = [];

    // --- A. TITLE BLOCK ---
    docChildren.push(
      new Paragraph({
        text: 'RECORD AI — LABORATORY RECORD REPORT',
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: 'TITLE: ', bold: true, size: 24 }),
          new TextRun({ text: (exp.title || '').toUpperCase(), bold: true, size: 24, color: '059669' }),
        ],
        spacing: { after: 80 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: `Experiment Code: ${exp.experiment_number || 'N/A'}  |  `, bold: true, size: 20 }),
          new TextRun({ text: `Subject: ${exp.subject || 'General Science'}  |  `, size: 20 }),
          new TextRun({ text: `Date: ${new Date(exp.created_at).toLocaleDateString()}`, size: 20 }),
        ],
        spacing: { after: 240 },
      })
    );

    const definedOrder: string[] = templateConfig.section_order || DEFAULT_SECTION_ORDER;

    // --- B. CANONICAL SECTIONS FLOW ---
    definedOrder.forEach((secKey) => {
      const secData = sectionMap[secKey];
      const titleText = SECTION_TITLES[secKey] || secKey.toUpperCase();
      const contentText = secData?.content?.trim() || '(No content recorded for this section)';

      // Section Heading
      docChildren.push(
        new Paragraph({
          text: titleText,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 120 },
        })
      );

      // Section Content Lines
      const lines = contentText.split('\n');
      lines.forEach((line: string) => {
        const trimmed = line.trim();
        if (trimmed) {
          docChildren.push(
            new Paragraph({
              children: [new TextRun({ text: trimmed, size: 22 })],
              spacing: { after: 80 },
            })
          );
        }
      });

      // --- C. OBSERVATION TABLES ---
      if (secKey === 'observation' && tables.length > 0) {
        tables.forEach((tbl: any, tblIdx: number) => {
          const dataObj = tbl.data_json || {};
          const headers: string[] = Array.isArray(dataObj.headers) ? dataObj.headers : [];
          const rows: string[][] = Array.isArray(dataObj.rows) ? dataObj.rows : [];

          if (headers.length > 0) {
            docChildren.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: `Table ${tblIdx + 1}: ${tbl.title || 'Observation Table'}`,
                    bold: true,
                    size: 22,
                    color: '059669',
                  }),
                ],
                spacing: { before: 160, after: 120 },
              })
            );

            // Build DOCX Table Rows
            const docxTableRows: TableRow[] = [];

            // Header Row
            const headerCells = headers.map(
              (h) =>
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [new TextRun({ text: String(h), bold: true, color: 'FFFFFF', size: 20 })],
                      alignment: AlignmentType.CENTER,
                    }),
                  ],
                  shading: { fill: '059669', type: ShadingType.CLEAR },
                  width: { size: Math.floor(100 / headers.length), type: WidthType.PERCENTAGE },
                })
            );
            docxTableRows.push(new TableRow({ children: headerCells }));

            // Data Rows
            rows.forEach((row, rIdx) => {
              const rowCells = headers.map((_, cIdx) => {
                const cellVal = row[cIdx] !== undefined ? String(row[cIdx]) : '';
                return new TableCell({
                  children: [
                    new Paragraph({
                      children: [new TextRun({ text: cellVal, size: 20 })],
                    }),
                  ],
                  shading: {
                    fill: rIdx % 2 === 0 ? 'F9FAFB' : 'F3F4F6',
                    type: ShadingType.CLEAR,
                  },
                  width: { size: Math.floor(100 / headers.length), type: WidthType.PERCENTAGE },
                });
              });
              docxTableRows.push(new TableRow({ children: rowCells }));
            });

            docChildren.push(
              new Table({
                rows: docxTableRows,
                width: { size: 100, type: WidthType.PERCENTAGE },
              })
            );
          }
        });
      }

      // --- D. CALCULATIONS ---
      if (secKey === 'calculation' && calculations && calculations.length > 0) {
        docChildren.push(
          new Paragraph({
            children: [new TextRun({ text: 'Verified Calculation Results:', bold: true, size: 22 })],
            spacing: { before: 160, after: 80 },
          })
        );

        calculations.forEach((calc: any) => {
          const statusText = (calc.verification_status || 'pending').toUpperCase();
          docChildren.push(
            new Paragraph({
              children: [
                new TextRun({ text: `•  ${calc.expression} = `, size: 20 }),
                new TextRun({ text: `${calc.output || 'N/A'} `, bold: true, size: 20, color: '059669' }),
                new TextRun({ text: `[Status: ${statusText}]`, size: 18, color: '6B7280' }),
              ],
              spacing: { after: 60 },
            })
          );
        });
      }
    });

    // --- E. GRAPH VISUALIZATION SUMMARY ---
    if (chartTable && templateConfig.include_graph !== false) {
      const cConfig = chartTable.data_json.chartConfig;
      docChildren.push(
        new Paragraph({
          text: `DATA VISUALIZATION GRAPH (${(cConfig.type || 'line').toUpperCase()} CHART)`,
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 240, after: 80 },
        }),
        new Paragraph({
          children: [
            new TextRun({ text: `X-Axis: ${cConfig.xHeader || 'X Column'}  |  Y-Axis: ${cConfig.yHeader || 'Y Column'}`, bold: true, size: 20 }),
          ],
          spacing: { after: 60 },
        }),
        new Paragraph({
          children: [
            new TextRun({ text: `Source Table: "${chartTable.title || 'Observation Table'}" — Embedded chart configuration saved for digital report archive.`, italic: true, size: 18, color: '6B7280' }),
          ],
          spacing: { after: 200 },
        })
      );
    }

    // Instantiate docx Document
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: docChildren,
        },
      ],
    });

    // Generate Word Document Buffer
    const docxBuffer = await Packer.toBuffer(doc);

    // =========================================================================
    // UPLOAD TO BUCKET & INSERT GENERATED_DOCUMENTS ROW
    // =========================================================================
    const filePath = `${experiment_id}/report_${Date.now()}.docx`;

    const { error: uploadErr } = await supabase.storage
      .from('generated-records')
      .upload(filePath, docxBuffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        upsert: true,
      });

    if (uploadErr) {
      throw new Error(`Storage upload error: ${uploadErr.message}`);
    }

    // Insert generated_documents record
    const { data: genDoc, error: genErr } = await supabase
      .from('generated_documents')
      .insert({
        experiment_id,
        format: 'docx',
        file_path: filePath,
      })
      .select()
      .single();

    if (genErr) {
      console.warn('[generate-record-docx] Insert generated_documents warning:', genErr);
    }

    // Create Signed URL (valid for 1 hour)
    const { data: signedData, error: signedErr } = await supabase.storage
      .from('generated-records')
      .createSignedUrl(filePath, 3600);

    if (signedErr) {
      throw new Error(`Signed URL creation failed: ${signedErr.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        file_path: filePath,
        signedUrl: signedData?.signedUrl || null,
        document_id: genDoc?.id || null,
      }),
      { headers: CORS_HEADERS }
    );
  } catch (err: any) {
    console.error('[generate-record-docx] Execution error:', err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Word document generation failed.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
});
