import { View, Text } from 'react-native'
import React, { useMemo } from 'react'
import { useLocalSearchParams } from 'expo-router'
import { Patient } from '~/lib/supabase'
import { SafeAreaView } from 'react-native-safe-area-context'
import PatientDetailsWrapper from '~/components/PatientData'

export default function patientDetails() {
  const params = useLocalSearchParams<{ patient?: string; view?: string }>()
  const patient: Patient | null = useMemo(() => {
    try {
      return params.patient ? JSON.parse(decodeURIComponent(params.patient)) : null
    } catch {
      return null
    }
  }, [params.patient])

  return <PatientDetailsWrapper patient_id={patient?.id!} view={params.view!} />
}

// import React, { useEffect, useMemo, useState } from 'react'
// import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native'
// import { SafeAreaView } from 'react-native'
// import { Text, Button, ActivityIndicator } from 'react-native-paper'
// import { MaterialIcons } from '@expo/vector-icons'
// import { useLocalSearchParams, router } from 'expo-router'
// import { supabase, Patient, Visit } from '../../lib/supabase'
// import HealthTrendsComponent from '../../components/HealthTrendsComponent'

// type ViewKey = 'trends' | 'history' | 'profile'

// const PatientDetailsWrapper: React.FC = () => {
//   const params = useLocalSearchParams<{ patient?: string; view?: string }>()
//   const patient: Patient | null = useMemo(() => {
//     try {
//       return params.patient ? JSON.parse(decodeURIComponent(params.patient)) : null
//     } catch {
//       return null
//     }
//   }, [params.patient])

//   const initialView: ViewKey = (params.view as ViewKey) || 'trends'
//   const [activeView, setActiveView] = useState<ViewKey>(initialView)

//   // ---- HISTORY state (copied structure from patient/history.tsx) ----
//   const [historyTab, setHistoryTab] = useState<'doctor' | 'ai'>('doctor')
//   const [visits, setVisits] = useState<Visit[]>([])
//   const [filteredVisits, setFilteredVisits] = useState<Visit[]>([])
//   const [aiSessions, setAiSessions] = useState<Visit[]>([])
//   const [filteredAiSessions, setFilteredAiSessions] = useState<Visit[]>([])
//   const [loadingHistory, setLoadingHistory] = useState(false)
//   const [refreshing, setRefreshing] = useState(false)

//   useEffect(() => {
//     if (activeView === 'history' && patient?.id) {
//       loadVisits(patient.id)
//     }
//   }, [activeView, patient?.id])

//   const loadVisits = async (patientId: string) => {
//     setLoadingHistory(true)
//     try {
//       const { data, error } = await supabase
//         .from('visits')
//         .select(`
//           *,
//           field_doctors (name, specialization)
//         `)
//         .eq('patient_id', patientId)
//         .order('visit_date', { ascending: false })

//       if (error) {
//         console.error('Error loading visits:', error)
//       } else {
//         const physicalVisits = data?.filter(v => v.visit_type !== 'virtual_consultation') || []
//         setVisits(physicalVisits)
//         setFilteredVisits(physicalVisits)

//         const virtualConsults = data?.filter(v => v.visit_type === 'virtual_consultation') || []
//         setAiSessions(virtualConsults)
//         setFilteredAiSessions(virtualConsults)
//       }
//     } catch (error) {
//       console.error('Error loading visits:', error)
//     } finally {
//       setLoadingHistory(false)
//       setRefreshing(false)
//     }
//   }

//   const onRefresh = () => {
//     setRefreshing(true)
//     if (patient?.id) loadVisits(patient.id)
//   }

//   // ---- Shared helpers from your patient/history.tsx ----
//   const formatDate = (dateString: string) => {
//     return new Date(dateString).toLocaleDateString('en-US', {
//       year: 'numeric',
//       month: 'short',
//       day: 'numeric',
//     })
//   }

//   const formatTime = (dateString: string) => {
//     return new Date(dateString).toLocaleTimeString('en-US', {
//       hour: '2-digit',
//       minute: '2-digit',
//     })
//   }

//   const getVitalChips = (visit: Visit) => {
//     const vitals: { label: string; unit?: string; alert?: boolean }[] = []

//     if (visit.weight) vitals.push({ label: `${visit.weight} kg` })
//     if (visit.systolic_bp && visit.diastolic_bp) {
//       const isHigh = visit.systolic_bp > 140 || visit.diastolic_bp > 90
//       vitals.push({ label: `${visit.systolic_bp}/${visit.diastolic_bp}`, unit: 'mmHg', alert: isHigh })
//     }
//     if (visit.heart_rate) vitals.push({ label: `${visit.heart_rate}`, unit: 'bpm' })
//     if (visit.temperature) {
//       const isHigh = visit.temperature > 37.5
//       vitals.push({ label: `${visit.temperature}°C`, alert: isHigh })
//     }
//     if (visit.blood_sugar) {
//       const isHigh = visit.blood_sugar > 180
//       vitals.push({ label: `${visit.blood_sugar}`, unit: 'mg/dL', alert: isHigh })
//     }
//     if (visit.oxygen_saturation) vitals.push({ label: `${visit.oxygen_saturation}%`, unit: 'O₂' })

//     return vitals
//   }

//   const handleEditVisit = (visit: Visit) => {
//     // doctor edits via doctor edit screen
//     router.push(`/doctor/edit-visit?visitId=${visit.id}`)
//   }

//   // ---- Renderers for the 3 views ----
//   const renderHeader = () => (
//     <View style={styles.header}>
//       <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
//         <MaterialIcons name="arrow-back" size={24} color="#333333" />
//       </TouchableOpacity>
//       <View style={{ flex: 1 }}>
//         <Text style={styles.title}>{patient?.name || 'Patient'}</Text>
//         {patient ? (
//           <Text style={styles.subtitle}>Age {patient.age} • {patient.gender}</Text>
//         ) : null}
//       </View>
//     </View>
//   )

//   const renderTabs = () => (
//     <View style={styles.tabRow}>
//       <Button
//         mode={activeView === 'trends' ? 'contained' : 'outlined'}
//         onPress={() => setActiveView('trends')}
//         style={styles.tabButton}
//         contentStyle={styles.tabButtonContent}
//         buttonColor={activeView === 'trends' ? '#4285F4' : undefined}
//         textColor={activeView === 'trends' ? '#FFFFFF' : '#4285F4'}
//         icon={() => <MaterialIcons name="trending-up" size={18} color={activeView === 'trends' ? '#FFFFFF' : '#4285F4'} />}
//       >
//         Trends
//       </Button>

//       <Button
//         mode={activeView === 'history' ? 'contained' : 'outlined'}
//         onPress={() => setActiveView('history')}
//         style={styles.tabButton}
//         contentStyle={styles.tabButtonContent}
//         buttonColor={activeView === 'history' ? '#4285F4' : undefined}
//         textColor={activeView === 'history' ? '#FFFFFF' : '#4285F4'}
//         icon={() => <MaterialIcons name="history" size={18} color={activeView === 'history' ? '#FFFFFF' : '#4285F4'} />}
//       >
//         History
//       </Button>

//       <Button
//         mode={activeView === 'profile' ? 'contained' : 'outlined'}
//         onPress={() => setActiveView('profile')}
//         style={styles.tabButton}
//         contentStyle={styles.tabButtonContent}
//         buttonColor={activeView === 'profile' ? '#4285F4' : undefined}
//         textColor={activeView === 'profile' ? '#FFFFFF' : '#4285F4'}
//         icon={() => <MaterialIcons name="badge" size={18} color={activeView === 'profile' ? '#FFFFFF' : '#4285F4'} />}
//       >
//         Profile
//       </Button>
//     </View>
//   )

//   const renderTrends = () => (
//     <HealthTrendsComponent
//       patientId={patient!.id}
//       showHeader={false}
//       containerStyle={{ flex: 1 }}
//     />
//   )

//   // ---- HISTORY view cloned structure/style from patient/history.tsx (minus FAB & useAuth) ----
//   const renderVisitCard = (visit: Visit, index: number) => (
//     <View key={visit.id} style={styles.visitCard}>
//       {/* Visit Header */}
//       <View style={styles.visitHeader}>
//         <View style={styles.visitDateContainer}>
//           <Text style={styles.visitDate}>{formatDate(visit.visit_date)}</Text>
//           <Text style={styles.visitTime}>{formatTime(visit.visit_date)}</Text>
//         </View>
//         {visit.doctor_id ? (
//           <TouchableOpacity style={styles.editButton} onPress={() => handleEditVisit(visit)}>
//             <MaterialIcons name="edit" size={20} color="#4285F4" />
//           </TouchableOpacity>
//         ) : null}
//       </View>

//       {/* Doctor Info */}
//       {(visit as any).field_doctors ? (
//         <View style={styles.doctorInfo}>
//           <View style={styles.doctorIcon}>
//             <MaterialIcons name="local-hospital" size={16} color="#4285F4" />
//           </View>
//           <View style={styles.doctorDetails}>
//             <Text style={styles.doctorName}>Dr. {(visit as any).field_doctors?.name}</Text>
//             <Text style={styles.doctorSpecialization}>
//               {(visit as any).field_doctors?.specialization}
//             </Text>
//           </View>
//         </View>
//       ) : (
//         <View style={styles.doctorInfo}>
//           <View style={styles.doctorIcon}>
//             <MaterialIcons name="self-improvement" size={16} color="#4CAF50" />
//           </View>
//           <View style={styles.doctorDetails}>
//             <Text style={styles.doctorName}>Self-recorded</Text>
//             <Text style={styles.doctorSpecialization}>Personal entry</Text>
//           </View>
//         </View>
//       )}

//       {/* Vital Signs */}
//       {getVitalChips(visit).length > 0 && (
//         <View style={styles.vitalsSection}>
//           <Text style={styles.sectionTitle}>Vitals</Text>
//           <View style={styles.vitalsGrid}>
//             {getVitalChips(visit).map((vital, idx) => (
//               <View
//                 key={idx}
//                 style={[styles.vitalChip, vital.alert && styles.alertChip]}
//               >
//                 <Text style={[styles.vitalValue, vital.alert && styles.alertText]}>
//                   {vital.label}
//                 </Text>
//                 {vital.unit ? (
//                   <Text style={[styles.vitalUnit, vital.alert && styles.alertText]}>{vital.unit}</Text>
//                 ) : null}
//               </View>
//             ))}
//           </View>
//         </View>
//       )}

//       {/* Symptoms */}
//       {visit.symptoms ? (
//         <View style={styles.section}>
//           <Text style={styles.sectionTitle}>Symptoms</Text>
//           <Text style={styles.sectionContent}>{visit.symptoms}</Text>
//         </View>
//       ) : null}

//       {/* Diagnosis */}
//       {visit.diagnosis ? (
//         <View style={styles.section}>
//           <Text style={styles.sectionTitle}>Diagnosis</Text>
//           <Text style={styles.sectionContent}>{visit.diagnosis}</Text>
//         </View>
//       ) : null}

//       {/* Treatment Notes */}
//       {visit.treatment_notes ? (
//         <View style={styles.section}>
//           <Text style={styles.sectionTitle}>Treatment</Text>
//           <Text style={styles.sectionContent}>{visit.treatment_notes}</Text>
//         </View>
//       ) : null}

//       {/* Medications */}
//       {visit.prescribed_medications ? (
//         <View style={styles.medicationSection}>
//           <Text style={styles.sectionTitle}>Medications</Text>
//           <Text style={styles.medicationContent}>{visit.prescribed_medications}</Text>
//         </View>
//       ) : null}
//     </View>
//   )

//   const renderHistory = () => {
//     if (loadingHistory) {
//       return (
//         <View style={styles.loadingContainer}>
//           <ActivityIndicator size="large" color="#4285F4" />
//           <Text style={styles.loadingText}>Loading history...</Text>
//         </View>
//       )
//     }

//     const TabHeader = () => (
//       <View style={styles.tabContainer}>
//         <TouchableOpacity
//           style={[styles.tab, historyTab === 'doctor' && styles.activeTab]}
//           onPress={() => setHistoryTab('doctor')}
//         >
//           <MaterialIcons
//             name="local-hospital"
//             size={20}
//             color={historyTab === 'doctor' ? '#4285F4' : '#999999'}
//           />
//           <Text style={[styles.tabText, historyTab === 'doctor' && styles.activeTabText]}>
//             Visits
//           </Text>
//         </TouchableOpacity>

//         <TouchableOpacity
//           style={[styles.tab, historyTab === 'ai' && styles.activeTab]}
//           onPress={() => setHistoryTab('ai')}
//         >
//           <MaterialIcons
//             name="psychology"
//             size={20}
//             color={historyTab === 'ai' ? '#4285F4' : '#999999'}
//           />
//           <Text style={[styles.tabText, historyTab === 'ai' && styles.activeTabText]}>
//             AI Sessions
//           </Text>
//         </TouchableOpacity>
//       </View>
//     )

//     const onPull = () => onRefresh()

//     return (
//       <>
//         <TabHeader />
//         <ScrollView
//           contentContainerStyle={styles.scrollContent}
//           refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onPull} />}
//           showsVerticalScrollIndicator={false}
//         >
//           {historyTab === 'doctor' ? (
//             filteredVisits.length ? (
//               filteredVisits.map(renderVisitCard)
//             ) : (
//               <View style={styles.emptyState}>
//                 <View style={styles.emptyIcon}>
//                   <MaterialIcons name="medical-information" size={48} color="#CCCCCC" />
//                 </View>
//                 <Text style={styles.emptyTitle}>No doctor visits yet</Text>
//                 <Text style={styles.emptyText}>
//                   Doctor visit history will appear here after the first appointment.
//                 </Text>
//               </View>
//             )
//           ) : filteredAiSessions.length ? (
//             filteredAiSessions.map(renderVisitCard)
//           ) : (
//             <View style={styles.emptyState}>
//               <View style={styles.emptyIcon}>
//                 <MaterialIcons name="psychology" size={48} color="#CCCCCC" />
//               </View>
//               <Text style={styles.emptyTitle}>No AI sessions yet</Text>
//               <Text style={styles.emptyText}>
//                 Start a conversation with the AI assistant to see it here.
//               </Text>
//             </View>
//           )}
//         </ScrollView>
//       </>
//     )
//   }

//   const renderProfile = () => (
//     <View style={styles.profileBlock}>
//       <View style={styles.profileRow}>
//         <Text style={styles.profileLabel}>Name</Text>
//         <Text style={styles.profileValue}>{patient?.name}</Text>
//       </View>
//       <View style={styles.profileRow}>
//         <Text style={styles.profileLabel}>Age</Text>
//         <Text style={styles.profileValue}>{patient?.age}</Text>
//       </View>
//       <View style={styles.profileRow}>
//         <Text style={styles.profileLabel}>Gender</Text>
//         <Text style={styles.profileValue}>{patient?.gender}</Text>
//       </View>
//       {patient?.email ? (
//         <View style={styles.profileRow}>
//           <Text style={styles.profileLabel}>Email</Text>
//           <Text style={styles.profileValue}>{patient.email}</Text>
//         </View>
//       ) : null}
//       {patient?.phone ? (
//         <View style={styles.profileRow}>
//           <Text style={styles.profileLabel}>Phone</Text>
//           <Text style={styles.profileValue}>{patient.phone}</Text>
//         </View>
//       ) : null}
//       {patient?.address ? (
//         <View style={styles.profileRow}>
//           <Text style={styles.profileLabel}>Address</Text>
//           <Text style={styles.profileValue}>{patient.address}</Text>
//         </View>
//       ) : null}
//       {patient?.allergies ? (
//         <View style={styles.profileRow}>
//           <Text style={styles.profileLabel}>Allergies</Text>
//           <Text style={styles.profileValue}>{patient.allergies}</Text>
//         </View>
//       ) : null}
//       {patient?.current_medications ? (
//         <View style={styles.profileRow}>
//           <Text style={styles.profileLabel}>Medications</Text>
//           <Text style={styles.profileValue}>{patient.current_medications}</Text>
//         </View>
//       ) : null}
//       {patient?.medical_history ? (
//         <View style={styles.profileRow}>
//           <Text style={styles.profileLabel}>Medical History</Text>
//           <Text style={styles.profileValue}>{patient.medical_history}</Text>
//         </View>
//       ) : null}
//       {patient?.emergency_contact_name ? (
//         <View style={styles.profileRow}>
//           <Text style={styles.profileLabel}>Emergency Contact</Text>
//           <Text style={styles.profileValue}>
//             {patient.emergency_contact_name}
//             {patient.emergency_contact_phone ? ` (${patient.emergency_contact_phone})` : ''}
//           </Text>
//         </View>
//       ) : null}
//     </View>
//   )

//   if (!patient) {
//     return (
//       <SafeAreaView style={styles.container}>
//         <View style={styles.centered}>
//           <MaterialIcons name="error-outline" size={48} color="#CCCCCC" />
//           <Text style={styles.centerText}>No patient selected</Text>
//           <Button mode="contained" onPress={() => router.back()} style={{ marginTop: 16 }} buttonColor="#4285F4">
//             Go Back
//           </Button>
//         </View>
//       </SafeAreaView>
//     )
//   }

//   return (
//     <SafeAreaView style={styles.container}>
//       {renderHeader()}

//       <ScrollView style={styles.content} contentContainerStyle={styles.pageScrollContent} showsVerticalScrollIndicator={false}>
//         {renderTabs()}
//         {activeView === 'trends' ? renderTrends() : activeView === 'history' ? renderHistory() : renderProfile()}
//       </ScrollView>
//     </SafeAreaView>
//   )
// }

// const styles = StyleSheet.create({
//   // Wrapper container + header + tabs
//   container: { flex: 1, backgroundColor: '#FFFFFF' },
//   header: {
//     flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16,
//     backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E8E8E8',
//   },
//   backButton: {
//     width: 40, height: 40, borderRadius: 20, backgroundColor: '#F8F9FA',
//     alignItems: 'center', justifyContent: 'center', marginRight: 16,
//   },
//   title: { fontSize: 20, fontWeight: '600', color: '#333333' },
//   subtitle: { fontSize: 12, color: '#888888', marginTop: 2 },
//   content: { flex: 1 },
//   pageScrollContent: { paddingHorizontal: 20, paddingVertical: 16, paddingBottom: 24 },

//   tabRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
//   tabButton: { flex: 1, borderRadius: 8, borderColor: '#4285F4' },
//   tabButtonContent: { paddingVertical: 8 },

//   // History view (mirrors patient/history.tsx)
//   tabContainer: {
//     flexDirection: 'row',
//     backgroundColor: '#FFFFFF',
//     paddingHorizontal: 20,
//     paddingVertical: 8,
//     borderBottomWidth: 1,
//     borderBottomColor: '#E8E8E8',
//   },
//   tab: {
//     flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
//     paddingVertical: 12, paddingHorizontal: 16, marginHorizontal: 4, borderRadius: 8,
//   },
//   activeTab: { backgroundColor: '#F0F7FF' },
//   tabText: { marginLeft: 8, fontSize: 16, color: '#999999', fontWeight: '500' },
//   activeTabText: { color: '#4285F4', fontWeight: '600' },

//   loadingContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
//   loadingText: { marginTop: 16, fontSize: 16, color: '#666666' },

//   scrollContent: { padding: 20, paddingBottom: 20 },

//   visitCard: {
//     backgroundColor: '#FAFAFA', borderRadius: 12, padding: 20, marginBottom: 16,
//     borderWidth: 1, borderColor: '#E8E8E8',
//   },
//   visitHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
//   visitDateContainer: { flex: 1 },
//   visitDate: { fontSize: 18, fontWeight: '600', color: '#333333', marginBottom: 4 },
//   visitTime: { fontSize: 14, color: '#666666' },
//   editButton: {
//     width: 32, height: 32, borderRadius: 16, backgroundColor: '#F0F7FF',
//     alignItems: 'center', justifyContent: 'center',
//   },

//   doctorInfo: {
//     flexDirection: 'row', alignItems: 'center', marginBottom: 16, paddingVertical: 12,
//     paddingHorizontal: 16, backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1, borderColor: '#E8E8E8',
//   },
//   doctorIcon: {
//     width: 32, height: 32, borderRadius: 16, backgroundColor: '#F0F7FF',
//     alignItems: 'center', justifyContent: 'center', marginRight: 12,
//   },
//   doctorDetails: { flex: 1 },
//   doctorName: { fontSize: 16, fontWeight: '600', color: '#333333', marginBottom: 2 },
//   doctorSpecialization: { fontSize: 14, color: '#666666' },

//   vitalsSection: { marginBottom: 16 },
//   vitalsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
//   vitalChip: {
//     backgroundColor: '#FFFFFF', borderRadius: 8, padding: 8, borderWidth: 1,
//     borderColor: '#E8E8E8', minWidth: 80, alignItems: 'center',
//   },
//   alertChip: { backgroundColor: '#FFF5F5', borderColor: '#FFB3B3' },
//   vitalValue: { fontSize: 16, fontWeight: '600', color: '#333333' },
//   vitalUnit: { fontSize: 12, color: '#666666', marginTop: 2 },
//   alertText: { color: '#D32F2F' },

//   section: { marginBottom: 16 },
//   sectionTitle: { fontSize: 16, fontWeight: '600', color: '#333333', marginBottom: 8 },
//   sectionContent: { fontSize: 14, color: '#666666', lineHeight: 20 },

//   medicationSection: { marginBottom: 16 },
//   medicationContent: {
//     fontSize: 14, color: '#2E7D32', backgroundColor: '#F0F8F0',
//     padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#E8F5E8', lineHeight: 20,
//   },

//   emptyState: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32 },
//   emptyIcon: {
//     width: 80, height: 80, borderRadius: 40, backgroundColor: '#F8F9FA',
//     alignItems: 'center', justifyContent: 'center', marginBottom: 24,
//   },
//   emptyTitle: { fontSize: 20, fontWeight: '600', color: '#333333', marginBottom: 8, textAlign: 'center' },
//   emptyText: { fontSize: 16, color: '#666666', textAlign: 'center', lineHeight: 24 },

//   // Profile block (simple; can be matched 1:1 if you share patient/profile.tsx)
//   profileBlock: {
//     backgroundColor: '#FAFAFA', borderRadius: 12, borderWidth: 1, borderColor: '#E8E8E8',
//     padding: 16, gap: 10,
//   },
//   profileRow: { flexDirection: 'row', justifyContent: 'space-between' },
//   profileLabel: { color: '#666666', fontSize: 14, fontWeight: '500' },
//   profileValue: { color: '#333333', fontSize: 14, flexShrink: 1, textAlign: 'right' },

//   centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
//   centerText: { marginTop: 12, color: '#666666', fontSize: 16 },
// })

// export default PatientDetailsWrapper
