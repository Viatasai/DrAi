import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, Button, List, ActivityIndicator, Switch } from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';

type TabKey = 'patients' | 'doctors';

type Patient = {
  id: string;
  auth_user_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string | null;
  banned: boolean;
};

type FieldDoctor = {
  id: string;
  auth_user_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  specialization?: string | null;
  created_at: string | null;
  banned: boolean;
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

  // Track toggle loading states
  const [toggleLoading, setToggleLoading] = useState<Record<string, boolean>>({});

  const formatWhen = (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString();
  };

  // -------- fetchers (paginated) with ban status --------
  const fetchPatientsPage = useCallback(async (page: number) => {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .rpc('get_users_with_ban_status', { table_name: 'patients' })
      .range(from, to);

    if (error) {
      console.error('Error fetching patients:', error);
      return { items: [] as Patient[], hasMore: false };
    }
    
    const items = (data ?? []).map(item => ({
      id: item.id,
      auth_user_id: item.auth_user_id,
      name: item.name,
      email: item.email,
      phone: item.phone,
      created_at: item.created_at,
      banned: item.banned || false
    })) as Patient[];
    
    return { items, hasMore: items.length === PAGE_SIZE };
  }, []);

  const fetchDoctorsPage = useCallback(async (page: number) => {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .rpc('get_users_with_ban_status', { table_name: 'field_doctors' })
      .range(from, to);

    if (error) {
      console.error('Error fetching doctors:', error);
      return { items: [] as FieldDoctor[], hasMore: false };
    }
    
    const items = (data ?? []).map(item => ({
      id: item.id,
      auth_user_id: item.auth_user_id,
      name: item.name,
      email: item.email,
      phone: item.phone,
      created_at: item.created_at,
      specialization: item.specialization,
      banned: item.banned || false
    })) as FieldDoctor[];
    
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

  const toggleBan = async (authUserId: string, currentBanStatus: boolean) => {
    // Prevent multiple simultaneous toggles for the same user
    if (toggleLoading[authUserId]) return;

    try {
      setToggleLoading(prev => ({ ...prev, [authUserId]: true }));
      
      const { error } = await supabase.rpc('toggle_user_ban', {
        uid: authUserId,
        ban: !currentBanStatus,
      });
      
      if (error) throw error;

      // Update local state
      if (activeTab === 'patients') {
        setPatients(prev =>
          prev.map(u => (u.auth_user_id === authUserId ? { ...u, banned: !currentBanStatus } : u))
        );
      } else {
        setDoctors(prev =>
          prev.map(u => (u.auth_user_id === authUserId ? { ...u, banned: !currentBanStatus } : u))
        );
      }
    } catch (err) {
      console.error('Failed to toggle ban', err);
      // You might want to show a toast or alert here
    } finally {
      setToggleLoading(prev => ({ ...prev, [authUserId]: false }));
    }
  };

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
      right={() => (
        <View style={styles.rightContainer}>
          <Text style={styles.metaText}>{formatWhen(item.created_at)}</Text>
          <View style={styles.banToggleContainer}>
            <Text style={[styles.banLabel, item.banned && styles.banLabelActive]}>
              {item.banned ? 'Banned' : 'Active'}
            </Text>
            <Switch
              value={item.banned}
              onValueChange={() => toggleBan(item.auth_user_id, item.banned)}
              disabled={toggleLoading[item.auth_user_id]}
              style={styles.banSwitch}
            />
          </View>
        </View>
      )}
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
      right={() => (
        <View style={styles.rightContainer}>
          <Text style={styles.metaText}>{formatWhen(item.created_at)}</Text>
          <View style={styles.banToggleContainer}>
            <Text style={[styles.banLabel, item.banned && styles.banLabelActive]}>
              {item.banned ? 'Banned' : 'Active'}
            </Text>
            <Switch
              value={item.banned}
              onValueChange={() => toggleBan(item.auth_user_id, item.banned)}
              disabled={toggleLoading[item.auth_user_id]}
              style={styles.banSwitch}
            />
          </View>
        </View>
      )}
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
  metaText: { color: '#666', fontSize: 12 },

  rightContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },

  banToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },

  banLabel: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
    marginRight: 8,
    minWidth: 50,
    textAlign: 'right',
  },

  banLabelActive: {
    color: '#f44336',
  },

  banSwitch: {
    transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }],
  },

  sep: { height: StyleSheet.hairlineWidth, backgroundColor: '#e5e5e5' },
  footerWrap: { paddingVertical: 16, alignItems: 'center' },
  footerEndText: { color: '#888' },
});