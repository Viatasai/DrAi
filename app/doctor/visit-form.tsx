import React, { useState } from 'react'
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { Text, Button } from 'react-native-paper'
import { MaterialIcons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useAuth } from '../../contexts/AuthContext'
import { supabase, Patient } from '../../lib/supabase'
import CleanTextInput from '~/components/input/cleanTextInput'
import { showToast } from '~/utils/toast'
import { getCurrentLocation } from '../../utils/location'
import UnitDropdown from '~/components/UnitDropdown'

/** converters (canonical: kg, cm, mmHg, °C, mg/dL) */
const LB_PER_KG = 2.2046226218
const KG_PER_ST = 6.35029318
const MMHG_PER_KPA = 7.50061683
const MGDL_PER_MMOLL = 18

const toKg = (v:number,u:'kg'|'lb'|'st')=>u==='kg'?v:u==='lb'?v/LB_PER_KG:v*KG_PER_ST
const fromKg=(kg:number,u:'kg'|'lb'|'st')=>u==='kg'?kg:u==='lb'?kg*LB_PER_KG:kg/KG_PER_ST
const toCm=(v:number,u:'cm'|'in'|'ft')=>u==='cm'?v:u==='in'?v*2.54:v*30.48
const fromCm=(cm:number,u:'cm'|'in'|'ft')=>u==='cm'?cm:u==='in'?cm/2.54:cm/30.48
const toMmHg=(v:number,u:'mmHg'|'kPa')=>u==='mmHg'?v:v*MMHG_PER_KPA
const fromMmHg=(mmHg:number,u:'mmHg'|'kPa')=>u==='mmHg'?mmHg:mmHg/MMHG_PER_KPA
const toC=(v:number,u:'C'|'F')=>u==='C'?v:(v-32)*(5/9)
const fromC=(c:number,u:'C'|'F')=>u==='C'?c:c*(9/5)+32
const toMgdl=(v:number,u:'mg_dL'|'mmol_L')=>u==='mg_dL'?v:v*MGDL_PER_MMOLL
const fromMgdl=(mgdl:number,u:'mg_dL'|'mmol_L')=>u==='mg_dL'?mgdl:mgdl/MGDL_PER_MMOLL
const fmt=(n:number,d=2)=>Number.isNaN(n)?'':n.toFixed(d).replace(/\.?0+$/,'')


/** reverse geocode label if needed */
async function reverseGeocodeName(lat:number, lon:number): Promise<string|null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`
    const res = await fetch(url, { headers: { 'User-Agent': 'Hearta/1.0 (+app)' } })
    const json = await res.json()
    return json?.name || json?.display_name || null
  } catch { return null }
}

const VisitFormScreen: React.FC = () => {
  const { userProfile } = useAuth()
  const router = useRouter()

  // ✅ read params via Expo Router
  const { patient: patientParam } = useLocalSearchParams<{ patient?: string }>()
  const patient: Patient | undefined = (() => {
    if (!patientParam) return undefined
    if (Array.isArray(patientParam)) return undefined
    try { return JSON.parse(patientParam) as Patient } catch { return undefined }
  })()

  const [loading, setLoading] = useState(false)

  // values
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
  const [observations, setObservations] = useState('')

  // units
  const [weightU, setWeightU] = useState<'kg'|'lb'|'st'>('kg')
  const [heightU, setHeightU] = useState<'cm'|'in'|'ft'>('cm')
  const [bpU, setBpU] = useState<'mmHg'|'kPa'>('mmHg')
  const [tempU, setTempU] = useState<'C'|'F'>('C')
  const [sugarU, setSugarU] = useState<'mg_dL'|'mmol_L'>('mg_dL')

  // placeholders
  const weightPh = weightU==='kg'?'75.5':weightU==='lb'?fmt(fromKg(75.5,'lb')):fmt(fromKg(75.5,'st'))
  const heightPh = heightU==='cm'?'170':heightU==='in'?fmt(fromCm(170,'in'),0):fmt(fromCm(170,'ft'))
  const tempPh = tempU==='C'?'36.5':fmt(fromC(36.5,'F'))
  const sugarPh = sugarU==='mg_dL'?'90':fmt(fromMgdl(90,'mmol_L'))

  // chip swaps (convert current visible value)
  const swapWeightUnit = (u:'kg'|'lb'|'st') => {
    if (u===weightU) return
    const n = parseFloat(weight)
    if (!isNaN(n)) setWeight(fmt(fromKg(toKg(n,weightU),u)))
    setWeightU(u)
  }
  const swapHeightUnit = (u:'cm'|'in'|'ft') => {
    if (u===heightU) return
    const n = parseFloat(height)
    if (!isNaN(n)) setHeight(fmt(fromCm(toCm(n,heightU),u)))
    setHeightU(u)
  }
  const swapBpUnit = (u:'mmHg'|'kPa') => {
    if (u===bpU) return
    const s = parseFloat(systolicBp)
    const d = parseFloat(diastolicBp)
    if (!isNaN(s)) setSystolicBp(fmt(fromMmHg(toMmHg(s,bpU),u)))
    if (!isNaN(d)) setDiastolicBp(fmt(fromMmHg(toMmHg(d,bpU),u)))
    setBpU(u)
  }
  const swapTempUnit = (u:'C'|'F') => {
    if (u===tempU) return
    const t = parseFloat(temperature)
    if (!isNaN(t)) setTemperature(fmt(fromC(toC(t,tempU),u)))
    setTempU(u)
  }
  const swapSugarUnit = (u:'mg_dL'|'mmol_L') => {
    if (u===sugarU) return
    const b = parseFloat(bloodSugar)
    if (!isNaN(b)) setBloodSugar(fmt(fromMgdl(toMgdl(b,sugarU),u)))
    setSugarU(u)
  }

  const validateForm = () => {
    const hasVitals =
      weight || height || systolicBp || diastolicBp || heartRate || temperature || bloodSugar || oxygenSaturation || respiratoryRate
    const hasSymptoms = symptoms.trim()
    if (!hasVitals && !hasSymptoms) {
      showToast.error('Validation Error','Please enter at least one vital sign or symptom')
      return false
    }
    return true
  }

  const handleSaveEntry = async () => {
    if (!validateForm()) return
    setLoading(true)
    try {
      const loc = await getCurrentLocation()
      let locName: string | null = loc?.name ?? null
      if (!locName && loc?.lat && loc?.lon) {
        locName = await reverseGeocodeName(loc.lat, loc.lon)
      }

      const visitData = {
        patient_id: (patient as any)?.id,
        doctor_id: (userProfile as any)?.id,
        visit_date: new Date().toISOString(),
        visit_type: 'in_person',
        weight: weight ? toKg(parseFloat(weight), weightU) : null,
        height: height ? toCm(parseFloat(height), heightU) : null,
        systolic_bp: systolicBp ? Math.round(toMmHg(parseFloat(systolicBp), bpU)) : null,
        diastolic_bp: diastolicBp ? Math.round(toMmHg(parseFloat(diastolicBp), bpU)) : null,
        heart_rate: heartRate ? parseInt(heartRate) : null,
        temperature: temperature ? parseFloat(fmt(toC(parseFloat(temperature), tempU))) : null,
        blood_sugar: bloodSugar ? parseFloat(fmt(toMgdl(parseFloat(bloodSugar), sugarU))) : null,
        oxygen_saturation: oxygenSaturation ? parseInt(oxygenSaturation) : null,
        respiratory_rate: respiratoryRate ? parseInt(respiratoryRate) : null,
        symptoms: symptoms.trim() || null,
        treatment_notes: observations.trim() || null,
        location: loc ? { lat: loc.lat, lon: loc.lon, accuracy: loc.accuracy ?? null, name: locName ?? null } : null,
      }

      const { data, error } = await supabase.from('visits').insert(visitData).select().single()
      if (error) {
        showToast.error('Error','Failed to save vitals entry')
        console.error(error)
      } else {
        return data
      }
    } catch (e) {
      showToast.error('Error','An unexpected error occurred')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleStartAIDiagnosis = async () => {
    const data = await handleSaveEntry()
    if (data) {
      const vitalsParam = encodeURIComponent(JSON.stringify({ visitId: data.id }))
      router.push(`/doctor/ai-chat-room?vitals=${vitalsParam}`)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={20} color="#333333" />
        </TouchableOpacity>
        <Text style={styles.title}>Add Vitals Entry</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vital Signs</Text>
          <Text style={styles.sectionSubtitle}>Enter any measurements you have</Text>

          {/* Weight */}
          <View style={styles.row}>
            <View style={styles.inputGrow}>
              <CleanTextInput label="Weight" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder={weightPh} />
            </View>
            <UnitDropdown options={[{label:'kg',value:'kg'},{label:'lb',value:'lb'},{label:'st',value:'st'}]} value={weightU} onChange={swapWeightUnit} />
          </View>

          {/* Height */}
          <View style={styles.row}>
            <View style={styles.inputGrow}>
              <CleanTextInput label="Height" value={height} onChangeText={setHeight} keyboardType="decimal-pad" placeholder={heightPh} />
            </View>
            <UnitDropdown options={[{label:'cm',value:'cm'},{label:'in',value:'in'},{label:'ft',value:'ft'}]} value={heightU} onChange={swapHeightUnit} />
          </View>

          {/* Systolic */}
          <View style={styles.row}>
            <View style={styles.inputGrow}>
              <CleanTextInput
                label="Systolic BP"
                value={systolicBp}
                onChangeText={setSystolicBp}
                keyboardType="numeric"
                placeholder={bpU==='mmHg'?'120':fmt(120/MMHG_PER_KPA)}
              />
            </View>
            <UnitDropdown options={[{label:'mmHg',value:'mmHg'},{label:'kPa',value:'kPa'}]} value={bpU} onChange={swapBpUnit} />
          </View>

          {/* Diastolic */}
          <View style={styles.row}>
            <View style={styles.inputGrow}>
              <CleanTextInput
                label="Diastolic BP"
                value={diastolicBp}
                onChangeText={setDiastolicBp}
                keyboardType="numeric"
                placeholder={bpU==='mmHg'?'80':fmt(80/MMHG_PER_KPA)}
              />
            </View>
            <UnitDropdown options={[{label:'mmHg',value:'mmHg'},{label:'kPa',value:'kPa'}]} value={bpU} onChange={swapBpUnit} />
          </View>

          {/* Heart Rate */}
          <View style={styles.row}>
            <View style={styles.inputGrow}>
              <CleanTextInput label="Heart Rate (bpm)" value={heartRate} onChangeText={setHeartRate} keyboardType="numeric" placeholder="72" />
            </View>
          </View>

          {/* Temperature */}
          <View style={styles.row}>
            <View style={styles.inputGrow}>
              <CleanTextInput label="Temperature" value={temperature} onChangeText={setTemperature} keyboardType="decimal-pad" placeholder={tempPh} />
            </View>
            <UnitDropdown options={[{label:'°C',value:'C'},{label:'°F',value:'F'}]} value={tempU} onChange={swapTempUnit} />
          </View>

          {/* Blood Sugar */}
          <View style={styles.row}>
            <View style={styles.inputGrow}>
              <CleanTextInput label="Blood Sugar" value={bloodSugar} onChangeText={setBloodSugar} keyboardType="decimal-pad" placeholder={sugarPh} />
            </View>
            <UnitDropdown options={[{label:'mg/dL',value:'mg_dL'},{label:'mmol/L',value:'mmol_L'}]} value={sugarU} onChange={swapSugarUnit} />
          </View>

          {/* Oxygen Saturation */}
          <View style={styles.row}>
            <View style={styles.inputGrow}>
              <CleanTextInput label="Oxygen Saturation (%)" value={oxygenSaturation} onChangeText={setOxygenSaturation} keyboardType="numeric" placeholder="98" />
            </View>
          </View>

          {/* Respiratory Rate */}
          <View style={styles.row}>
            <View style={styles.inputGrow}>
              <CleanTextInput label="Respiratory Rate (breaths/min)" value={respiratoryRate} onChangeText={setRespiratoryRate} keyboardType="numeric" placeholder="16" />
            </View>
          </View>
        </View>

        {/* Symptoms */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Symptoms</Text>
          <Text style={styles.sectionSubtitle}>Describe how the patient is feeling today</Text>
          <CleanTextInput label="Current Symptoms" value={symptoms} onChangeText={setSymptoms} placeholder="Describe any symptoms..." multiline numberOfLines={3} />
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes & Observations</Text>
          <Text style={styles.sectionSubtitle}>Any additional notes</Text>
          <CleanTextInput label="Additional Notes" value={observations} onChangeText={setObservations} placeholder="Other observations, medications, activities, etc..." multiline numberOfLines={4} />
        </View>

        <View style={styles.actionButtons}>
          <Button mode="contained" onPress={handleSaveEntry} loading={loading} disabled={loading} style={styles.primaryBtn} buttonColor="#4285F4">
            {loading ? 'Saving...' : 'Save Entry'}
          </Button>
          <Button mode="outlined" onPress={handleStartAIDiagnosis} disabled={loading} style={styles.secondaryBtn} textColor="#4285F4">
            Start AI Diagnosis
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
    marginBottom: 32
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4
  },
  sectionSubtitle: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 16
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  inputGrow: {
    flex: 1
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 12
  },
  primaryBtn: {
    flex: 1,
    borderRadius: 10
  },
  secondaryBtn: {
    flex: 1,
    borderRadius: 10,
    borderColor: '#4285F4'
  },
})

export default VisitFormScreen
