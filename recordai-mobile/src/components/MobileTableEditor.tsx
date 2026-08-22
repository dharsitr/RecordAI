import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { supabase } from '../lib/supabase';
import type { ObservationTable } from '../types/database';

export interface MobileTableEditorProps {
  table: ObservationTable;
  onSave?: (updated: ObservationTable) => void;
  readOnly?: boolean;
}

export const MobileTableEditor: React.FC<MobileTableEditorProps> = ({
  table,
  onSave,
  readOnly = false,
}) => {
  const dataObj = (table.data_json as any) || {};
  const initialHeaders: string[] = Array.isArray(dataObj.headers) && dataObj.headers.length > 0
    ? dataObj.headers
    : ['Parameter', 'Measured Value', 'Unit'];
  const initialRows: string[][] = Array.isArray(dataObj.rows) && dataObj.rows.length > 0
    ? dataObj.rows
    : [['', '', '']];

  const [title, setTitle] = useState(table.title || 'Observation Table');
  const [headers, setHeaders] = useState<string[]>(initialHeaders);
  const [rows, setRows] = useState<string[][]>(initialRows);
  const [saving, setSaving] = useState(false);

  // Cell Text Change Handler
  const handleCellChange = (rIdx: number, cIdx: number, value: string) => {
    const updatedRows = rows.map((r, i) => {
      if (i === rIdx) {
        const copy = [...r];
        copy[cIdx] = value;
        return copy;
      }
      return r;
    });
    setRows(updatedRows);
  };

  // Header Text Change Handler
  const handleHeaderChange = (cIdx: number, value: string) => {
    const copy = [...headers];
    copy[cIdx] = value;
    setHeaders(copy);
  };

  // Row Add / Delete Controls
  const handleAddRow = () => {
    const emptyRow = new Array(headers.length).fill('');
    setRows((prev) => [...prev, emptyRow]);
  };

  const handleRemoveRow = () => {
    if (rows.length <= 1) return;
    setRows((prev) => prev.slice(0, -1));
  };

  // Column Add / Delete Controls
  const handleAddColumn = () => {
    const newColName = `Column ${headers.length + 1}`;
    setHeaders((prev) => [...prev, newColName]);
    setRows((prev) => prev.map((r) => [...r, '']));
  };

  const handleRemoveColumn = () => {
    if (headers.length <= 1) return;
    setHeaders((prev) => prev.slice(0, -1));
    setRows((prev) => prev.map((r) => r.slice(0, -1)));
  };

  // Save Table Changes
  const handleSaveTable = async () => {
    setSaving(true);
    try {
      const updatedDataJson = {
        ...dataObj,
        headers,
        rows,
      };

      const { data, error } = await (supabase
        .from('observation_tables') as any)
        .update({
          title,
          data_json: updatedDataJson,
        })
        .eq('id', table.id)
        .select()
        .single();

      if (error) throw error;
      if (data && onSave) {
        onSave(data as ObservationTable);
      }
      Alert.alert('Saved', 'Observation table changes persisted successfully!');
    } catch (err: any) {
      console.error('[MobileTableEditor] Save error:', err);
      Alert.alert('Save Error', err?.message || 'Failed saving table data');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.card}>
      {/* Table Title Editor */}
      <View style={styles.headerRow}>
        <TextInput
          style={styles.titleInput}
          value={title}
          onChangeText={setTitle}
          placeholder="Table Title"
          placeholderTextColor="#6b7280"
          editable={!readOnly}
        />
        {!readOnly && (
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.disabledBtn]}
            onPress={handleSaveTable}
            disabled={saving}
          >
            <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Table'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Grid Controls (Row / Column Operations) */}
      {!readOnly && (
        <View style={styles.controlsRow}>
          <TouchableOpacity style={styles.ctrlBtn} onPress={handleAddRow}>
            <Text style={styles.ctrlBtnText}>+ Row</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ctrlBtn} onPress={handleRemoveRow}>
            <Text style={styles.ctrlBtnText}>- Row</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ctrlBtn} onPress={handleAddColumn}>
            <Text style={styles.ctrlBtnText}>+ Col</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ctrlBtn} onPress={handleRemoveColumn}>
            <Text style={styles.ctrlBtnText}>- Col</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Horizontal Scrollable Table Grid */}
      <ScrollView horizontal contentContainerStyle={styles.gridContainer}>
        <View>
          {/* Header Row */}
          <View style={styles.tr}>
            {headers.map((h, cIdx) => (
              <TextInput
                key={cIdx}
                style={[styles.thInput, styles.cellWidth]}
                value={h}
                onChangeText={(val: string) => handleHeaderChange(cIdx, val)}
                editable={!readOnly}
              />
            ))}
          </View>

          {/* Data Rows */}
          {rows.map((row, rIdx) => (
            <View key={rIdx} style={[styles.tr, rIdx % 2 === 1 && styles.evenTr]}>
              {headers.map((_, cIdx) => (
                <TextInput
                  key={cIdx}
                  style={[styles.tdInput, styles.cellWidth]}
                  value={row[cIdx] || ''}
                  onChangeText={(val: string) => handleCellChange(rIdx, cIdx, val)}
                  editable={!readOnly}
                />
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#111827',
    borderColor: '#1f2937',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginVertical: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8,
  },
  titleInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#06b6d4',
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
    paddingVertical: 4,
  },
  saveBtn: {
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  disabledBtn: {
    opacity: 0.5,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  ctrlBtn: {
    backgroundColor: '#1f2937',
    borderColor: '#374151',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  ctrlBtnText: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '700',
  },
  gridContainer: {
    paddingVertical: 4,
  },
  tr: {
    flexDirection: 'row',
  },
  evenTr: {
    backgroundColor: '#192233',
  },
  cellWidth: {
    width: 110,
  },
  thInput: {
    backgroundColor: '#059669',
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    padding: 8,
    borderWidth: 0.5,
    borderColor: '#047857',
    textAlign: 'center',
  },
  tdInput: {
    backgroundColor: '#0d1322',
    color: '#e5e7eb',
    fontSize: 12,
    padding: 8,
    borderWidth: 0.5,
    borderColor: '#1f2937',
  },
});
