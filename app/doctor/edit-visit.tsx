import React, { useEffect, useMemo, useState } from 'react'
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { Text, Button } from 'react-native-paper'
import { MaterialIcons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useAuth } from '../../contexts/AuthContext'
import { supabase, Visit } from '../../lib/supabase'
import CleanTextInput from '~/components/input/cleanTextInput'
import { showToast } from '~/utils/toast'

/** --- conversions (DB canonical: kg, cm, mmHg, °C, mg/dL) --- */
const LB_PER_KG = 2.2046226218
const KG_PER_ST = 6.35029318
const MMHG_PER_KPA = 7.50061683
const MGDL_PER_MMOLL = 18

const toKg = (v: number, u: 'kg' | 'lb' | 'st') => (u === 'kg' ? v : u === 'lb' ? v / LB_PER_KG : v * KG_PER_ST)
const toCm = (v: number, u: 'cm' | 'in' | 'ft') => (u === 'cm' ? v : u === 'in' ? v * 2.54 : v * 30.48)
const toMmHg = (v: number, u: 'mmHg' | 'kPa') => (u === 'mmHg' ? v : v * MMHG_PER_KPA)
const toC = (v: number, u: 'C' | 'F') => (u === 'C' ? v : (v - 32) * (5 / 9))
const toMgdl = (v: number, u: 'mg_dL' | 'mmol_L') => (u === 'mg_dL' ? v : v * MGDL_PER_MMOLL)

const fmt = (n: number, d = 2) => (Number.isNaN(n) ? '' : n.toFixed(d).replace(/\.?0+$/, ''))

const DoctorEditVisitScreen: React.FC = () => {
  const router = useRouter()
  const { userProfile } = useAuth()

  // ✅ Read params correctly in Expo Router
  const params = useLocalSearchParams<{
    visit?: string
    visitId?: string
  }>()

  // Allow passing the visit as JSON (common) or just the id
  const parsedVisitFromParam: Visit | null = useMemo(() => {
    const raw = params.visit
    if (!raw || Array.isArray(raw)) return null
    try {
      return JSON.parse(raw) as Visit
    } catch {
      return null
    }
  }, [params.visit])

  const visitIdFromParam: string | null = useMemo(() => {
    const v = params.visitId
    if (!v) return null
    return Array.isArray(v) ? v[0] : v
  }, [params.visitId])

  const [loading, setLoading] = useState(false)
  const [visit, setVisit] = useState<Visit | null>(parsedVisitFromParam)

  // form state (string inputs)
  const [weight, setWeight] = useState('')
  const [height, setHeight] = useState('')
  const [systolicBp, setSystolicBp] = useState('')
  const [diastolicBp, setDiastolicBp] = useState('')
  const [heartRate, setHeartRate] = useState('')
  const [temperature, setTemperature] = useState('')
  const [bloodSugar, setBloodSugar] = useState('')
  const [oxygenSaturation, setOxygenSaturation] = useState('')
  const [respiratoryRate, setRespiratoryRate] = useState('')

  const [symptoms, setSymptoms] = useState('')
  const [diagnosis, setDiagnosis] = useState('')
  const [treatmentNotes, setTreatmentNotes] = useState('')
  const [prescriptions, setPrescriptions] = useState('')
  const [followUp, setFollowUp] = useState('')

  // Optional display units – if you already had unit chips here, keep them wired to these
  const [weightU, setWeightU] = useState<'kg' | 'lb' | 'st'>('kg')
  const [heightU, setHeightU] = useState<'cm' | 'in' | 'ft'>('cm')
  const [bpU, setBpU] = useState<'mmHg' | 'kPa'>('mmHg')
  const [tempU, setTempU] = useState<'C' | 'F'>('C')
  const [sugarU, setSugarU] = useState<'mg_dL' | 'mmol_L'>('mg_dL')

  // Load by id if we didn’t receive the full visit object
  useEffect(() => {
    if (visit) return
    if (!visitIdFromParam) return
    ;(async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('visits')
          .select('*')
          .eq('id', visitIdFromParam)
          .single()
        if (error) {
          showToast.error('Error', 'Failed to load visit')
          console.error(error)
        } else {
          setVisit(data as Visit)
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [visitIdFromParam])

  // Seed form once we have a visit
  useEffect(() => {
    if (!visit) return
    setWeight(visit.weight != null ? fmt(visit.weight) : '')
    setHeight(visit.height != null ? fmt(visit.height) : '')
    setSystolicBp(visit.systolic_bp != null ? String(visit.systolic_bp) : '')
    setDiastolicBp(visit.diastolic_bp != null ? String(visit.diastolic_bp) : '')
    setHeartRate(visit.heart_rate != null ? String(visit.heart_rate) : '')
    setTemperature(visit.temperature != null ? fmt(visit.temperature) : '')
    setBloodSugar(visit.blood_sugar != null ? fmt(visit.blood_sugar) : '')
    setOxygenSaturation(visit.oxygen_saturation != null ? String(visit.oxygen_saturation) : '')
    setRespiratoryRate(visit.respiratory_rate != null ? String(visit.respiratory_rate) : '')

    setSymptoms(visit.symptoms ?? '')
    setDiagnosis(visit.diagnosis ?? '')
    setTreatmentNotes(visit.treatment_notes ?? '')
    setPrescriptions(visit.prescribed_medications ?? '')
    setFollowUp(visit.follow_up_instructions ?? '')
  }, [visit])

  const validateForm = () => {
    // Match your existing simple checks; avoid blocking edits unnecessarily
    if (
      !weight &&
      !height &&
      !systolicBp &&
      !diastolicBp &&
      !heartRate &&
      !temperature &&
      !bloodSugar &&
      !oxygenSaturation &&
      !respiratoryRate &&
      !symptoms &&
      !diagnosis &&
      !treatmentNotes &&
      !prescriptions &&
      !followUp
    ) {
      showToast.error('Validation Error', 'Nothing to update')
      return false
    }
    return true
  }

  const toCanonical = () => {
    // Convert only numbers that are provided; leave others null (so they won’t overwrite)
    const w = weight ? toKg(parseFloat(weight), weightU) : undefined
    const h = height ? toCm(parseFloat(height), heightU) : undefined
    const sbp = systolicBp ? Math.round(toMmHg(parseFloat(systolicBp), bpU)) : undefined
    const dbp = diastolicBp ? Math.round(toMmHg(parseFloat(diastolicBp), bpU)) : undefined
    const t = temperature ? parseFloat(fmt(toC(parseFloat(temperature), tempU))) : undefined
    const bs = bloodSugar ? parseFloat(fmt(toMgdl(parseFloat(bloodSugar), sugarU))) : undefined
    const hr = heartRate ? parseInt(heartRate) : undefined
    const spo2 = oxygenSaturation ? parseInt(oxygenSaturation) : undefined
    const rr = respiratoryRate ? parseInt(respiratoryRate) : undefined

    return {
      ...(w !== undefined ? { weight: w } : {}),
      ...(h !== undefined ? { height: h } : {}),
      ...(sbp !== undefined ? { systolic_bp: sbp } : {}),
      ...(dbp !== undefined ? { diastolic_bp: dbp } : {}),
      ...(t !== undefined ? { temperature: t } : {}),
      ...(bs !== undefined ? { blood_sugar: bs } : {}),
      ...(hr !== undefined ? { heart_rate: hr } : {}),
      ...(spo2 !== undefined ? { oxygen_saturation: spo2 } : {}),
      ...(rr !== undefined ? { respiratory_rate: rr } : {}),
      symptoms: symptoms.trim() || null,
      diagnosis: diagnosis.trim() || null,
      treatment_notes: treatmentNotes.trim() || null,
      prescribed_medications: prescriptions.trim() || null,
      follow_up_instructions: followUp.trim() || null,
    }
  }

  const handleSave = async () => {
    if (!visit) {
      showToast.error('Visit not loaded yet', 'Not ready')
      return
    }
    if (!validateForm()) return

    setLoading(true)
    try {
      const payload = toCanonical()
      const { error } = await supabase
        .from('visits')
        .update(payload)
        .eq('id', visit.id)
      if (error) {
        showToast.error('Failed to update visit', 'Error')
        console.error('update visit error', error)
      } else {
        showToast.success('Success', 'Visit updated')
        router.back()
      }
    } catch (e) {
      showToast.error('Failed to update visit', 'Error')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  if (!visit) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <MaterialIcons name="arrow-back" size={20} color="#333333" />
          </TouchableOpacity>
          <Text style={styles.title}>edit-visit</Text>
        </View>
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>Loading visit…</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <MaterialIcons name="arrow-back" size={20} color="#333333" />
        </TouchableOpacity>
        <Text style={styles.title}>edit-visit</Text>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Vitals */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vital Signs</Text>

          <CleanTextInput
            label="Weight (kg)"
            value={weight}
            onChangeText={setWeight}
            keyboardType="decimal-pad"
            placeholder="75.5"
          />
          <CleanTextInput
            label="Height (cm)"
            value={height}
            onChangeText={setHeight}
            keyboardType="decimal-pad"
            placeholder="170"
          />

          <View style={styles.row}>
            <View style={[styles.inputGrow, { marginRight: 8 }]}>
              <CleanTextInput
                label="Systolic BP (mmHg)"
                value={systolicBp}
                onChangeText={setSystolicBp}
                keyboardType="numeric"
                placeholder="120"
              />
            </View>
            <View style={styles.inputGrow}>
              <CleanTextInput
                label="Diastolic BP (mmHg)"
                value={diastolicBp}
                onChangeText={setDiastolicBp}
                keyboardType="numeric"
                placeholder="80"
              />
            </View>
          </View>

          <CleanTextInput
            label="Heart Rate (bpm)"
            value={heartRate}
            onChangeText={setHeartRate}
            keyboardType="numeric"
            placeholder="72"
          />
          <CleanTextInput
            label="Temperature (°C)"
            value={temperature}
            onChangeText={setTemperature}
            keyboardType="decimal-pad"
            placeholder="36.6"
          />
          <CleanTextInput
            label="Blood Sugar (mg/dL)"
            value={bloodSugar}
            onChangeText={setBloodSugar}
            keyboardType="decimal-pad"
            placeholder="90"
          />
          <CleanTextInput
            label="Oxygen Saturation (%)"
            value={oxygenSaturation}
            onChangeText={setOxygenSaturation}
            keyboardType="numeric"
            placeholder="98"
          />
          <CleanTextInput
            label="Respiratory Rate (breaths/min)"
            value={respiratoryRate}
            onChangeText={setRespiratoryRate}
            keyboardType="numeric"
            placeholder="16"
          />
        </View>

        {/* Clinical notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Clinical Notes</Text>
          <CleanTextInput
            label="Current Symptoms"
            value={symptoms}
            onChangeText={setSymptoms}
            placeholder="e.g., headache, cough…"
            multiline
            numberOfLines={3}
          />
          <CleanTextInput
            label="Diagnosis"
            value={diagnosis}
            onChangeText={setDiagnosis}
            placeholder="Optional"
            multiline
            numberOfLines={3}
          />
          <CleanTextInput
            label="Treatment Notes"
            value={treatmentNotes}
            onChangeText={setTreatmentNotes}
            placeholder="Optional"
            multiline
            numberOfLines={3}
          />
          <CleanTextInput
            label="Prescribed Medications"
            value={prescriptions}
            onChangeText={setPrescriptions}
            placeholder="Optional"
            multiline
            numberOfLines={3}
          />
          <CleanTextInput
            label="Follow-up Instructions"
            value={followUp}
            onChangeText={setFollowUp}
            placeholder="Optional"
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            mode="contained"
            onPress={handleSave}
            loading={loading}
            disabled={loading}
            style={styles.primaryBtn}
            buttonColor="#4285F4"
          >
            {loading ? 'Saving…' : 'Save Changes'}
          </Button>
          <Button
            mode="outlined"
            onPress={() => router.back()}
            disabled={loading}
            style={styles.secondaryBtn}
            textColor="#666666"
          >
            Cancel
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333333',
    flex: 1
  },
  content: {
    flex: 1
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    paddingBottom: 40
  },
  section: {
    marginBottom: 24
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 12
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  inputGrow: {
    flex: 1
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8
  },
  primaryBtn: {
    flex: 1,
    borderRadius: 10
  },
  secondaryBtn: {
    flex: 1,
    borderRadius: 10
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  loadingText: {
    color: '#666666',
    fontSize: 16
  },
})

export default DoctorEditVisitScreen
