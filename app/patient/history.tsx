import React, { useState, useEffect, useMemo } from 'react'
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native'
import { Text, FAB, ActivityIndicator } from 'react-native-paper'
import { MaterialIcons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '../../contexts/AuthContext'
import { supabase, Patient, Visit, getVisitShortLocation } from '../../lib/supabase'
import { useRouter } from 'expo-router'

/** ----------------- Unit helpers (display-only) ----------------- */
type WeightUnit = 'kg' | 'lb' | 'st'
type HeightUnit = 'cm' | 'in' | 'ft'
type TempUnit = 'C' | 'F'
type BPUnit = 'mmHg' | 'kPa'
type SugarUnit = 'mg_dL' | 'mmol_L'

const KG_PER_LB = 0.45359237
const KG_PER_ST = 6.35029318
const CM_PER_IN = 2.54
const CM_PER_FT = 30.48
const KPA_PER_MMHG = 0.133322
const MMOL_PER_MGDL = 1 / 18

const round1 = (n: number) => Math.round(n * 10) / 10

function convertWeight(x: number, to: WeightUnit) {
  if (to === 'kg') return x
  if (to === 'lb') return x / KG_PER_LB
  if (to === 'st') return x / KG_PER_ST
  return x
}
function convertHeight(x: number, to: HeightUnit) {
  if (to === 'cm') return x
  if (to === 'in') return x / CM_PER_IN
  if (to === 'ft') return x / CM_PER_FT
  return x
}
function convertTemp(x: number, to: TempUnit) {
  if (to === 'C') return x
  return x * 9 / 5 + 32
}
function convertBP(x: number, to: BPUnit) {
  if (to === 'mmHg') return x
  return x * KPA_PER_MMHG
}
function convertSugar(x: number, to: SugarUnit) {
  if (to === 'mg_dL') return x
  return x * MMOL_PER_MGDL
}

type DisplayUnits = {
  weight: WeightUnit
  height: HeightUnit
  temperature: TempUnit
  bloodPressure: BPUnit
  bloodSugar: SugarUnit
}

/** ----------------------------- UI bits ----------------------------- */
type UnitChip = { label: string; value: string }
const UnitChips = ({ options, value, onChange }: { options: UnitChip[], value: string, onChange: (v: any) => void }) => (
  <View style={styles.unitRow}>
    {options.map(o => (
      <TouchableOpacity
        key={o.value}
        onPress={() => onChange(o.value)}
        style={[styles.unitChip, value === o.value && styles.unitChipSelected]}
      >
        <Text style={[styles.unitChipText, value === o.value && styles.unitChipTextSelected]}>{o.label}</Text>
      </TouchableOpacity>
    ))}
  </View>
)

const PatientHistoryScreen: React.FC = () => {
  const { userProfile } = useAuth()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'doctor' | 'ai'>('doctor')
  const [visits, setVisits] = useState<Visit[]>([])
  const [filteredVisits, setFilteredVisits] = useState<Visit[]>([])
  const [aiSessions, setAiSessions] = useState<Visit[]>([])
  const [filteredAiSessions, setFilteredAiSessions] = useState<Visit[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const patient = userProfile as Patient

  // global display unit toolbar (local only)
  const [du, setDu] = useState<DisplayUnits>({
    weight: 'kg',
    height: 'cm',
    temperature: 'C',
    bloodPressure: 'mmHg',
    bloodSugar: 'mg_dL',
  })

  useEffect(() => {
    loadVisits()
  }, [])

  const loadVisits = async () => {
    if (!patient) return
    try {
      const { data } = await supabase
        .from('visits')
        .select(`
          *,
          field_doctors (name, specialization)
        `)
        .eq('patient_id', patient.id)
        .order('visit_date', { ascending: false })

      const physical = data?.filter((v) => v.visit_type !== 'virtual_consultation') || []
      setVisits(physical)
      setFilteredVisits(physical)

      const virtuals = data?.filter((v) => v.visit_type === 'virtual_consultation') || []
      setAiSessions(virtuals)
      setFilteredAiSessions(virtuals)
    } finally {
      setLoading(false)
    }
  }

  const onRefresh = () => {
    setRefreshing(true)
    loadVisits()
    setRefreshing(false)
  }

  const formatDate = (s: string) =>
    new Date(s).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  const formatTime = (s: string) =>
    new Date(s).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

  const getVitalChips = (visit: Visit) => {
    const chips: { label: string; unit?: string; alert?: boolean }[] = []
    if (visit.weight != null) {
      const v = round1(convertWeight(visit.weight, du.weight))
      const unit = du.weight === 'kg' ? 'kg' : du.weight === 'lb' ? 'lb' : 'st'
      chips.push({ label: `${v}`, unit })
    }
    if (visit.systolic_bp && visit.diastolic_bp) {
      const s = du.bloodPressure === 'mmHg' ? visit.systolic_bp : round1(convertBP(visit.systolic_bp, du.bloodPressure))
      const d = du.bloodPressure === 'mmHg' ? visit.diastolic_bp : round1(convertBP(visit.diastolic_bp, du.bloodPressure))
      const alert = visit.systolic_bp > 140 || visit.diastolic_bp > 90
      chips.push({ label: `${s}/${d}`, unit: du.bloodPressure, alert })
    }
    if (visit.heart_rate) chips.push({ label: `${visit.heart_rate}`, unit: 'bpm' })
    if (visit.temperature != null) {
      const v = du.temperature === 'C' ? round1(visit.temperature) : round1(convertTemp(visit.temperature, 'F'))
      chips.push({ label: `${v}°`, unit: du.temperature, alert: (du.temperature === 'C' ? visit.temperature > 37.5 : v > 99.5) })
    }
    if (visit.blood_sugar != null) {
      const v = du.bloodSugar === 'mg_dL' ? round1(visit.blood_sugar) : round1(convertSugar(visit.blood_sugar, 'mmol_L'))
      chips.push({ label: `${v}`, unit: du.bloodSugar, alert: (du.bloodSugar === 'mg_dL' ? visit.blood_sugar > 180 : v > 10) })
    }
    if (visit.oxygen_saturation) chips.push({ label: `${visit.oxygen_saturation}%`, unit: 'O₂' })
    return chips
  }

  const handleEditVisit = (visit: Visit) => {
    const visitParam = encodeURIComponent(JSON.stringify(visit))
    router.push(`/patient/edit-visit?visit=${visitParam}`)
  }

  const renderVisitCard = (visit: Visit) => (
    <View key={visit.id} style={styles.visitCard}>
      <View style={styles.visitHeader}>
        <View style={styles.visitDateContainer}>
          <Text style={styles.visitDate}>{formatDate(visit.visit_date)}</Text>
          <Text style={styles.visitTime}>
            {formatTime(visit.visit_date)}
            {(() => {
              const label = getVisitShortLocation(visit as Visit)
              return label ? ` • ${label}` : ''
            })()}
          </Text>
        </View>

        {(!visit.doctor_id || visit.visit_type === 'self_recorded') && (
          <TouchableOpacity style={styles.editButton} onPress={() => handleEditVisit(visit)}>
            <MaterialIcons name="edit" size={20} color="#4285F4" />
          </TouchableOpacity>
        )}
      </View>

      {(visit as any).field_doctors ? (
        <View style={styles.doctorInfo}>
          <View style={styles.doctorIcon}>
            <MaterialIcons name="local-hospital" size={16} color="#4285F4" />
          </View>
          <View style={styles.doctorDetails}>
            <Text style={styles.doctorName}>Dr. {(visit as any).field_doctors?.name}</Text>
            <Text style={styles.doctorSpecialization}>{(visit as any).field_doctors?.specialization}</Text>
          </View>
        </View>
      ) : (
        <View style={styles.doctorInfo}>
          <View style={styles.doctorIcon}>
            <MaterialIcons name="self-improvement" size={16} color="#4CAF50" />
          </View>
          <View style={styles.doctorDetails}>
            <Text style={styles.doctorName}>Self-recorded</Text>
            <Text style={styles.doctorSpecialization}>Personal entry</Text>
          </View>
        </View>
      )}

      {(() => {
        const chips = getVitalChips(visit)
        if (!chips.length) return null
        return (
          <View style={styles.vitalsSection}>
            <Text style={styles.sectionTitle}>Vitals</Text>
            <View style={styles.vitalsGrid}>
              {chips.map((v, i) => (
                <View key={i} style={[styles.vitalChip, v.alert && styles.alertChip]}>
                  <Text style={[styles.vitalValue, v.alert && styles.alertText]}>{v.label}</Text>
                  {v.unit ? (
                    <Text style={[styles.vitalUnit, v.alert && styles.alertText]}>{v.unit}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          </View>
        )
      })()}

      {visit.symptoms ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Symptoms</Text>
          <Text style={styles.sectionContent}>{visit.symptoms}</Text>
        </View>
      ) : null}

      {visit.diagnosis ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Diagnosis</Text>
          <Text style={styles.sectionContent}>{visit.diagnosis}</Text>
        </View>
      ) : null}

      {visit.treatment_notes ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Treatment</Text>
          <Text style={styles.sectionContent}>{visit.treatment_notes}</Text>
        </View>
      ) : null}

      {visit.prescribed_medications ? (
        <View style={styles.medicationSection}>
          <Text style={styles.sectionTitle}>Medications</Text>
          <Text style={styles.medicationContent}>{visit.prescribed_medications}</Text>
        </View>
      ) : null}
    </View>
  )

  const renderDisplayToolbar = () => (
    <View style={styles.toolbar}>
      <View style={styles.toolbarRow}>
        <Text style={styles.toolbarLabel}>Weight</Text>
        <UnitChips
          options={[{label:'kg',value:'kg'},{label:'lb',value:'lb'},{label:'st',value:'st'}]}
          value={du.weight} onChange={(v)=>setDu(prev=>({...prev, weight: v as WeightUnit}))}
        />
      </View>

      <View style={styles.toolbarRow}>
        <Text style={styles.toolbarLabel}>Height</Text>
        <UnitChips
          options={[{label:'cm',value:'cm'},{label:'in',value:'in'},{label:'ft',value:'ft'}]}
          value={du.height} onChange={(v)=>setDu(prev=>({...prev, height: v as HeightUnit}))}
        />
      </View>

      <View style={styles.toolbarRow}>
        <Text style={styles.toolbarLabel}>Temperature</Text>
        <UnitChips
          options={[{label:'°C',value:'C'},{label:'°F',value:'F'}]}
          value={du.temperature} onChange={(v)=>setDu(prev=>({...prev, temperature: v as TempUnit}))}
        />
      </View>

      <View style={styles.toolbarRow}>
        <Text style={styles.toolbarLabel}>Blood Pressure</Text>
        <UnitChips
          options={[{label:'mmHg',value:'mmHg'},{label:'kPa',value:'kPa'}]}
          value={du.bloodPressure} onChange={(v)=>setDu(prev=>({...prev, bloodPressure: v as BPUnit}))}
        />
      </View>

      <View style={styles.toolbarRow}>
        <Text style={styles.toolbarLabel}>Blood Sugar</Text>
        <UnitChips
          options={[{label:'mg/dL',value:'mg_dL'},{label:'mmol/L',value:'mmol_L'}]}
          value={du.bloodSugar} onChange={(v)=>setDu(prev=>({...prev, bloodSugar: v as SugarUnit}))}
        />
      </View>
    </View>
  )

  const renderDoctorTab = () => (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      {renderDisplayToolbar()}

      {filteredVisits.length ? (
        filteredVisits.map(renderVisitCard)
      ) : (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <MaterialIcons name="medical-information" size={48} color="#CCCCCC" />
          </View>
          <Text style={styles.emptyTitle}>No doctor visits yet</Text>
          <Text style={styles.emptyText}>
            Your doctor visit history will appear here after your first appointment
          </Text>
        </View>
      )}
    </ScrollView>
  )

  const renderAiTab = () => (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      {renderDisplayToolbar()}

      {filteredAiSessions.length ? (
        filteredAiSessions.map(renderVisitCard)
      ) : (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <MaterialIcons name="psychology" size={48} color="#CCCCCC" />
          </View>
          <Text style={styles.emptyTitle}>No AI sessions yet</Text>
          <Text style={styles.emptyText}>
            Start a conversation with the AI assistant to see your interaction history here
          </Text>
        </View>
      )}
    </ScrollView>
  )

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'doctor' && styles.activeTab]}
          onPress={() => setActiveTab('doctor')}
        >
          <MaterialIcons name="local-hospital" size={20} color={activeTab === 'doctor' ? '#4285F4' : '#999999'} />
          <Text style={[styles.tabText, activeTab === 'doctor' && styles.activeTabText]}>Visits</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'ai' && styles.activeTab]}
          onPress={() => setActiveTab('ai')}
        >
          <MaterialIcons name="psychology" size={20} color={activeTab === 'ai' ? '#4285F4' : '#999999'} />
          <Text style={[styles.tabText, activeTab === 'ai' && styles.activeTabText]}>AI Sessions</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4285F4" />
          <Text style={styles.loadingText}>Loading history...</Text>
        </View>
      ) : activeTab === 'doctor' ? (
        renderDoctorTab()
      ) : (
        renderAiTab()
      )}

      <FAB
        style={styles.fab}
        onPress={() => router.push('/patient/AddVitals')}
        customSize={56}
        color="#FFFFFF"
        icon={() => (
          <Text style={{ fontSize: 28, marginLeft: 5, marginTop: -5, fontWeight: 'bold', color: '#FFFFFF' }}>+</Text>
        )}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', marginTop: -55 },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  unitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unitChip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginHorizontal: 2,
  },
  unitChipSelected: {
    backgroundColor: '#4285F4',
    borderColor: '#4285F4',
  },
  unitChipText: {
    fontSize: 14,
    color: '#333333',
    fontWeight: '500',
  },
  unitChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, paddingHorizontal: 16, marginHorizontal: 4, borderRadius: 8,
  },
  activeTab: { backgroundColor: '#F0F7FF' },
  tabText: { marginLeft: 8, fontSize: 16, color: '#999999', fontWeight: '500' },
  activeTabText: { color: '#4285F4', fontWeight: '600' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  loadingText: { marginTop: 16, fontSize: 16, color: '#666666' },
  scrollContent: { padding: 20, paddingBottom: 100 },

  /* toolbar */
  toolbar: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#E8E8E8', borderRadius: 12,
    padding: 12, marginBottom: 16, gap: 10,
  },
  toolbarRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toolbarLabel: { fontSize: 14, fontWeight: '600', color: '#333333', marginRight: 8 },

  /* visit card (unchanged) */
  visitCard: { backgroundColor: '#FAFAFA', borderRadius: 12, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#E8E8E8' },
  visitHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  visitDateContainer: { flex: 1 },
  visitDate: { fontSize: 18, fontWeight: '600', color: '#333333', marginBottom: 4 },
  visitTime: { fontSize: 14, color: '#666666' },
  editButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F0F7FF', alignItems: 'center', justifyContent: 'center' },
  doctorInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1, borderColor: '#E8E8E8' },
  doctorIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F0F7FF', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  doctorDetails: { flex: 1 },
  doctorName: { fontSize: 16, fontWeight: '600', color: '#333333', marginBottom: 2 },
  doctorSpecialization: { fontSize: 14, color: '#666666' },
  vitalsSection: { marginBottom: 16 },
  vitalsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  vitalChip: { backgroundColor: '#FFFFFF', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: '#E8E8E8', minWidth: 80, alignItems: 'center' },
  alertChip: { backgroundColor: '#FFF5F5', borderColor: '#FFB3B3' },
  vitalValue: { fontSize: 16, fontWeight: '600', color: '#333333' },
  vitalUnit: { fontSize: 12, color: '#666666', marginTop: 2 },
  alertText: { color: '#D32F2F' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#333333', marginBottom: 8 },
  sectionContent: { fontSize: 14, color: '#666666', lineHeight: 20 },
  medicationSection: { marginBottom: 16 },
  medicationContent: { fontSize: 14, color: '#2E7D32', backgroundColor: '#F0F8F0', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#E8F5E8', lineHeight: 20 },
  emptyState: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#F8F9FA', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: '#333333', marginBottom: 8, textAlign: 'center' },
  emptyText: { fontSize: 16, color: '#666666', textAlign: 'center', lineHeight: 24 },
  fab: { position: 'absolute', margin: 20, right: 0, bottom: 0, backgroundColor: '#4285F4' },
})

export default PatientHistoryScreen
