/// <reference path="../deno.d.ts" />

// ==============================================================================
// Supabase Edge Function: generate-record-pdf
// Description: Formatted PDF document generation for verified laboratory records.
// Renders Title Block, Canonical Sections, Observation Tables, Calculations,
// and Graph Configs using pdf-lib. Uploads PDF to generated-records bucket.
// ==============================================================================

import { createClient } from '@supabase/supabase-js';
import { PDFDocument, rgb, StandardFonts } from 'https://esm.sh/pdf-lib@1.17.1';
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
      tables,
      calculations,
    } = await fetchExperimentRecordData(supabase, experiment_id);

    // =========================================================================
    // BUILD PDF DOCUMENT USING PDF-LIB
    // =========================================================================
    const pdfDoc = await PDFDocument.create();
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const pageSize: [number, number] = [595.28, 841.89]; // A4 (points)
    let page = pdfDoc.addPage(pageSize);
    let { width, height } = page.getSize();
    let y = height - 50; // top margin

    const ensureSpace = (needed: number) => {
      if (y - needed < 50) {
        page = pdfDoc.addPage(pageSize);
        y = height - 50;
      }
    };

    // Color definitions
    const primaryColor = rgb(0.02, 0.59, 0.41); // Emerald #059669
    const darkGray = rgb(0.1, 0.1, 0.15);
    const lightGray = rgb(0.95, 0.96, 0.98);
    const borderGray = rgb(0.8, 0.8, 0.85);

    // --- A. TITLE BLOCK ---
    page.drawRectangle({
      x: 40,
      y: y - 55,
      width: width - 80,
      height: 60,
      color: primaryColor,
    });

    page.drawText('RECORD AI — LABORATORY RECORD REPORT', {
      x: 55,
      y: y - 25,
      size: 14,
      font: fontBold,
      color: rgb(1, 1, 1),
    });

    page.drawText(`Exp Code: ${exp.experiment_number || 'N/A'} | Date: ${new Date(exp.created_at).toLocaleDateString()}`, {
      x: 55,
      y: y - 45,
      size: 10,
      font: fontRegular,
      color: rgb(0.9, 1, 0.95),
    });

    y -= 75;

    // Experiment Title & Subject
    ensureSpace(40);
    page.drawText(`TITLE: ${exp.title.toUpperCase()}`, {
      x: 40,
      y,
      size: 12,
      font: fontBold,
      color: darkGray,
    });
    y -= 18;

    page.drawText(`Subject: ${exp.subject || 'General Laboratory Science'}`, {
      x: 40,
      y,
      size: 10,
      font: fontRegular,
      color: rgb(0.4, 0.4, 0.5),
    });
    y -= 25;

    // Horizontal Separator Rule
    page.drawLine({
      start: { x: 40, y },
      end: { x: width - 40, y },
      thickness: 1,
      color: borderGray,
    });
    y -= 20;

    // Map Sections by Section Type
    const sectionMap: Record<string, any> = {};
    sections.forEach((sec) => {
      sectionMap[(sec.section_type || '').toLowerCase()] = sec;
    });

    const definedOrder: string[] = templateConfig.section_order || DEFAULT_SECTION_ORDER;

    // --- B. SECTIONS RENDER LOOP ---
    definedOrder.forEach((secKey) => {
      const secData = sectionMap[secKey];
      const titleText = SECTION_TITLES[secKey] || secKey.toUpperCase();
      const contentText = secData?.content?.trim() || '(No content recorded for this section)';

      ensureSpace(45);

      // Section Header Box
      page.drawRectangle({
        x: 40,
        y: y - 18,
        width: width - 80,
        height: 22,
        color: lightGray,
      });

      page.drawText(titleText, {
        x: 48,
        y: y - 13,
        size: 11,
        font: fontBold,
        color: primaryColor,
      });

      y -= 30;

      // Section Content Lines
      const lines = contentText.split('\n');
      lines.forEach((line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        // Wrap long text lines to fit page width
        const maxChar = 85;
        for (let i = 0; i < trimmed.length; i += maxChar) {
          const chunk = trimmed.substring(i, i + maxChar);
          ensureSpace(16);
          page.drawText(chunk, {
            x: 48,
            y,
            size: 9.5,
            font: fontRegular,
            color: darkGray,
          });
          y -= 14;
        }
      });

      y -= 10;

      // --- C. SPECIAL INLINE TABLE RENDER FOR OBSERVATION SECTION ---
      if (secKey === 'observation' && tables.length > 0) {
        tables.forEach((tbl: any, tblIdx: number) => {
          const dataObj = tbl.data_json || {};
          const headers: string[] = Array.isArray(dataObj.headers) ? dataObj.headers : [];
          const rows: string[][] = Array.isArray(dataObj.rows) ? dataObj.rows : [];

          if (headers.length > 0) {
            ensureSpace(50);
            page.drawText(`Table ${tblIdx + 1}: ${tbl.title || 'Observation Table'}`, {
              x: 48,
              y,
              size: 10,
              font: fontBold,
              color: darkGray,
            });
            y -= 16;

            // Render Table Header Row
            const colWidth = Math.min(120, (width - 100) / headers.length);
            ensureSpace(20);

            page.drawRectangle({
              x: 48,
              y: y - 16,
              width: headers.length * colWidth,
              height: 20,
              color: primaryColor,
            });

            headers.forEach((h, hIdx) => {
              page.drawText(String(h).substring(0, 15), {
                x: 52 + hIdx * colWidth,
                y: y - 12,
                size: 9,
                font: fontBold,
                color: rgb(1, 1, 1),
              });
            });
            y -= 22;

            // Render Table Rows
            rows.forEach((row, rIdx) => {
              ensureSpace(18);
              const isEven = rIdx % 2 === 0;

              page.drawRectangle({
                x: 48,
                y: y - 14,
                width: headers.length * colWidth,
                height: 18,
                color: isEven ? rgb(0.98, 0.98, 0.99) : rgb(0.93, 0.94, 0.96),
              });

              row.forEach((cellVal, cIdx) => {
                if (cIdx < headers.length) {
                  page.drawText(String(cellVal ?? '').substring(0, 18), {
                    x: 52 + cIdx * colWidth,
                    y: y - 10,
                    size: 8.5,
                    font: fontRegular,
                    color: darkGray,
                  });
                }
              });
              y -= 18;
            });

            y -= 15;
          }
        });
      }

      // --- D. SPECIAL INLINE CALCULATIONS RENDER ---
      if (secKey === 'calculation' && calculations && calculations.length > 0) {
        ensureSpace(30);
        page.drawText('Verified Calculation Results:', {
          x: 48,
          y,
          size: 10,
          font: fontBold,
          color: darkGray,
        });
        y -= 16;

        calculations.forEach((calc: any) => {
          ensureSpace(16);
          const statusText = (calc.verification_status || 'pending').toUpperCase();
          page.drawText(`• ${calc.expression} = ${calc.output || 'N/A'} [Status: ${statusText}]`, {
            x: 55,
            y,
            size: 9,
            font: fontRegular,
            color: darkGray,
          });
          y -= 14;
        });

        y -= 10;
      }
    });

    // --- E. GRAPH VISUALIZATION SUMMARY (IF SAVED GRAPH CONFIG EXISTS) ---
    const chartTable = tables.find((t: any) => t.data_json && t.data_json.chartConfig);
    if (chartTable && templateConfig.include_graph !== false) {
      const cConfig = chartTable.data_json.chartConfig;
      ensureSpace(80);

      page.drawRectangle({
        x: 40,
        y: y - 65,
        width: width - 80,
        height: 70,
        color: rgb(0.94, 0.97, 1.0),
        borderColor: rgb(0.7, 0.85, 1.0),
        borderWidth: 1,
      });

      page.drawText(`DATA VISUALIZATION GRAPH (${(cConfig.type || 'line').toUpperCase()} CHART)`, {
        x: 55,
        y: y - 20,
        size: 10.5,
        font: fontBold,
        color: rgb(0.15, 0.4, 0.8),
      });

      page.drawText(`X-Axis: ${cConfig.xHeader || 'X Column'} | Y-Axis: ${cConfig.yHeader || 'Y Column'}`, {
        x: 55,
        y: y - 36,
        size: 9.5,
        font: fontRegular,
        color: darkGray,
      });

      page.drawText(`Source Table: "${chartTable.title || 'Observation Table'}" — Graph saved for digital report compilation.`, {
        x: 55,
        y: y - 52,
        size: 8.5,
        font: fontRegular,
        color: rgb(0.4, 0.4, 0.5),
      });

      y -= 80;
    }

    // Footer Page Numbering
    const pageCount = pdfDoc.getPageCount();
    for (let i = 0; i < pageCount; i++) {
      const p = pdfDoc.getPage(i);
      p.drawText(`RecordAI Digital Lab Report — Page ${i + 1} of ${pageCount}`, {
        x: width / 2 - 100,
        y: 20,
        size: 8,
        font: fontRegular,
        color: rgb(0.5, 0.5, 0.5),
      });
    }

    // Save PDF Bytes
    const pdfBytes = await pdfDoc.save();

    // =========================================================================
    // UPLOAD TO BUCKET & INSERT GENERATED_DOCUMENTS ROW
    // =========================================================================
    const filePath = `${experiment_id}/report_${Date.now()}.pdf`;

    const { error: uploadErr } = await supabase.storage
      .from('generated-records')
      .upload(filePath, pdfBytes, {
        contentType: 'application/pdf',
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
        format: 'pdf',
        file_path: filePath,
      })
      .select()
      .single();

    if (genErr) {
      console.warn('[generate-record-pdf] Insert generated_documents warning:', genErr);
    }

    // Create Signed URL valid for 1 hour (3600 seconds)
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
    console.error('[generate-record-pdf] Fatal execution error:', err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'PDF generation failed.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
});
