import React, { useState } from 'react'
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity, Pressable } from 'react-native'
import { Text, Button } from 'react-native-paper'
import { MaterialIcons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useAuth } from '../../contexts/AuthContext'
import { supabase, Patient, FieldDoctor } from '../../lib/supabase'
import CleanTextInput from '~/components/input/cleanTextInput'

//inline helpers 
const toKg = (val: number, u: 'kg'|'lb') => u === 'lb' ? val * 0.45359237 : val
const toCm = (val: number, u: 'cm'|'in') => u === 'in' ? val * 2.54 : val
const toC  = (val: number, u: 'C' |'F')  => u === 'F' ? (val - 32) * (5/9) : val

const VisitFormScreen: React.FC = () => {
  const { userProfile } = useAuth()
  const router = useRouter()
  const params = useLocalSearchParams()
  const [loading, setLoading] = useState(false)

  // In your real file you likely pass patient via params; keep that if present
  let selectedPatient: Patient | null = null
  try {
    if (params?.patient) selectedPatient = JSON.parse(String(params.patient))
  } catch (e) {}

  const doctor = userProfile as FieldDoctor
  const patient = (selectedPatient as Patient) || (userProfile as any as Patient) // fallback to your current behavior

  // Vital signs
  const [weight, setWeight] = useState('')
  const [height, setHeight] = useState('')
  const [systolicBp, setSystolicBp] = useState('')
  const [diastolicBp, setDiastolicBp] = useState('')
  const [heartRate, setHeartRate] = useState('')
  const [temperature, setTemperature] = useState('')
  const [bloodSugar, setBloodSugar] = useState('')
  const [oxygenSaturation, setOxygenSaturation] = useState('')
  const [respiratoryRate, setRespiratoryRate] = useState('')

  // unit toggles
  const [weightUnit, setWeightUnit] = useState<'kg'|'lb'>('kg')
  const [heightUnit, setHeightUnit] = useState<'cm'|'in'>('cm')
  const [tempUnit,   setTempUnit]   = useState<'C'|'F'>('C')

  // Symptoms and observations
  const [symptoms, setSymptoms] = useState('')
  const [observations, setObservations] = useState('')

  const validateForm = () => {
    const hasVitals = weight || height || systolicBp || diastolicBp || heartRate || 
                     temperature || bloodSugar || oxygenSaturation || respiratoryRate
    const hasSymptoms = symptoms.trim()
    
    if (!hasVitals && !hasSymptoms) {
      Alert.alert('Validation Error', 'Please enter at least one vital sign or symptom')
      return false
    }
    if (weight && (parseFloat(weight) < 1 || parseFloat(weight) > 500)) {
      Alert.alert('Validation Error', 'Please enter a valid weight (1-500 kg)')
      return false
    }
    if (height && (parseFloat(height) < 30 || parseFloat(height) > 300)) {
      Alert.alert('Validation Error', 'Please enter a valid height (30-300 cm)')
      return false
    }
    if (systolicBp && (parseInt(systolicBp) < 50 || parseInt(systolicBp) > 300)) {
      Alert.alert('Validation Error', 'Please enter a valid systolic blood pressure (50-300 mmHg)')
      return false
    }
    if (diastolicBp && (parseInt(diastolicBp) < 30 || parseInt(diastolicBp) > 200)) {
      Alert.alert('Validation Error', 'Please enter a valid diastolic blood pressure (30-200 mmHg)')
      return false
    }
    if (heartRate && (parseInt(heartRate) < 30 || parseInt(heartRate) > 250)) {
      Alert.alert('Validation Error', 'Please enter a valid heart rate (30-250 bpm)')
      return false
    }
    if (temperature && (parseFloat(temperature) < 30 || parseFloat(temperature) > 45)) {
      Alert.alert('Validation Error', 'Please enter a valid temperature (30-45°C)')
      return false
    }
    if (bloodSugar && (parseFloat(bloodSugar) < 20 || parseFloat(bloodSugar) > 800)) {
      Alert.alert('Validation Error', 'Please enter a valid blood sugar (20-800 mg/dL)')
      return false
    }
    if (oxygenSaturation && (parseInt(oxygenSaturation) < 50 || parseInt(oxygenSaturation) > 100)) {
      Alert.alert('Validation Error', 'Please enter a valid oxygen saturation (50-100%)')
      return false
    }
    if (respiratoryRate && (parseInt(respiratoryRate) < 5 || parseInt(respiratoryRate) > 60)) {
      Alert.alert('Validation Error', 'Please enter a valid respiratory rate (5-60 breaths/min)')
      return false
    }
    return true
  }

  const handleSaveEntry = async () => {
    if (!validateForm()) return
    if (!patient?.id) {
      Alert.alert('Error', 'No patient selected')
      return
    }

    setLoading(true)
    try {
      const w = weight ? parseFloat(weight) : undefined
      const h = height ? parseFloat(height) : undefined
      const t = temperature ? parseFloat(temperature) : undefined

      const visitData = {
        patient_id: patient.id,
        doctor_id: doctor?.id ?? null,
        visit_date: new Date().toISOString().slice(0,10), // YYYY-MM-DD
        visit_type: 'in_person', // or 'field'
        weight: w != null ? toKg(w, weightUnit) : null,
        height: h != null ? toCm(h, heightUnit) : null,
        systolic_bp: systolicBp ? parseInt(systolicBp) : null,
        diastolic_bp: diastolicBp ? parseInt(diastolicBp) : null,
        heart_rate: heartRate ? parseInt(heartRate) : null,
        temperature: t != null ? toC(t, tempUnit) : null,
        blood_sugar: bloodSugar ? parseFloat(bloodSugar) : null,
        oxygen_saturation: oxygenSaturation ? parseInt(oxygenSaturation) : null,
        respiratory_rate: respiratoryRate ? parseInt(respiratoryRate) : null,
        symptoms: symptoms.trim() || null,
        treatment_notes: observations.trim() || null,
      }

      const { error } = await supabase.from('visits').insert(visitData)

      if (error) {
        Alert.alert('Error', 'Failed to save vitals entry')
        console.error('Error saving vitals:', error)
      } else {
        Alert.alert('Success', 'Visit saved successfully', [{ text: 'OK', onPress: () => router.back() }])
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred')
      console.error('Error saving vitals:', error)
    } finally {
      setLoading(false)
    }
  }

  const Toggle = ({
    value, options, onChange,
  }: { value: string; options: string[]; onChange: (v: any)=>void }) => (
    <View style={styles.toggleRow}>
      {options.map(opt => (
        <Pressable
          key={opt}
          onPress={() => onChange(opt)}
          style={[styles.toggle, value === opt && styles.toggleActive]}
        >
          <Text style={[styles.toggleText, value === opt && styles.toggleTextActive]}>{opt}</Text>
        </Pressable>
      ))}
    </View>
  )

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color="#333333" />
        </TouchableOpacity>
        <Text style={styles.title}>Add Vitals Entry</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Vital Signs Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vital Signs</Text>
          <Text style={styles.sectionSubtitle}>Enter any measurements you have</Text>

          <View style={styles.rowHeader}>
            <Text style={styles.subLabel}>Weight ({weightUnit})</Text>
            <Toggle value={weightUnit} options={['kg','lb']} onChange={setWeightUnit} />
          </View>
          <View style={styles.inputRow}>
            <CleanTextInput
              label=""
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
              placeholder="75.5"
              style={styles.halfInput}
            />
            <View style={styles.halfInput} />
          </View>

          <View style={styles.rowHeader}>
            <Text style={styles.subLabel}>Height ({heightUnit})</Text>
            <Toggle value={heightUnit} options={['cm','in']} onChange={setHeightUnit} />
          </View>
          <View style={styles.inputRow}>
            <CleanTextInput
              label=""
              value={height}
              onChangeText={setHeight}
              keyboardType="decimal-pad"
              placeholder="170"
              style={styles.halfInput}
            />
            <View style={styles.halfInput} />
          </View>

          <View style={styles.inputRow}>
            <CleanTextInput
              label="Systolic BP (mmHg)"
              value={systolicBp}
              onChangeText={setSystolicBp}
              keyboardType="numeric"
              placeholder="120"
              style={styles.halfInput}
            />
            <CleanTextInput
              label="Diastolic BP (mmHg)"
              value={diastolicBp}
              onChangeText={setDiastolicBp}
              keyboardType="numeric"
              placeholder="80"
              style={styles.halfInput}
            />
          </View>

          <View style={styles.inputRow}>
            <CleanTextInput
              label="Heart Rate (bpm)"
              value={heartRate}
              onChangeText={setHeartRate}
              keyboardType="numeric"
              placeholder="72"
              style={styles.halfInput}
            />
            <View style={{ flex: 1 }}>
              <View style={styles.rowHeader}>
                <Text style={styles.subLabel}>Temperature ({tempUnit})</Text>
                <Toggle value={tempUnit} options={['C','F']} onChange={setTempUnit} />
              </View>
              <CleanTextInput
                label=""
                value={temperature}
                onChangeText={setTemperature}
                keyboardType="decimal-pad"
                placeholder="36.5"
              />
            </View>
          </View>

          <View style={styles.inputRow}>
            <CleanTextInput
              label="Blood Sugar (mg/dL)"
              value={bloodSugar}
              onChangeText={setBloodSugar}
              keyboardType="decimal-pad"
              placeholder="90"
              style={styles.halfInput}
            />
            <CleanTextInput
              label="Oxygen Saturation (%)"
              value={oxygenSaturation}
              onChangeText={setOxygenSaturation}
              keyboardType="numeric"
              placeholder="98"
              style={styles.halfInput}
            />
          </View>

          <CleanTextInput
            label="Respiratory Rate (breaths/min)"
            value={respiratoryRate}
            onChangeText={setRespiratoryRate}
            keyboardType="numeric"
            placeholder="16"
          />
        </View>

        {/* Symptoms Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Symptoms</Text>
          <Text style={styles.sectionSubtitle}>Any patient complaints or findings</Text>
          <CleanTextInput
            label="Current Symptoms"
            value={symptoms}
            onChangeText={setSymptoms}
            placeholder="Describe symptoms..."
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Observations Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes & Observations</Text>
          <Text style={styles.sectionSubtitle}>Exam findings, instructions, etc.</Text>
          <CleanTextInput
            label="Additional Notes"
            value={observations}
            onChangeText={setObservations}
            placeholder="Other observations, medications, activities..."
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <Button
            mode="contained"
            onPress={handleSaveEntry}
            loading={loading}
            disabled={loading}
            style={styles.saveButton}
            contentStyle={styles.buttonContent}
            buttonColor="#4285F4"
          >
            {loading ? 'Saving...' : 'Save Visit'}
          </Button>

          <Button
            mode="outlined"
            onPress={() => router.back()}
            disabled={loading}
            style={styles.cancelButton}
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
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: '#E8E8E8',
  },
  backButton: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#F8F9FA',
    alignItems: 'center', justifyContent: 'center', marginRight: 16,
  },
  title: { fontSize: 24, fontWeight: '600', color: '#333333', flex: 1 },
  content: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingVertical: 24, paddingBottom: 40 },
  section: { marginBottom: 32 },
  sectionTitle: { fontSize: 20, fontWeight: '600', color: '#333333', marginBottom: 4 },
  sectionSubtitle: { fontSize: 16, color: '#666666', marginBottom: 20 },
  inputRow: { flexDirection: 'row', gap: 12 },
  halfInput: { flex: 1 },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  subLabel: { fontWeight: '600', color: '#333' },
  toggleRow: { flexDirection: 'row', gap: 8 },
  toggle: { borderWidth: 1, borderColor: '#ddd', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#fff' },
  toggleActive: { backgroundColor: '#E3F2FD', borderColor: '#90CAF9' },
  toggleText: { color: '#333' },
  toggleTextActive: { fontWeight: '700', color: '#1976D2' },
  actionButtons: { marginTop: 24, gap: 12 },
  saveButton: { borderRadius: 12 },
  buttonContent: { paddingVertical: 12 },
  cancelButton: { borderRadius: 12, borderColor: '#E8E8E8' },
})

export default VisitFormScreen
