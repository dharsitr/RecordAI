import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { supabase } from '../lib/supabase';
import type { Experiment } from '../types/database';

export const GenerateScreen = ({ route, navigation }: any) => {
  const experimentId = route?.params?.experimentId;

  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [loading, setLoading] = useState(true);

  const [pdfSignedUrl, setPdfSignedUrl] = useState<string | null>(null);
  const [docxSignedUrl, setDocxSignedUrl] = useState<string | null>(null);

  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [generatingDocx, setGeneratingDocx] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    async function loadExpData() {
      if (!experimentId) return;
      try {
        setLoading(true);
        const { data: exp } = await supabase
          .from('experiments')
          .select('*')
          .eq('id', experimentId)
          .single();
        if (exp) setExperiment(exp);

        // Check if PDF/DOCX already exists in generated_documents
        const { data: genDocs } = await supabase
          .from('generated_documents')
          .select('*')
          .eq('experiment_id', experimentId);

        if (genDocs && genDocs.length > 0) {
          const pdfDoc = (genDocs as any[]).find((d) => d.format === 'pdf');
          const docxDoc = (genDocs as any[]).find((d) => d.format === 'docx');

          if (pdfDoc?.file_path) {
            const { data: pSigned } = await supabase.storage
              .from('generated-records')
              .createSignedUrl(pdfDoc.file_path, 3600);
            if (pSigned?.signedUrl) setPdfSignedUrl(pSigned.signedUrl);
          }

          if (docxDoc?.file_path) {
            const { data: dSigned } = await supabase.storage
              .from('generated-records')
              .createSignedUrl(docxDoc.file_path, 3600);
            if (dSigned?.signedUrl) setDocxSignedUrl(dSigned.signedUrl);
          }
        }
      } catch (err) {
        console.error('[GenerateScreen] Load error:', err);
      } finally {
        setLoading(false);
      }
    }

    loadExpData();
  }, [experimentId]);

  /**
   * REQUIREMENT 4: Invoke Edge Function "generate-record-pdf"
   */
  const handleGeneratePdf = async () => {
    if (!experimentId) return;
    setGeneratingPdf(true);

    try {
      const { data, error } = await supabase.functions.invoke('generate-record-pdf', {
        body: { experiment_id: experimentId },
      });

      if (error) throw new Error(error.message || 'Edge Function failed');
      if (data && !data.success) throw new Error(data.error || 'PDF generation failed');

      if (data?.signedUrl) {
        setPdfSignedUrl(data.signedUrl);
      }
    } catch (err: any) {
      console.error('[GenerateScreen] PDF generation error:', err);
      Alert.alert('Generation Error', err?.message || 'Failed generating PDF record.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  /**
   * REQUIREMENT 4: Invoke Edge Function "generate-record-docx"
   */
  const handleGenerateDocx = async () => {
    if (!experimentId) return;
    setGeneratingDocx(true);

    try {
      const { data, error } = await supabase.functions.invoke('generate-record-docx', {
        body: { experiment_id: experimentId },
      });

      if (error) throw new Error(error.message || 'Edge Function failed');
      if (data && !data.success) throw new Error(data.error || 'DOCX generation failed');

      if (data?.signedUrl) {
        setDocxSignedUrl(data.signedUrl);
      }
    } catch (err: any) {
      console.error('[GenerateScreen] DOCX generation error:', err);
      Alert.alert('Generation Error', err?.message || 'Failed generating DOCX document.');
    } finally {
      setGeneratingDocx(false);
    }
  };

  /**
   * REQUIREMENT 4: Share PDF via expo-sharing
   */
  const handleSharePdf = async () => {
    if (!pdfSignedUrl) return;
    setSharing(true);

    try {
      const filename = `recordai_${experiment?.experiment_number || 'report'}.pdf`;
      const localUri = `${FileSystem.documentDirectory}${filename}`;

      // Download file to local mobile cache
      const downloadRes = await FileSystem.downloadAsync(pdfSignedUrl, localUri);

      // Check if sharing is available on device
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(downloadRes.uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Share ${experiment?.title || 'Lab Record'} PDF`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('Sharing Unavailable', 'Sharing is not supported on this device.');
      }
    } catch (err: any) {
      console.error('[GenerateScreen] Share error:', err);
      Alert.alert('Share Error', err?.message || 'Failed sharing PDF document.');
    } finally {
      setSharing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.badgeText}>EXPORT & SHARE REPORT</Text>
          <Text style={styles.title}>{experiment?.title || 'Experiment Record'}</Text>
          <Text style={styles.subtitle}>
            Code: {experiment?.experiment_number || 'EXP'} • {experiment?.subject || 'Science'}
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#10b981" />
          </View>
        ) : (
          <View style={styles.cardsSection}>
            {/* PDF CARD */}
            <View style={styles.exportCard}>
              <Text style={styles.cardHeader}>Formal PDF Lab Report</Text>
              <Text style={styles.cardDesc}>
                Compiles title block, ordered sections, observation tables, verified calculations, and data visualization charts.
              </Text>

              {pdfSignedUrl ? (
                <View style={styles.btnRow}>
                  <TouchableOpacity
                    style={[styles.shareBtn, sharing && styles.disabledBtn]}
                    onPress={handleSharePdf}
                    disabled={sharing}
                  >
                    {sharing ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <Text style={styles.shareBtnText}>📤 Share / Open PDF</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.regenBtn} onPress={handleGeneratePdf}>
                    <Text style={styles.regenBtnText}>Regenerate</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.primaryBtn, generatingPdf && styles.disabledBtn]}
                  onPress={handleGeneratePdf}
                  disabled={generatingPdf}
                >
                  {generatingPdf ? (
                    <ActivityIndicator color="#0b0f19" />
                  ) : (
                    <Text style={styles.primaryBtnText}>✨ Generate PDF Report</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {/* DOCX CARD */}
            <View style={styles.exportCard}>
              <Text style={styles.cardHeader}>Microsoft Word (.docx)</Text>
              <Text style={styles.cardDesc}>
                Editable Word document output suitable for manuscript submission or lab archive.
              </Text>

              <TouchableOpacity
                style={[styles.docxBtn, generatingDocx && styles.disabledBtn]}
                onPress={handleGenerateDocx}
                disabled={generatingDocx}
              >
                {generatingDocx ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.docxBtnText}>
                    {docxSignedUrl ? '✨ Regenerate Word (.docx)' : '✨ Generate Word (.docx)'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={styles.doneBtn}
          onPress={() => navigation.navigate('Dashboard')}
        >
          <Text style={styles.doneBtnText}>Return to Dashboard</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0f19',
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    marginBottom: 24,
  },
  badgeText: {
    color: '#10b981',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#9ca3af',
  },
  loadingBox: {
    padding: 40,
    alignItems: 'center',
  },
  cardsSection: {
    gap: 16,
    marginBottom: 24,
  },
  exportCard: {
    backgroundColor: '#111827',
    borderColor: '#1f2937',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  cardHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 6,
  },
  cardDesc: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 16,
    lineHeight: 18,
  },
  primaryBtn: {
    backgroundColor: '#10b981',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#0b0f19',
    fontSize: 15,
    fontWeight: '800',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  shareBtn: {
    flex: 2,
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  shareBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  regenBtn: {
    flex: 1,
    backgroundColor: '#1f2937',
    borderColor: '#374151',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  regenBtnText: {
    color: '#9ca3af',
    fontSize: 13,
    fontWeight: '600',
  },
  docxBtn: {
    backgroundColor: '#0284c7',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  docxBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  disabledBtn: {
    opacity: 0.5,
  },
  doneBtn: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  doneBtnText: {
    color: '#d1d5db',
    fontSize: 14,
    fontWeight: '700',
  },
});
