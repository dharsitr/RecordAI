import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  Platform,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { Experiment } from '../types/database';

interface ExperimentWithRelations extends Experiment {
  documents?: any[];
  generated_documents?: any[];
}

export const DashboardScreen = ({ navigation }: any) => {
  const { user, signOut } = useAuth();
  const [experiments, setExperiments] = useState<ExperimentWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchExperiments = async () => {
    try {
      const { data, error } = await supabase
        .from('experiments')
        .select('*, documents(*), generated_documents(*)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setExperiments((data as ExperimentWithRelations[]) || []);
    } catch (err) {
      console.error('[DashboardScreen] Fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchExperiments();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchExperiments();
  };

  const renderExperimentItem = ({ item }: { item: ExperimentWithRelations }) => {
    const docsCount = (item.documents || []).length;
    const genCount = (item.generated_documents || []).length;
    const statusText = genCount > 0 ? 'Exported' : docsCount > 0 ? 'Verified' : 'Draft';
    const statusColor = genCount > 0 ? '#10b981' : docsCount > 0 ? '#06b6d4' : '#f59e0b';

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('NewRecord', { experimentId: item.id })}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <View style={[styles.statusBadge, { borderColor: statusColor }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
          </View>
        </View>

        <View style={styles.cardMeta}>
          <Text style={styles.codeText}>{item.experiment_number || 'EXP-RECORD'}</Text>
          <Text style={styles.subjectText}>{item.subject || 'General'}</Text>
        </View>

        <Text style={styles.dateText}>
          Created: {new Date(item.created_at).toLocaleDateString()} • {docsCount} scan page(s)
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Mobile Bar */}
      <View style={styles.headerBar}>
        <View>
          <Text style={styles.headerSub}>MOBILE COMPANION</Text>
          <Text style={styles.headerTitle}>Lab Experiments</Text>
        </View>

        <TouchableOpacity style={styles.signOutBtn} onPress={signOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Main Content Area */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#10b981" />
          <Text style={styles.loadingText}>Fetching lab records...</Text>
        </View>
      ) : (
        <FlatList
          data={experiments}
          keyExtractor={(item: ExperimentWithRelations) => item.id}
          renderItem={renderExperimentItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#10b981"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>No Experiments Found</Text>
              <Text style={styles.emptySub}>
                Tap the "+ New Record" button below to capture notebook pages using your camera.
              </Text>
            </View>
          }
        />
      )}

      {/* Floating Action Button for New Record Flow */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('NewRecord')}
      >
        <Text style={styles.fabText}>+ New Record</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0f19',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  headerSub: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10b981',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
  },
  signOutBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#1f2937',
  },
  signOutText: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '600',
  },
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#9ca3af',
    fontSize: 13,
  },
  listContent: {
    padding: 20,
    paddingBottom: 90,
  },
  card: {
    backgroundColor: '#111827',
    borderColor: '#1f2937',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  codeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10b981',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  subjectText: {
    fontSize: 12,
    color: '#06b6d4',
  },
  dateText: {
    fontSize: 11,
    color: '#6b7280',
  },
  emptyBox: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 18,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    backgroundColor: '#10b981',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 28,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  fabText: {
    color: '#0b0f19',
    fontSize: 15,
    fontWeight: '800',
  },
});
