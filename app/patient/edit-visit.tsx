import React, { useEffect, useState } from 'react'
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import { Text, Button } from 'react-native-paper'
import { MaterialIcons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { supabase, Visit } from '../../lib/supabase'
import CleanTextInput from '~/components/input/cleanTextInput'
import { showToast } from '~/utils/toast'
import UnitDropdown from '~/components/UnitDropdown'

/** ----------------- Unit helpers (local, no storage) ----------------- */
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

const parseNum = (v: string) => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null }
const formatNum = (v: number | null, d = 1) => (v == null || !Number.isFinite(v)) ? '' : String(Number(v.toFixed(d)))

function convertWeight(x: number, from: WeightUnit, to: WeightUnit) { if (!Number.isFinite(x) || from === to) return x; let kg = x; if (from === 'lb') kg = x * KG_PER_LB; else if (from === 'st') kg = x * KG_PER_ST; if (to === 'kg') return kg; if (to === 'lb') return kg / KG_PER_LB; if (to === 'st') return kg / KG_PER_ST; return kg }
function convertHeight(x: number, from: HeightUnit, to: HeightUnit) { if (!Number.isFinite(x) || from === to) return x; let cm = x; if (from === 'in') cm = x * CM_PER_IN; else if (from === 'ft') cm = x * CM_PER_FT; if (to === 'cm') return cm; if (to === 'in') return cm / CM_PER_IN; if (to === 'ft') return cm / CM_PER_FT; return cm }
function convertTemp(x: number, from: TempUnit, to: TempUnit) { if (!Number.isFinite(x) || from === to) return x; if (from === 'C' && to === 'F') return x * 9 / 5 + 32; if (from === 'F' && to === 'C') return (x - 32) * 5 / 9; return x }
function convertBP(x: number, from: BPUnit, to: BPUnit) { if (!Number.isFinite(x) || from === to) return x; if (from === 'mmHg' && to === 'kPa') return x * KPA_PER_MMHG; if (from === 'kPa' && to === 'mmHg') return x / KPA_PER_MMHG; return x }
function convertSugar(x: number, from: SugarUnit, to: SugarUnit) { if (!Number.isFinite(x) || from === to) return x; if (from === 'mg_dL' && to === 'mmol_L') return x * MMOL_PER_MGDL; if (from === 'mmol_L' && to === 'mg_dL') return x / MMOL_PER_MGDL; return x }


const EditVisitScreen: React.FC = () => {
  const router = useRouter()
  const params = useLocalSearchParams<{ visit?: string }>() // patient passes serialized visit

  // local unit selection only
  const [wUnit, setWUnit] = useState<WeightUnit>('kg')
  const [hUnit, setHUnit] = useState<HeightUnit>('cm')
  const [tUnit, setTUnit] = useState<TempUnit>('C')
  const [bpUnit, setBpUnit] = useState<BPUnit>('mmHg')
  const [sUnit, setSUnit] = useState<SugarUnit>('mg_dL')

  const [visit, setVisit] = useState<Visit | null>(null)
  const [loading, setLoading] = useState(false)

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
  const [prescribedMedications, setPrescribedMedications] = useState('')
  const [followUpInstructions, setFollowUpInstructions] = useState('')

  useEffect(() => {
    let mounted = true
    ;(async () => {
      if (!params.visit) return
      try {
        const v: Visit = JSON.parse(decodeURIComponent(params.visit))
        if (!mounted) return
        setVisit(v)

        setWeight(v.weight != null ? formatNum(convertWeight(v.weight, 'kg', wUnit), 1) : '')
        setHeight(v.height != null ? formatNum(convertHeight(v.height, 'cm', hUnit), 2) : '')
        setSystolicBp(v.systolic_bp != null ? formatNum(convertBP(v.systolic_bp, 'mmHg', bpUnit), 1) : '')
        setDiastolicBp(v.diastolic_bp != null ? formatNum(convertBP(v.diastolic_bp, 'mmHg', bpUnit), 1) : '')
        setHeartRate(v.heart_rate != null ? String(v.heart_rate) : '')
        setTemperature(v.temperature != null ? formatNum(convertTemp(v.temperature, 'C', tUnit), 1) : '')
        setBloodSugar(v.blood_sugar != null ? formatNum(convertSugar(v.blood_sugar, 'mg_dL', sUnit), 1) : '')
        setOxygenSaturation(v.oxygen_saturation != null ? String(v.oxygen_saturation) : '')
        setRespiratoryRate(v.respiratory_rate != null ? String(v.respiratory_rate) : '')
        setSymptoms(v.symptoms || '')
        setDiagnosis(v.diagnosis || '')
        setTreatmentNotes(v.treatment_notes || '')
        setPrescribedMedications(v.prescribed_medications || '')
        setFollowUpInstructions(v.follow_up_instructions || '')
      } catch (e) {
        console.error('Invalid visit param', e)
        showToast.error('Error', 'Invalid visit data')
        router.back()
      }
    })()
    return () => { mounted = false }
  }, [params.visit])

  function onChangeUnit(kind: 'weight'|'height'|'temperature'|'bloodPressure'|'bloodSugar', next: any) {
    if (kind === 'weight') { const cur = parseNum(weight); if (cur != null) setWeight(formatNum(convertWeight(cur, wUnit, next), 1)); setWUnit(next) }
    if (kind === 'height') { const cur = parseNum(height); if (cur != null) setHeight(formatNum(convertHeight(cur, hUnit, next), 2)); setHUnit(next) }
    if (kind === 'temperature') { const cur = parseNum(temperature); if (cur != null) setTemperature(formatNum(convertTemp(cur, tUnit, next), 1)); setTUnit(next) }
    if (kind === 'bloodPressure') { const s = parseNum(systolicBp); const d = parseNum(diastolicBp); if (s != null) setSystolicBp(formatNum(convertBP(s, bpUnit, next), 1)); if (d != null) setDiastolicBp(formatNum(convertBP(d, bpUnit, next), 1)); setBpUnit(next) }
    if (kind === 'bloodSugar') { const cur = parseNum(bloodSugar); if (cur != null) setBloodSugar(formatNum(convertSugar(cur, sUnit, next), 1)); setSUnit(next) }
  }

  function toCanonical() {
    const w = parseNum(weight)
    const h = parseNum(height)
    const t = parseNum(temperature)
    const sBP = parseNum(systolicBp)
    const dBP = parseNum(diastolicBp)
    const hr = parseNum(heartRate)
    const bs = parseNum(bloodSugar)
    const spo2 = parseNum(oxygenSaturation)
    const rr = parseNum(respiratoryRate)

    return {
      weight: w != null ? convertWeight(w, wUnit, 'kg') : null,
      height: h != null ? convertHeight(h, hUnit, 'cm') : null,
      systolic_bp: sBP != null ? Math.round(convertBP(sBP, bpUnit, 'mmHg')) : null,
      diastolic_bp: dBP != null ? Math.round(convertBP(dBP, bpUnit, 'mmHg')) : null,
      heart_rate: hr != null ? Math.round(hr) : null,
      temperature: t != null ? convertTemp(t, tUnit, 'C') : null,
      blood_sugar: bs != null ? convertSugar(bs, sUnit, 'mg_dL') : null,
      oxygen_saturation: spo2 != null ? Math.round(spo2) : null,
      respiratory_rate: rr != null ? Math.round(rr) : null,

      symptoms: symptoms.trim() || null,
      diagnosis: diagnosis.trim() || null,
      treatment_notes: treatmentNotes.trim() || null,
      prescribed_medications: prescribedMedications.trim() || null,
      follow_up_instructions: followUpInstructions.trim() || null,
      updated_at: new Date().toISOString(),
    }
  }

  async function handleSave() {
    if (!visit) { showToast.error('Not ready', 'Visit not loaded yet'); return }
    if (visit.doctor_id) { showToast.error('Not allowed', 'Doctor-authored visits can’t be edited here'); return }

    setLoading(true)
    try {
      const payload = toCanonical()
      const { data, error } = await supabase
        .from('visits')
        .update(payload)
        .eq('id', visit.id)
        .select('id')
        .limit(1)

      if (error) {
        showToast.error('Error', 'Failed to update visit')
        console.error('patient edit update error', error)
        return
      }
      if (!data || data.length === 0) {
        showToast.error('Not saved', 'No rows were updated')
        return
      }
      showToast.success('Success', 'Visit updated')
      router.back()
    } finally {
      setLoading(false)
    }
  }

  const weightPh = wUnit === 'kg' ? '75.5' : wUnit === 'lb' ? '166.4' : '11.9'
  const heightPh = hUnit === 'cm' ? '170' : hUnit === 'in' ? '67' : '5.58'
  const tempPh = tUnit === 'C' ? '36.5' : '97.7'
  const sysPh = bpUnit === 'mmHg' ? '120' : '16.0'
  const diaPh = bpUnit === 'mmHg' ? '80' : '10.7'
  const sugarPh = sUnit === 'mg_dL' ? '90' : '5.0'

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: '#FFFFFF'
      }}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              padding: 4
            }}
          >
            <MaterialIcons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Visit</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vital Signs</Text>

          <View style={styles.fieldRow}>
            <Text style={styles.rowLabel}>Weight</Text>
            <View style={styles.inputAndToggle}>
              <View style={styles.inputFlex}>
                <CleanTextInput label="" value={weight} onChangeText={setWeight} placeholder={weightPh} />
              </View>
              <UnitDropdown
                options={[{label:'kg',value:'kg'},{label:'lb',value:'lb'},{label:'st',value:'st'}]}
                value={wUnit}
                onChange={(v)=>onChangeUnit('weight', v as WeightUnit)}
              />
            </View>
          </View>

          <View style={styles.fieldRow}>
            <Text style={styles.rowLabel}>Height</Text>
            <View style={styles.inputAndToggle}>
              <View style={styles.inputFlex}>
                <CleanTextInput label="" value={height} onChangeText={setHeight} placeholder={heightPh} />
              </View>
              <UnitDropdown
                options={[{label:'cm',value:'cm'},{label:'in',value:'in'},{label:'ft',value:'ft'}]}
                value={hUnit}
                onChange={(v)=>onChangeUnit('height', v as HeightUnit)}
              />
            </View>
          </View>

          <View style={styles.fieldRow}>
            <Text style={styles.rowLabel}>Systolic BP</Text>
            <View style={styles.inputAndToggle}>
              <View style={styles.inputFlex}>
                <CleanTextInput label="" value={systolicBp} onChangeText={setSystolicBp} placeholder={sysPh} keyboardType="numeric" />
              </View>
              <UnitDropdown
                options={[{label:'mmHg',value:'mmHg'},{label:'kPa',value:'kPa'}]}
                value={bpUnit}
                onChange={(v)=>onChangeUnit('bloodPressure', v as BPUnit)}
              />
            </View>
          </View>

          <View style={styles.fieldRow}>
            <Text style={styles.rowLabel}>Diastolic BP</Text>
            <View style={styles.inputAndToggle}>
              <View style={styles.inputFlex}>
                <CleanTextInput label="" value={diastolicBp} onChangeText={setDiastolicBp} placeholder={diaPh} keyboardType="numeric" />
              </View>
              <UnitDropdown
                options={[{label:'mmHg',value:'mmHg'},{label:'kPa',value:'kPa'}]}
                value={bpUnit}
                onChange={(v)=>onChangeUnit('bloodPressure', v as BPUnit)}
              />
            </View>
          </View>

          <View style={styles.fieldRow}>
            <Text style={styles.rowLabel}>Heart Rate (bpm)</Text>
            <CleanTextInput label="" value={heartRate} onChangeText={setHeartRate} placeholder="72" keyboardType="numeric" />
          </View>

          <View style={styles.fieldRow}>
            <Text style={styles.rowLabel}>Temperature</Text>
            <View style={styles.inputAndToggle}>
              <View style={styles.inputFlex}>
                <CleanTextInput label="" value={temperature} onChangeText={setTemperature} placeholder={tempPh} />
              </View>
              <UnitDropdown
                options={[{label:'°C',value:'C'},{label:'°F',value:'F'}]}
                value={tUnit}
                onChange={(v)=>onChangeUnit('temperature', v as TempUnit)}
              />
            </View>
          </View>

          <View style={styles.fieldRow}>
            <Text style={styles.rowLabel}>Blood Sugar</Text>
            <View style={styles.inputAndToggle}>
              <View style={styles.inputFlex}>
                <CleanTextInput label="" value={bloodSugar} onChangeText={setBloodSugar} placeholder={sugarPh} />
              </View>
              <UnitDropdown
                options={[{label:'mg/dL',value:'mg_dL'},{label:'mmol/L',value:'mmol_L'}]}
                value={sUnit}
                onChange={(v)=>onChangeUnit('bloodSugar', v as SugarUnit)}
              />
            </View>
          </View>

          <View style={styles.fieldRow}>
            <Text style={styles.rowLabel}>Oxygen Saturation (%)</Text>
            <CleanTextInput label="" value={oxygenSaturation} onChangeText={setOxygenSaturation} placeholder="98" keyboardType="numeric" />
          </View>

          <View style={styles.fieldRow}>
            <Text style={styles.rowLabel}>Respiratory Rate (breaths/min)</Text>
            <CleanTextInput label="" value={respiratoryRate} onChangeText={setRespiratoryRate} placeholder="16" keyboardType="numeric" />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Clinical Notes</Text>
          <CleanTextInput label="Current Symptoms" value={symptoms} onChangeText={setSymptoms} multiline numberOfLines={3} />
          <CleanTextInput label="Diagnosis" value={diagnosis} onChangeText={setDiagnosis} multiline numberOfLines={2} />
          <CleanTextInput label="Treatment Notes" value={treatmentNotes} onChangeText={setTreatmentNotes} multiline numberOfLines={3} />
          <CleanTextInput label="Prescribed Medications" value={prescribedMedications} onChangeText={setPrescribedMedications} multiline numberOfLines={2} />
          <CleanTextInput label="Follow-up Instructions" value={followUpInstructions} onChangeText={setFollowUpInstructions} multiline numberOfLines={2} />
        </View>

        <View style={styles.actionButtons}>
          <Button
            mode="contained"
            onPress={handleSave}
            loading={loading}
            disabled={loading}
            style={styles.saveButton}
            contentStyle={styles.buttonContent}
            buttonColor="#4285F4"
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
          <Button mode="outlined" onPress={() => router.back()} disabled={loading} style={styles.cancelButton} textColor="#666">
            Cancel
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 16
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600'
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    gap: 12
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600'
  },
  fieldRow: {
    gap: 8
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: '600'
  },
  inputAndToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  inputFlex: {
    flex: 1
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12
  },
  saveButton: {
    borderRadius: 12,
    flex: 1
  },
  buttonContent: {
    paddingVertical: 12
  },
  cancelButton: {
    borderRadius: 12,
    borderColor: '#E8E8E8',
    flex: 1
  },
})

export default EditVisitScreen
