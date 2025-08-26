import React, { useState } from 'react'
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native'
import { Text, Button } from 'react-native-paper'
import { MaterialIcons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '../../contexts/AuthContext'
import { supabase, Patient } from '../../lib/supabase'
import CleanTextInput from '~/components/input/cleanTextInput'
import { showToast } from '~/utils/toast'
import { getCurrentLocation } from '../../utils/location'

/** Fallback reverse geocode if name isn't provided by getCurrentLocation() */
async function reverseGeocodeName(lat: number, lon: number): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'DRAI/1.0 (+https://example.org)' },
    })
    const json = await res.json()
    // prefer short, human-friendly name
    return json?.name || json?.display_name || null
  } catch {
    return null
  }
}

const AddVitalsScreen: React.FC = () => {
  const { userProfile } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const patient = userProfile as Patient

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

  // Symptoms and observations
  const [symptoms, setSymptoms] = useState('')
  const [observations, setObservations] = useState('')

  const validateForm = () => {
    const hasVitals =
      weight ||
      height ||
      systolicBp ||
      diastolicBp ||
      heartRate ||
      temperature ||
      bloodSugar ||
      oxygenSaturation ||
      respiratoryRate
    const hasSymptoms = symptoms.trim()

    if (!hasVitals && !hasSymptoms) {
      showToast.error(
        'Validation Error',
        'Please enter at least one vital sign or symptom',
      )
      return false
    }

    if (weight && (parseFloat(weight) < 1 || parseFloat(weight) > 500)) {
      showToast.error('Validation Error', 'Please enter a valid weight (1-500 kg)')
      return false
    }
    if (height && (parseFloat(height) < 30 || parseFloat(height) > 300)) {
      showToast.error('Validation Error', 'Please enter a valid height (30-300 cm)')
      return false
    }
    if (systolicBp && (parseInt(systolicBp) < 50 || parseInt(systolicBp) > 300)) {
      showToast.error(
        'Validation Error',
        'Please enter a valid systolic blood pressure (50-300 mmHg)',
      )
      return false
    }
    if (diastolicBp && (parseInt(diastolicBp) < 30 || parseInt(diastolicBp) > 200)) {
      showToast.error(
        'Validation Error',
        'Please enter a valid diastolic blood pressure (30-200 mmHg)',
      )
      return false
    }
    if (heartRate && (parseInt(heartRate) < 30 || parseInt(heartRate) > 250)) {
      showToast.error('Validation Error', 'Please enter a valid heart rate (30-250 bpm)')
      return false
    }
    if (temperature && (parseFloat(temperature) < 30 || parseFloat(temperature) > 45)) {
      showToast.error('Validation Error', 'Please enter a valid temperature (30-45°C)')
      return false
    }
    if (bloodSugar && (parseFloat(bloodSugar) < 20 || parseFloat(bloodSugar) > 800)) {
      showToast.error(
        'Validation Error',
        'Please enter a valid blood sugar (20-800 mg/dL)',
      )
      return false
    }
    if (
      oxygenSaturation &&
      (parseInt(oxygenSaturation) < 50 || parseInt(oxygenSaturation) > 100)
    ) {
      showToast.error(
        'Validation Error',
        'Please enter a valid oxygen saturation (50-100%)',
      )
      return false
    }
    if (
      respiratoryRate &&
      (parseInt(respiratoryRate) < 5 || parseInt(respiratoryRate) > 60)
    ) {
      showToast.error(
        'Validation Error',
        'Please enter a valid respiratory rate (5-60 breaths/min)',
      )
      return false
    }

    return true
  }

  const handleSaveEntry = async () => {
    if (!validateForm()) return

    setLoading(true)
    try {
      // 1) Get device location (lat/lon/accuracy/name?)
      const loc = await getCurrentLocation()

      // 2) If we have coords but no name, reverse-geocode a short label
      let locName: string | null = loc?.name ?? null
      if (!locName && loc?.lat && loc?.lon) {
        locName = await reverseGeocodeName(loc.lat, loc.lon)
      }

      // 3) Prepare data (visit_date uses exact current timestamp)
      const visitData = {
        patient_id: patient?.id,
        doctor_id: null,
        visit_date: new Date().toISOString(),
        visit_type: 'self_recorded',
        weight: weight ? parseFloat(weight) : null,
        height: height ? parseFloat(height) : null,
        systolic_bp: systolicBp ? parseInt(systolicBp) : null,
        diastolic_bp: diastolicBp ? parseInt(diastolicBp) : null,
        heart_rate: heartRate ? parseInt(heartRate) : null,
        temperature: temperature ? parseFloat(temperature) : null,
        blood_sugar: bloodSugar ? parseFloat(bloodSugar) : null,
        oxygen_saturation: oxygenSaturation ? parseInt(oxygenSaturation) : null,
        respiratory_rate: respiratoryRate ? parseInt(respiratoryRate) : null,
        symptoms: symptoms.trim() || null,
        treatment_notes: observations.trim() || null,
        location: loc
          ? {
              lat: loc.lat,
              lon: loc.lon,
              accuracy: loc.accuracy ?? null,
              name: locName ?? null,
            }
          : null,
      }

      const { error } = await supabase.from('visits').insert(visitData)

      if (error) {
        showToast.error('Error', 'Failed to save vitals entry')
        console.error('Error saving vitals:', error)
      } else {
        showToast.error('Success', 'Vitals entry saved successfully')
        router.back()
      }
    } catch (error) {
      showToast.error('Error', 'An unexpected error occurred')
      console.error('Error saving vitals:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color="#333333" />
        </TouchableOpacity>
        <Text style={styles.title}>Add Vitals Entry</Text>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Vital Signs */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vital Signs</Text>
          <Text style={styles.sectionSubtitle}>Enter any measurements you have</Text>

          <View style={styles.inputRow}>
            <CleanTextInput
              label="Weight (kg)"
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
              placeholder="75.5"
              style={styles.halfInput}
            />
            <CleanTextInput
              label="Height (cm)"
              value={height}
              onChangeText={setHeight}
              keyboardType="decimal-pad"
              placeholder="170"
              style={styles.halfInput}
            />
          </View>

          <View style={styles.inputRow}>
            <CleanTextInput
              label="Systolic BP"
              value={systolicBp}
              onChangeText={setSystolicBp}
              keyboardType="numeric"
              placeholder="120"
              style={styles.halfInput}
            />
            <CleanTextInput
              label="Diastolic BP"
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
            <CleanTextInput
              label="Temperature (°C)"
              value={temperature}
              onChangeText={setTemperature}
              keyboardType="decimal-pad"
              placeholder="36.5"
              style={styles.halfInput}
            />
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

        {/* Symptoms */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Symptoms</Text>
          <Text style={styles.sectionSubtitle}>Describe how you're feeling today</Text>
          <CleanTextInput
            label="Current Symptoms"
            value={symptoms}
            onChangeText={setSymptoms}
            placeholder="Describe any symptoms you're experiencing..."
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes & Observations</Text>
          <Text style={styles.sectionSubtitle}>
            Any additional notes about your health
          </Text>
          <CleanTextInput
            label="Additional Notes"
            value={observations}
            onChangeText={setObservations}
            placeholder="Any other observations, medications taken, activities, etc..."
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Actions */}
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
            {loading ? 'Saving...' : 'Save Entry'}
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
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
    fontSize: 24,
    fontWeight: '600',
    color: '#333333',
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 20,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  actionButtons: {
    marginTop: 24,
    gap: 12,
  },
  saveButton: {
    borderRadius: 12,
  },
  buttonContent: {
    paddingVertical: 12,
  },
  cancelButton: {
    borderRadius: 12,
    borderColor: '#E8E8E8',
  },
})

export default AddVitalsScreen
