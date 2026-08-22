import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  SafeAreaView,
  Alert,
  Platform,
} from 'react-native';
import { supabase } from '../lib/supabase';
import type { Document, Experiment, ObservationTable, Section } from '../types/database';
import { MobileTableEditor } from '../components/MobileTableEditor';

const CANONICAL_SECTIONS = [
  { key: 'aim', title: 'Aim / Objective' },
  { key: 'apparatus', title: 'Apparatus & Reagents' },
  { key: 'procedure', title: 'Procedure & Protocol' },
  { key: 'observation', title: 'Observations & Data' },
  { key: 'calculation', title: 'Calculations & Formulas' },
  { key: 'result', title: 'Results & Conclusion' },
  { key: 'precautions', title: 'Precautions & Safety' },
];

export const VerifyScreen = ({ route, navigation }: any) => {
  const experimentId = route?.params?.experimentId;

  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [tables, setTables] = useState<ObservationTable[]>([]);
  const [signedImageUrls, setSignedImageUrls] = useState<Record<string, string>>({});
  const [activeDocIndex, setActiveDocIndex] = useState(0);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [sectionMap, setSectionMap] = useState<
    Record<string, { id?: string; section_type: string; content: string; confidence: number | null }>
  >({});

  useEffect(() => {
    async function loadVerificationData() {
      if (!experimentId) return;
      try {
        setLoading(true);

        // Fetch Experiment
        const { data: exp } = await supabase
          .from('experiments')
          .select('*')
          .eq('id', experimentId)
          .single();
        if (exp) setExperiment(exp);

        // Fetch Documents
        const { data: docs } = await supabase
          .from('documents')
          .select('*')
          .eq('experiment_id', experimentId)
          .order('created_at', { ascending: true });

        if (docs) {
          setDocuments(docs);
          const urlMap: Record<string, string> = {};
          for (const d of docs) {
            const { data: pubData } = supabase.storage.from('lab-uploads').getPublicUrl(d.file_path);
            if (pubData?.publicUrl) urlMap[d.id] = pubData.publicUrl;
          }
          setSignedImageUrls(urlMap);

          const docIds = docs.map((d) => d.id);

          // Fetch Sections
          const { data: secData } = await supabase
            .from('sections')
            .select('*')
            .in('document_id', docIds);

          const sMap: Record<string, any> = {};
          CANONICAL_SECTIONS.forEach((s) => {
            sMap[s.key] = { section_type: s.key, content: '', confidence: null };
          });

          if (secData) {
            secData.forEach((s) => {
              const k = (s.section_type || '').toLowerCase();
              sMap[k] = {
                id: s.id,
                section_type: s.section_type,
                content: s.content || '',
                confidence: s.confidence ?? null,
              };
            });
          }
          setSectionMap(sMap);

          // Fetch Tables
          const { data: tblData } = await supabase
            .from('observation_tables')
            .select('*')
            .in('document_id', docIds);
          if (tblData) setTables(tblData);
        }
      } catch (err) {
        console.error('[VerifyScreen] Load error:', err);
      } finally {
        setLoading(false);
      }
    }

    loadVerificationData();
  }, [experimentId]);

  const handleSectionContentChange = (key: string, text: string) => {
    setSectionMap((prev) => ({
      ...prev,
      [key]: { ...prev[key], content: text },
    }));
  };

  const handleSaveAndContinue = async () => {
    if (documents.length === 0) return;
    setSaving(true);

    try {
      const primaryDocId = documents[0].id;

      // Save sections
      const secPromises = Object.values(sectionMap).map(async (item) => {
        if (!item.content && !item.id) return;
        if (item.id) {
          await supabase.from('sections').update({ content: item.content }).eq('id', item.id);
        } else {
          await supabase.from('sections').insert({
            document_id: primaryDocId,
            section_type: item.section_type,
            content: item.content,
            confidence: 1.0,
          });
        }
      });

      await Promise.all(secPromises);

      // Navigate to Generate Export Screen
      navigation.navigate('Generate', { experimentId });
    } catch (err: any) {
      console.error('[VerifyScreen] Save error:', err);
      Alert.alert('Save Error', err?.message || 'Error saving verification edits.');
    } finally {
      setSaving(false);
    }
  };

  const activeDoc = documents[activeDocIndex];
  const activeImageUrl = activeDoc ? signedImageUrls[activeDoc.id] : null;

  if (loading) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={styles.loadingText}>Loading notebook scan and extracted sections...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* REQUIREMENT 1: STACKED LAYOUT — TOP: SCAN IMAGE VIEWER */}
        <View style={styles.imageViewerCard}>
          <View style={styles.imageHeader}>
            <Text style={styles.imageTitle}>Notebook Page Scan ({activeDocIndex + 1}/{documents.length})</Text>
            {documents.length > 1 && (
              <View style={styles.pageNav}>
                <TouchableOpacity
                  disabled={activeDocIndex === 0}
                  onPress={() => setActiveDocIndex((prev) => Math.max(prev - 1, 0))}
                  style={styles.pageBtn}
                >
                  <Text style={styles.pageBtnText}>◀ Prev</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={activeDocIndex === documents.length - 1}
                  onPress={() => setActiveDocIndex((prev) => Math.min(prev + 1, documents.length - 1))}
                  style={styles.pageBtn}
                >
                  <Text style={styles.pageBtnText}>Next ▶</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {activeImageUrl ? (
            <Image source={{ uri: activeImageUrl }} style={styles.scanImage} resizeMode="contain" />
          ) : (
            <View style={styles.noImgBox}>
              <Text style={styles.noImgText}>No scan preview available</Text>
            </View>
          )}
        </View>

        {/* STACKED LAYOUT — BOTTOM: EXTRACTED SECTIONS EDITOR */}
        <View style={styles.sectionsContainer}>
          <Text style={styles.sectionHeading}>Extracted Notebook Sections</Text>

          {CANONICAL_SECTIONS.map((secDef) => {
            const secData = sectionMap[secDef.key] || { section_type: secDef.key, content: '', confidence: null };
            const isLowConfidence = secData.confidence !== null && secData.confidence < 0.7;
            const isObservation = secDef.key === 'observation';

            return (
              <View
                key={secDef.key}
                style={[
                  styles.sectionCard,
                  isLowConfidence && styles.lowConfidenceCard,
                ]}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.secTitle}>{secDef.title}</Text>

                  {/* REQUIREMENT 2: CONFIDENCE FLAG STYLING */}
                  {isLowConfidence ? (
                    <View style={styles.flagBadge}>
                      <Text style={styles.flagText}>⚠️ Low Confidence ({Math.round(secData.confidence! * 100)}%)</Text>
                    </View>
                  ) : secData.confidence !== null ? (
                    <View style={styles.highBadge}>
                      <Text style={styles.highText}>✨ {Math.round(secData.confidence * 100)}% Confidence</Text>
                    </View>
                  ) : null}
                </View>

                <TextInput
                  style={[styles.secInput, isLowConfidence && styles.lowConfidenceInput]}
                  multiline
                  value={secData.content}
                  onChangeText={(text) => handleSectionContentChange(secDef.key, text)}
                  placeholder={`Enter ${secDef.title} content...`}
                  placeholderTextColor="#6b7280"
                />

                {/* Inline Mobile Table Editor */}
                {isObservation && (
                  <View style={styles.tableBlock}>
                    <Text style={styles.tableBlockTitle}>Observation Data Tables</Text>
                    {tables.map((tbl) => (
                      <MobileTableEditor key={tbl.id} table={tbl} />
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Action Button: Save & Continue to Export */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.disabledBtn]}
          onPress={handleSaveAndContinue}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#0b0f19" />
          ) : (
            <Text style={styles.saveBtnText}>Save & Continue to Export &rarr;</Text>
          )}
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
    padding: 16,
    paddingBottom: 40,
  },
  loadingBox: {
    flex: 1,
    backgroundColor: '#0b0f19',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#9ca3af',
    fontSize: 13,
  },
  imageViewerCard: {
    backgroundColor: '#111827',
    borderColor: '#1f2937',
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
  },
  imageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  imageTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10b981',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  pageNav: {
    flexDirection: 'row',
    gap: 8,
  },
  pageBtn: {
    backgroundColor: '#1f2937',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  pageBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
  scanImage: {
    width: '100%',
    height: 250,
    borderRadius: 10,
    backgroundColor: '#050811',
  },
  noImgBox: {
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noImgText: {
    color: '#6b7280',
    fontSize: 13,
  },
  sectionsContainer: {
    gap: 14,
    marginBottom: 20,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 4,
  },
  sectionCard: {
    backgroundColor: '#111827',
    borderColor: '#1f2937',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  lowConfidenceCard: {
    borderColor: '#f59e0b',
    borderLeftWidth: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.05)',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  secTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  flagBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.4)',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  flagText: {
    color: '#fbbf24',
    fontSize: 10,
    fontWeight: '700',
  },
  highBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  highText: {
    color: '#34d399',
    fontSize: 10,
    fontWeight: '600',
  },
  secInput: {
    backgroundColor: '#0b0f19',
    borderColor: '#1f2937',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    color: '#ffffff',
    fontSize: 13,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  lowConfidenceInput: {
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  tableBlock: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
  },
  tableBlockTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#06b6d4',
    marginBottom: 6,
  },
  saveBtn: {
    backgroundColor: '#10b981',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  disabledBtn: {
    opacity: 0.5,
  },
  saveBtnText: {
    color: '#0b0f19',
    fontSize: 15,
    fontWeight: '800',
  },
});
