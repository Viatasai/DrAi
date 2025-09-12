import React from 'react'
import { View, StyleSheet } from 'react-native'
import { Text } from 'react-native-paper'
import { MaterialIcons } from '@expo/vector-icons'


type WeightUnit = 'kg' | 'lb' | 'st'
type HeightUnit = 'cm' | 'in' | 'ft'
type TempUnit = 'C' | 'F'
type BPUnit = 'mmHg' | 'kPa'
type SugarUnit = 'mg_dL' | 'mmol_L'

type DisplayUnits = {
  weight: WeightUnit
  height: HeightUnit
  temperature: TempUnit
  bloodPressure: BPUnit
  bloodSugar: SugarUnit
}

const defaultDisplay: DisplayUnits = {
  weight: 'kg',
  height: 'cm',
  temperature: 'C',
  bloodPressure: 'mmHg',
  bloodSugar: 'mg_dL',
}

/** ---- math helpers (display-only) ---- */
const KG_PER_LB = 0.45359237
const KG_PER_ST = 6.35029318
const CM_PER_IN = 2.54
const CM_PER_FT = 30.48
const KPA_PER_MMHG = 0.133322
const MMOL_PER_MGDL = 1 / 18

const round1 = (n: number) => Math.round(n * 10) / 10

function convWeightFromKg(kg: number, to: WeightUnit) {
  if (!Number.isFinite(kg)) return kg
  if (to === 'kg') return kg
  if (to === 'lb') return kg / KG_PER_LB
  if (to === 'st') return kg / KG_PER_ST
  return kg
}
function convHeightFromCm(cm: number, to: HeightUnit) {
  if (!Number.isFinite(cm)) return cm
  if (to === 'cm') return cm
  if (to === 'in') return cm / CM_PER_IN
  if (to === 'ft') return cm / CM_PER_FT
  return cm
}
function convTempFromC(c: number, to: TempUnit) {
  if (!Number.isFinite(c)) return c
  if (to === 'C') return c
  return c * 9 / 5 + 32
}
function convBPFromMmHg(mmHg: number, to: BPUnit) {
  if (!Number.isFinite(mmHg)) return mmHg
  if (to === 'mmHg') return mmHg
  return mmHg * KPA_PER_MMHG
}
function convSugarFromMgDl(mg: number, to: SugarUnit) {
  if (!Number.isFinite(mg)) return mg
  if (to === 'mg_dL') return mg
  return mg * MMOL_PER_MGDL
}

type VitalChip = { label: string; unit?: string; alert?: boolean }

function buildChips(visit: any, du: DisplayUnits): VitalChip[] {
  const chips: VitalChip[] = []

  // Weight (kg -> selected)
  if (visit?.weight != null) {
    const v = round1(convWeightFromKg(visit.weight, du.weight))
    const unit = du.weight
    chips.push({ label: `${v}`, unit })
  }

  // Height (cm -> selected)
  if (visit?.height != null) {
    const v = round1(convHeightFromCm(visit.height, du.height))
    const unit = du.height
    chips.push({ label: `${v}`, unit })
  }

  // BP (mmHg -> selected)
  if (visit?.systolic_bp != null && visit?.diastolic_bp != null) {
    const s = du.bloodPressure === 'mmHg'
      ? visit.systolic_bp
      : round1(convBPFromMmHg(visit.systolic_bp, du.bloodPressure))
    const d = du.bloodPressure === 'mmHg'
      ? visit.diastolic_bp
      : round1(convBPFromMmHg(visit.diastolic_bp, du.bloodPressure))
    const alert = (visit.systolic_bp > 140) || (visit.diastolic_bp > 90)
    chips.push({ label: `${s}/${d}`, unit: du.bloodPressure, alert })
  }

  // HR (integer)
  if (visit?.heart_rate != null) {
    chips.push({ label: `${visit.heart_rate}`, unit: 'bpm' })
  }

  // Temperature (°C -> selected)
  if (visit?.temperature != null) {
    const v = round1(convTempFromC(visit.temperature, du.temperature))
    const alert = du.temperature === 'C' ? visit.temperature > 37.5 : v > 99.5
    chips.push({ label: `${v}°`, unit: du.temperature, alert })
  }

  // Blood sugar (mg/dL -> selected)
  if (visit?.blood_sugar != null) {
    const v = round1(convSugarFromMgDl(visit.blood_sugar, du.bloodSugar))
    const alert = du.bloodSugar === 'mg_dL' ? visit.blood_sugar > 180 : v > 10
    chips.push({ label: `${v}`, unit: du.bloodSugar, alert })
  }

  // SpO2
  if (visit?.oxygen_saturation != null) {
    chips.push({ label: `${visit.oxygen_saturation}%`, unit: 'O₂' })
  }

  return chips
}

const VitalSignsCard: React.FC<{
  visit: any
  title?: string
  displayUnits?: Partial<DisplayUnits>
}> = ({ visit, title = 'Vitals', displayUnits }) => {
  const du: DisplayUnits = { ...defaultDisplay, ...(displayUnits || {}) }
  const chips = buildChips(visit, du)

  if (!chips.length) return null

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.iconPill}>
          <MaterialIcons name="monitor-heart" size={16} color="#D32F2F" />
        </View>
        <Text style={styles.title}>{title}</Text>
      </View>

      <View style={styles.grid}>
        {chips.map((c, i) => (
          <View key={i} style={[styles.chip, c.alert && styles.alertChip]}>
            <Text style={[styles.value, c.alert && styles.alertText]}>{c.label}</Text>
            {c.unit ? (
              <Text style={[styles.unit, c.alert && styles.alertText]}>{c.unit}</Text>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    padding: 16,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconPill: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    minWidth: 80,
    alignItems: 'center',
  },
  alertChip: {
    backgroundColor: '#FFF5F5',
    borderColor: '#FFB3B3',
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
  unit: {
    fontSize: 12,
    color: '#666666',
    marginTop: 2,
  },
  alertText: {
    color: '#D32F2F',
  },
})

export default VitalSignsCard
