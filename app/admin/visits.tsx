import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Share, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {Text, Button, List, ActivityIndicator, Searchbar, Menu, Checkbox, Modal, Portal,
  Divider, Chip, IconButton,} from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '../../lib/supabase';
import EmptyState from '~/components/EmptyState';
import { DatePickerModal } from 'react-native-paper-dates';

type VisitTypeFilter = 'all' | 'in_person' | 'self_recorded' | 'virtual';
type SortOption = 'date_desc' | 'date_asc' | 'type_asc' | 'type_desc';

type VisitRow = {
  id: string;
  created_at: string | null;
  visit_type: string | null;
  diagnosis: string | null;
  symptoms: string | null;
  location: any | null; // jsonb
  patient_id: string | null;
  notes?: string | null;
  doctor_name?: string | null;
  treatment?: string | null;
  patients?: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    age?: number | null;
    gender?: string | null;
  } | null;
};

const PAGE_SIZE = 20;

/** ---------- helpers (hoisted) ---------- */
function locality(loc: any): string {
  return loc?.locality || loc?.adminArea || loc?.city || loc?.region || '';
}

function formatWhen(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function formatChipDate(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/** ---------- visible checkbox as icons ---------- */
const CheckBoxIcon = ({
  checked,
  indeterminate,
  onPress,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onPress: () => void;
}) => (
  <Pressable
    onPress={onPress}
    hitSlop={10}
    style={styles.cbWrap}
    accessibilityRole="checkbox"
    accessibilityState={{ checked: indeterminate ? 'mixed' : checked }}
  >
    <MaterialIcons
      name={
        indeterminate
          ? 'indeterminate-check-box'
          : checked
          ? 'check-box'
          : 'check-box-outline-blank'
      }
      size={22}
      color={checked ? '#4C51BF' : '#8E8E8E'}
    />
  </Pressable>
);

export default function VisitsScreen() {
  // header controls
  const [visitType, setVisitType] = useState<VisitTypeFilter>('all');
  const [search, setSearch] = useState('');
  const [region, setRegion] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('date_desc');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  // calendar
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  // menus
  const [regionMenuVisible, setRegionMenuVisible] = useState(false);
  const [typeMenuVisible, setTypeMenuVisible] = useState(false);
  const [sortMenuVisible, setSortMenuVisible] = useState(false);

  // list state
  const [items, setItems] = useState<VisitRow[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // selection state
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showExportButton, setShowExportButton] = useState(false);

  // modal state
  const [selectedVisit, setSelectedVisit] = useState<VisitRow | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // distinct regions derived from loaded rows
  const regions = useMemo(() => {
    const s = new Set<string>();
    for (const v of items) {
      const l = locality(v.location);
      if (l) s.add(l);
    }
    return ['All Regions', ...Array.from(s).sort()];
  }, [items]);

  // Selection handlers
  const toggleSelectAll = () => {
    if (selectedItems.size === items.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(items.map(item => item.id)));
    }
  };

  const toggleSelectItem = (id: string) => {
    const next = new Set(selectedItems);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedItems(next);
  };

  useEffect(() => {
    setShowExportButton(selectedItems.size > 0);
  }, [selectedItems]);

  useEffect(() => {
    setSelectedItems(new Set());
  }, [visitType, region, search, sortBy, startDate, endDate]);

  // ---------- query builders ----------
  const applyVisitType = (q: any) => {
    if (visitType === 'in_person') return q.eq('visit_type', 'in_person');
    if (visitType === 'self_recorded') return q.eq('visit_type', 'self_recorded');
    if (visitType === 'virtual')
      return q.in('visit_type', ['chat', 'virtual_consultation', 'virtual']);
    return q;
  };

  const applyRegion = (q: any) => {
    if (!region || region === 'All Regions') return q;
    return q.filter('location->>locality', 'eq', region);
  };

  const applyDateRange = (q: any) => {
    if (startDate) q = q.gte('created_at', formatDate(startDate));
    if (endDate) {
      const endPlusOne = new Date(endDate.getTime() + 24 * 60 * 60 * 1000);
      q = q.lt('created_at', formatDate(endPlusOne));
    }
    return q;
  };

  const applySorting = (q: any) => {
    switch (sortBy) {
      case 'date_asc':
        return q.order('created_at', { ascending: true });
      case 'type_asc':
        return q.order('visit_type', { ascending: true }).order('created_at', { ascending: false });
      case 'type_desc':
        return q.order('visit_type', { ascending: false }).order('created_at', { ascending: false });
      default:
        return q.order('created_at', { ascending: false });
    }
  };

  // keep search client-side to avoid complex OR queries
  const applySearch = (q: any) => q;

  const baseSelect = `
    id, created_at, visit_type, diagnosis, symptoms, location, patient_id,
    patients:patient_id ( id, name, email, phone, age, gender )
  `;

  // ---------- data ----------
  const fetchPage = useCallback(
    async (p: number) => {
      const from = p * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let q = supabase.from('visits').select(baseSelect).range(from, to);
      q = applySorting(applyVisitType(applyRegion(applyDateRange(applySearch(q)))));

      const { data, error } = await q;
      if (error) {
        console.error('load visits error', error);
        return { rows: [] as VisitRow[], more: false };
      }
      let rows = (data ?? []).map((row: any) => ({
        ...row,
        patients: Array.isArray(row.patients) ? row.patients[0] ?? null : row.patients ?? null,
      })) as VisitRow[];

      const idsNeedingLookup = rows.filter(r => !r.patients && r.patient_id).map(r => r.patient_id!) as string[];
      if (idsNeedingLookup.length) {
        const uniq = Array.from(new Set(idsNeedingLookup));
        const { data: pats } = await supabase
          .from('patients')
          .select('id, name, email, phone, age, gender')
          .in('id', uniq);
        const map = new Map((pats || []).map(p => [p.id, p]));
        rows = rows.map(r => (r.patients || !r.patient_id ? r : { ...r, patients: map.get(r.patient_id) as any }));
      }

      // Client search & filters (patient name/email/phone too)
      const needle = search.trim().toLowerCase();
      let filtered = rows;

      if (needle) {
        filtered = filtered.filter(r => {
          const p = r.patients;
          const hay = [
            p?.name, p?.email, p?.phone,
            r.diagnosis, r.symptoms, r.notes, r.doctor_name, r.treatment,
            r.visit_type, locality(r.location),
          ].filter(Boolean).join(' ').toLowerCase();
          return hay.includes(needle);
        });
      }

      if (visitType !== 'all') {
        filtered = filtered.filter(r => {
          if (visitType === 'in_person') return r.visit_type === 'in_person';
          if (visitType === 'self_recorded') return r.visit_type === 'self_recorded';
          if (visitType === 'virtual') return ['chat', 'virtual_consultation', 'virtual'].includes(r.visit_type || '');
          return true;
        });
      }

      if (region && region !== 'All Regions') {
        filtered = filtered.filter(r => locality(r.location) === region);
      }

      if (startDate || endDate) {
        filtered = filtered.filter(r => {
          if (!r.created_at) return false;
          const d = new Date(r.created_at);
          if (startDate && d < startDate) return false;
          if (endDate && d > new Date(endDate.getTime() + 24 * 60 * 60 * 1000)) return false;
          return true;
        });
      }

      filtered.sort((a, b) => {
        switch (sortBy) {
          case 'date_asc':
            return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
          case 'date_desc':
            return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
          case 'type_asc':
            return (a.visit_type || '').localeCompare(b.visit_type || '');
          case 'type_desc':
            return (b.visit_type || '').localeCompare(a.visit_type || '');
          default:
            return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        }
      });

      // NOTE: server already paginated via .range; no extra slicing
      return { rows: filtered, more: (data?.length ?? 0) === PAGE_SIZE };
    },
    [visitType, region, search, sortBy, startDate, endDate]
  );

  const loadInitial = useCallback(async () => {
    setLoading(true);
    const { rows, more } = await fetchPage(0);
    setItems(rows);
    setHasMore(more);
    setPage(0);
    setLoading(false);
  }, [fetchPage]);

  useEffect(() => {
    loadInitial();
  }, [visitType, region, search, sortBy, startDate, endDate, loadInitial]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadInitial();
    setRefreshing(false);
  }, [loadInitial]);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    const next = page + 1;
    const { rows, more } = await fetchPage(next);
    if (rows.length) setItems(prev => [...prev, ...rows]);
    setHasMore(more);
    setPage(next);
  }, [loading, hasMore, page, fetchPage]);

  // ---------- CSV share helpers ----------
  const escapeCsv = (v: any) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  // ⬇️ your earlier change: download selected rows to CSV (web), Share fallback (native)
  const downloadCsv = async () => {
    try {
      const selectedVisits = items.filter(item => selectedItems.has(item.id));
      const header = [
        'Visit ID',
        'Date/Time',
        'Visit Type',
        'Patient Name',
        'Patient Email',
        'Patient Phone',
        'Patient Age',
        'Patient Gender',
        'Doctor Name',
        'Diagnosis',
        'Symptoms',
        'Treatment',
        'Notes',
        'Locality',
      ];

      const lines = [header.join(',')];

      for (const v of selectedVisits) {
        lines.push(
          [
            v.id,
            formatWhen(v.created_at),
            v.visit_type || '',
            v.patients?.name || '',
            v.patients?.email || '',
            v.patients?.phone || '',
            v.patients?.age ?? '',
            v.patients?.gender || '',
            v.doctor_name || '',
            v.diagnosis || '',
            v.symptoms || '',
            v.treatment || '',
            v.notes || '',
            locality(v.location),
          ].map(escapeCsv).join(',')
        );
      }

      const csv = lines.join('\n');

      // Web download (matches your previous commit)
      if (typeof document !== 'undefined') {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `visits_export_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        console.log(`CSV file downloaded with ${selectedVisits.length} records`);
      } else {
        // Native fallback – share the CSV text
        await Share.share({
          title: `Visits Export (${selectedVisits.length} records)`,
          message: csv,
        });
      }
    } catch (e) {
      console.error('CSV download error', e);
    }
  };

  // ---------- date helpers ----------
  const clearDateFilter = () => {
    setStartDate(null);
    setEndDate(null);
  };

  const dateChipLabel = useMemo(() => {
    if (startDate && endDate) return `${formatChipDate(startDate)} – ${formatChipDate(endDate)}`;
    if (startDate) return `Since ${formatChipDate(startDate)}`;
    if (endDate) return `Until ${formatChipDate(endDate)}`;
    return 'All Dates';
  }, [startDate, endDate]);

  // ---------- visit modal ----------
  const openVisitModal = (visit: VisitRow) => {
    setSelectedVisit(visit);
    setModalVisible(true);
  };
  const closeVisitModal = () => {
    setModalVisible(false);
    setSelectedVisit(null);
  };

  // ---------- header ----------
  const StickyHeader = useMemo(
    () => (
      <View style={styles.stickyHeader}>
        <View style={styles.headerRow}>
          <MaterialIcons name="assignment" size={24} color="#4C51BF" />
        <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle}>Visits</Text>
            <Text style={styles.headerSub}>
              {items.length} records {selectedItems.size > 0 && `• ${selectedItems.size} selected`}
            </Text>
          </View>
        </View>

        <View style={styles.controlsRow}>
          <Searchbar
            placeholder="Search visits, patients, diagnosis..."
            value={search}
            onChangeText={setSearch}
            style={styles.search}
            inputStyle={{ fontSize: 14 }}
          />
        </View>

        <View style={styles.filtersRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll}>
            <Menu
              visible={typeMenuVisible}
              onDismiss={() => setTypeMenuVisible(false)}
              anchor={
                <Chip
                  mode={visitType !== 'all' ? 'flat' : 'outlined'}
                  onPress={() => setTypeMenuVisible(true)}
                  style={styles.filterChip}
                  icon={({ size, color }) => <MaterialIcons name="tune" size={size} color={'#4C51BF'} />}
                >
                  {visitType === 'all' ? 'All Types' : visitType.replace('_', ' ')}
                </Chip>
              }
            >
              <Menu.Item onPress={() => { setVisitType('all'); setTypeMenuVisible(false); }} title="All Types" />
              <Menu.Item onPress={() => { setVisitType('in_person'); setTypeMenuVisible(false); }} title="In-person" />
              <Menu.Item onPress={() => { setVisitType('self_recorded'); setTypeMenuVisible(false); }} title="Self-recorded" />
              <Menu.Item onPress={() => { setVisitType('virtual'); setTypeMenuVisible(false); }} title="Virtual" />
            </Menu>

            <Menu
              visible={regionMenuVisible}
              onDismiss={() => setRegionMenuVisible(false)}
              anchor={
                <Chip
                  mode={region ? 'flat' : 'outlined'}
                  onPress={() => setRegionMenuVisible(true)}
                  style={styles.filterChip}
                  icon={({ size, color }) => <MaterialIcons name="place" size={size} color={'#4C51BF'} />}
                >
                  {region || 'All Regions'}
                </Chip>
              }
            >
              {regions.map((r) => (
                <Menu.Item
                  key={r}
                  onPress={() => {
                    setRegion(r === 'All Regions' ? null : r);
                    setRegionMenuVisible(false);
                  }}
                  title={r}
                />
              ))}
            </Menu>

            <Menu
              visible={sortMenuVisible}
              onDismiss={() => setSortMenuVisible(false)}
              anchor={
                <Chip
                  mode="outlined"
                  onPress={() => setSortMenuVisible(true)}
                  style={styles.filterChip}
                  icon={({ size, color }) => <MaterialIcons name="sort" size={size} color={'#4C51BF'} />}
                >
                  {(() => {
                    switch (sortBy) {
                      case 'date_asc': return 'Date ↑';
                      case 'date_desc': return 'Date ↓';
                      case 'type_asc': return 'Type A–Z';
                      case 'type_desc': return 'Type Z–A';
                      default: return 'Date ↓';
                    }
                  })()}
                </Chip>
              }
            >
              <Menu.Item onPress={() => { setSortBy('date_desc'); setSortMenuVisible(false); }} title="Latest First" />
              <Menu.Item onPress={() => { setSortBy('date_asc'); setSortMenuVisible(false); }} title="Oldest First" />
              <Menu.Item onPress={() => { setSortBy('type_asc'); setSortMenuVisible(false); }} title="Type A–Z" />
              <Menu.Item onPress={() => { setSortBy('type_desc'); setSortMenuVisible(false); }} title="Type Z–A" />
            </Menu>

            {/* Calendar-style date range selector */}
            <Chip
              mode={startDate || endDate ? 'flat' : 'outlined'}
              onPress={() => setDatePickerOpen(true)}
              style={styles.filterChip}
              onClose={startDate || endDate ? clearDateFilter : undefined}
              icon={({ size, color }) => <MaterialIcons name="calendar-today" size={size} color={'#4C51BF'} />}
            >
              {dateChipLabel}
            </Chip>
          </ScrollView>
        </View>

        {showExportButton && (
          <View style={styles.exportRow}>
            <Button
              mode="contained"
              onPress={downloadCsv}
              style={styles.exportBtn}
              icon="download"
            >
              Export {selectedItems.size} Selected
            </Button>
          </View>
        )}
      </View>
    ),
    [search, region, regions, regionMenuVisible, typeMenuVisible, sortMenuVisible, visitType, sortBy, selectedItems.size, showExportButton, startDate, endDate, dateChipLabel, items.length]
  );

  // ---------- list ----------
  const renderItem = ({ item }: { item: VisitRow }) => {
    const p = item.patients;
    const who = p?.name || p?.email || p?.phone
      ? [p?.name, p?.email, p?.phone].filter(Boolean).join(' • ')
      : 'Unknown patient';

    const line2 = [
      item.diagnosis?.trim() || item.symptoms?.trim() || '(no notes)',
      item.visit_type ? ` • ${item.visit_type}` : '',
      locality(item.location) ? ` • ${locality(item.location)}` : '',
    ].join('').trim();

    const isSelected = selectedItems.has(item.id);

    return (
      <View style={styles.itemContainer}>
        <View style={styles.checkboxContainer}>
          <CheckBoxIcon
            checked={isSelected}
            onPress={() => toggleSelectItem(item.id)}
          />
        </View>
        <List.Item
          style={[styles.listItem, isSelected && styles.selectedItem]}
          title={who}
          description={line2}
          left={() => (
            <MaterialIcons
              name="person"
              size={20}
              color={isSelected ? "#4C51BF" : "#555"}
              style={styles.leftIcon}
            />
          )}
          right={() => <Text style={styles.metaText}>{formatWhen(item.created_at)}</Text>}
          onPress={() => openVisitModal(item)}
        />
      </View>
    );
  };

  const renderSelectAllItem = () => {
    if (items.length === 0) return null;
    return (
      <View style={styles.selectAllContainer}>
        <View style={styles.checkboxContainer}>
          <CheckBoxIcon
            checked={selectedItems.size === items.length && items.length > 0}
            indeterminate={selectedItems.size > 0 && selectedItems.size < items.length}
            onPress={toggleSelectAll}
          />
        </View>
        <List.Item
          style={styles.selectAllItem}
          title="Select All"
          description={`${selectedItems.size} of ${items.length} selected`}
          left={() => (
            <MaterialIcons
              name="done-all"
              size={20}
              color="#4C51BF"
              style={styles.leftIcon}
            />
          )}
        />
      </View>
    );
  };

  const keyExtractor = (v: VisitRow) => v.id;

  const ListFooter = () => (
    <View style={styles.footerWrap}>
      {loading && !items.length ? <ActivityIndicator /> : null}
      {!loading && !hasMore ? <Text style={styles.footerEndText}>No more results</Text> : null}
    </View>
  );

  const VisitDetailModal = () => (
    <Portal>
      <Modal visible={modalVisible} onDismiss={closeVisitModal} contentContainerStyle={styles.modalContainer}>
        {selectedVisit && (
          <ScrollView style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Visit Details</Text>
              <IconButton icon="close" onPress={closeVisitModal} />
            </View>
            <Divider style={styles.modalDivider} />
            {/* Patient Info */}
            <View style={styles.modalSection}>
              <Text style={styles.sectionTitle}>Patient Information</Text>
              <Text style={styles.detailLabel}>Name:</Text>
              <Text style={styles.detailValue}>{selectedVisit.patients?.name || 'Not provided'}</Text>
              <Text style={styles.detailLabel}>Email:</Text>
              <Text style={styles.detailValue}>{selectedVisit.patients?.email || 'Not provided'}</Text>
              <Text style={styles.detailLabel}>Phone:</Text>
              <Text style={styles.detailValue}>{selectedVisit.patients?.phone || 'Not provided'}</Text>
              {selectedVisit.patients?.age && (<>
                <Text style={styles.detailLabel}>Age:</Text>
                <Text style={styles.detailValue}>{selectedVisit.patients.age}</Text>
              </>)}
              {selectedVisit.patients?.gender && (<>
                <Text style={styles.detailLabel}>Gender:</Text>
                <Text style={styles.detailValue}>{selectedVisit.patients.gender}</Text>
              </>)}
            </View>
            <Divider style={styles.modalDivider} />
            {/* Visit Info */}
            <View style={styles.modalSection}>
              <Text style={styles.sectionTitle}>Visit Information</Text>
              <Text style={styles.detailLabel}>Date & Time:</Text>
              <Text style={styles.detailValue}>{formatWhen(selectedVisit.created_at)}</Text>
              <Text style={styles.detailLabel}>Visit Type:</Text>
              <Text style={styles.detailValue}>{selectedVisit.visit_type || 'Not specified'}</Text>
              <Text style={styles.detailLabel}>Location:</Text>
              <Text style={styles.detailValue}>{locality(selectedVisit.location) || 'Not provided'}</Text>
              {selectedVisit.doctor_name && (<>
                <Text style={styles.detailLabel}>Doctor:</Text>
                <Text style={styles.detailValue}>{selectedVisit.doctor_name}</Text>
              </>)}
            </View>
            <Divider style={styles.modalDivider} />
            {/* Medical Info */}
            <View style={styles.modalSection}>
              <Text style={styles.sectionTitle}>Medical Information</Text>
              {selectedVisit.diagnosis && (<>
                <Text style={styles.detailLabel}>Diagnosis:</Text>
                <Text style={styles.detailValue}>{selectedVisit.diagnosis}</Text>
              </>)}
              {selectedVisit.symptoms && (<>
                <Text style={styles.detailLabel}>Symptoms:</Text>
                <Text style={styles.detailValue}>{selectedVisit.symptoms}</Text>
              </>)}
              {selectedVisit.treatment && (<>
                <Text style={styles.detailLabel}>Treatment:</Text>
                <Text style={styles.detailValue}>{selectedVisit.treatment}</Text>
              </>)}
              {selectedVisit.notes && (<>
                <Text style={styles.detailLabel}>Notes:</Text>
                <Text style={styles.detailValue}>{selectedVisit.notes}</Text>
              </>)}
            </View>
          </ScrollView>
        )}
      </Modal>
    </Portal>
  );

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <FlatList
        data={items}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        ListHeaderComponent={
          <>
            {StickyHeader}
            {renderSelectAllItem()}
          </>
        }
        ListHeaderComponentStyle={styles.headerShim}
        stickyHeaderIndices={[0]}
        ListEmptyComponent={
          !loading ? (
            <View style={{ padding: 16 }}>
              <EmptyState
                icon="assignment"
                title="No visits found"
                description="Try adjusting your filters or search terms."
                iconSize={48}
              />
            </View>
          ) : null
        }
        ListFooterComponent={<ListFooter />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onEndReachedThreshold={0.3}
        onEndReached={loadMore}
      />

      {/* Visit details modal */}
      <VisitDetailModal />

      {/* Calendar-style date range picker modal */}
      <DatePickerModal
        mode="range"
        visible={datePickerOpen}
        onDismiss={() => setDatePickerOpen(false)}
        startDate={startDate ?? undefined}
        endDate={endDate ?? undefined}
        onConfirm={({ startDate: s, endDate: e }) => {
          setDatePickerOpen(false);
          setStartDate(s ?? null);
          setEndDate(e ?? null);
        }}
        saveLabel="Apply"
        locale={Intl.DateTimeFormat().resolvedOptions().locale}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  listContent: { paddingBottom: 16 },
  headerShim: { marginTop: -6 },

  // Header styles
  stickyHeader: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5e5',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  headerTextWrap: { marginLeft: 12, flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  headerSub: { color: '#666', marginTop: 2, fontSize: 12 },

  controlsRow: { marginBottom: 12 },
  search: { height: 44, elevation: 1 },

  filtersRow: { marginBottom: 8 },
  filtersScroll: { flexGrow: 0 },
  filterChip: { marginRight: 8, height: 32 },

  exportRow: { marginTop: 12, alignItems: 'center' },
  exportBtn: { backgroundColor: '#4C51BF', paddingHorizontal: 16 },

  // List item styles
  selectAllContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  selectAllItem: { flex: 1, paddingVertical: 8 },

  itemContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff' },
  checkboxContainer: { paddingHorizontal: 12, paddingVertical: 8 },
  listItem: { flex: 1, paddingVertical: 12 },
  selectedItem: { backgroundColor: '#b4bef4' },
  leftIcon: { marginRight: 8, marginTop: 2 },
  metaText: { color: '#666', fontSize: 12 },

  sep: { height: StyleSheet.hairlineWidth, backgroundColor: '#e5e5e5', marginLeft: 56 },
  footerWrap: { paddingVertical: 16, alignItems: 'center' },
  footerEndText: { color: '#888', fontSize: 12 },

  // Modal styles
  modalContainer: {
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 12,
    maxHeight: '80%',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalContent: { maxHeight: '100%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingBottom: 12 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  modalDivider: { marginHorizontal: 20, marginVertical: 8 },
  modalSection: { padding: 20, paddingTop: 12, paddingBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#4C51BF', marginBottom: 12 },
  detailLabel: { fontSize: 12, color: '#666', marginTop: 8, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  detailValue: { fontSize: 16, color: '#333', marginBottom: 4, lineHeight: 22 },

  // tap area for checkbox icons
  cbWrap: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
