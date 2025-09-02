import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Dimensions, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Text,
  Button,
  Card,
  ActivityIndicator,
  Menu,
  Surface,
  Chip,
  TextInput,
  Modal,
  Portal,
  IconButton,
  Divider,
  ToggleButton,
} from 'react-native-paper';
import Slider from '@react-native-community/slider';
import { MaterialIcons } from '@expo/vector-icons';
import { LineChart, PieChart, BarChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Line, Pie, Cell, Bar } from 'recharts';
import { supabase } from '../../lib/supabase';

const { width: screenWidth } = Dimensions.get('window');

type RangeTab = 'today' | '7d' | '30d' | '90d';

type LocationData = {
  lat: number;
  lon: number;
  name: string;
  accuracy?: number;
};

type VisitRowLite = {
  id: string;
  created_at: string | null;
  visit_type: string | null;
  diagnosis: string | null;
  symptoms: string | null;
  location: LocationData | null;
  patient_id: string | null;
};

type Patient = {
  id: string;
  created_at: string;
  name: string;
  email: string;
};

type TrendDataPoint = {
  date: string;
  visits: number;
  newPatients: number;
  virtualVisits: number;
};

// Modern, cohesive color palette
const COLORS = {
  primary: '#6366F1',
  secondary: '#8B5CF6',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#06B6D4',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceVariant: '#F1F5F9',
  text: '#1E293B',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  border: '#E2E8F0',
  shadow: 'rgba(15, 23, 42, 0.08)',
};

// Chart colors that work well together
const CHART_COLORS = [
  '#6366F1', '#8B5CF6', '#10B981', '#F59E0B',
  '#EF4444', '#06B6D4', '#EC4899', '#84CC16'
];

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
  d.setDate(d.getDate() - (days - 1));
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function extractLocationName(location: LocationData): string {
  if (!location || !location.name) return '';

  const parts = location.name.split(', ');

  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i].trim();
    if (part === 'United States' || /^\d{5}(-\d{4})?$/.test(part)) continue;
    if (/^[A-Z]{2}$/.test(part) || ['New York', 'California', 'Texas', 'Florida'].includes(part)) continue;
    if (part.length > 2 && !part.includes('County')) {
      return part;
    }
  }

  const meaningfulPart = parts.find(p => p.length > 2 && !p.match(/^\d+$/));
  return meaningfulPart || parts[0] || '';
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
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

// Generate real trend data from actual visits
function generateRealTrendData(visits: VisitRowLite[], patients: Patient[], days: number, range: RangeTab): TrendDataPoint[] {
  const data: TrendDataPoint[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - i);
    targetDate.setHours(0, 0, 0, 0);

    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    // Filter visits for this specific day
    const dayVisits = visits.filter(visit => {
      if (!visit.created_at) return false;
      const visitDate = new Date(visit.created_at);
      return visitDate >= targetDate && visitDate < nextDay;
    });

    // Count new patients for this day (patients created on this day)
    const newPatientsCount = patients.filter(patient => {
      const patientDate = new Date(patient.created_at);
      return patientDate >= targetDate && patientDate < nextDay;
    }).length;

    // Count virtual visits
    const virtualVisitsCount = dayVisits.filter(visit =>
      ['chat', 'virtual', 'virtual_consultation'].includes(visit.visit_type || '')
    ).length;

    data.push({
      date: range === 'today' || days <= 7
        ? targetDate.toLocaleDateString('en-US', { weekday: 'short' })
        : targetDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      visits: dayVisits.length,
      newPatients: newPatientsCount,
      virtualVisits: virtualVisitsCount,
    });
  }

  return data;
}

// Geocoding function
async function geocodeAddress(address: string): Promise<{ lat: number; lon: number; name: string } | null> {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`);

    if (!response.ok) {
      console.error('Geocoding API error:', response.status, await response.text());
      return null;
    }

    const data = await response.json();

    if (data && data.length > 0) {
      if (data[0].lat && data[0].lon && data[0].display_name) {
        return {
          lat: parseFloat(data[0].lat),
          lon: parseFloat(data[0].lon),
          name: data[0].display_name
        };
      } else {
        console.warn("Geocoding result missing lat, lon, or display_name:", data[0]);
        return null;
      }
    }
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

/** ---------------- screen ---------------- */
export default function AnalyticsDashboard() {
  const [range, setRange] = useState<RangeTab>('30d');
  const [region, setRegion] = useState<string | null>(null);
  const [filtersVisible, setFiltersVisible] = useState(false);

  // Location-based filtering
  const [searchLocation, setSearchLocation] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lon: number; name: string } | null>(null);
  const [searchRadius, setSearchRadius] = useState(10);
  const [isLocationLoading, setIsLocationLoading] = useState(false);

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Raw data from database
  const [allPatients, setAllPatients] = useState<Patient[]>([]);
  const [allVisitsInRange, setAllVisitsInRange] = useState<VisitRowLite[]>([]);

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
  const [locationData, setLocationData] = useState<{ name: string; value: number; color: string }[]>([]);
  const [regionsFromData, setRegionsFromData] = useState<string[]>(['All regions']);
  const [trendData, setTrendData] = useState<TrendDataPoint[]>([]);

  // date window
  const { fromISO, toISO } = useMemo(() => {
    const days = range === 'today' ? 1 : range === '7d' ? 7 : range === '30d' ? 30 : 90;
    if (range === 'today') return { fromISO: startOfTodayISO(), toISO: nowISO() };
    return { fromISO: subDaysStartOfDayISO(days), toISO: nowISO() };
  }, [range]);

  // Filter visits by location and radius
  const filterVisitsByLocation = useCallback((visits: VisitRowLite[]) => {
    if (!selectedLocation) return visits;

    return visits.filter(visit => {
      if (!visit.location || !visit.location.lat || !visit.location.lon) return false;

      const distance = calculateDistance(
        selectedLocation.lat,
        selectedLocation.lon,
        visit.location.lat,
        visit.location.lon
      );

      return distance <= searchRadius;
    });
  }, [selectedLocation, searchRadius]);

  const load = useCallback(async () => {
    try {
      setLoading(true);

      // 1) Fetch all patients (for total count and new patient analysis)
      const patientsResult = await supabase
        .from('patients')
        .select('id, created_at, name, email')
        .order('created_at', { ascending: false });

      if (patientsResult.error) {
        console.error('Error fetching patients:', patientsResult.error);
      } else {
        setAllPatients(patientsResult.data || []);
        setTotalPatients(patientsResult.data?.length || 0);
      }

      // 2) Fetch total doctors count
      const doctorsResult = await supabase
        .from('field_doctors')
        .select('*', { count: 'exact', head: true });

      if (doctorsResult.error) {
        console.error('Error fetching doctors count:', doctorsResult.error);
      } else {
        setTotalDoctors(doctorsResult.count ?? 0);
      }

      // 3) Get all visits in time range with location data
      const visitsResult = await supabase
        .from('visits')
        .select('id, patient_id, diagnosis, symptoms, location, created_at, visit_type')
        .gte('created_at', fromISO)
        .lte('created_at', toISO)
        .order('created_at', { ascending: false });

      if (visitsResult.error) {
        console.error('Error fetching visits:', visitsResult.error);
        return;
      }

      let allVisits = (visitsResult.data ?? []) as VisitRowLite[];
      setAllVisitsInRange(allVisits);

      // Apply region filter if selected
      if (region && region !== 'All regions') {
        allVisits = allVisits.filter(visit => {
          if (!visit.location) return false;
          const locationName = extractLocationName(visit.location);
          return locationName.toLowerCase().includes(region.toLowerCase());
        });
      }

      // Apply location-based radius filtering
      const filteredVisits = filterVisitsByLocation(allVisits);

      // 4) Calculate metrics from filtered data
      setVisitsInRange(filteredVisits.length);

      // Today's visits from filtered data
      const todayVisits = filteredVisits.filter(visit => {
        if (!visit.created_at) return false;
        const visitDate = new Date(visit.created_at);
        const today = new Date();
        return visitDate.toDateString() === today.toDateString();
      });
      setTodaysVisits(todayVisits.length);

      // Active patients in range (unique patient IDs from filtered visits)
      const uniquePatients = new Set(filteredVisits.map(v => v.patient_id).filter(Boolean));
      setActivePatientsInRange(uniquePatients.size);

      // Calculate new patients in the selected time range
      const patientsInRange = (patientsResult.data || []).filter(patient => {
        const patientDate = new Date(patient.created_at);
        const fromDate = new Date(fromISO);
        const toDate = new Date(toISO);
        return patientDate >= fromDate && patientDate <= toDate;
      });
      setNewPatientsInRange(patientsInRange.length);

      // 5) Visit type breakdown from filtered visits
      const inPersonVisits = filteredVisits.filter(v => v.visit_type === 'in_person').length;
      const selfVisits = filteredVisits.filter(v => v.visit_type === 'self_recorded').length;
      const virtualVisits = filteredVisits.filter(v =>
        ['chat', 'virtual', 'virtual_consultation'].includes(v.visit_type || '')
      ).length;

      setTypeInPerson(inPersonVisits);
      setTypeSelf(selfVisits);
      setTypeVirtual(virtualVisits);

      // 6) Location analysis (use all visits for broader context)
      const locationMap = new Map<string, number>();
      allVisits.forEach(visit => {
        if (!visit.location) return;
        const locationName = extractLocationName(visit.location);
        if (locationName) {
          locationMap.set(locationName, (locationMap.get(locationName) || 0) + 1);
        }
      });

      const locationChartData = Array.from(locationMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, value], index) => ({
          name: name.length > 12 ? name.substring(0, 12) + '...' : name,
          fullName: name,
          value,
          color: CHART_COLORS[index % CHART_COLORS.length]
        }));
      setLocationData(locationChartData);

      // regions list
      setRegionsFromData(['All regions', ...Array.from(locationMap.keys()).sort()]);

      // 7) Generate real trend data using actual visits and patients
      const days = range === 'today' ? 7 : range === '7d' ? 7 : range === '30d' ? 30 : 90;
      const realTrendData = generateRealTrendData(filteredVisits, patientsResult.data || [], days, range);
      setTrendData(realTrendData);

      // 8) Diagnosis and symptoms analysis from filtered visits
      const diag = new Map<string, number>();
      const symp = new Map<string, number>();
      filteredVisits.forEach(visit => {
        tokenize(visit.diagnosis).forEach(token => {
          if (token.length > 2) diag.set(token, (diag.get(token) || 0) + 1);
        });
        tokenize(visit.symptoms).forEach(token => {
          if (token.length > 2) symp.set(token, (symp.get(token) || 0) + 1);
        });
      });
      setTopDiagnoses(topN(diag, 5));
      setTopSymptoms(topN(symp, 6));

    } catch (e) {
      console.error('analytics load error', e);
      Alert.alert('Error', 'Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [fromISO, toISO, region, selectedLocation, searchRadius, range, filterVisitsByLocation]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // Handle location search
  const handleLocationSearch = async () => {
    if (!searchLocation.trim()) return;

    setIsLocationLoading(true);
    try {
      const result = await geocodeAddress(searchLocation);
      if (result) {
        setSelectedLocation(result);
        setTimeout(() => load(), 100);
      } else {
        Alert.alert('Location Not Found', 'Could not find the specified location. Please try a different address.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to search for location. Please try again.');
    } finally {
      setIsLocationLoading(false);
    }
  };

  const clearLocationFilter = () => {
    setSelectedLocation(null);
    setSearchLocation('');
    load();
  };

  const clearAllFilters = () => {
    setSelectedLocation(null);
    setSearchLocation('');
    setRegion(null);
    load();
  };

  // Check if any filters are active
  const hasActiveFilters = selectedLocation !== null || (region !== null && region !== 'All regions');

  // Chart data transformations
  const visitTypeData = useMemo(() => [
    { name: 'In-Person', value: typeInPerson, color: CHART_COLORS[0] },
    { name: 'Virtual', value: typeVirtual, color: CHART_COLORS[1] },
    { name: 'Self-Recorded', value: typeSelf, color: CHART_COLORS[2] },
  ].filter(item => item.value > 0), [typeInPerson, typeSelf, typeVirtual]);

  const diagnosisChartData = useMemo(() =>
    topDiagnoses.map((item, index) => ({
      name: item.key.charAt(0).toUpperCase() + item.key.slice(1),
      value: item.count,
      color: CHART_COLORS[index % CHART_COLORS.length]
    })), [topDiagnoses]);

  // Custom KPI Card Component
  const KpiCard = ({ title, value, icon, subtitle, color = COLORS.primary }: any) => (
    <Surface style={styles.kpiCard} elevation={0}>
      <View style={styles.kpiContent}>
        <View style={[styles.kpiIcon, { backgroundColor: color }]}>
          <MaterialIcons name={icon} size={20} color={COLORS.surface} />
        </View>
        <View style={styles.kpiText}>
          <Text style={[styles.kpiValue, { color }]}>{value.toLocaleString()}</Text>
          <Text style={styles.kpiTitle}>{title}</Text>
        </View>
      </View>
    </Surface>
  );

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      {/* Header */}
      <Surface style={styles.header} elevation={2}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            {/* <MaterialIcons name="menu" size={24} color={COLORS.surface} /> */}
          </View>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Healthcare Dashboard</Text>
            <Text style={styles.headerSubtitle}>
              {selectedLocation
                ? `Within ${searchRadius}km of ${selectedLocation.name.split(',')[0]}`
                : 'Real-time Analytics'
              }
            </Text>
          </View>
          <View style={styles.headerRight}>
            <MaterialIcons name="account-circle" size={28} color={COLORS.surface} />
          </View>
        </View>

        {/* Time Range Chips */}
        <View style={styles.timeRangeContainer}>
          {(['today', '7d', '30d', '90d'] as RangeTab[]).map((r) => (
            <Chip
              key={r}
              selected={range === r}
              onPress={() => setRange(r)}
              style={[styles.timeChip, range === r && styles.selectedTimeChip]}
              textStyle={[styles.timeChipText, range === r && styles.selectedTimeChipText]}
              showSelectedCheck={false}
            >
              {r === 'today' ? 'Today' : r === '7d' ? '7 Days' : r === '30d' ? '30 Days' : '90 Days'}
            </Chip>
          ))}
        </View>
      </Surface>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Filter Bar */}
        <View style={styles.filterBar}>
          <Button
            mode="contained"
            onPress={() => setFiltersVisible(true)}
            style={[styles.filterButton, hasActiveFilters && styles.activeFilterButton]}
            buttonColor={hasActiveFilters ? COLORS.success : COLORS.primary}
            icon="filter"
            compact
          >
            {hasActiveFilters ? 'Filters Active' : 'All regions'}
          </Button>

          {hasActiveFilters && (
            <Button
              mode="text"
              onPress={clearAllFilters}
              textColor={COLORS.danger}
              compact
            >
              Clear All
            </Button>
          )}
        </View>

        {/* Active Filter Indicator */}
        {selectedLocation && (
          <Surface style={styles.activeFilterCard} elevation={1}>
            <MaterialIcons name="location-on" size={18} color={COLORS.success} />
            <Text style={styles.activeFilterText}>
              Within {searchRadius}km of {extractLocationName({ name: selectedLocation.name } as LocationData)}
            </Text>
            <IconButton
              icon="close"
              size={16}
              onPress={clearLocationFilter}
              iconColor={COLORS.textSecondary}
            />
          </Surface>
        )}

        {/* KPI Grid */}
        <ScrollView horizontal={true} showsHorizontalScrollIndicator={false}>


          <View style={styles.kpiGrid}>
            <KpiCard
              title="Total Patients"
              value={totalPatients}
              icon="people"
              color={COLORS.primary}
            />
            <KpiCard
              title="Active Patients"
              value={activePatientsInRange}
              icon="person"
              color={COLORS.success}
            />
            <KpiCard
              title="Today's Visits"
              value={todaysVisits}
              icon="today"
              color={COLORS.warning}
            />
            <KpiCard
              title="Available Doctors"
              value={totalDoctors}
              icon="medical-services"
              color={COLORS.danger}
            />
          </View>
        </ScrollView>
        {/* Secondary KPI Row */}
        <View style={styles.secondaryKpiGrid}>
          <KpiCard
            title="New Patients"
            value={newPatientsInRange}
            icon="person-add"
            color={COLORS.secondary}
          />
          <KpiCard
            title="Total Visits"
            value={visitsInRange}
            icon="event-note"
            color={COLORS.info}
          />
        </View>

        {/* Trends Chart */}
        <Surface style={styles.chartCard} elevation={1}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>Visit Trends (Real Data)</Text>
          </View>
          <View style={styles.chartContent}>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trendData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: COLORS.textSecondary }}
                />
                <YAxis hide />
                <Tooltip
                  contentStyle={{
                    backgroundColor: COLORS.surface,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="visits"
                  stroke={COLORS.primary}
                  strokeWidth={2.5}
                  dot={{ fill: COLORS.primary, strokeWidth: 1, r: 3 }}
                  name="Total Visits"
                />
                <Line
                  type="monotone"
                  dataKey="newPatients"
                  stroke={COLORS.success}
                  strokeWidth={2}
                  dot={{ fill: COLORS.success, strokeWidth: 1, r: 2 }}
                  name="New Patients"
                />
                <Line
                  type="monotone"
                  dataKey="virtualVisits"
                  stroke={COLORS.info}
                  strokeWidth={2}
                  dot={{ fill: COLORS.info, strokeWidth: 1, r: 2 }}
                  name="Virtual Visits"
                />
              </LineChart>
            </ResponsiveContainer>
          </View>
        </Surface>

        {/* Charts Row */}
        <View style={styles.chartsRow}>
          {/* Visit Types */}
          <Surface style={[styles.halfChart, { marginRight: 8 }]} elevation={1}>
            <View style={styles.chartHeader}>
              <Text style={styles.chartTitle}>Visit Types</Text>
            </View>
            <View style={styles.pieChartContainer}>
              {visitTypeData.length > 0 ? (
                <PieChart width={140} height={140}>
                  <Pie
                    data={visitTypeData}
                    cx={70}
                    cy={70}
                    outerRadius={50}
                    dataKey="value"
                    label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {visitTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              ) : (
                <View style={styles.emptyChart}>
                  <MaterialIcons name="pie-chart-outline" size={32} color={COLORS.textMuted} />
                  <Text style={styles.emptyChartText}>No data</Text>
                </View>
              )}
            </View>
          </Surface>

          {/* Common Diagnoses */}
          <Surface style={[styles.halfChart, { marginLeft: 8 }]} elevation={1}>
            <View style={styles.chartHeader}>
              <Text style={styles.chartTitle}>Common Diagnoses</Text>
            </View>
            <View style={styles.pieChartContainer}>
              {diagnosisChartData.length > 0 ? (
                <PieChart width={140} height={140}>
                  <Pie
                    data={diagnosisChartData}
                    cx={70}
                    cy={70}
                    outerRadius={45}
                    dataKey="value"
                    labelLine={false}
                  >
                    {diagnosisChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              ) : (
                <View style={styles.emptyChart}>
                  <MaterialIcons name="medical-information" size={32} color={COLORS.textMuted} />
                  <Text style={styles.emptyChartText}>No data</Text>
                </View>
              )}
            </View>
          </Surface>
        </View>

        {/* Common Symptoms */}
        <Surface style={styles.chartCard} elevation={1}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>Common Symptoms (From Real Data)</Text>
          </View>
          <View style={styles.symptomsContainer}>
            {topSymptoms.length > 0 ? (
              topSymptoms.slice(0, 6).map((symptom, index) => (
                <View key={symptom.key} style={styles.symptomItem}>
                  <View style={[styles.symptomDot, { backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }]} />
                  <Text style={styles.symptomText}>{symptom.key.charAt(0).toUpperCase() + symptom.key.slice(1)}</Text>
                  <Text style={styles.symptomCount}>{symptom.count}</Text>
                </View>
              ))
            ) : (
              <View style={styles.emptyChart}>
                <MaterialIcons name="healing" size={32} color={COLORS.textMuted} />
                <Text style={styles.emptyChartText}>No symptom data available</Text>
              </View>
            )}
          </View>
        </Surface>

        {/* Location Distribution */}
        {locationData.length > 0 && (
          <Surface style={styles.chartCard} elevation={1}>
            <View style={styles.chartHeader}>
              <Text style={styles.chartTitle}>Top Locations (Real Data)</Text>
            </View>
            <View style={styles.locationContainer}>
              {locationData.map((location, index) => (
                <View key={location.fullName} style={styles.locationItem}>
                  <View style={[styles.locationDot, { backgroundColor: location.color }]} />
                  <Text style={styles.locationText}>{location.fullName}</Text>
                  <Text style={styles.locationCount}>{location.value}</Text>
                </View>
              ))}
            </View>
          </Surface>
        )}

        {/* Key Metrics */}
        <Surface style={styles.chartCard} elevation={1}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>Key Metrics (Real Data)</Text>
          </View>
          <View style={styles.keyMetricsGrid}>
            <View style={styles.keyMetric}>
              <Text style={[styles.keyMetricValue, { color: COLORS.warning }]}>
                {activePatientsInRange > 0 ? (visitsInRange / activePatientsInRange).toFixed(1) : '0'}
              </Text>
              <Text style={styles.keyMetricLabel}>Avg Visits/Patient</Text>
            </View>
            <View style={styles.keyMetric}>
              <Text style={[styles.keyMetricValue, { color: COLORS.secondary }]}>
                {totalPatients > 0 ? ((newPatientsInRange / totalPatients) * 100).toFixed(1) + '%' : '0%'}
              </Text>
              <Text style={styles.keyMetricLabel}>New Patient Rate</Text>
            </View>
            <View style={styles.keyMetric}>
              <Text style={[styles.keyMetricValue, { color: COLORS.info }]}>
                {visitsInRange > 0 ? ((typeVirtual / visitsInRange) * 100).toFixed(1) + '%' : '0%'}
              </Text>
              <Text style={styles.keyMetricLabel}>Virtual Visit %</Text>
            </View>
          </View>
        </Surface>

        {/* Data Summary Card */}
        <Surface style={styles.chartCard} elevation={1}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>Data Summary</Text>
          </View>
          <View style={styles.dataSummaryContainer}>
            <View style={styles.summaryRow}>
              <MaterialIcons name="info-outline" size={16} color={COLORS.info} />
              <Text style={styles.summaryText}>
                Showing data from {allVisitsInRange.length} total visits
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <MaterialIcons name="filter-list" size={16} color={COLORS.primary} />
              <Text style={styles.summaryText}>
                {hasActiveFilters ? `Filtered to ${visitsInRange} visits` : 'No filters applied'}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <MaterialIcons name="schedule" size={16} color={COLORS.success} />
              <Text style={styles.summaryText}>
                Time range: {range === 'today' ? 'Today' : range === '7d' ? 'Last 7 days' : range === '30d' ? 'Last 30 days' : 'Last 90 days'}
              </Text>
            </View>
            {selectedLocation && (
              <View style={styles.summaryRow}>
                <MaterialIcons name="location-on" size={16} color={COLORS.warning} />
                <Text style={styles.summaryText}>
                  Within {searchRadius}km of {extractLocationName({ name: selectedLocation.name } as LocationData)}
                </Text>
              </View>
            )}
          </View>
        </Surface>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Filter Modal */}
      <Portal>
        <Modal
          visible={filtersVisible}
          onDismiss={() => setFiltersVisible(false)}
          contentContainerStyle={styles.filterModalContainer}
        >
          <Surface style={styles.filterModalContent} elevation={8}>
            <View style={styles.filterModalHeader}>
              <Text style={styles.filterModalTitle}>Filters</Text>
              <IconButton
                icon="close"
                onPress={() => setFiltersVisible(false)}
                iconColor={COLORS.textSecondary}
              />
            </View>

            <Divider style={styles.filterDivider} />

            {/* Region Filter */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Region</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.regionChipContainer}>
                {regionsFromData.map((r) => (
                  <Chip
                    key={r}
                    selected={region === r || (region === null && r === 'All regions')}
                    onPress={() => setRegion(r === 'All regions' ? null : r)}
                    style={[styles.regionChip, (region === r || (region === null && r === 'All regions')) && styles.selectedRegionChip]}
                    textStyle={[styles.regionChipText, (region === r || (region === null && r === 'All regions')) && styles.selectedRegionChipText]}
                    showSelectedCheck={false}
                  >
                    {r.length > 15 ? r.substring(0, 15) + '...' : r}
                  </Chip>
                ))}
              </ScrollView>
            </View>

            <Divider style={styles.filterDivider} />

            {/* Location Filter */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Location-Based Analysis</Text>
              <Text style={styles.filterSectionSubtitle}>
                Filter data within a specific radius of a location
              </Text>

              <TextInput
                label="Search location"
                value={searchLocation}
                onChangeText={setSearchLocation}
                mode="outlined"
                style={styles.locationFilterInput}
                placeholder="e.g., New York, NY"
                left={<TextInput.Icon icon="map-marker" />}
                onSubmitEditing={handleLocationSearch}
              />

              {selectedLocation && (
                <Surface style={styles.selectedLocationCard} elevation={1}>
                  <MaterialIcons name="location-on" size={16} color={COLORS.success} />
                  <View style={styles.selectedLocationText}>
                    <Text style={styles.selectedLocationName}>
                      {extractLocationName({ name: selectedLocation.name } as LocationData)}
                    </Text>
                    <Text style={styles.selectedLocationRadius}>
                      Radius: {searchRadius}km
                    </Text>
                  </View>
                  <IconButton
                    icon="delete"
                    size={16}
                    onPress={clearLocationFilter}
                    iconColor={COLORS.danger}
                  />
                </Surface>
              )}

              <View style={styles.radiusContainer}>
                <Text style={styles.radiusLabel}>Search Radius: {searchRadius} km</Text>
                <Slider
                  style={styles.radiusSlider}
                  minimumValue={1}
                  maximumValue={50}
                  value={searchRadius}
                  onValueChange={setSearchRadius}
                  step={1}
                  minimumTrackTintColor={COLORS.primary}
                  maximumTrackTintColor={COLORS.border}
                  thumbTintColor={COLORS.primary}
                />
                <View style={styles.radiusLabels}>
                  <Text style={styles.radiusLabelSmall}>1 km</Text>
                  <Text style={styles.radiusLabelSmall}>50 km</Text>
                </View>
              </View>
            </View>

            <View style={styles.filterModalButtons}>
              <Button
                mode="outlined"
                onPress={clearAllFilters}
                style={styles.filterModalButton}
                textColor={COLORS.danger}
              >
                Clear All
              </Button>
              <Button
                mode="contained"
                onPress={handleLocationSearch}
                style={[styles.filterModalButton, { marginLeft: 12 }]}
                loading={isLocationLoading}
                disabled={!searchLocation.trim() || isLocationLoading}
              >
                {isLocationLoading ? 'Searching...' : 'Apply Location'}
              </Button>
            </View>
          </Surface>
        </Modal>
      </Portal>

      {loading && (
        <View style={styles.loadingOverlay}>
          <Surface style={styles.loadingCard} elevation={8}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading Real Data...</Text>
          </Surface>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background
  },

  // Header
  header: {
    backgroundColor: '#4C51BF',
    paddingTop: 12,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: {
    width: 32,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerRight: {
    width: 32,
    alignItems: 'flex-end',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.surface,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.surface + 'CC',
    textAlign: 'center',
    marginTop: 2,
  },
  timeRangeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  timeChip: {
    marginHorizontal: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  selectedTimeChip: {
    backgroundColor: COLORS.surface,
  },
  timeChipText: {
    color: COLORS.surface,
    fontSize: 12,
    fontWeight: '500',
  },
  selectedTimeChipText: {
    color: '#4C51BF',
    fontWeight: '600',
  },

  scrollContent: {
    paddingBottom: 24,
  },

  // Filter Bar
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  filterButton: {
    borderRadius: 20,
  },
  activeFilterButton: {
    backgroundColor: COLORS.success,
  },

  // Active Filter Card
  activeFilterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: COLORS.success + '15',
    borderWidth: 1,
    borderColor: COLORS.success + '30',
  },
  activeFilterText: {
    flex: 1,
    marginLeft: 6,
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '500',
  },

  // KPI Cards
  kpiGrid: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  secondaryKpiGrid: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    marginBottom: 20,
  },
  kpiCard: {
    flex: 1,
    marginHorizontal: 4,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  kpiContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  kpiIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  kpiText: {
    flex: 1,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  kpiTitle: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '500',
  },

  // Charts
  chartCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chartHeader: {
    padding: 16,
    paddingBottom: 8,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  chartContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },

  chartsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  halfChart: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pieChartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    height: 160,
  },
  emptyChart: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  emptyChartText: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },

  // Symptoms
  symptomsContainer: {
    padding: 16,
    paddingTop: 8,
    minHeight: 100,
  },
  symptomItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  symptomDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  symptomText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  symptomCount: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },

  // Locations
  locationContainer: {
    padding: 16,
    paddingTop: 8,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  locationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  locationText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },
  locationCount: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },

  // Key Metrics
  keyMetricsGrid: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 16,
    justifyContent: 'space-around',
  },
  keyMetric: {
    flex: 1,
    alignItems: 'center',
  },
  keyMetricValue: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  keyMetricLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
    fontWeight: '500',
  },

  // Data Summary
  dataSummaryContainer: {
    padding: 16,
    paddingTop: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  summaryText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginLeft: 8,
    fontWeight: '500',
  },

  // Filter Modal
  filterModalContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  filterModalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    maxHeight: '85%',
  },
  filterModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  filterModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  filterDivider: {
    marginVertical: 8,
  },
  filterSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  filterSectionSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  regionChipContainer: {
    flexGrow: 0,
  },
  regionChip: {
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: COLORS.surfaceVariant,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  selectedRegionChip: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  regionChipText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  selectedRegionChipText: {
    color: COLORS.surface,
    fontWeight: '600',
  },
  locationFilterInput: {
    marginBottom: 16,
  },
  selectedLocationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: COLORS.success + '10',
    borderWidth: 1,
    borderColor: COLORS.success + '30',
    marginBottom: 16,
  },
  selectedLocationText: {
    flex: 1,
    marginLeft: 8,
  },
  selectedLocationName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  selectedLocationRadius: {
    fontSize: 11,
    color: COLORS.success,
    marginTop: 2,
    fontWeight: '500',
  },
  radiusContainer: {
    marginTop: 8,
  },
  radiusLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  radiusSlider: {
    width: '100%',
    height: 32,
  },
  radiusLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  radiusLabelSmall: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  filterModalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  filterModalButton: {
    borderRadius: 8,
  },

  // Loading
  loadingOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
  },
  loadingCard: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 32,
    paddingVertical: 24,
    borderRadius: 16,
    alignItems: 'center',
    marginHorizontal: 32,
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.textSecondary,
    fontSize: 16,
    fontWeight: '500'
  },
});