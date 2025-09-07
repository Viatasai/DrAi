// import React, { useState } from 'react'
// import { View, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native'
// import { Text, Button, ActivityIndicator } from 'react-native-paper'
// import { MaterialIcons } from '@expo/vector-icons'
// import { SafeAreaView } from 'react-native'
// import { useAuth } from '../../contexts/AuthContext'
// import { supabase, Patient } from '../../lib/supabase'
// import { router } from 'expo-router'
// import CleanTextInput from '~/components/input/cleanTextInput'
// import { showToast } from '~/utils/toast'

// const PatientProfileScreen: React.FC = () => {
//   const { userProfile, signOut, refreshProfile } = useAuth()
//   const [editing, setEditing] = useState(false)
//   const [loading, setLoading] = useState(false)

//   const patient = userProfile as Patient

//   // Editable fields
//   const [phone, setPhone] = useState(patient?.phone || '')
//   const [address, setAddress] = useState(patient?.address || '')
//   const [emergencyContactName, setEmergencyContactName] = useState(
//     patient?.emergency_contact_name || '',
//   )
//   const [emergencyContactPhone, setEmergencyContactPhone] = useState(
//     patient?.emergency_contact_phone || '',
//   )
//   const [medicalHistory, setMedicalHistory] = useState(patient?.medical_history || '')
//   const [allergies, setAllergies] = useState(patient?.allergies || '')
//   const [currentMedications, setCurrentMedications] = useState(
//     patient?.current_medications || '',
//   )

//   const handleSave = async () => {
//     if (!patient) return

//     setLoading(true)
//     try {
//       const { error } = await supabase
//         .from('patients')
//         .update({
//           phone,
//           address,
//           emergency_contact_name: emergencyContactName,
//           emergency_contact_phone: emergencyContactPhone,
//           medical_history: medicalHistory,
//           allergies,
//           current_medications: currentMedications,
//         })
//         .eq('id', patient.id)

//       if (error) {
//         showToast.error('Error', 'Failed to update profile')
//         console.error('Error updating profile:', error)
//       } else {
//         showToast.success('Success', 'Profile updated successfully')
//         setEditing(false)
//         await refreshProfile()
//       }
//     } catch (error) {
//       showToast.error('Error', 'An unexpected error occurred')
//       console.error('Error updating profile:', error)
//     } finally {
//       setLoading(false)
//     }
//   }

//   const handleCancel = () => {
//     // Reset to original values
//     setPhone(patient?.phone || '')
//     setAddress(patient?.address || '')
//     setEmergencyContactName(patient?.emergency_contact_name || '')
//     setEmergencyContactPhone(patient?.emergency_contact_phone || '')
//     setMedicalHistory(patient?.medical_history || '')
//     setAllergies(patient?.allergies || '')
//     setCurrentMedications(patient?.current_medications || '')
//     setEditing(false)
//   }

//   const handleSignOut = async () => {
//     await signOut()
//     router.push('/auth/login')
//   }

//   if (!patient) {
//     return (
//       <SafeAreaView style={styles.container}>
//         <View style={styles.loadingContainer}>
//           <ActivityIndicator size="large" color="#4285F4" />
//           <Text style={styles.loadingText}>Loading profile...</Text>
//         </View>
//       </SafeAreaView>
//     )
//   }

//   return (
//     <SafeAreaView style={styles.container}>
//       <View style={styles.header}>
//         <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
//           <MaterialIcons name="arrow-back" size={24} color="#333333" />
//         </TouchableOpacity>
//         <Text style={styles.title}>My Profile</Text>
//         {!editing && (
//           <TouchableOpacity
//             style={styles.editIconButton}
//             onPress={() => setEditing(true)}
//           >
//             <MaterialIcons name="edit" size={24} color="#4285F4" />
//           </TouchableOpacity>
//         )}
//       </View>

//       <ScrollView
//         style={styles.content}
//         contentContainerStyle={styles.scrollContent}
//         showsVerticalScrollIndicator={false}
//       >
//         {/* Profile Header */}
//         <View style={styles.profileHeader}>
//           <View style={styles.avatarContainer}>
//             <MaterialIcons name="account-circle" size={80} color="#4285F4" />
//           </View>
//           <Text style={styles.name}>{patient.name}</Text>
//           <Text style={styles.email}>{patient.email}</Text>
//           <View style={styles.basicInfo}>
//             <View style={styles.infoChip}>
//               <Text style={styles.infoChipText}>Age {patient.age}</Text>
//             </View>
//             <View style={styles.infoChip}>
//               <Text style={styles.infoChipText}>{patient.gender}</Text>
//             </View>
//           </View>
//         </View>

//         {/* Contact Information */}
//         <View style={styles.section}>
//           <Text style={styles.sectionTitle}>Contact Information</Text>

//           {editing ? (
//             <>
//               <CleanTextInput
//                 label="Phone Number"
//                 value={phone}
//                 onChangeText={setPhone}
//                 keyboardType="phone-pad"
//                 placeholder="Enter phone number"
//               />
//               <CleanTextInput
//                 label="Address"
//                 value={address}
//                 onChangeText={setAddress}
//                 placeholder="Enter your address"
//                 multiline
//                 numberOfLines={3}
//               />
//             </>
//           ) : (
//             <>
//               <View style={styles.infoRow}>
//                 <View style={styles.infoIcon}>
//                   <MaterialIcons name="phone" size={20} color="#4285F4" />
//                 </View>
//                 <View style={styles.infoContent}>
//                   <Text style={styles.infoLabel}>Phone</Text>
//                   <Text style={styles.infoValue}>{phone || 'Not provided'}</Text>
//                 </View>
//               </View>

//               <View style={styles.infoRow}>
//                 <View style={styles.infoIcon}>
//                   <MaterialIcons name="home" size={20} color="#4285F4" />
//                 </View>
//                 <View style={styles.infoContent}>
//                   <Text style={styles.infoLabel}>Address</Text>
//                   <Text style={styles.infoValue}>{address || 'Not provided'}</Text>
//                 </View>
//               </View>
//             </>
//           )}
//         </View>

//         {/* Emergency Contact */}
//         <View style={styles.section}>
//           <Text style={styles.sectionTitle}>Emergency Contact</Text>

//           {editing ? (
//             <>
//               <CleanTextInput
//                 label="Emergency Contact Name"
//                 value={emergencyContactName}
//                 onChangeText={setEmergencyContactName}
//                 placeholder="Enter emergency contact name"
//                 autoCapitalize="words"
//               />
//               <CleanTextInput
//                 label="Emergency Contact Phone"
//                 value={emergencyContactPhone}
//                 onChangeText={setEmergencyContactPhone}
//                 keyboardType="phone-pad"
//                 placeholder="Enter emergency contact phone"
//               />
//             </>
//           ) : (
//             <>
//               <View style={styles.infoRow}>
//                 <View style={styles.infoIcon}>
//                   <MaterialIcons name="person" size={20} color="#4285F4" />
//                 </View>
//                 <View style={styles.infoContent}>
//                   <Text style={styles.infoLabel}>Name</Text>
//                   <Text style={styles.infoValue}>
//                     {emergencyContactName || 'Not provided'}
//                   </Text>
//                 </View>
//               </View>

//               <View style={styles.infoRow}>
//                 <View style={styles.infoIcon}>
//                   <MaterialIcons name="phone-in-talk" size={20} color="#4285F4" />
//                 </View>
//                 <View style={styles.infoContent}>
//                   <Text style={styles.infoLabel}>Phone</Text>
//                   <Text style={styles.infoValue}>
//                     {emergencyContactPhone || 'Not provided'}
//                   </Text>
//                 </View>
//               </View>
//             </>
//           )}
//         </View>

//         {/* Medical Information */}
//         <View style={styles.section}>
//           <Text style={styles.sectionTitle}>Medical Information</Text>

//           {editing ? (
//             <>
//               <CleanTextInput
//                 label="Medical History"
//                 value={medicalHistory}
//                 onChangeText={setMedicalHistory}
//                 placeholder="Enter medical history, past conditions, surgeries, etc."
//                 multiline
//                 numberOfLines={4}
//               />
//               <CleanTextInput
//                 label="Known Allergies"
//                 value={allergies}
//                 onChangeText={setAllergies}
//                 placeholder="Enter known allergies (food, medication, environmental)"
//                 multiline
//                 numberOfLines={3}
//               />
//               <CleanTextInput
//                 label="Current Medications"
//                 value={currentMedications}
//                 onChangeText={setCurrentMedications}
//                 placeholder="List current medications with dosages"
//                 multiline
//                 numberOfLines={3}
//               />
//             </>
//           ) : (
//             <>
//               <View style={styles.medicalSection}>
//                 <View style={styles.medicalHeader}>
//                   <MaterialIcons name="history" size={20} color="#4285F4" />
//                   <Text style={styles.medicalLabel}>Medical History</Text>
//                 </View>
//                 <Text style={styles.medicalValue}>
//                   {medicalHistory || 'No medical history recorded'}
//                 </Text>
//               </View>

//               <View style={styles.medicalSection}>
//                 <View style={styles.medicalHeader}>
//                   <MaterialIcons name="warning" size={20} color="#FF9800" />
//                   <Text style={styles.medicalLabel}>Known Allergies</Text>
//                 </View>
//                 <Text style={[styles.medicalValue, allergies && styles.allergyText]}>
//                   {allergies || 'No known allergies'}
//                 </Text>
//               </View>

//               <View style={styles.medicalSection}>
//                 <View style={styles.medicalHeader}>
//                   <MaterialIcons name="medication" size={20} color="#4CAF50" />
//                   <Text style={styles.medicalLabel}>Current Medications</Text>
//                 </View>
//                 <Text style={styles.medicalValue}>
//                   {currentMedications || 'No current medications'}
//                 </Text>
//               </View>
//             </>
//           )}
//         </View>

//         {/* Action Buttons */}
//         <View style={styles.actionButtons}>
//           {editing ? (
//             <>
//               <Button
//                 mode="contained"
//                 onPress={handleSave}
//                 loading={loading}
//                 disabled={loading}
//                 style={styles.saveButton}
//                 contentStyle={styles.buttonContent}
//                 buttonColor="#4285F4"
//               >
//                 {loading ? 'Saving...' : 'Save Changes'}
//               </Button>
//               <Button
//                 mode="outlined"
//                 onPress={handleCancel}
//                 disabled={loading}
//                 style={styles.cancelButton}
//                 textColor="#666666"
//               >
//                 Cancel
//               </Button>
//             </>
//           ) : (
//             <></>
//           )}

//           <Button
//             mode="outlined"
//             onPress={handleSignOut}
//             style={styles.signOutButton}
//             textColor="#D32F2F"
//             icon={() => <MaterialIcons name="logout" size={20} color="#D32F2F" />}
//           >
//             Sign Out
//           </Button>
//         </View>
//       </ScrollView>
//     </SafeAreaView>
//   )
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: '#FFFFFF',
//   },
//   header: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     paddingHorizontal: 20,
//     paddingVertical: 16,
//     backgroundColor: '#FFFFFF',
//     borderBottomWidth: 1,
//     borderBottomColor: '#E8E8E8',
//   },
//   backButton: {
//     width: 40,
//     height: 40,
//     borderRadius: 20,
//     backgroundColor: '#F8F9FA',
//     alignItems: 'center',
//     justifyContent: 'center',
//     marginRight: 16,
//   },
//   title: {
//     fontSize: 24,
//     fontWeight: '600',
//     color: '#333333',
//     flex: 1,
//   },
//   editIconButton: {
//     width: 40,
//     height: 40,
//     borderRadius: 20,
//     backgroundColor: '#F0F7FF',
//     alignItems: 'center',
//     justifyContent: 'center',
//   },
//   content: {
//     flex: 1,
//   },
//   scrollContent: {
//     paddingHorizontal: 20,
//     paddingVertical: 24,
//     paddingBottom: 40,
//   },
//   loadingContainer: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//     padding: 32,
//   },
//   loadingText: {
//     fontSize: 16,
//     color: '#666666',
//     marginTop: 16,
//   },
//   profileHeader: {
//     alignItems: 'center',
//     backgroundColor: '#FAFAFA',
//     borderRadius: 12,
//     padding: 24,
//     marginBottom: 32,
//     borderWidth: 1,
//     borderColor: '#E8E8E8',
//   },
//   avatarContainer: {
//     width: 100,
//     height: 100,
//     borderRadius: 50,
//     backgroundColor: '#F0F7FF',
//     alignItems: 'center',
//     justifyContent: 'center',
//     marginBottom: 16,
//   },
//   name: {
//     fontSize: 24,
//     fontWeight: '600',
//     color: '#333333',
//     marginBottom: 4,
//   },
//   email: {
//     fontSize: 16,
//     color: '#666666',
//     marginBottom: 16,
//   },
//   basicInfo: {
//     flexDirection: 'row',
//     gap: 12,
//   },
//   infoChip: {
//     backgroundColor: '#F0F7FF',
//     paddingHorizontal: 12,
//     paddingVertical: 6,
//     borderRadius: 16,
//     borderWidth: 1,
//     borderColor: '#E3F2FD',
//   },
//   infoChipText: {
//     fontSize: 14,
//     color: '#4285F4',
//     fontWeight: '500',
//   },
//   section: {
//     marginBottom: 32,
//   },
//   sectionTitle: {
//     fontSize: 20,
//     fontWeight: '600',
//     color: '#333333',
//     marginBottom: 20,
//   },
//   infoRow: {
//     flexDirection: 'row',
//     alignItems: 'flex-start',
//     backgroundColor: '#FAFAFA',
//     padding: 16,
//     borderRadius: 12,
//     marginBottom: 12,
//     borderWidth: 1,
//     borderColor: '#E8E8E8',
//   },
//   infoIcon: {
//     width: 40,
//     height: 40,
//     borderRadius: 20,
//     backgroundColor: '#F0F7FF',
//     alignItems: 'center',
//     justifyContent: 'center',
//     marginRight: 12,
//   },
//   infoContent: {
//     flex: 1,
//   },
//   infoLabel: {
//     fontSize: 14,
//     fontWeight: '500',
//     color: '#666666',
//     marginBottom: 2,
//   },
//   infoValue: {
//     fontSize: 16,
//     color: '#333333',
//     lineHeight: 22,
//   },
//   medicalSection: {
//     backgroundColor: '#FAFAFA',
//     padding: 16,
//     borderRadius: 12,
//     marginBottom: 12,
//     borderWidth: 1,
//     borderColor: '#E8E8E8',
//   },
//   medicalHeader: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     marginBottom: 8,
//   },
//   medicalLabel: {
//     fontSize: 16,
//     fontWeight: '600',
//     color: '#333333',
//     marginLeft: 8,
//   },
//   medicalValue: {
//     fontSize: 14,
//     color: '#666666',
//     lineHeight: 20,
//   },
//   allergyText: {
//     color: '#FF9800',
//     fontWeight: '500',
//   },
//   actionButtons: {
//     marginTop: 24,
//     gap: 12,
//   },
//   saveButton: {
//     borderRadius: 12,
//   },
//   editButton: {
//     borderRadius: 12,
//     marginBottom: 16,
//   },
//   buttonContent: {
//     paddingVertical: 12,
//   },
//   cancelButton: {
//     borderRadius: 12,
//     borderColor: '#E8E8E8',
//     marginBottom: 16,
//   },
//   signOutButton: {
//     borderRadius: 12,
//     borderColor: '#FFB3B3',
//   },
// })

// export default PatientProfileScreen


import React, { useState, useEffect } from 'react'
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity, FlatList } from 'react-native'
import { Text, Button, ActivityIndicator, Searchbar, Chip, Modal, Portal } from 'react-native-paper'
import { MaterialIcons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native'
import { useAuth } from '../../contexts/AuthContext'
import { supabase, Patient } from '../../lib/supabase'
import { router } from 'expo-router'
import CleanTextInput from '~/components/input/cleanTextInput'
import { showToast } from '~/utils/toast'

// Types for access management
interface Doctor {
  id: string
  name: string
  email: string
  specialty: string
  hospital_name?: string
  verified: boolean
}

interface Organization {
  id: string
  name: string
  type: string
  location: string
  phone: string
  verified: boolean
}

interface AccessGrant {
  id: string
  doctor_id?: string
  organization_id?: string
  granted_at: string
  expires_at?: string
  permissions: string[]
  doctor?: Doctor
  organization?: Organization
}

type TabType = 'profile' | 'access'

const PatientProfileScreen: React.FC = () => {
  const { userProfile, signOut, refreshProfile } = useAuth()
  const [activeTab, setActiveTab] = useState<TabType>('profile')
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)

  // Access management states
  const [accessGrants, setAccessGrants] = useState<AccessGrant[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<(Doctor | Organization)[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedEntity, setSelectedEntity] = useState<Doctor | Organization | null>(null)
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(['view_profile'])
  const [accessLoading, setAccessLoading] = useState(false)

  const patient = userProfile as Patient

  // Editable fields
  const [phone, setPhone] = useState(patient?.phone || '')
  const [address, setAddress] = useState(patient?.address || '')
  const [emergencyContactName, setEmergencyContactName] = useState(
    patient?.emergency_contact_name || '',
  )
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(
    patient?.emergency_contact_phone || '',
  )
  const [medicalHistory, setMedicalHistory] = useState(patient?.medical_history || '')
  const [allergies, setAllergies] = useState(patient?.allergies || '')
  const [currentMedications, setCurrentMedications] = useState(
    patient?.current_medications || '',
  )

  const permissionOptions = [
    { key: 'view_profile', label: 'View Profile' },
    { key: 'view_medical_history', label: 'View Medical History' },
    { key: 'view_appointments', label: 'View Appointments' },
    { key: 'view_prescriptions', label: 'View Prescriptions' },
    { key: 'view_lab_results', label: 'View Lab Results' },
  ]

  useEffect(() => {
    if (activeTab === 'access') {
      loadAccessGrants()
    }
  }, [activeTab])

  const loadAccessGrants = async () => {
    if (!patient) return

    setAccessLoading(true)
    try {
      const { data, error } = await supabase
        .from('org_user_mapping')
        .select(`
          *,
          organization:organizations(*)
        `)
        .eq('user_id', patient.auth_user_id)


      if (error) {
        console.error('Error loading access grants:', error)
        showToast.error('Error', 'Failed to load access permissions')
      } else {
        setAccessGrants(data || [])
      }
    } catch (error) {
      console.error('Error loading access grants:', error)
      showToast.error('Error', 'An unexpected error occurred')
    } finally {
      setAccessLoading(false)
    }
  }

  const searchProviders = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }

    setSearchLoading(true)
    try {
      // Search doctors
      // const { data: doctors } = await supabase
      //   .from('doctors')
      //   .select('*')
      //   .or(`name.ilike.%${query}%, email.ilike.%${query}%, specialty.ilike.%${query}%`)
      //   .eq('verified', true)
      //   .limit(5)

      // Search organizations
      const { data: organizations } = await supabase
        .from('organizations')
        .select('*')
        .or(`name.ilike.%${query}%, address.ilike.%${query}%`)
        .limit(5)

      const results = [
        // ...(doctors || []),
        ...(organizations || [])
      ]

      setSearchResults(results)
    } catch (error) {
      console.error('Error searching providers:', error)
    } finally {
      setSearchLoading(false)
    }
  }

  const handleGrantAccess = async () => {
    if (!selectedEntity || !patient) return

    setLoading(true)
    try {

      const accessData = {
        user_id: patient.auth_user_id,
        role: 'patient',
        org_id: selectedEntity.id

      }

      const { error } = await supabase
        .from('org_user_mapping')
        .insert(accessData)

      if (error) {
        showToast.error('Error', 'Failed to grant access')
        console.error('Error granting access:', error)
      } else {
        showToast.success('Success', 'Access granted successfully')
        setShowAddModal(false)
        setSelectedEntity(null)
        setSelectedPermissions(['view_profile'])
        setSearchQuery('')
        setSearchResults([])
        await loadAccessGrants()
      }
    } catch (error) {
      showToast.error('Error', 'An unexpected error occurred')
      console.error('Error granting access:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRevokeAccess = async (accessId: string) => {

    try {
      const { error } = await supabase
        .from('org_user_mapping')
        .delete()
        .eq('id', accessId)

      if (error) {
        showToast.error('Error', 'Failed to revoke access')
        console.error('Error revoking access:', error)
      } else {
        showToast.success('Success', 'Access revoked successfully')
        await loadAccessGrants()
      }
    } catch (error) {
      showToast.error('Error', 'An unexpected error occurred')
      console.error('Error revoking access:', error)
    }

  }

  const handleSave = async () => {
    if (!patient) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from('patients')
        .update({
          phone,
          address,
          emergency_contact_name: emergencyContactName,
          emergency_contact_phone: emergencyContactPhone,
          medical_history: medicalHistory,
          allergies,
          current_medications: currentMedications,
        })
        .eq('id', patient.id)

      if (error) {
        showToast.error('Error', 'Failed to update profile')
        console.error('Error updating profile:', error)
      } else {
        showToast.success('Success', 'Profile updated successfully')
        setEditing(false)
        await refreshProfile()
      }
    } catch (error) {
      showToast.error('Error', 'An unexpected error occurred')
      console.error('Error updating profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    // Reset to original values
    setPhone(patient?.phone || '')
    setAddress(patient?.address || '')
    setEmergencyContactName(patient?.emergency_contact_name || '')
    setEmergencyContactPhone(patient?.emergency_contact_phone || '')
    setMedicalHistory(patient?.medical_history || '')
    setAllergies(patient?.allergies || '')
    setCurrentMedications(patient?.current_medications || '')
    setEditing(false)
  }

  const handleSignOut = async () => {
    await signOut()
    router.push('/auth/login')
  }

  const renderAccessItem = ({ item }: { item: AccessGrant }) => {
    const entity = item.doctor || item.organization
    const isDoctor = !!item.doctor

    return (
      <View style={styles.accessItem}>
        <View style={styles.accessItemHeader}>
          <View style={styles.accessIcon}>
            <MaterialIcons
              name={item.organization?.type === '2' ? "person" : "business"}
              size={24}
              color="#4285F4"
            />
          </View>
          <View style={styles.accessInfo}>
            <Text style={styles.accessName}>{entity?.name}</Text>
            <Text style={styles.accessSubtitle}>
              {/* {isDoctor
                ? `${(entity as Doctor)?.specialty} • ${(entity as Doctor)?.hospital_name || 'Independent'}`
                : `${(entity as Organization)?.type} • ${(entity as Organization)?.location}`
              } */}
              {item.organization?.type === '2' ? 'Doctor' : 'Hospital'}

            </Text>
            <View style={styles.permissionChips}>
              <Text>
                {item.organization?.phone}
              </Text>
              {/* {item.permissions.map((permission) => (
                <Chip
                  key={permission}
                  compact
                  style={styles.permissionChip}
                  textStyle={styles.permissionChipText}
                >
                  {permissionOptions.find(p => p.key === permission)?.label || permission}
                </Chip>
              ))} */}
            </View>
          </View>
        </View>

        <View style={styles.accessActions}>
          {/* <Text style={styles.grantedDate}>
            Granted {new Date(item.granted_at).toLocaleDateString()}
          </Text> */}
          <TouchableOpacity
            style={styles.revokeButton}
            onPress={() => handleRevokeAccess(item.id)}
          >
            <MaterialIcons name="remove-circle" size={20} color="#D32F2F" />
            <Text style={styles.revokeText}>Revoke</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  const renderSearchResult = ({ item }: { item: Doctor | Organization }) => {
    const isDoctor = 'specialty' in item

    return (
      <TouchableOpacity
        style={styles.searchResultItem}
        onPress={() => setSelectedEntity(item)}
      >
        <View style={styles.searchResultIcon}>
          <MaterialIcons
            name={isDoctor ? "person" : "business"}
            size={20}
            color="#4285F4"
          />
        </View>
        <View style={styles.searchResultInfo}>
          <Text style={styles.searchResultName}>{item.name}</Text>
          <Text style={styles.searchResultSubtitle}>
            {isDoctor
              ? `${(item as Doctor).specialty} • ${(item as Doctor).hospital_name || 'Independent'}`
              : `${(item as Organization).type} • ${(item as Organization).location}`
            }
          </Text>
        </View>
        <MaterialIcons name="chevron-right" size={20} color="#666666" />
      </TouchableOpacity>
    )
  }

  if (!patient) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4285F4" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color="#333333" />
        </TouchableOpacity>
        <Text style={styles.title}>My Profile</Text>
        {!editing && activeTab === 'profile' && (
          <TouchableOpacity
            style={styles.editIconButton}
            onPress={() => setEditing(true)}
          >
            <MaterialIcons name="edit" size={24} color="#4285F4" />
          </TouchableOpacity>
        )}
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'profile' && styles.activeTab]}
          onPress={() => setActiveTab('profile')}
        >
          <MaterialIcons
            name="person"
            size={20}
            color={activeTab === 'profile' ? '#4285F4' : '#666666'}
          />
          <Text style={[styles.tabText, activeTab === 'profile' && styles.activeTabText]}>
            Profile
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'access' && styles.activeTab]}
          onPress={() => setActiveTab('access')}
        >
          <MaterialIcons
            name="security"
            size={20}
            color={activeTab === 'access' ? '#4285F4' : '#666666'}
          />
          <Text style={[styles.tabText, activeTab === 'access' && styles.activeTabText]}>
            Access Management
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'profile' ? (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Profile Header */}
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              <MaterialIcons name="account-circle" size={80} color="#4285F4" />
            </View>
            <Text style={styles.name}>{patient.name}</Text>
            <Text style={styles.email}>{patient.email}</Text>
            <View style={styles.basicInfo}>
              <View style={styles.infoChip}>
                <Text style={styles.infoChipText}>Age {patient.age}</Text>
              </View>
              <View style={styles.infoChip}>
                <Text style={styles.infoChipText}>{patient.gender}</Text>
              </View>
            </View>
          </View>

          {/* Contact Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact Information</Text>

            {editing ? (
              <>
                <CleanTextInput
                  label="Phone Number"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  placeholder="Enter phone number"
                />
                <CleanTextInput
                  label="Address"
                  value={address}
                  onChangeText={setAddress}
                  placeholder="Enter your address"
                  multiline
                  numberOfLines={3}
                />
              </>
            ) : (
              <>
                <View style={styles.infoRow}>
                  <View style={styles.infoIcon}>
                    <MaterialIcons name="phone" size={20} color="#4285F4" />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Phone</Text>
                    <Text style={styles.infoValue}>{phone || 'Not provided'}</Text>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <View style={styles.infoIcon}>
                    <MaterialIcons name="home" size={20} color="#4285F4" />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Address</Text>
                    <Text style={styles.infoValue}>{address || 'Not provided'}</Text>
                  </View>
                </View>
              </>
            )}
          </View>

          {/* Emergency Contact */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Emergency Contact</Text>

            {editing ? (
              <>
                <CleanTextInput
                  label="Emergency Contact Name"
                  value={emergencyContactName}
                  onChangeText={setEmergencyContactName}
                  placeholder="Enter emergency contact name"
                  autoCapitalize="words"
                />
                <CleanTextInput
                  label="Emergency Contact Phone"
                  value={emergencyContactPhone}
                  onChangeText={setEmergencyContactPhone}
                  keyboardType="phone-pad"
                  placeholder="Enter emergency contact phone"
                />
              </>
            ) : (
              <>
                <View style={styles.infoRow}>
                  <View style={styles.infoIcon}>
                    <MaterialIcons name="person" size={20} color="#4285F4" />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Name</Text>
                    <Text style={styles.infoValue}>
                      {emergencyContactName || 'Not provided'}
                    </Text>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <View style={styles.infoIcon}>
                    <MaterialIcons name="phone-in-talk" size={20} color="#4285F4" />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Phone</Text>
                    <Text style={styles.infoValue}>
                      {emergencyContactPhone || 'Not provided'}
                    </Text>
                  </View>
                </View>
              </>
            )}
          </View>

          {/* Medical Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Medical Information</Text>

            {editing ? (
              <>
                <CleanTextInput
                  label="Medical History"
                  value={medicalHistory}
                  onChangeText={setMedicalHistory}
                  placeholder="Enter medical history, past conditions, surgeries, etc."
                  multiline
                  numberOfLines={4}
                />
                <CleanTextInput
                  label="Known Allergies"
                  value={allergies}
                  onChangeText={setAllergies}
                  placeholder="Enter known allergies (food, medication, environmental)"
                  multiline
                  numberOfLines={3}
                />
                <CleanTextInput
                  label="Current Medications"
                  value={currentMedications}
                  onChangeText={setCurrentMedications}
                  placeholder="List current medications with dosages"
                  multiline
                  numberOfLines={3}
                />
              </>
            ) : (
              <>
                <View style={styles.medicalSection}>
                  <View style={styles.medicalHeader}>
                    <MaterialIcons name="history" size={20} color="#4285F4" />
                    <Text style={styles.medicalLabel}>Medical History</Text>
                  </View>
                  <Text style={styles.medicalValue}>
                    {medicalHistory || 'No medical history recorded'}
                  </Text>
                </View>

                <View style={styles.medicalSection}>
                  <View style={styles.medicalHeader}>
                    <MaterialIcons name="warning" size={20} color="#FF9800" />
                    <Text style={styles.medicalLabel}>Known Allergies</Text>
                  </View>
                  <Text style={[styles.medicalValue, allergies && styles.allergyText]}>
                    {allergies || 'No known allergies'}
                  </Text>
                </View>

                <View style={styles.medicalSection}>
                  <View style={styles.medicalHeader}>
                    <MaterialIcons name="medication" size={20} color="#4CAF50" />
                    <Text style={styles.medicalLabel}>Current Medications</Text>
                  </View>
                  <Text style={styles.medicalValue}>
                    {currentMedications || 'No current medications'}
                  </Text>
                </View>
              </>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            {editing ? (
              <>
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
                <Button
                  mode="outlined"
                  onPress={handleCancel}
                  disabled={loading}
                  style={styles.cancelButton}
                  textColor="#666666"
                >
                  Cancel
                </Button>
              </>
            ) : (
              <></>
            )}

            <Button
              mode="outlined"
              onPress={handleSignOut}
              style={styles.signOutButton}
              textColor="#D32F2F"
              icon={() => <MaterialIcons name="logout" size={20} color="#D32F2F" />}
            >
              Sign Out
            </Button>
          </View>
        </ScrollView>
      ) : (
        <View style={styles.accessContent}>
          {/* Access Management Header */}
          <View style={styles.accessHeader}>
            <View style={styles.accessTitleContainer}>
              <Text style={styles.accessTitle}>Healthcare Access</Text>
              <Text style={styles.accessSubtitle}>
                Manage who can access your medical information
              </Text>
            </View>
            <Button
              mode="contained"
              onPress={() => setShowAddModal(true)}
              buttonColor="#4285F4"
              contentStyle={styles.addButtonContent}
              style={styles.addButton}
              textColor='#FFFFFF'
              icon={() => <MaterialIcons name="add" size={20} color="#FFFFFF" />}
            >
              Grant Access
            </Button>
          </View>

          {/* Access List */}
          {accessLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4285F4" />
              <Text style={styles.loadingText}>Loading access permissions...</Text>
            </View>
          ) : (
            <FlatList
              data={accessGrants}
              renderItem={renderAccessItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.accessList}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <MaterialIcons name="security" size={64} color="#CCCCCC" />
                  <Text style={styles.emptyStateTitle}>No Access Granted</Text>
                  <Text style={styles.emptyStateText}>
                    You haven't granted access to any doctors or organizations yet.
                    Tap "Grant Access" to get started.
                  </Text>
                </View>
              }
            />
          )}
        </View>
      )}

      {/* Add Access Modal */}
      <Portal>
        <Modal
          visible={showAddModal}
          onDismiss={() => {
            setShowAddModal(false)
            setSelectedEntity(null)
            setSearchQuery('')
            setSearchResults([])
            setSelectedPermissions(['view_profile'])
          }}
          contentContainerStyle={styles.modal}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Grant Access</Text>
            <TouchableOpacity
              onPress={() => {
                setShowAddModal(false)
                setSelectedEntity(null)
                setSearchQuery('')
                setSearchResults([])
                setSelectedPermissions(['view_profile'])
              }}
            >
              <MaterialIcons name="close" size={24} color="#666666" />
            </TouchableOpacity>
          </View>

          {!selectedEntity ? (
            <>


              <CleanTextInput
                label="Search patients"
                onChangeText={(query) => {
                  setSearchQuery(query)
                  searchProviders(query)
                }}
                value={searchQuery}
                style={styles.searchbar}
                placeholder="Search doctors or organizations..."
                left={
                  <MaterialIcons
                    name="search"
                    size={20}
                    color="#666666"
                    style={{ marginLeft: 12 }}
                  />
                }
                right={
                  searchQuery ? (
                    <TouchableOpacity
                      onPress={() => setSearchQuery('')}

                    >
                      <MaterialIcons name="close" size={20} color="#666666" />
                    </TouchableOpacity>
                  ) : undefined
                }
              />

              <FlatList
                data={searchResults}
                renderItem={renderSearchResult}
                keyExtractor={(item) => item.id}
                style={styles.searchResults}
                ListEmptyComponent={
                  searchQuery ? (
                    <View style={styles.emptySearch}>
                      <Text style={styles.emptySearchText}>
                        No results found for "{searchQuery}"
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.emptySearch}>
                      <Text style={styles.emptySearchText}>
                        Start typing to search for doctors or organizations
                      </Text>
                    </View>
                  )
                }
              />
            </>
          ) : (
            <ScrollView>
              <View style={styles.selectedEntity}>
                <View style={styles.selectedEntityHeader}>
                  <View style={styles.selectedEntityIcon}>
                    <MaterialIcons
                      name={'specialty' in selectedEntity ? "person" : "business"}
                      size={24}
                      color="#4285F4"
                    />
                  </View>
                  <View style={styles.selectedEntityInfo}>
                    <Text style={styles.selectedEntityName}>{selectedEntity.name}</Text>
                    <Text style={styles.selectedEntitySubtitle}>
                      {'specialty' in selectedEntity
                        ? `${selectedEntity.specialty} • ${selectedEntity.hospital_name || 'Independent'}`
                        : `${selectedEntity.type} • ${selectedEntity.location}`
                      }
                    </Text>
                  </View>
                </View>

                {/* <Text style={styles.permissionsTitle}>Select Permissions:</Text>
                <View style={styles.permissionsList}>
                  {permissionOptions.map((permission) => (
                    <TouchableOpacity
                      key={permission.key}
                      style={[
                        styles.permissionOption,
                        selectedPermissions.includes(permission.key) && styles.selectedPermissionOption
                      ]}
                      onPress={() => {
                        if (selectedPermissions.includes(permission.key)) {
                          setSelectedPermissions(prev => prev.filter(p => p !== permission.key))
                        } else {
                          setSelectedPermissions(prev => [...prev, permission.key])
                        }
                      }}
                    >
                      <MaterialIcons
                        name={selectedPermissions.includes(permission.key) ? "check-box" : "check-box-outline-blank"}
                        size={24}
                        color={selectedPermissions.includes(permission.key) ? "#4285F4" : "#666666"}
                      />
                      <Text style={[
                        styles.permissionOptionText,
                        selectedPermissions.includes(permission.key) && styles.selectedPermissionText
                      ]}>
                        {permission.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View> */}

                <View style={styles.modalActions}>
                  <Button
                    mode="outlined"
                    onPress={() => setSelectedEntity(null)}
                    style={styles.modalBackButton}
                  >
                    Back
                  </Button>
                  <Button
                    mode="contained"
                    onPress={handleGrantAccess}
                    loading={loading}
                    disabled={loading}
                    buttonColor="#4285F4"
                    style={styles.grantButton}
                  >
                    Grant Access
                  </Button>
                </View>
              </View>
            </ScrollView>
          )}
        </Modal>
      </Portal>
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
  editIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F7FF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Tab styles
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#4285F4',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666666',
    marginLeft: 8,
  },
  activeTabText: {
    color: '#4285F4',
    fontWeight: '600',
  },

  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    fontSize: 16,
    color: '#666666',
    marginTop: 16,
  },
  profileHeader: {
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 24,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F0F7FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  name: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  email: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 16,
  },
  basicInfo: {
    flexDirection: 'row',
    gap: 12,
  },
  infoChip: {
    backgroundColor: '#F0F7FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E3F2FD',
  },
  infoChipText: {
    fontSize: 14,
    color: '#4285F4',
    fontWeight: '500',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FAFAFA',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F7FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666666',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    color: '#333333',
    lineHeight: 22,
  },
  medicalSection: {
    backgroundColor: '#FAFAFA',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  medicalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  medicalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginLeft: 8,
  },
  medicalValue: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
  allergyText: {
    color: '#FF9800',
    fontWeight: '500',
  },
  actionButtons: {
    marginTop: 24,
    gap: 12,
  },
  saveButton: {
    borderRadius: 12,
  },
  editButton: {
    borderRadius: 12,
    marginBottom: 16,
  },
  buttonContent: {
    paddingVertical: 12,
  },
  cancelButton: {
    borderRadius: 12,
    borderColor: '#E8E8E8',
    marginBottom: 16,
  },
  signOutButton: {
    borderRadius: 12,
    borderColor: '#FFB3B3',
  },

  // Access Management Styles
  accessContent: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  accessHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  accessTitleContainer: {
    flex: 1,
    marginRight: 16,
  },
  accessTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  accessSubtitle: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
  addButton: {
    borderRadius: 12,
  },
  addButtonContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  accessList: {
    padding: 20,
    paddingTop: 0,
  },
  accessItem: {
    marginTop:15,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
   
    borderWidth: 1,
    borderColor: '#E8E8E8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  accessItemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  accessIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F7FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  accessInfo: {
    flex: 1,
  },
  accessName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 2,
  },
  permissionChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  permissionChip: {
    backgroundColor: '#E3F2FD',
    height: 28,
  },
  permissionChipText: {
    fontSize: 12,
    color: '#1976D2',
  },
  accessActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  grantedDate: {
    fontSize: 12,
    color: '#999999',
  },
  revokeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#FFEBEE',
  },
  revokeText: {
    fontSize: 12,
    color: '#D32F2F',
    fontWeight: '500',
    marginLeft: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    lineHeight: 20,
  },

  // Modal Styles
  modal: {
    backgroundColor: '#FFFFFF',
    margin: 20,
    borderRadius: 16,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
  },
  searchbar: {
    marginBottom: 16,
    elevation: 0,
    backgroundColor: '#F8F9FA',
  },
  searchResults: {
    maxHeight: 300,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#F8F9FA',
  },
  searchResultIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F7FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 2,
  },
  searchResultSubtitle: {
    fontSize: 12,
    color: '#666666',
  },
  emptySearch: {
    padding: 32,
    alignItems: 'center',
  },
  emptySearchText: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
  },
  selectedEntity: {
    paddingTop: 8,
  },
  selectedEntityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    marginBottom: 20,
  },
  selectedEntityIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0F7FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  selectedEntityInfo: {
    flex: 1,
  },
  selectedEntityName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  selectedEntitySubtitle: {
    fontSize: 14,
    color: '#666666',
  },
  permissionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 16,
  },
  permissionsList: {
    marginBottom: 24,
  },
  permissionOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#F8F9FA',
  },
  selectedPermissionOption: {
    backgroundColor: '#F0F7FF',
  },
  permissionOptionText: {
    fontSize: 14,
    color: '#333333',
    marginLeft: 12,
    flex: 1,
  },
  selectedPermissionText: {
    color: '#4285F4',
    fontWeight: '500',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalBackButton: {
    flex: 1,
    borderRadius: 12,
  },
  grantButton: {
    flex: 1,
    borderRadius: 12,
  },
})

export default PatientProfileScreen

