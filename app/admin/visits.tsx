import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Text,
  Button,
  List,
  ActivityIndicator,
  Searchbar,
  Menu,
} from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import EmptyState from '~/components/EmptyState';

type VisitTypeFilter = 'all' | 'in_person' | 'self_recorded' | 'virtual';

type VisitRow = {
  id: string;
  created_at: string | null;
  visit_type: string | null;
  diagnosis: string | null;
  symptoms: string | null;
  location: any | null; // jsonb
  patient_id: string | null;
  patients?: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
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

export default function VisitsScreen() {
  // header controls
  const [visitType, setVisitType] = useState<VisitTypeFilter>('all');
  const [search, setSearch] = useState('');
  const [region, setRegion] = useState<string | null>(null);
  const [regionMenuVisible, setRegionMenuVisible] = useState(false);
  const [typeMenuVisible, setTypeMenuVisible] = useState(false);

  // list state
  const [items, setItems] = useState<VisitRow[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // distinct regions derived from loaded rows
  const regions = useMemo(() => {
    const s = new Set<string>();
    for (const v of items) {
      const l = locality(v.location);
      if (l) s.add(l);
    }
    return ['All regions', ...Array.from(s).sort()];
  }, [items]);

  // ---------- query builders ----------
  const applyVisitType = (q: any) => {
    if (visitType === 'in_person') return q.eq('visit_type', 'in_person');
    if (visitType === 'self_recorded') return q.eq('visit_type', 'self_recorded');
    if (visitType === 'virtual')
      return q.in('visit_type', ['chat', 'virtual_consultation', 'virtual']);
    return q;
  };

  const applyRegion = (q: any) => {
    if (!region || region === 'All regions') return q;
    return q.filter('location->>locality', 'eq', region);
  };

  // server-side for diagnosis/symptoms; patient search is client-side
  const applySearch = (q: any) => {
    const s = (search || '').trim();
    if (!s) return q;
    const esc = s.replace(/[%_]/g, c => `\\${c}`);
    return q.or(`diagnosis.ilike.%${esc}%,symptoms.ilike.%${esc}%`);
  };

  const baseSelect = `
    id, created_at, visit_type, diagnosis, symptoms, location, patient_id,
    patients:patient_id ( id, name, email, phone )
  `;

  // ---------- data ----------
  const fetchPage = useCallback(
    async (p: number) => {
      const from = p * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let q = supabase
        .from('visits')
        .select(baseSelect)
        .order('created_at', { ascending: false })
        .range(from, to);

      q = applyVisitType(applyRegion(applySearch(q)));

      const { data, error } = await q;
      if (error) {
        console.error('load visits error', error);
        return { rows: [] as VisitRow[], more: false };
      }
      let rows = (data ?? []).map((row: any) => ({
        ...row,
        patients: Array.isArray(row.patients)
          ? row.patients[0] ?? null
          : row.patients ?? null,
      })) as VisitRow[];

      // robust fallback join if nested 'patients' is missing
      const idsNeedingLookup = rows
        .filter(r => !r.patients && r.patient_id)
        .map(r => r.patient_id!) as string[];
      if (idsNeedingLookup.length) {
        const uniq = Array.from(new Set(idsNeedingLookup));
        const { data: pats } = await supabase
          .from('patients')
          .select('id, name, email, phone')
          .in('id', uniq);
        const map = new Map((pats || []).map(p => [p.id, p]));
        rows = rows.map(r =>
          r.patients || !r.patient_id ? r : { ...r, patients: map.get(r.patient_id) as any }
        );
      }

      // client-side patient search on current page
      const needle = search.trim().toLowerCase();
      if (needle) {
        rows = rows.filter(r => {
          const p = r.patients;
          const hay = [p?.name, p?.email, p?.phone]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return hay.includes(needle); // <-- real filter now
        });
      }

      return { rows, more: rows.length === PAGE_SIZE };
    },
    [visitType, region, search]
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
  }, [visitType, region, search, loadInitial]);

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

  // ---------- CSV share ----------
  const escapeCsv = (v: any) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const shareCsv = async () => {
    try {
      const header = [
        'Visit ID',
        'Date/Time',
        'Visit Type',
        'Patient Name',
        'Patient Email',
        'Patient Phone',
        'Diagnosis',
        'Symptoms',
        'Locality',
      ];
      const lines = [header.join(',')];
      for (const v of items) {
        lines.push(
          [
            v.id,
            formatWhen(v.created_at),
            v.visit_type || '',
            v.patients?.name || '',
            v.patients?.email || '',
            v.patients?.phone || '',
            v.diagnosis || '',
            v.symptoms || '',
            locality(v.location),
          ].map(escapeCsv).join(',')
        );
      }
      const csv = lines.join('\n');
      await Share.share({ title: 'Visits CSV', message: csv });
    } catch (e) {
      console.error('share csv error', e);
    }
  };

  // ---------- header ----------
  const StickyHeader = useMemo(
    () => (
      <View style={styles.stickyHeader}>
        <View style={styles.headerRow}>
          <MaterialIcons name="assignment" size={20} color="#FF9800" />
        <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle}>Visits</Text>
            <Text style={styles.headerSub}>All visit records</Text>
          </View>
        </View>

        <View style={styles.controlsRow}>
          <Searchbar
            placeholder="Search diagnosis/symptoms or patient…"
            value={search}
            onChangeText={setSearch}
            style={[styles.search, { flex: 1 }]}
            inputStyle={{ fontSize: 14 }}
          />

          <Menu
            visible={typeMenuVisible}
            onDismiss={() => setTypeMenuVisible(false)}
            anchor={
              <Button
                mode="outlined"
                onPress={() => setTypeMenuVisible(true)}
                style={styles.filterBtn}
                icon={({ size, color }) => (
                  <MaterialIcons name="filter-list" size={size} color={color} />
                )}
              >
                {visitType === 'all' ? 'Filter' : visitType.replace('_', ' ')}
              </Button>
            }
          >
            <Menu.Item onPress={() => { setVisitType('all'); setTypeMenuVisible(false); }} title="Clear filter" />
            <Menu.Item onPress={() => { setVisitType('in_person'); setTypeMenuVisible(false); }} title="In-person" />
            <Menu.Item onPress={() => { setVisitType('self_recorded'); setTypeMenuVisible(false); }} title="Self-recorded" />
            <Menu.Item onPress={() => { setVisitType('virtual'); setTypeMenuVisible(false); }} title="Virtual consultation" />
          </Menu>

          <Menu
            visible={regionMenuVisible}
            onDismiss={() => setRegionMenuVisible(false)}
            anchor={
              <Button
                mode="outlined"
                onPress={() => setRegionMenuVisible(true)}
                style={styles.filterBtn}
                icon={({ size, color }) => (
                  <MaterialIcons name="place" size={size} color={color} />
                )}
              >
                {region ?? 'Region'}
              </Button>
            }
          >
            {regions.map((r) => (
              <Menu.Item
                key={r}
                onPress={() => {
                  setRegion(r === 'All regions' ? null : r);
                  setRegionMenuVisible(false);
                }}
                title={r}
              />
            ))}
          </Menu>

          <Button
            mode="contained"
            onPress={shareCsv}
            style={styles.exportBtn}
            icon={({ size }) => (
              <MaterialIcons name="download" size={size} color="white" />
            )}
          >
            Export
          </Button>
        </View>
      </View>
    ),
    [search, region, regions, regionMenuVisible, typeMenuVisible, visitType]
  );

  // ---------- list ----------
  const renderItem = ({ item }: { item: VisitRow }) => {
    const p = item.patients;
    const who =
      p?.name || p?.email || p?.phone
        ? [p?.name, p?.email, p?.phone].filter(Boolean).join(' • ')
        : 'Unknown patient';

    const line2 = [
      item.diagnosis?.trim() || item.symptoms?.trim() || '(no notes)',
      item.visit_type ? ` • ${item.visit_type}` : '',
      locality(item.location) ? ` • ${locality(item.location)}` : '',
    ]
      .join('')
      .trim();

    return (
      <List.Item
        title={who}
        description={line2}
        left={() => (
          <MaterialIcons name="person" size={20} color="#555" style={styles.leftIcon} />
        )}
        right={() => <Text style={styles.metaText}>{formatWhen(item.created_at)}</Text>}
        onPress={() => {
          // TODO: open bottom sheet or detail (reuse VisitCard) in the next step
        }}
      />
    );
  };

  const keyExtractor = (v: VisitRow) => v.id;

  const ListFooter = () => (
    <View style={styles.footerWrap}>
      {loading && !items.length ? <ActivityIndicator /> : null}
      {!loading && !hasMore ? <Text style={styles.footerEndText}>No more results</Text> : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <FlatList
        data={items}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        ListHeaderComponent={StickyHeader}
        ListHeaderComponentStyle={styles.headerShim}
        stickyHeaderIndices={[0]}
        ListEmptyComponent={
          !loading ? (
            <View style={{ padding: 16 }}>
              <EmptyState
                icon="assignment"
                title="No visits"
                description="Visit records will appear here as they are created."
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  listContent: { paddingBottom: 16 },
  headerShim: { marginTop: -6 }, // tuck under orange bar
  stickyHeader: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5e5',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  headerTextWrap: { marginLeft: 8, flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: 'bold' },
  headerSub: { color: '#666', marginTop: 2 },

  controlsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  search: { marginRight: 8, height: 40 },
  filterBtn: { height: 40, justifyContent: 'center', marginRight: 8 },
  exportBtn: { height: 40, justifyContent: 'center', backgroundColor: '#FF9800' },

  leftIcon: { marginRight: 8, marginTop: 2 },
  metaText: { color: '#666' },

  sep: { height: StyleSheet.hairlineWidth, backgroundColor: '#e5e5e5' },
  footerWrap: { paddingVertical: 16, alignItems: 'center' },
  footerEndText: { color: '#888' },
});
