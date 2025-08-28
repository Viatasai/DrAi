import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Text,
  Button,
  Card,
  List,
  ActivityIndicator,
  Menu,
  Divider,
} from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';

type RangeTab = 'today' | '7d' | '30d';

type VisitRowLite = {
  id: string;
  created_at: string | null;
  visit_type: string | null;
  diagnosis: string | null;
  symptoms: string | null;
  location: any | null; // jsonb with { locality?: string, ... }
  patient_id: string | null;
};

/** ---------------- helpers ---------------- */
function startOfTodayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
function nowISO(): string {
  return new Date().toISOString();
}
function subDaysStartOfDayISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - (days - 1)); // inclusive window
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
function locality(loc: any): string {
  return loc?.locality || loc?.adminArea || loc?.city || loc?.region || '';
}
function tokenize(text?: string | null): string[] {
  if (!text) return [];
  return text
    .split(/[,;\n]/g)
    .map(s => s.trim().toLowerCase())
    .filter(s => s.length > 1);
}
function topN(map: Map<string, number>, n = 5): { key: string; count: number }[] {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key, count]) => ({ key, count }));
}

/** ---------------- screen ---------------- */
export default function AnalyticsScreen() {
  const [range, setRange] = useState<RangeTab>('7d');
  const [region, setRegion] = useState<string | null>(null);
  const [regionMenuVisible, setRegionMenuVisible] = useState(false);

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // KPI state
  const [totalPatients, setTotalPatients] = useState<number>(0);
  const [totalDoctors, setTotalDoctors] = useState<number>(0);
  const [visitsInRange, setVisitsInRange] = useState<number>(0);
  const [todaysVisits, setTodaysVisits] = useState<number>(0);
  const [newPatientsInRange, setNewPatientsInRange] = useState<number>(0);
  const [activePatientsInRange, setActivePatientsInRange] = useState<number>(0);

  // Breakdown & trends
  const [typeInPerson, setTypeInPerson] = useState<number>(0);
  const [typeSelf, setTypeSelf] = useState<number>(0);
  const [typeVirtual, setTypeVirtual] = useState<number>(0);

  const [topDiagnoses, setTopDiagnoses] = useState<{ key: string; count: number }[]>([]);
  const [topSymptoms, setTopSymptoms] = useState<{ key: string; count: number }[]>([]);
  const [regionsFromData, setRegionsFromData] = useState<string[]>(['All regions']);

  // date window
  const { fromISO, toISO } = useMemo(() => {
    if (range === 'today') return { fromISO: startOfTodayISO(), toISO: nowISO() };
    if (range === '7d') return { fromISO: subDaysStartOfDayISO(7), toISO: nowISO() };
    return { fromISO: subDaysStartOfDayISO(30), toISO: nowISO() };
  }, [range]);

  /** ----- tiny filter helper so we reuse logic across queries ----- */
  const withVisitFilters = useCallback(
    (q: any) => {
      q = q.gte('created_at', fromISO).lte('created_at', toISO);
      if (region && region !== 'All regions') {
        q = q.filter('location->>locality', 'eq', region);
      }
      return q;
    },
    [fromISO, toISO, region]
  );

  /** ----- load analytics ----- */
  const load = useCallback(async () => {
    try {
      setLoading(true);

      // 1) totals (no region filter)
      const [pAll, dAll] = await Promise.all([
        supabase.from('patients').select('*', { count: 'exact', head: true }),
        supabase.from('field_doctors').select('*', { count: 'exact', head: true }),
      ]);
      setTotalPatients(pAll.count ?? 0);
      setTotalDoctors(dAll.count ?? 0);

      // 2) patients created in range (no region on patients table yet)
      const pRange = await supabase
        .from('patients')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', fromISO)
        .lte('created_at', toISO);
      setNewPatientsInRange(pRange.count ?? 0);

      // 3) visits in range + today
      const vRange = await withVisitFilters(
        supabase.from('visits').select('id', { count: 'exact', head: true })
      );
      setVisitsInRange(vRange.count ?? 0);

      const vToday = await withVisitFilters(
        supabase
          .from('visits')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', startOfTodayISO())
      );
      setTodaysVisits(vToday.count ?? 0);

      // 4) type breakdown — 3 small count queries (clear + fast)
      const [vInPerson, vSelf, vVirtual] = await Promise.all([
        withVisitFilters(
          supabase.from('visits').select('id', { count: 'exact', head: true }).eq('visit_type', 'in_person')
        ),
        withVisitFilters(
          supabase.from('visits').select('id', { count: 'exact', head: true }).eq('visit_type', 'self_recorded')
        ),
        withVisitFilters(
          supabase
            .from('visits')
            .select('id', { count: 'exact', head: true })
            .in('visit_type', ['chat', 'virtual', 'virtual_consultation'])
        ),
      ]);
      setTypeInPerson(vInPerson.count ?? 0);
      setTypeSelf(vSelf.count ?? 0);
      setTypeVirtual(vVirtual.count ?? 0);

      // 5) lightweight sample for distinct active patients & top fields
      //    (client aggregation keeps this simple; later we can move to an RPC if needed)
      const SAMPLE_LIMIT = 500; // tune later if necessary
      const vSample = await withVisitFilters(
        supabase
          .from('visits')
          .select('id, patient_id, diagnosis, symptoms, location, created_at')
          .order('created_at', { ascending: false })
          .range(0, SAMPLE_LIMIT - 1)
      );
      const rows = (vSample.data ?? []) as VisitRowLite[];

      // active patients (distinct within window)
      const uniqPatients = new Set<string>();
      rows.forEach(r => r.patient_id && uniqPatients.add(r.patient_id));
      setActivePatientsInRange(uniqPatients.size);

      // regions list from sample (keeps UX fast and simple)
      const regionSet = new Set<string>();
      rows.forEach(r => {
        const l = locality(r.location);
        if (l) regionSet.add(l);
      });
      setRegionsFromData(['All regions', ...Array.from(regionSet).sort()]);

      // top diagnosis/symptoms
      const diag = new Map<string, number>();
      const symp = new Map<string, number>();
      rows.forEach(r => {
        tokenize(r.diagnosis).forEach(t => diag.set(t, (diag.get(t) || 0) + 1));
        tokenize(r.symptoms).forEach(t => symp.set(t, (symp.get(t) || 0) + 1));
      });
      setTopDiagnoses(topN(diag, 5));
      setTopSymptoms(topN(symp, 5));
    } catch (e) {
      console.error('analytics load error', e);
    } finally {
      setLoading(false);
    }
  }, [fromISO, toISO, withVisitFilters]);

  useEffect(() => {
    load();
  }, [range, region, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  /** ---------------- UI ---------------- */
  const StickyHeader = useMemo(
    () => (
      <View style={styles.stickyHeader}>
        {/* Title */}
        <View style={styles.headerRow}>
          <MaterialIcons name="insights" size={20} color="#FF9800" />
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle}>Analytics</Text>
            <Text style={styles.headerSub}>KPIs, Regions & Symptoms</Text>
          </View>
        </View>

        {/* Controls: ranges + region */}
        <View style={styles.controlsRow}>
          <Button
            mode={range === 'today' ? 'contained' : 'outlined'}
            onPress={() => setRange('today')}
            style={styles.chip}
          >
            Today
          </Button>
          <Button
            mode={range === '7d' ? 'contained' : 'outlined'}
            onPress={() => setRange('7d')}
            style={styles.chip}
          >
            7d
          </Button>
          <Button
            mode={range === '30d' ? 'contained' : 'outlined'}
            onPress={() => setRange('30d')}
            style={styles.chip}
          >
            30d
          </Button>

          <Menu
            visible={regionMenuVisible}
            onDismiss={() => setRegionMenuVisible(false)}
            anchor={
              <Button
                mode="outlined"
                onPress={() => setRegionMenuVisible(true)}
                style={styles.regionBtn}
                icon={({ size, color }) => (
                  <MaterialIcons name="place" size={size} color={color} />
                )}
              >
                {region ?? 'Region'}
              </Button>
            }
          >
            {regionsFromData.map((r) => (
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
        </View>
      </View>
    ),
    [range, region, regionMenuVisible, regionsFromData]
  );

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.headerShim} />
        {StickyHeader}

        {/* KPIs */}
        <View style={styles.grid}>
          <Kpi title="Total Patients" value={totalPatients} icon="people" />
          <Kpi title="Total Doctors" value={totalDoctors} icon="medical-services" />
          <Kpi title="Visits (range)" value={visitsInRange} icon="event-note" />
          <Kpi title="Today’s Visits" value={todaysVisits} icon="today" />
          <Kpi title="Active Patients (range)" value={activePatientsInRange} icon="person" />
          <Kpi title="New Patients (range)" value={newPatientsInRange} icon="person-add-alt" />
        </View>

        {/* Breakdown */}
        <Card style={styles.card}>
          <Card.Title title="Visit Type Breakdown" left={(p) => <MaterialIcons {...p} name="pie-chart-outline" />} />
          <Card.Content>
            <List.Item
              title="In-person"
              right={() => <Text style={styles.kpiValue}>{typeInPerson}</Text>}
              left={() => <MaterialIcons name="event-available" size={20} color="#555" style={styles.listIcon} />}
            />
            <Divider />
            <List.Item
              title="Self-recorded"
              right={() => <Text style={styles.kpiValue}>{typeSelf}</Text>}
              left={() => <MaterialIcons name="edit-note" size={20} color="#555" style={styles.listIcon} />}
            />
            <Divider />
            <List.Item
              title="Virtual"
              right={() => <Text style={styles.kpiValue}>{typeVirtual}</Text>}
              left={() => <MaterialIcons name="chat" size={20} color="#555" style={styles.listIcon} />}
            />
          </Card.Content>
        </Card>

        {/* Top Diagnoses / Symptoms */}
        <Card style={styles.card}>
          <Card.Title title="Top Diagnoses" left={(p) => <MaterialIcons {...p} name="medical-information" />} />
          <Card.Content>
            {topDiagnoses.length === 0 && loading ? (
              <ActivityIndicator />
            ) : topDiagnoses.length ? (
              topDiagnoses.map((d) => (
                <List.Item
                  key={d.key}
                  title={d.key}
                  right={() => <Text style={styles.kpiValue}>{d.count}</Text>}
                  left={() => <MaterialIcons name="chevron-right" size={20} color="#555" style={styles.listIcon} />}
                />
              ))
            ) : (
              <Text style={styles.emptyText}>No diagnosis data in this window.</Text>
            )}
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Title title="Top Symptoms" left={(p) => <MaterialIcons {...p} name="sick" />} />
          <Card.Content>
            {topSymptoms.length === 0 && loading ? (
              <ActivityIndicator />
            ) : topSymptoms.length ? (
              topSymptoms.map((s) => (
                <List.Item
                  key={s.key}
                  title={s.key}
                  right={() => <Text style={styles.kpiValue}>{s.count}</Text>}
                  left={() => <MaterialIcons name="chevron-right" size={20} color="#555" style={styles.listIcon} />}
                />
              ))
            ) : (
              <Text style={styles.emptyText}>No symptom data in this window.</Text>
            )}
          </Card.Content>
        </Card>

        {/* pad bottom */}
        <View style={{ height: 24 }} />
      </ScrollView>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator />
        </View>
      )}
    </SafeAreaView>
  );
}

/** ---------- small KPI card (reusable) ---------- */
function Kpi({ title, value, icon }: { title: string; value: number; icon: keyof typeof MaterialIcons.glyphMap }) {
  return (
    <Card style={styles.kpiCard}>
      <Card.Content style={{ flexDirection: 'row', alignItems: 'center' }}>
        <MaterialIcons name={icon} size={20} color="#FF9800" />
        <View style={{ marginLeft: 8, flex: 1 }}>
          <Text style={styles.kpiTitle}>{title}</Text>
          <Text style={styles.kpiValue}>{value}</Text>
        </View>
      </Card.Content>
    </Card>
  );
}

/** ---------------- styles ---------------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scrollContent: { paddingBottom: 24 },
  headerShim: { height: 0, marginTop: -6 }, // tuck header under orange app bar
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

  controlsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, flexWrap: 'wrap' },
  chip: { marginRight: 8, marginTop: 8 },
  regionBtn: { marginTop: 8 },

  grid: {
    paddingHorizontal: 16,
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  kpiCard: {
    width: '48%',
    marginBottom: 12,
    elevation: 2,
  },
  kpiTitle: { color: '#666', fontSize: 12 },
  kpiValue: { fontSize: 18, fontWeight: 'bold', color: '#333' },

  card: { marginHorizontal: 16, marginTop: 12, elevation: 2 },
  listIcon: { marginRight: 8, marginTop: 2 },
  emptyText: { color: '#666', paddingVertical: 8 },

  loadingOverlay: {
    position: 'absolute', left: 0, right: 0, bottom: 0, top: 0,
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent'
  },
});
