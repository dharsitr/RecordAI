import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Image,
  Alert,
  SafeAreaView,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export const NewRecordScreen = ({ navigation }: any) => {
  const { user } = useAuth();

  // Wizard Step: 1 = Form Details, 2 = Photo Capture & Upload
  const [step, setStep] = useState<1 | 2>(1);

  // Form State
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('Physics');
  const [expNumber, setExpNumber] = useState(
    `EXP-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`
  );

  // Created Experiment State
  const [createdExpId, setCreatedExpId] = useState<string | null>(null);

  // Image Capture & Upload State
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 1. Create Experiment Row in Supabase
  const handleCreateExperiment = async () => {
    setErrorMsg(null);
    if (!title.trim()) {
      setErrorMsg('Please enter an experiment title.');
      return;
    }

    if (!user) {
      setErrorMsg('User authentication required.');
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('experiments')
        .insert({
          user_id: user.id,
          title: title.trim(),
          subject: subject.trim(),
          experiment_number: expNumber.trim(),
        } as any)
        .select()
        .single();

      if (error) throw error;
      if (data) {
        setCreatedExpId((data as any).id);
        setStep(2);
      }
    } catch (err: any) {
      console.error('[NewRecordScreen] Create experiment error:', err);
      setErrorMsg(err?.message || 'Failed creating experiment record.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Capture Photo via Camera
  const handleTakePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Denied', 'Camera access permission is required to capture photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setCapturedImages((prev) => [...prev, result.assets[0].uri]);
    }
  };

  // 3. Select Photos from Gallery
  const handlePickGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Denied', 'Media library access is required to select photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets) {
      const newUris = result.assets.map((a: any) => a.uri);
      setCapturedImages((prev) => [...prev, ...newUris]);
    }
  };

  // 4. Upload Captured Photos to "lab-uploads" Bucket & Insert "documents" Rows
  const handleUploadAndFinish = async () => {
    if (!createdExpId || capturedImages.length === 0) return;

    setUploading(true);
    setErrorMsg(null);

    try {
      for (let i = 0; i < capturedImages.length; i++) {
        const imageUri = capturedImages[i];
        const fileName = `${createdExpId}/${Date.now()}_${i}.jpg`;

        // Fetch image as blob for React Native upload
        const response = await fetch(imageUri);
        const blob = await response.blob();

        // Upload to "lab-uploads" Storage bucket
        const { error: uploadErr } = await supabase.storage
          .from('lab-uploads')
          .upload(fileName, blob, {
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (uploadErr) throw new Error(`Upload error: ${uploadErr.message}`);

        // Insert matching document record
        const { data: docData, error: docErr } = await supabase
          .from('documents')
          .insert({
            experiment_id: createdExpId,
            file_path: fileName,
            file_type: 'image/jpeg',
            processing_status: 'uploaded',
          } as any)
          .select()
          .single();

        if (docErr) throw new Error(`Document insert error: ${docErr.message}`);

        // Automatically invoke Edge Function "extract-lab-record" if available
        if (docData) {
          supabase.functions.invoke('extract-lab-record', {
            body: { document_id: (docData as any).id },
          }).catch((e) => console.warn('Edge function invoke warning:', e));
        }
      }

      Alert.alert('Success', 'Notebook scan pages uploaded successfully!', [
        { text: 'Go to Dashboard', onPress: () => navigation.navigate('Dashboard') },
      ]);
    } catch (err: any) {
      console.error('[NewRecordScreen] Upload error:', err);
      setErrorMsg(err?.message || 'Error uploading notebook photos.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.badgeText}>MOBILE CAPTURE WIZARD</Text>
          <Text style={styles.title}>
            {step === 1 ? 'New Lab Record' : 'Capture Notebook Scans'}
          </Text>
        </View>

        {errorMsg && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        {/* STEP 1: FORM DETAILS */}
        {step === 1 && (
          <View style={styles.formSection}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>EXPERIMENT TITLE</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Acid-Base Titration & Molarity Analysis"
                placeholderTextColor="#6b7280"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>SUBJECT / DOMAIN</Text>
              <TextInput
                style={styles.input}
                value={subject}
                onChangeText={setSubject}
                placeholder="Chemistry / Physics / Electronics"
                placeholderTextColor="#6b7280"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>EXPERIMENT NUMBER / CODE</Text>
              <TextInput
                style={[styles.input, styles.monoInput]}
                value={expNumber}
                onChangeText={setExpNumber}
                placeholder="EXP-2026-001"
                placeholderTextColor="#6b7280"
              />
            </View>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleCreateExperiment}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#0b0f19" />
              ) : (
                <Text style={styles.buttonText}>Next: Capture Photos &rarr;</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 2: CAPTURE & UPLOAD PHOTOS */}
        {step === 2 && (
          <View style={styles.formSection}>
            <Text style={styles.sectionSubtitle}>
              Capture or select handwritten notebook pages for experiment:{' '}
              <Text style={styles.highlightText}>{title}</Text>
            </Text>

            {/* Photo Actions */}
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.actionBtn} onPress={handleTakePhoto}>
                <Text style={styles.actionBtnText}>📷 Take Photo</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionBtn} onPress={handlePickGallery}>
                <Text style={styles.actionBtnText}>🖼️ Choose Gallery</Text>
              </TouchableOpacity>
            </View>

            {/* Captured Photos Grid Preview */}
            <Text style={styles.label}>CAPTURED PAGES ({capturedImages.length})</Text>
            {capturedImages.length === 0 ? (
              <View style={styles.emptyPreviewBox}>
                <Text style={styles.emptyPreviewText}>
                  No pages captured yet. Tap "Take Photo" to capture notebook pages using camera.
                </Text>
              </View>
            ) : (
              <View style={styles.imageGrid}>
                {capturedImages.map((uri, idx) => (
                  <View key={idx} style={styles.imageCard}>
                    <Image source={{ uri }} style={styles.previewImage} />
                    <TouchableOpacity
                      style={styles.removeBadge}
                      onPress={() =>
                        setCapturedImages((prev) => prev.filter((_, i) => i !== idx))
                      }
                    >
                      <Text style={styles.removeText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* Final Upload Button */}
            <TouchableOpacity
              style={[
                styles.button,
                (uploading || capturedImages.length === 0) && styles.buttonDisabled,
              ]}
              onPress={handleUploadAndFinish}
              disabled={uploading || capturedImages.length === 0}
            >
              {uploading ? (
                <ActivityIndicator color="#0b0f19" />
              ) : (
                <Text style={styles.buttonText}>Upload & Process Record</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
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
    padding: 24,
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
    fontSize: 26,
    fontWeight: '800',
    color: '#ffffff',
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#9ca3af',
    marginBottom: 16,
    lineHeight: 18,
  },
  highlightText: {
    color: '#10b981',
    fontWeight: '700',
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  errorText: {
    color: '#f87171',
    fontSize: 13,
  },
  formSection: {
    gap: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    color: '#d1d5db',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#111827',
    borderColor: '#1f2937',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 15,
  },
  monoInput: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#10b981',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: '#1f2937',
    borderColor: '#374151',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyPreviewBox: {
    backgroundColor: '#111827',
    borderColor: '#1f2937',
    borderWidth: 1,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyPreviewText: {
    color: '#6b7280',
    fontSize: 12,
    textAlign: 'center',
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  imageCard: {
    width: 90,
    height: 90,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  removeBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  button: {
    backgroundColor: '#10b981',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#0b0f19',
    fontSize: 15,
    fontWeight: '700',
  },
});
