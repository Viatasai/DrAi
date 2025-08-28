import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Button, List, ActivityIndicator } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';

type TabKey = 'patients' | 'doctors';

type Patient = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string | null;
};

type FieldDoctor = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  specialization?: string | null;
  created_at: string | null;
};

const PAGE_SIZE = 20;

export default function UsersScreen() {
  const [activeTab, setActiveTab] = useState<TabKey>('patients');

  // patients state
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientsPage, setPatientsPage] = useState(0);
  const [patientsHasMore, setPatientsHasMore] = useState(true);
  const [patientsLoading, setPatientsLoading] = useState(true);
  const [patientsRefreshing, setPatientsRefreshing] = useState(false);

  // doctors state
  const [doctors, setDoctors] = useState<FieldDoctor[]>([]);
  const [doctorsPage, setDoctorsPage] = useState(0);
  const [doctorsHasMore, setDoctorsHasMore] = useState(true);
  const [doctorsLoading, setDoctorsLoading] = useState(true);
  const [doctorsRefreshing, setDoctorsRefreshing] = useState(false);

  const formatWhen = (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString();
  };

  // -------- fetchers (paginated) --------
  const fetchPatientsPage = useCallback(async (page: number) => {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from('patients')
      .select('id, name, email, phone, created_at')
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) return { items: [] as Patient[], hasMore: false };
    const items = (data ?? []) as Patient[];
    return { items, hasMore: items.length === PAGE_SIZE };
  }, []);

  const fetchDoctorsPage = useCallback(async (page: number) => {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from('field_doctors')
      .select('id, name, email, phone, created_at, specialization')
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) return { items: [] as FieldDoctor[], hasMore: false };
    const items = (data ?? []) as FieldDoctor[];
    return { items, hasMore: items.length === PAGE_SIZE };
  }, []);

  // -------- initial loads --------
  useEffect(() => {
    (async () => {
      setPatientsLoading(true);
      const { items, hasMore } = await fetchPatientsPage(0);
      setPatients(items);
      setPatientsHasMore(hasMore);
      setPatientsPage(0);
      setPatientsLoading(false);
    })();
  }, [fetchPatientsPage]);

  useEffect(() => {
    (async () => {
      setDoctorsLoading(true);
      const { items, hasMore } = await fetchDoctorsPage(0);
      setDoctors(items);
      setDoctorsHasMore(hasMore);
      setDoctorsPage(0);
      setDoctorsLoading(false);
    })();
  }, [fetchDoctorsPage]);

  // -------- refresh handlers --------
  const refreshPatients = useCallback(async () => {
    setPatientsRefreshing(true);
    const { items, hasMore } = await fetchPatientsPage(0);
    setPatients(items);
    setPatientsHasMore(hasMore);
    setPatientsPage(0);
    setPatientsRefreshing(false);
  }, [fetchPatientsPage]);

  const refreshDoctors = useCallback(async () => {
    setDoctorsRefreshing(true);
    const { items, hasMore } = await fetchDoctorsPage(0);
    setDoctors(items);
    setDoctorsHasMore(hasMore);
    setDoctorsPage(0);
    setDoctorsRefreshing(false);
  }, [fetchDoctorsPage]);

  // -------- load more handlers (infinite scroll) --------
  const loadMorePatients = useCallback(async () => {
    if (patientsLoading || !patientsHasMore) return;
    const next = patientsPage + 1;
    const { items, hasMore } = await fetchPatientsPage(next);
    if (items.length) setPatients(prev => [...prev, ...items]);
    setPatientsHasMore(hasMore);
    setPatientsPage(next);
  }, [patientsLoading, patientsHasMore, patientsPage, fetchPatientsPage]);

  const loadMoreDoctors = useCallback(async () => {
    if (doctorsLoading || !doctorsHasMore) return;
    const next = doctorsPage + 1;
    const { items, hasMore } = await fetchDoctorsPage(next);
    if (items.length) setDoctors(prev => [...prev, ...items]);
    setDoctorsHasMore(hasMore);
    setDoctorsPage(next);
  }, [doctorsLoading, doctorsHasMore, doctorsPage, fetchDoctorsPage]);

  // -------- sticky header (title + tabs), now snug under app bar --------
  const StickyHeader = useMemo(() => {
    return (
      <View style={styles.stickyHeader}>
        <View style={styles.headerRow}>
          <MaterialIcons name="groups" size={49} color="#FF9800" />
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle}>Users</Text>
            <Text style={styles.headerSub}>Patients &amp; Field Doctors</Text>
          </View>
        </View>

        <View style={styles.toggleRow}>
          <Button
            mode={activeTab === 'patients' ? 'contained' : 'outlined'}
            onPress={() => setActiveTab('patients')}
            style={styles.toggleBtn}
            icon={({ size, color }) => (
              <MaterialIcons
                name="people-alt"
                size={size}
                color={activeTab === 'patients' ? 'white' : color}
              />
            )}
          >
            Patients
          </Button>

          <Button
            mode={activeTab === 'doctors' ? 'contained' : 'outlined'}
            onPress={() => setActiveTab('doctors')}
            style={styles.toggleBtn}
            icon={({ size, color }) => (
              <MaterialIcons
                name="medical-services"
                size={size}
                color={activeTab === 'doctors' ? 'white' : color}
              />
            )}
          >
            Field Doctors
          </Button>
        </View>
      </View>
    );
  }, [activeTab]);

  // -------- list renderers --------
  const patientItem = ({ item }: { item: Patient }) => (
    <List.Item
      title={item.name || 'Unnamed'}
      description={[
        item.email || '—',
        item.phone ? ` • ${item.phone}` : '',
      ].join('')}
      left={() => <MaterialIcons name="person" size={20} color="#555" style={styles.leftIcon} />}
      right={() => <Text style={styles.metaText}>{formatWhen(item.created_at)}</Text>}
    />
  );

  const doctorItem = ({ item }: { item: FieldDoctor }) => (
    <List.Item
      title={item.name || 'Unnamed'}
      description={[
        item.email || '—',
        item.phone ? ` • ${item.phone}` : '',
        item.specialization ? ` • ${item.specialization}` : '',
      ].join('')}
      left={() => <MaterialIcons name="medical-services" size={20} color="#555" style={styles.leftIcon} />}
      right={() => <Text style={styles.metaText}>{formatWhen(item.created_at)}</Text>}
    />
  );

  const Footer = ({ loading, hasMore }: { loading: boolean; hasMore: boolean }) => (
    <View style={styles.footerWrap}>
      {loading && <ActivityIndicator />}
      {!loading && !hasMore && <Text style={styles.footerEndText}>No more results</Text>}
    </View>
  );

  const showPatients = activeTab === 'patients';

  return (
    // exclude TOP edge so we sit right under the orange app bar
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      {showPatients ? (
        <FlatList
          data={patients}
          keyExtractor={(it) => it.id}
          renderItem={patientItem}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          ListHeaderComponent={StickyHeader}
          ListHeaderComponentStyle={styles.headerShim}   // pulls header up a few px
          stickyHeaderIndices={[0]}
          ListFooterComponent={
            <Footer loading={patientsLoading && !patients.length} hasMore={patientsHasMore} />
          }
          refreshControl={
            <RefreshControl refreshing={patientsRefreshing} onRefresh={refreshPatients} />
          }
          onEndReachedThreshold={0.3}
          onEndReached={loadMorePatients}
        />
      ) : (
        <FlatList
          data={doctors}
          keyExtractor={(it) => it.id}
          renderItem={doctorItem}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          ListHeaderComponent={StickyHeader}
          ListHeaderComponentStyle={styles.headerShim}
          stickyHeaderIndices={[0]}
          ListFooterComponent={
            <Footer loading={doctorsLoading && !doctors.length} hasMore={doctorsHasMore} />
          }
          refreshControl={
            <RefreshControl refreshing={doctorsRefreshing} onRefresh={refreshDoctors} />
          }
          onEndReachedThreshold={0.3}
          onEndReached={loadMoreDoctors}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },

  // no extra top padding; horizontal padding is handled inside sticky header
  listContent: { paddingBottom: 16 },

  // this tiny negative margin removes the visible gap under the orange bar
  headerShim: { marginTop: -6 },

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
  headerTitle: { fontSize: 16, fontWeight: 'bold' }, // slightly tighter
  headerSub: { color: '#666', marginTop: 2 },

  toggleRow: { flexDirection: 'row', marginTop: 8 },
  toggleBtn: { flex: 1, marginRight: 8 },

  leftIcon: { marginRight: 8, marginTop: 2 },
  metaText: { color: '#666' },

  sep: { height: StyleSheet.hairlineWidth, backgroundColor: '#e5e5e5' },
  footerWrap: { paddingVertical: 16, alignItems: 'center' },
  footerEndText: { color: '#888' },
});
