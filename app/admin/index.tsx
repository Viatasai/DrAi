import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native'
import { Card, Text, Button, List, Divider, ActivityIndicator, Menu } from 'react-native-paper'
import { MaterialIcons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '../../contexts/AuthContext'
import { supabase, Admin } from '../../lib/supabase'

import EmptyState from '~/components/EmptyState'
import StatsCard from '~/components/StatsCard'

/** ---------------- types ---------------- */
type RangeTab = 'today' | '7d' | '30d'

interface SystemStats {
  totalPatients: number
  totalDoctors: number
  visitsInRange: number
  visitsToday: number
  activePatientsInRange: number
  newPatientsInRange: number
}

/** ---------------- tiny helpers (same spirit as analytics) ---------------- */
function startOfTodayISO(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}
function nowISO(): string {
  return new Date().toISOString()
}
function subDaysStartOfDayISO(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - (days - 1)) // inclusive window
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}
function locality(loc: any): string {
  return loc?.locality || loc?.adminArea || loc?.city || loc?.region || ''
}
function tokenize(text?: string | null): string[] {
  if (!text) return []
  return text
    .split(/[,;\n]/g)
    .map(s => s.trim().toLowerCase())
    .filter(s => s.length > 1)
}
function topN(map: Map<string, number>, n = 5): { key: string; count: number }[] {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key, count]) => ({ key, count }))
}

/** ---------------- screen ---------------- */
const AdminHomeScreen: React.FC = () => {
  const { userProfile } = useAuth()
  const admin = userProfile as Admin

  const [stats, setStats] = useState<SystemStats>({
    totalPatients: 0,
    totalDoctors: 0,
    visitsInRange: 0,
    visitsToday: 0,
    activePatientsInRange: 0,
    newPatientsInRange: 0,
  })

  // range + region controls
  const [range, setRange] = useState<RangeTab>('7d')
  const [region, setRegion] = useState<string | null>(null)
  const [regionMenuVisible, setRegionMenuVisible] = useState(false)
  const [regionsFromData, setRegionsFromData] = useState<string[]>(['All regions'])

  // breakdown + lists
  const [typeInPerson, setTypeInPerson] = useState<number>(0)
  const [typeSelf, setTypeSelf] = useState<number>(0)
  const [typeVirtual, setTypeVirtual] = useState<number>(0)
  const [topDiagnoses, setTopDiagnoses] = useState<{ key: string; count: number }[]>([])
  const [topSymptoms, setTopSymptoms] = useState<{ key: string; count: number }[]>([])

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // date window derived from range
  const { fromISO, toISO } = useMemo(() => {
    if (range === 'today') return { fromISO: startOfTodayISO(), toISO: nowISO() }
    if (range === '7d') return { fromISO: subDaysStartOfDayISO(7), toISO: nowISO() }
    return { fromISO: subDaysStartOfDayISO(30), toISO: nowISO() }
  }, [range])

  /** small helper so we reuse the same visit filters */
  const withVisitFilters = useCallback(
    (q: any) => {
      q = q.gte('created_at', fromISO).lte('created_at', toISO)
      if (region && region !== 'All regions') {
        q = q.filter('location->>locality', 'eq', region)
      }
      return q
    },
    [fromISO, toISO, region]
  )

  useEffect(() => {
    loadSystemStats()
  }, [range, region])

  const loadSystemStats = async () => {
    try {
      setLoading(true)

      // totals (no region)
      const [pAll, dAll] = await Promise.all([
        supabase.from('patients').select('*', { count: 'exact', head: true }),
        supabase.from('field_doctors').select('*', { count: 'exact', head: true }),
      ])

      // new patients created in window (no region column on patients yet)
      const pRange = await supabase
        .from('patients')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', fromISO)
        .lte('created_at', toISO)

      // visits in range + today
      const vRange = await withVisitFilters(
        supabase.from('visits').select('id', { count: 'exact', head: true })
      )
      const vToday = await withVisitFilters(
        supabase
          .from('visits')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', startOfTodayISO())
      )

      // visit type breakdown (3 clear count queries)
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
      ])

      // lightweight sample for active patients & top fields
      const SAMPLE_LIMIT = 500
      const vSample = await withVisitFilters(
        supabase
          .from('visits')
          .select('id, patient_id, diagnosis, symptoms, location, created_at')
          .order('created_at', { ascending: false })
          .range(0, SAMPLE_LIMIT - 1)
      )
      const rows = vSample.data ?? []

      // active patients (distinct within window)
      const uniqPatients = new Set<string>()
      rows.forEach((r: any) => r.patient_id && uniqPatients.add(r.patient_id))

      // available regions from sample (keeps UX fast)
      const regionSet = new Set<string>()
      rows.forEach((r: any) => {
        const l = locality(r.location)
        if (l) regionSet.add(l)
      })
      setRegionsFromData(['All regions', ...Array.from(regionSet).sort()])

      // top diagnosis / symptoms
      const diag = new Map<string, number>()
      const symp = new Map<string, number>()
      rows.forEach((r: any) => {
        tokenize(r.diagnosis).forEach(t => diag.set(t, (diag.get(t) || 0) + 1))
        tokenize(r.symptoms).forEach(t => symp.set(t, (symp.get(t) || 0) + 1))
      })

      setStats({
        totalPatients: pAll.count ?? 0,
        totalDoctors: dAll.count ?? 0,
        visitsInRange: vRange.count ?? 0,
        visitsToday: vToday.count ?? 0,
        activePatientsInRange: uniqPatients.size,
        newPatientsInRange: pRange.count ?? 0,
      })
      setTypeInPerson(vInPerson.count ?? 0)
      setTypeSelf(vSelf.count ?? 0)
      setTypeVirtual(vVirtual.count ?? 0)
      setTopDiagnoses(topN(diag, 5))
      setTopSymptoms(topN(symp, 5))
    } catch (err) {
      console.error('Error loading system stats:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const onRefresh = () => {
    setRefreshing(true)
    loadSystemStats()
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Welcome Section */}
        <Card style={styles.welcomeCard}>
          <Card.Content>
            <View style={styles.welcomeHeader}>
              <MaterialIcons name="admin-panel-settings" size={32} color="#FF9800" />
              <View style={styles.welcomeTextContainer}>
                <Text style={styles.welcomeText}>Welcome, {admin?.name}!</Text>
                <Text style={styles.welcomeSubText}>System Administrator Dashboard</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* ---- System Overview with range + region (merged from analytics) ---- */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>System Overview</Text>

          <View style={styles.controlsRow}>
            <Button mode={range === 'today' ? 'contained' : 'outlined'} onPress={() => setRange('today')} style={styles.rangeBtn}>
              Today
            </Button>
            <Button mode={range === '7d' ? 'contained' : 'outlined'} onPress={() => setRange('7d')} style={styles.rangeBtn}>
              7d
            </Button>
            <Button mode={range === '30d' ? 'contained' : 'outlined'} onPress={() => setRange('30d')} style={styles.rangeBtn}>
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
                  icon={({ size, color }) => <MaterialIcons name="place" size={size} color={color} />}
                >
                  {region ?? 'Region'}
                </Button>
              }
            >
              {regionsFromData.map(r => (
                <Menu.Item
                  key={r}
                  onPress={() => {
                    setRegion(r === 'All regions' ? null : r)
                    setRegionMenuVisible(false)
                  }}
                  title={r}
                />
              ))}
            </Menu>
          </View>
        </View>

        {/* KPI Grid */}
        <View style={styles.statsGrid}>
          <StatsCard title="Total Patients" value={stats.totalPatients} icon="people" color="#2196F3" />
          <StatsCard title="Total Doctors" value={stats.totalDoctors} icon="local-hospital" color="#4CAF50" />
        </View>
        <View style={styles.statsGrid}>
          <StatsCard title="Visits (range)" value={stats.visitsInRange} icon="event-note" color="#9C27B0" />
          <StatsCard title="Today’s Visits" value={stats.visitsToday} icon="today" color="#FF5722" />
        </View>
        <View style={styles.statsGrid}>
          <StatsCard title="Active Patients (range)" value={stats.activePatientsInRange} icon="person" color="#607D8B" />
          <StatsCard title="New Patients (range)" value={stats.newPatientsInRange} icon="person-add-alt" color="#795548" />
        </View>

        {/* Visit Type Breakdown */}
        <Card style={styles.sectionCard}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="pie-chart-outline" size={20} color="#FF9800" />
              <Text style={[styles.sectionTitle, { marginLeft: 8 }]}>Visit Type Breakdown</Text>
            </View>
            <List.Item
              title="In-person"
              left={() => <MaterialIcons name="event-available" size={20} color="#555" style={styles.listIcon} />}
              right={() => <Text style={styles.kpiValue}>{typeInPerson}</Text>}
            />
            <Divider />
            <List.Item
              title="Self-recorded"
              left={() => <MaterialIcons name="edit-note" size={20} color="#555" style={styles.listIcon} />}
              right={() => <Text style={styles.kpiValue}>{typeSelf}</Text>}
            />
            <Divider />
            <List.Item
              title="Virtual"
              left={() => <MaterialIcons name="chat" size={20} color="#555" style={styles.listIcon} />}
              right={() => <Text style={styles.kpiValue}>{typeVirtual}</Text>}
            />
          </Card.Content>
        </Card>

        {/* Top Diagnoses */}
        <Card style={styles.sectionCard}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="medical-information" size={20} color="#FF9800" />
              <Text style={[styles.sectionTitle, { marginLeft: 8 }]}>Top Diagnoses</Text>
            </View>
            {topDiagnoses.length === 0 && loading ? (
              <ActivityIndicator />
            ) : topDiagnoses.length ? (
              topDiagnoses.map(d => (
                <List.Item
                  key={d.key}
                  title={d.key}
                  left={() => <MaterialIcons name="chevron-right" size={20} color="#555" style={styles.listIcon} />}
                  right={() => <Text style={styles.kpiValue}>{d.count}</Text>}
                />
              ))
            ) : (
              <Text style={styles.emptyText}>No diagnosis data in this window.</Text>
            )}
          </Card.Content>
        </Card>

        {/* Top Symptoms */}
        <Card style={styles.sectionCard}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="sick" size={20} color="#FF9800" />
              <Text style={[styles.sectionTitle, { marginLeft: 8 }]}>Top Symptoms</Text>
            </View>
            {topSymptoms.length === 0 && loading ? (
              <ActivityIndicator />
            ) : topSymptoms.length ? (
              topSymptoms.map(s => (
                <List.Item
                  key={s.key}
                  title={s.key}
                  left={() => <MaterialIcons name="chevron-right" size={20} color="#555" style={styles.listIcon} />}
                  right={() => <Text style={styles.kpiValue}>{s.count}</Text>}
                />
              ))
            ) : (
              <Text style={styles.emptyText}>No symptom data in this window.</Text>
            )}
          </Card.Content>
        </Card>

        {/* Quick Actions (kept) */}
        <Card style={styles.sectionCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.actionsContainer}>
              <Button
                mode="contained"
                icon="people"
                style={[styles.actionButton, { backgroundColor: '#2196F3' }]}
                contentStyle={styles.actionButtonContent}
              >
                Manage Patients
              </Button>
              <Button
                mode="contained"
                icon="local-hospital"
                style={[styles.actionButton, { backgroundColor: '#4CAF50' }]}
                contentStyle={styles.actionButtonContent}
              >
                Manage Doctors
              </Button>
              <Button mode="outlined" icon="analytics" style={styles.actionButton} contentStyle={styles.actionButtonContent}>
                View Analytics
              </Button>
              <Button mode="outlined" icon="settings" style={styles.actionButton} contentStyle={styles.actionButtonContent}>
                System Settings
              </Button>
            </View>
          </Card.Content>
        </Card>

        {/* System Health (kept) */}
        <Card style={styles.sectionCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>System Health</Text>
            <View style={styles.healthContainer}>
              <View style={styles.healthItem}>
                <MaterialIcons name="check-circle" size={24} color="#4CAF50" />
                <Text style={styles.healthText}>Database Connection: Online</Text>
              </View>
              <View style={styles.healthItem}>
                <MaterialIcons name="check-circle" size={24} color="#4CAF50" />
                <Text style={styles.healthText}>API Services: Operational</Text>
              </View>
              <View style={styles.healthItem}>
                <MaterialIcons name="check-circle" size={24} color="#4CAF50" />
                <Text style={styles.healthText}>Authentication: Active</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Recent System Activity (kept) */}
        <Card style={styles.sectionCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Recent System Activity</Text>
            <EmptyState
              icon="timeline"
              title="Activity Log"
              description="System activity and audit logs will appear here when available."
              iconSize={48}
            />
          </Card.Content>
        </Card>
      </ScrollView>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator />
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scrollContent: { padding: 16 },

  welcomeCard: { marginBottom: 24, elevation: 2 },
  welcomeHeader: { flexDirection: 'row', alignItems: 'center' },
  welcomeTextContainer: { marginLeft: 16, flex: 1 },
  welcomeText: { fontSize: 20, fontWeight: 'bold' },
  welcomeSubText: { color: '#666', marginTop: 4 },

  sectionHeaderRow: { marginBottom: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },

  controlsRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 8 },
  rangeBtn: { marginRight: 8, marginTop: 8 },
  regionBtn: { marginTop: 8 },

  statsGrid: { flexDirection: 'row', gap: 12, marginBottom: 16 },

  sectionCard: { marginBottom: 16, elevation: 2 },

  actionsContainer: { gap: 12 },
  actionButton: { marginVertical: 4 },
  actionButtonContent: { paddingVertical: 8 },

  healthContainer: { gap: 12 },
  healthItem: { flexDirection: 'row', alignItems: 'center' },
  healthText: { marginLeft: 12, fontSize: 16, color: '#333' },

  listIcon: { marginRight: 8, marginTop: 2 },
  kpiValue: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  emptyText: { color: '#666', paddingVertical: 8 },

  loadingOverlay: {
    position: 'absolute', left: 0, right: 0, bottom: 0, top: 0,
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent'
  },
})

export default AdminHomeScreen
