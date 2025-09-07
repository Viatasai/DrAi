
// import React, { useCallback, useEffect, useMemo, useState } from 'react';
// import { View, StyleSheet, FlatList, RefreshControl, ScrollView } from 'react-native';
// import { SafeAreaView } from 'react-native-safe-area-context';
// import { 
//   Text, 
//   Button, 
//   List, 
//   ActivityIndicator, 
//   Switch,
//   TextInput,
//   Portal,
//   Dialog,
//   RadioButton,
//   Card,
//   Chip,
//   FAB,
//   Divider
// } from 'react-native-paper';
// import { MaterialIcons } from '@expo/vector-icons';
// import { supabase } from '../../lib/supabase';

// type ViewMode = 'overview' | 'org-detail';
// type OrgTabKey = 'doctors' | 'patients' | 'org-admins';

// type Organization = {
//   id: string;
//   name: string;
//   created_at: string | null;
//   doctor_count?: number;
//   patient_count?: number;
//   admin_count?: number;
// };

// type Doctor = {
//   id: string;
//   auth_user_id: string;
//   name: string | null;
//   email: string | null;
//   phone: string | null;
//   specialization?: string | null;
//   created_at: string | null;
//   banned: boolean;
// };

// type Patient = {
//   id: string;
//   auth_user_id: string;
//   name: string | null;
//   email: string | null;
//   phone: string | null;
//   created_at: string | null;
//   banned: boolean;
// };

// type OrgAdmin = {
//   id: string;
//   auth_user_id: string;
//   name: string | null;
//   email: string | null;
//   phone: string | null;
//   created_at: string | null;
//   banned: boolean;
// };

// type OverviewStats = {
//   totalOrgs: number;
//   totalDoctors: number;
//   totalPatients: number;
//   totalAdmins: number;
// };

// const PAGE_SIZE = 20;

// export default function AdminUsersScreen() {
//   // View state
//   const [viewMode, setViewMode] = useState<ViewMode>('overview');
//   const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
//   const [activeOrgTab, setActiveOrgTab] = useState<OrgTabKey>('doctors');

//   // Overview state
//   const [overviewStats, setOverviewStats] = useState<OverviewStats>({
//     totalOrgs: 0,
//     totalDoctors: 0,
//     totalPatients: 0,
//     totalAdmins: 0
//   });
//   const [organizations, setOrganizations] = useState<Organization[]>([]);
//   const [overviewLoading, setOverviewLoading] = useState(true);
//   const [overviewRefreshing, setOverviewRefreshing] = useState(false);

//   // Org detail state
//   const [orgDoctors, setOrgDoctors] = useState<Doctor[]>([]);
//   const [orgPatients, setOrgPatients] = useState<Patient[]>([]);
//   const [orgAdmins, setOrgAdmins] = useState<OrgAdmin[]>([]);
//   const [orgDetailLoading, setOrgDetailLoading] = useState(false);
//   const [orgDetailRefreshing, setOrgDetailRefreshing] = useState(false);

//   // Modal states
//   const [createOrgModalVisible, setCreateOrgModalVisible] = useState(false);
//   const [newOrgName, setNewOrgName] = useState('');
//   const [creatingOrg, setCreatingOrg] = useState(false);

//   const [createDocModalVisible, setCreateDocModalVisible] = useState(false);
//   const [docFormData, setDocFormData] = useState({
//     name: '',
//     email: '',
//     password: '',
//     phone: '',
//     specialization: ''
//   });
//   const [creatingDoc, setCreatingDoc] = useState(false);

//   const [createAdminModalVisible, setCreateAdminModalVisible] = useState(false);
//   const [adminFormData, setAdminFormData] = useState({
//     name: '',
//     email: '',
//     password: '',
//     phone: ''
//   });
//   const [creatingAdmin, setCreatingAdmin] = useState(false);

//   const [assignDocModalVisible, setAssignDocModalVisible] = useState(false);
//   const [availableDoctors, setAvailableDoctors] = useState<Doctor[]>([]);
//   const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
//   const [assigningDocs, setAssigningDocs] = useState(false);

//   const [toggleLoading, setToggleLoading] = useState<Record<string, boolean>>({});

//   const formatWhen = (iso?: string | null) => {
//     if (!iso) return '';
//     const d = new Date(iso);
//     return d.toLocaleDateString();
//   };

//   // Fetch overview data
//   const fetchOverviewData = useCallback(async () => {
//     try {
//       // Get organizations with counts
//       const { data: orgsData, error: orgsError } = await supabase
//         .from('organizations')
//         .select(`
//           *,
//           doctor_count:org_user_mapping!inner(count),
//           patient_count:org_user_mapping!inner(count),
//           admin_count:org_user_mapping!inner(count)
//         `);

//       if (orgsError) throw orgsError;

//       // Get total stats
//       const [doctorsCount, patientsCount, adminsCount] = await Promise.all([
//         supabase.from('field_doctors').select('id', { count: 'exact', head: true }),
//         supabase.from('patients').select('id', { count: 'exact', head: true }),
//         supabase.from('org_user_mapping').select('id', { count: 'exact', head: true }).eq('role', 'org_admin')
//       ]);

//       const processedOrgs = (orgsData || []).map((org: any) => ({
//         ...org,
//         doctor_count: org.doctor_count?.[0]?.count || 0,
//         patient_count: org.patient_count?.[0]?.count || 0,
//         admin_count: org.admin_count?.[0]?.count || 0
//       })) as Organization[];

//       setOrganizations(processedOrgs);
//       setOverviewStats({
//         totalOrgs: processedOrgs.length,
//         totalDoctors: doctorsCount.count || 0,
//         totalPatients: patientsCount.count || 0,
//         totalAdmins: adminsCount.count || 0
//       });
//     } catch (error) {
//       console.error('Error fetching overview data:', error);
//     }
//   }, []);

//   // Fetch org-specific data
//   const fetchOrgData = useCallback(async (orgId: string) => {
//     if (!orgId) return;
  
//     setOrgDetailLoading(true);
//     try {
//       // Step 1: get user_ids for doctors
//       const { data: doctorMappings, error: doctorMapError } = await supabase
//         .from('org_user_mapping')
//         .select('user_id')
//         .eq('org_id', orgId)
//         .eq('role', 'doctor');
  
//       if (doctorMapError) throw doctorMapError;
  
//       // Step 2: fetch doctor details
//       let doctorDetails: any[] = [];
//       if (doctorMappings && doctorMappings.length > 0) {
//         const doctorIds = doctorMappings.map((d) => d.user_id);
//         const { data, error } = await supabase
//           .from('field_doctors')
//           .select('*')
//           .in('auth_user_id', doctorIds);
  
//         if (error) throw error;
//         doctorDetails = data ?? [];
//       }
  
//       // Step 1: get user_ids for patients
//       const { data: patientMappings, error: patientMapError } = await supabase
//         .from('org_user_mapping')
//         .select('user_id')
//         .eq('org_id', orgId)
//         .eq('role', 'patient');
  
//       if (patientMapError) throw patientMapError;
  
//       // Step 2: fetch patient details
//       let patientDetails: any[] = [];
//       if (patientMappings && patientMappings.length > 0) {
//         const patientIds = patientMappings.map((p) => p.user_id);
//         const { data, error } = await supabase
//           .from('patients')
//           .select('*')
//           .in('auth_user_id', patientIds);
  
//         if (error) throw error;
//         patientDetails = data ?? [];
//       }
  
//       // Step 1: get user_ids for admins
//       const { data: adminMappings, error: adminMapError } = await supabase
//         .from('org_user_mapping')
//         .select('user_id')
//         .eq('org_id', orgId)
//         .eq('role', 'org_admin');
  
//       if (adminMapError) throw adminMapError;
  
//       // Step 2: fetch admin details
//       let adminDetails: any[] = [];
//       if (adminMappings && adminMappings.length > 0) {
//         const adminIds = adminMappings.map((a) => a.user_id);
//         const { data, error } = await supabase
//           .from('users') // org_admins are regular users
//           .select('*')
//           .in('id', adminIds);
  
//         if (error) throw error;
//         adminDetails = data ?? [];
//       }
  
//       // Update state
//       setOrgDoctors(doctorDetails.map((doc) => ({
//         ...doc,
//         banned: doc.banned || false,
//       })));
  
//       setOrgPatients(patientDetails.map((pat) => ({
//         ...pat,
//         banned: pat.banned || false,
//       })));
  
//       setOrgAdmins(adminDetails.map((adm) => ({
//         ...adm,
//         banned: adm.banned || false,
//       })));
  
//     } catch (error) {
//       console.error('Error fetching org data:', error);
//     } finally {
//       setOrgDetailLoading(false);
//     }
//   }, []);
//   // Fetch available doctors for assignment
//   const fetchAvailableDoctors = useCallback(async () => {
//     if (!selectedOrg) return;

//     try {
//       // Get all doctors not assigned to this org
//       const { data: allDoctors, error } = await supabase
//         .from('field_doctors')
//         .select('*');

//       if (error) throw error;

//       const { data: assignedDoctors, error: assignedError } = await supabase
//         .from('org_user_mapping')
//         .select('user_id')
//         .eq('org_id', selectedOrg.id)
//         .eq('role', 'doctor');

//       if (assignedError) throw assignedError;

//       const assignedUserIds = new Set((assignedDoctors || []).map(item => item.user_id));
//       const available = (allDoctors || []).filter(doc => !assignedUserIds.has(doc.auth_user_id));

//       setAvailableDoctors(available);
//     } catch (error) {
//       console.error('Error fetching available doctors:', error);
//     }
//   }, [selectedOrg]);

//   // Initial load
//   useEffect(() => {
//     (async () => {
//       setOverviewLoading(true);
//       await fetchOverviewData();
//       setOverviewLoading(false);
//     })();
//   }, [fetchOverviewData]);

//   // Load org data when org is selected
//   useEffect(() => {
//     if (selectedOrg && viewMode === 'org-detail') {
//       fetchOrgData(selectedOrg.id);
//     }
//   }, [selectedOrg, viewMode, fetchOrgData]);

//   // Refresh handlers
//   const refreshOverview = useCallback(async () => {
//     setOverviewRefreshing(true);
//     await fetchOverviewData();
//     setOverviewRefreshing(false);
//   }, [fetchOverviewData]);

//   const refreshOrgData = useCallback(async () => {
//     if (!selectedOrg) return;
//     setOrgDetailRefreshing(true);
//     await fetchOrgData(selectedOrg.id);
//     setOrgDetailRefreshing(false);
//   }, [selectedOrg, fetchOrgData]);

//   // Action handlers
//   const createOrganization = async () => {
//     if (!newOrgName.trim()) return;
    
//     setCreatingOrg(true);
//     try {
//       const { data, error } = await supabase
//         .from('organizations')
//         .insert({ name: newOrgName.trim() })
//         .select()
//         .single();

//       if (error) throw error;
      
//       const newOrg = { ...data, doctor_count: 0, patient_count: 0, admin_count: 0 };
//       setOrganizations(prev => [...prev, newOrg]);
//       setOverviewStats(prev => ({ ...prev, totalOrgs: prev.totalOrgs + 1 }));
//       setNewOrgName('');
//       setCreateOrgModalVisible(false);
//     } catch (error) {
//       console.error('Error creating organization:', error);
//     } finally {
//       setCreatingOrg(false);
//     }
//   };

//   const createDoctor = async () => {
//     if (!selectedOrg || !docFormData.name || !docFormData.email || !docFormData.password) return;
    
//     setCreatingDoc(true);
//     try {
//       // Create user account
//       const { data: authData, error: authError } = await supabase.auth.admin.createUser({
//         email: docFormData.email,
//         password: docFormData.password,
//         email_confirm: true,
//         user_metadata: {
//           name: docFormData.name,
//           role: 'doctor'
//         }
//       });

//       if (authError) throw authError;

//       // Create doctor profile
//       const { error: profileError } = await supabase
//         .from('field_doctors')
//         .insert({
//           auth_user_id: authData.user.id,
//           name: docFormData.name,
//           email: docFormData.email,
//           phone: docFormData.phone || null,
//           specialization: docFormData.specialization || null
//         });

//       if (profileError) throw profileError;

//       // Assign to organization
//       const { error: mappingError } = await supabase
//         .from('org_user_mapping')
//         .insert({
//           org_id: selectedOrg.id,
//           user_id: authData.user.id,
//           role: 'doctor'
//         });

//       if (mappingError) throw mappingError;
      
//       // Reset and refresh
//       setDocFormData({ name: '', email: '', password: '', phone: '', specialization: '' });
//       setCreateDocModalVisible(false);
//       await fetchOrgData(selectedOrg.id);
//       await fetchOverviewData();
//     } catch (error) {
//       console.error('Error creating doctor:', error);
//     } finally {
//       setCreatingDoc(false);
//     }
//   };

//   const createOrgAdmin = async () => {
//     if (!selectedOrg || !adminFormData.name || !adminFormData.email || !adminFormData.password) return;
    
//     setCreatingAdmin(true);
//     try {
//       // Create user account
//       const { data: authData, error: authError } = await supabase.auth.admin.createUser({
//         email: adminFormData.email,
//         password: adminFormData.password,
//         email_confirm: true,
//         user_metadata: {
//           name: adminFormData.name,
//           role: 'org_admin'
//         }
//       });

//       if (authError) throw authError;

//       // Create user profile
//       const { error: profileError } = await supabase
//         .from('users')
//         .insert({
//           auth_user_id: authData.user.id,
//           name: adminFormData.name,
//           email: adminFormData.email,
//           phone: adminFormData.phone || null,
//           role: 'org_admin'
//         });

//       if (profileError) throw profileError;

//       // Assign to organization
//       const { error: mappingError } = await supabase
//         .from('org_user_mapping')
//         .insert({
//           org_id: selectedOrg.id,
//           user_id: authData.user.id,
//           role: 'org_admin'
//         });

//       if (mappingError) throw mappingError;
      
//       // Reset and refresh
//       setAdminFormData({ name: '', email: '', password: '', phone: '' });
//       setCreateAdminModalVisible(false);
//       await fetchOrgData(selectedOrg.id);
//       await fetchOverviewData();
//     } catch (error) {
//       console.error('Error creating org admin:', error);
//     } finally {
//       setCreatingAdmin(false);
//     }
//   };

//   const assignDoctorsToOrg = async () => {
//     if (!selectedOrg || selectedDocIds.size === 0) return;
    
//     setAssigningDocs(true);
//     try {
//       const mappings = Array.from(selectedDocIds).map(docId => ({
//         org_id: selectedOrg.id,
//         user_id: docId,
//         role: 'doctor'
//       }));

//       const { error } = await supabase
//         .from('org_user_mapping')
//         .insert(mappings);

//       if (error) throw error;

//       setSelectedDocIds(new Set());
//       setAssignDocModalVisible(false);
//       await fetchOrgData(selectedOrg.id);
//       await fetchOverviewData();
//     } catch (error) {
//       console.error('Error assigning doctors:', error);
//     } finally {
//       setAssigningDocs(false);
//     }
//   };

//   const toggleBan = async (authUserId: string, currentBanStatus: boolean) => {
//     if (toggleLoading[authUserId]) return;

//     try {
//       setToggleLoading(prev => ({ ...prev, [authUserId]: true }));
      
//       const { error } = await supabase.rpc('toggle_user_ban', {
//         uid: authUserId,
//         ban: !currentBanStatus,
//       });
      
//       if (error) throw error;

//       // Update local state
//       if (activeOrgTab === 'doctors') {
//         setOrgDoctors(prev =>
//           prev.map(u => (u.auth_user_id === authUserId ? { ...u, banned: !currentBanStatus } : u))
//         );
//       } else if (activeOrgTab === 'patients') {
//         setOrgPatients(prev =>
//           prev.map(u => (u.auth_user_id === authUserId ? { ...u, banned: !currentBanStatus } : u))
//         );
//       } else if (activeOrgTab === 'org-admins') {
//         setOrgAdmins(prev =>
//           prev.map(u => (u.auth_user_id === authUserId ? { ...u, banned: !currentBanStatus } : u))
//         );
//       }
//     } catch (err) {
//       console.error('Failed to toggle ban', err);
//     } finally {
//       setToggleLoading(prev => ({ ...prev, [authUserId]: false }));
//     }
//   };

//   // Overview Header
//   const OverviewHeader = useMemo(() => (
//     <View style={styles.overviewHeader}>
//       <View style={styles.headerRow}>
//         <MaterialIcons name="dashboard" size={49} color="#4C51BF" />
//         <View style={styles.headerTextWrap}>
//           <Text style={styles.headerTitle}>Admin Dashboard</Text>
//           <Text style={styles.headerSub}>Manage organizations and users</Text>
//         </View>
//       </View>
//     </View>
//   ), []);

//   // Org Detail Header
//   const OrgDetailHeader = useMemo(() => (
//     <View style={styles.orgDetailHeader}>
//       <View style={styles.orgHeaderTop}>
//         <Button
//           mode="outlined"
//           onPress={() => setViewMode('overview')}
//           icon="arrow-left"
//           style={styles.backBtn}
//         >
//           Back
//         </Button>
//         <View style={styles.orgTitleWrap}>
//           <Text style={styles.orgTitle}>{selectedOrg?.name}</Text>
//           <Text style={styles.orgSub}>Organization Management</Text>
//         </View>
//       </View>

//       <View style={styles.orgTabs}>
//         {(['doctors', 'patients', 'org-admins'] as OrgTabKey[]).map((tab) => (
//           <Button
//             key={tab}
//             mode={activeOrgTab === tab ? 'contained' : 'outlined'}
//             onPress={() => setActiveOrgTab(tab)}
//             buttonColor={activeOrgTab === tab ? '#4C51BF' : 'white'}
//             textColor={activeOrgTab === tab ? 'white' : '#4C51BF'}
//             style={styles.orgTabBtn}
//           >
//             {tab === 'doctors' ? 'Doctors' : tab === 'patients' ? 'Patients' : 'Admins'}
//           </Button>
//         ))}
//       </View>
//     </View>
//   ), [selectedOrg, activeOrgTab]);

//   // Overview Cards
//   const renderOverviewCards = () => (
//     <View style={styles.cardsContainer}>
//       <View style={styles.cardRow}>
//         <Card style={[styles.statCard, styles.orgsCard]}>
//           <Card.Content>
//             <View style={styles.cardContent}>
//               <MaterialIcons name="business" size={32} color="#4C51BF" />
//               <Text style={styles.statNumber}>{overviewStats.totalOrgs}</Text>
//               <Text style={styles.statLabel}>Organizations</Text>
//             </View>
//           </Card.Content>
//         </Card>

//         <Card style={[styles.statCard, styles.doctorsCard]}>
//           <Card.Content>
//             <View style={styles.cardContent}>
//               <MaterialIcons name="medical-services" size={32} color="#10B981" />
//               <Text style={styles.statNumber}>{overviewStats.totalDoctors}</Text>
//               <Text style={styles.statLabel}>Doctors</Text>
//             </View>
//           </Card.Content>
//         </Card>
//       </View>

//       <View style={styles.cardRow}>
//         <Card style={[styles.statCard, styles.patientsCard]}>
//           <Card.Content>
//             <View style={styles.cardContent}>
//               <MaterialIcons name="people-alt" size={32} color="#F59E0B" />
//               <Text style={styles.statNumber}>{overviewStats.totalPatients}</Text>
//               <Text style={styles.statLabel}>Patients</Text>
//             </View>
//           </Card.Content>
//         </Card>

//         <Card style={[styles.statCard, styles.adminsCard]}>
//           <Card.Content>
//             <View style={styles.cardContent}>
//               <MaterialIcons name="admin-panel-settings" size={32} color="#EF4444" />
//               <Text style={styles.statNumber}>{overviewStats.totalAdmins}</Text>
//               <Text style={styles.statLabel}>Org Admins</Text>
//             </View>
//           </Card.Content>
//         </Card>
//       </View>
//     </View>
//   );

//   // Organization List
//   const renderOrgItem = ({ item }: { item: Organization }) => (
//     <Card style={styles.orgCard} onPress={() => {
//       setSelectedOrg(item);
//       setViewMode('org-detail');
//     }}>
//       <Card.Content>
//         <View style={styles.orgCardContent}>
//           <View style={styles.orgCardLeft}>
//             <MaterialIcons name="business" size={24} color="#4C51BF" />
//             <View style={styles.orgCardText}>
//               <Text style={styles.orgCardTitle}>{item.name}</Text>
//               <Text style={styles.orgCardDate}>Created {formatWhen(item.created_at)}</Text>
//             </View>
//           </View>
//           <View style={styles.orgCardStats}>
//             <Chip compact style={styles.orgChip}>{item.doctor_count || 0} Docs</Chip>
//             <Chip compact style={styles.orgChip}>{item.patient_count || 0} Patients</Chip>
//             <Chip compact style={styles.orgChip}>{item.admin_count || 0} Admins</Chip>
//           </View>
//         </View>
//       </Card.Content>
//     </Card>
//   );

//   // User list items
//   const renderDoctorItem = ({ item }: { item: Doctor }) => (
//     <List.Item
//       title={item.name || 'Unnamed'}
//       description={[
//         item.email || '—',
//         item.phone ? ` • ${item.phone}` : '',
//         item.specialization ? ` • ${item.specialization}` : ''
//       ].join('')}
//       left={() => <MaterialIcons name="medical-services" size={20} color="#555" style={styles.leftIcon} />}
//       right={() => (
//         <View style={styles.userItemRight}>
//           <Text style={styles.metaText}>{formatWhen(item.created_at)}</Text>
//           <View style={styles.banToggleContainer}>
//             <Text style={[styles.banLabel, item.banned && styles.banLabelActive]}>
//               {item.banned ? 'Banned' : 'Active'}
//             </Text>
//             <Switch
//               value={item.banned}
//               trackColor={{ false: '#767577', true: '#4C51BF' }}
//               thumbColor="white"
//               onValueChange={() => toggleBan(item.auth_user_id, item.banned)}
//               disabled={toggleLoading[item.auth_user_id]}
//               style={styles.banSwitch}
//             />
//           </View>
//         </View>
//       )}
//     />
//   );

//   const renderPatientItem = ({ item }: { item: Patient }) => (
//     <List.Item
//       title={item.name || 'Unnamed'}
//       description={[
//         item.email || '—',
//         item.phone ? ` • ${item.phone}` : ''
//       ].join('')}
//       left={() => <MaterialIcons name="person" size={20} color="#555" style={styles.leftIcon} />}
//       right={() => (
//         <View style={styles.userItemRight}>
//           <Text style={styles.metaText}>{formatWhen(item.created_at)}</Text>
//           <View style={styles.banToggleContainer}>
//             <Text style={[styles.banLabel, item.banned && styles.banLabelActive]}>
//               {item.banned ? 'Banned' : 'Active'}
//             </Text>
//             <Switch
//               value={item.banned}
//               trackColor={{ false: '#767577', true: '#4C51BF' }}
//               thumbColor="white"
//               onValueChange={() => toggleBan(item.auth_user_id, item.banned)}
//               disabled={toggleLoading[item.auth_user_id]}
//               style={styles.banSwitch}
//             />
//           </View>
//         </View>
//       )}
//     />
//   );

//   const renderAdminItem = ({ item }: { item: OrgAdmin }) => (
//     <List.Item
//       title={item.name || 'Unnamed'}
//       description={[
//         item.email || '—',
//         item.phone ? ` • ${item.phone}` : ''
//       ].join('')}
//       left={() => <MaterialIcons name="admin-panel-settings" size={20} color="#555" style={styles.leftIcon} />}
//       right={() => (
//         <View style={styles.userItemRight}>
//           <Text style={styles.metaText}>{formatWhen(item.created_at)}</Text>
//           <View style={styles.banToggleContainer}>
//             <Text style={[styles.banLabel, item.banned && styles.banLabelActive]}>
//               {item.banned ? 'Banned' : 'Active'}
//             </Text>
//             <Switch
//               value={item.banned}
//               trackColor={{ false: '#767577', true: '#4C51BF' }}
//               thumbColor="white"
//               onValueChange={() => toggleBan(item.auth_user_id, item.banned)}
//               disabled={toggleLoading[item.auth_user_id]}
//               style={styles.banSwitch}
//             />
//           </View>
//         </View>
//       )}
//     />
//   );

//   const renderAvailableDocItem = ({ item }: { item: Doctor }) => (
//     <List.Item
//       title={item.name || 'Unnamed'}
//       description={[
//         item.email || '—',
//         item.specialization ? ` • ${item.specialization}` : ''
//       ].join('')}
//       left={() => (
//         <Button
//           mode={selectedDocIds.has(item.auth_user_id) ? 'contained' : 'outlined'}
//           compact
//           onPress={() => {
//             setSelectedDocIds(prev => {
//               const newSet = new Set(prev);
//               if (newSet.has(item.auth_user_id)) {
//                 newSet.delete(item.auth_user_id);
//               } else {
//                 newSet.add(item.auth_user_id);
//               }
//               return newSet;
//             });
//           }}
//         >
//           {selectedDocIds.has(item.auth_user_id) ? 'Selected' : 'Select'}
//         </Button>
//       )}
//     />
//   );

//   // Get current data based on active tab
//   const getCurrentData = () => {
//     switch (activeOrgTab) {
//       case 'doctors': return orgDoctors;
//       case 'patients': return orgPatients;
//       case 'org-admins': return orgAdmins;
//       default: return [];
//     }
//   };

//   const getCurrentRenderer = () => {
//     switch (activeOrgTab) {
//       case 'doctors': return renderDoctorItem;
//       case 'patients': return renderPatientItem;
//       case 'org-admins': return renderAdminItem;
//       default: return renderDoctorItem;
//     }
//   };

//   if (viewMode === 'overview') {
//     return (
//       <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
//         <ScrollView
//           refreshControl={<RefreshControl refreshing={overviewRefreshing} onRefresh={refreshOverview} />}
//           contentContainerStyle={styles.overviewContent}
//         >
//           {OverviewHeader}
          
//           {overviewLoading ? (
//             <ActivityIndicator style={styles.loader} size="large" />
//           ) : (
//             <>
//               {renderOverviewCards()}
              
//               <Text style={styles.sectionTitle}>Organizations</Text>
              
//               {organizations.map(org => (
//                 <View key={org.id}>
//                   {renderOrgItem({ item: org })}
//                 </View>
//               ))}
//             </>
//           )}
//         </ScrollView>

//         <FAB
//           icon="plus"
//           style={styles.fab}
//           onPress={() => setCreateOrgModalVisible(true)}
//           label="New Org"
//         />

//         {/* Create Organization Modal */}
//         <Portal>
//           <Dialog visible={createOrgModalVisible} onDismiss={() => setCreateOrgModalVisible(false)}>
//             <Dialog.Title>Create Organization</Dialog.Title>
//             <Dialog.Content>
//               <TextInput
//                 mode="outlined"
//                 label="Organization Name"
//                 value={newOrgName}
//                 onChangeText={setNewOrgName}
//                 style={styles.formInput}
//               />
//             </Dialog.Content>
//             <Dialog.Actions>
//               <Button onPress={() => setCreateOrgModalVisible(false)}>Cancel</Button>
//               <Button 
//                 onPress={createOrganization}
//                 disabled={!newOrgName.trim() || creatingOrg}
//                 loading={creatingOrg}
//                 mode="contained"
//               >
//                 Create
//               </Button>
//             </Dialog.Actions>
//           </Dialog>
//         </Portal>
//       </SafeAreaView>
//     );
//   }

//   // Org Detail View
//   return (
//     <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
//       <FlatList
//         data={getCurrentData()}
//         keyExtractor={(item) => item.id}
//         renderItem={getCurrentRenderer()}
//         contentContainerStyle={styles.listContent}
//         ItemSeparatorComponent={() => <View style={styles.sep} />}
//         ListHeaderComponent={OrgDetailHeader}
//         ListHeaderComponentStyle={styles.headerShim}
//         stickyHeaderIndices={[0]}
//         refreshControl={<RefreshControl refreshing={orgDetailRefreshing} onRefresh={refreshOrgData} />}
//         ListEmptyComponent={
//           orgDetailLoading ? (
//             <ActivityIndicator style={styles.loader} />
//           ) : (
//             <View style={styles.emptyState}>
//               <Text style={styles.emptyText}>
//                 No {activeOrgTab === 'doctors' ? 'doctors' : activeOrgTab === 'patients' ? 'patients' : 'admins'} found
//               </Text>
//             </View>
//           )
//         }
//       />

//       {/* Floating Action Buttons */}
//       <View style={styles.fabContainer}>
//         {activeOrgTab === 'doctors' && (
//           <>
//             <FAB
//               icon="plus"
//               style={[styles.fab, styles.fabSecondary]}
//               small
//               onPress={() => setCreateDocModalVisible(true)}
//               label="New Doctor"
//             />
//             <FAB
//               icon="account-multiple-plus"
//               style={[styles.fab, styles.fabPrimary]}
//               small
//               onPress={() => {
//                 fetchAvailableDoctors();
//                 setAssignDocModalVisible(true);
//               }}
//               label="Assign Existing"
//             />
//           </>
//         )}
        
//         {activeOrgTab === 'org-admins' && (
//           <FAB
//             icon="shield-account"
//             style={[styles.fab, styles.fabPrimary]}
//             onPress={() => setCreateAdminModalVisible(true)}
//             label="New Admin"
//           />
//         )}
//       </View>

//       {/* Create Doctor Modal */}
//       <Portal>
//         <Dialog 
//           visible={createDocModalVisible} 
//           onDismiss={() => setCreateDocModalVisible(false)}
//           style={styles.modal}
//         >
//           <Dialog.Title>Create New Doctor</Dialog.Title>
//           <Dialog.Content>
//             <TextInput
//               mode="outlined"
//               label="Full Name *"
//               value={docFormData.name}
//               onChangeText={(text) => setDocFormData(prev => ({ ...prev, name: text }))}
//               style={styles.formInput}
//             />
//             <TextInput
//               mode="outlined"
//               label="Email *"
//               value={docFormData.email}
//               onChangeText={(text) => setDocFormData(prev => ({ ...prev, email: text }))}
//               keyboardType="email-address"
//               autoCapitalize="none"
//               style={styles.formInput}
//             />
//             <TextInput
//               mode="outlined"
//               label="Password *"
//               value={docFormData.password}
//               onChangeText={(text) => setDocFormData(prev => ({ ...prev, password: text }))}
//               secureTextEntry
//               style={styles.formInput}
//             />
//             <TextInput
//               mode="outlined"
//               label="Phone Number"
//               value={docFormData.phone}
//               onChangeText={(text) => setDocFormData(prev => ({ ...prev, phone: text }))}
//               keyboardType="phone-pad"
//               style={styles.formInput}
//             />
//             <TextInput
//               mode="outlined"
//               label="Specialization"
//               value={docFormData.specialization}
//               onChangeText={(text) => setDocFormData(prev => ({ ...prev, specialization: text }))}
//               style={styles.formInput}
//             />
//           </Dialog.Content>
//           <Dialog.Actions>
//             <Button onPress={() => setCreateDocModalVisible(false)}>Cancel</Button>
//             <Button 
//               onPress={createDoctor}
//               disabled={!docFormData.name || !docFormData.email || !docFormData.password || creatingDoc}
//               loading={creatingDoc}
//               mode="contained"
//             >
//               Create Doctor
//             </Button>
//           </Dialog.Actions>
//         </Dialog>
//       </Portal>

//       {/* Create Admin Modal */}
//       <Portal>
//         <Dialog 
//           visible={createAdminModalVisible} 
//           onDismiss={() => setCreateAdminModalVisible(false)}
//           style={styles.modal}
//         >
//           <Dialog.Title>Create Organization Admin</Dialog.Title>
//           <Dialog.Content>
//             <TextInput
//               mode="outlined"
//               label="Full Name *"
//               value={adminFormData.name}
//               onChangeText={(text) => setAdminFormData(prev => ({ ...prev, name: text }))}
//               style={styles.formInput}
//             />
//             <TextInput
//               mode="outlined"
//               label="Email *"
//               value={adminFormData.email}
//               onChangeText={(text) => setAdminFormData(prev => ({ ...prev, email: text }))}
//               keyboardType="email-address"
//               autoCapitalize="none"
//               style={styles.formInput}
//             />
//             <TextInput
//               mode="outlined"
//               label="Password *"
//               value={adminFormData.password}
//               onChangeText={(text) => setAdminFormData(prev => ({ ...prev, password: text }))}
//               secureTextEntry
//               style={styles.formInput}
//             />
//             <TextInput
//               mode="outlined"
//               label="Phone Number"
//               value={adminFormData.phone}
//               onChangeText={(text) => setAdminFormData(prev => ({ ...prev, phone: text }))}
//               keyboardType="phone-pad"
//               style={styles.formInput}
//             />
//           </Dialog.Content>
//           <Dialog.Actions>
//             <Button onPress={() => setCreateAdminModalVisible(false)}>Cancel</Button>
//             <Button 
//               onPress={createOrgAdmin}
//               disabled={!adminFormData.name || !adminFormData.email || !adminFormData.password || creatingAdmin}
//               loading={creatingAdmin}
//               mode="contained"
//             >
//               Create Admin
//             </Button>
//           </Dialog.Actions>
//         </Dialog>
//       </Portal>

//       {/* Assign Existing Doctors Modal */}
//       <Portal>
//         <Dialog 
//           visible={assignDocModalVisible} 
//           onDismiss={() => setAssignDocModalVisible(false)}
//           style={styles.largeModal}
//         >
//           <Dialog.Title>Assign Existing Doctors</Dialog.Title>
//           <Dialog.Content>
//             <Text style={styles.modalSubtext}>
//               Select doctors to assign to {selectedOrg?.name}:
//             </Text>
//             <FlatList
//               data={availableDoctors}
//               keyExtractor={(item) => item.id}
//               renderItem={renderAvailableDocItem}
//               style={styles.modalList}
//               ItemSeparatorComponent={() => <Divider />}
//               ListEmptyComponent={
//                 <View style={styles.emptyState}>
//                   <Text style={styles.emptyText}>No available doctors to assign</Text>
//                 </View>
//               }
//             />
//             <Text style={styles.selectionCount}>
//               {selectedDocIds.size} doctor{selectedDocIds.size !== 1 ? 's' : ''} selected
//             </Text>
//           </Dialog.Content>
//           <Dialog.Actions>
//             <Button onPress={() => setAssignDocModalVisible(false)}>Cancel</Button>
//             <Button 
//               onPress={assignDoctorsToOrg}
//               disabled={selectedDocIds.size === 0 || assigningDocs}
//               loading={assigningDocs}
//               mode="contained"
//             >
//               Assign {selectedDocIds.size > 0 ? `(${selectedDocIds.size})` : ''}
//             </Button>
//           </Dialog.Actions>
//         </Dialog>
//       </Portal>
//     </SafeAreaView>
//   );
// }

// const styles = StyleSheet.create({
//   container: { 
//     flex: 1, 
//     backgroundColor: '#f5f5f5' 
//   },

//   // Overview styles
//   overviewContent: {
//     paddingBottom: 100,
//   },

//   overviewHeader: {
//     backgroundColor: '#fff',
//     paddingHorizontal: 16,
//     paddingVertical: 16,
//     borderBottomWidth: StyleSheet.hairlineWidth,
//     borderBottomColor: '#e5e5e5',
//   },

//   headerRow: { 
//     flexDirection: 'row', 
//     alignItems: 'center' 
//   },

//   headerTextWrap: { 
//     marginLeft: 12, 
//     flex: 1 
//   },

//   headerTitle: { 
//     fontSize: 20, 
//     fontWeight: 'bold',
//     color: '#1f2937'
//   },

//   headerSub: { 
//     color: '#6b7280', 
//     marginTop: 2,
//     fontSize: 14
//   },

//   // Cards styles
//   cardsContainer: {
//     paddingHorizontal: 16,
//     paddingVertical: 20,
//   },

//   cardRow: {
//     flexDirection: 'row',
//     marginBottom: 16,
//     gap: 12,
//   },

//   statCard: {
//     flex: 1,
//     elevation: 2,
//   },

//   orgsCard: {
//     borderLeftWidth: 4,
//     borderLeftColor: '#4C51BF',
//   },

//   doctorsCard: {
//     borderLeftWidth: 4,
//     borderLeftColor: '#10B981',
//   },

//   patientsCard: {
//     borderLeftWidth: 4,
//     borderLeftColor: '#F59E0B',
//   },

//   adminsCard: {
//     borderLeftWidth: 4,
//     borderLeftColor: '#EF4444',
//   },

//   cardContent: {
//     alignItems: 'center',
//     paddingVertical: 8,
//   },

//   statNumber: {
//     fontSize: 28,
//     fontWeight: 'bold',
//     marginTop: 8,
//     color: '#1f2937',
//   },

//   statLabel: {
//     fontSize: 12,
//     color: '#6b7280',
//     marginTop: 4,
//     textAlign: 'center',
//   },

//   sectionTitle: {
//     fontSize: 18,
//     fontWeight: '600',
//     color: '#1f2937',
//     marginHorizontal: 16,
//     marginBottom: 16,
//     marginTop: 8,
//   },

//   // Organization card styles
//   orgCard: {
//     marginHorizontal: 16,
//     marginBottom: 12,
//     elevation: 2,
//   },

//   orgCardContent: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//   },

//   orgCardLeft: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     flex: 1,
//   },

//   orgCardText: {
//     marginLeft: 12,
//     flex: 1,
//   },

//   orgCardTitle: {
//     fontSize: 16,
//     fontWeight: '600',
//     color: '#1f2937',
//   },

//   orgCardDate: {
//     fontSize: 12,
//     color: '#6b7280',
//     marginTop: 2,
//   },

//   orgCardStats: {
//     alignItems: 'flex-end',
//   },

//   orgChip: {
//     marginBottom: 4,
//     backgroundColor: '#f3f4f6',
//   },

//   // Org detail styles
//   listContent: { 
//     paddingBottom: 16 
//   },

//   headerShim: { 
//     marginTop: -6 
//   },

//   orgDetailHeader: {
//     backgroundColor: '#fff',
//     paddingHorizontal: 16,
//     paddingTop: 4,
//     paddingBottom: 12,
//     borderBottomWidth: StyleSheet.hairlineWidth,
//     borderBottomColor: '#e5e5e5',
//   },

//   orgHeaderTop: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     marginBottom: 16,
//   },

//   backBtn: {
//     marginRight: 12,
//   },

//   orgTitleWrap: {
//     flex: 1,
//   },

//   orgTitle: {
//     fontSize: 18,
//     fontWeight: 'bold',
//     color: '#1f2937',
//   },

//   orgSub: {
//     fontSize: 12,
//     color: '#6b7280',
//     marginTop: 2,
//   },

//   orgTabs: {
//     flexDirection: 'row',
//     gap: 8,
//   },

//   orgTabBtn: {
//     flex: 1,
//   },

//   // User item styles
//   leftIcon: { 
//     marginRight: 8, 
//     marginTop: 2 
//   },

//   userItemRight: {
//     alignItems: 'flex-end',
//     justifyContent: 'center',
//   },

//   metaText: { 
//     color: '#6b7280', 
//     fontSize: 11,
//     marginBottom: 4,
//   },

//   banToggleContainer: {
//     flexDirection: 'row',
//     alignItems: 'center',
//   },

//   banLabel: {
//     fontSize: 10,
//     color: '#10B981',
//     fontWeight: '500',
//     marginRight: 6,
//     minWidth: 35,
//     textAlign: 'right',
//   },

//   banLabelActive: {
//     color: '#EF4444',
//   },

//   banSwitch: {
//     transform: [{ scaleX: 0.7 }, { scaleY: 0.7 }],
//   },

//   sep: { 
//     height: StyleSheet.hairlineWidth, 
//     backgroundColor: '#e5e5e5' 
//   },

//   // FAB styles
//   fabContainer: {
//     position: 'absolute',
//     bottom: 16,
//     right: 16,
//     flexDirection: 'column-reverse',
//     alignItems: 'flex-end',
//     gap: 8,
//   },

//   fab: {
//     backgroundColor: '#4C51BF',
//   },

//   fabPrimary: {
//     backgroundColor: '#4C51BF',
//   },

//   fabSecondary: {
//     backgroundColor: '#10B981',
//   },

//   // Modal styles
//   modal: {
//     maxHeight: '80%',
//   },

//   largeModal: {
//     maxHeight: '90%',
//     marginHorizontal: 20,
//   },

//   formInput: {
//     marginBottom: 12,
//   },

//   modalSubtext: {
//     fontSize: 14,
//     color: '#6b7280',
//     marginBottom: 16,
//   },

//   modalList: {
//     maxHeight: 300,
//     marginBottom: 16,
//   },

//   selectionCount: {
//     fontSize: 12,
//     color: '#4C51BF',
//     fontWeight: '500',
//     textAlign: 'center',
//   },

//   // Empty states
//   emptyState: {
//     paddingVertical: 40,
//     alignItems: 'center',
//   },

//   emptyText: {
//     fontSize: 14,
//     color: '#6b7280',
//     textAlign: 'center',
//   },

//   loader: {
//     marginTop: 40,
//   },
// });

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  Text, 
  Button, 
  List, 
  ActivityIndicator, 
  Switch,
  TextInput,
  Portal,
  Dialog,
  RadioButton,
  Card,
  Chip,
  FAB,
  Divider
} from 'react-native-paper';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';

type ViewMode = 'overview' | 'org-detail';
type OrgTabKey = 'doctors' | 'patients' | 'org-admins';

type Organization = {
  id: string;
  name: string;
  created_at: string | null;
  doctor_count?: number;
  patient_count?: number;
  admin_count?: number;
};

type Doctor = {
  id: string;
  auth_user_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  specialization?: string | null;
  created_at: string | null;
  banned: boolean;
};

type Patient = {
  id: string;
  auth_user_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string | null;
  banned: boolean;
};

type OrgAdmin = {
  id: string;
  auth_user_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string | null;
  banned: boolean;
};

type OverviewStats = {
  totalOrgs: number;
  totalDoctors: number;
  totalPatients: number;
  totalAdmins: number;
};

const PAGE_SIZE = 20;

export default function AdminUsersScreen() {
  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [activeOrgTab, setActiveOrgTab] = useState<OrgTabKey>('doctors');

  // Overview state
  const [overviewStats, setOverviewStats] = useState<OverviewStats>({
    totalOrgs: 0,
    totalDoctors: 0,
    totalPatients: 0,
    totalAdmins: 0
  });
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewRefreshing, setOverviewRefreshing] = useState(false);

  // Org detail state
  const [orgDoctors, setOrgDoctors] = useState<Doctor[]>([]);
  const [orgPatients, setOrgPatients] = useState<Patient[]>([]);
  const [orgAdmins, setOrgAdmins] = useState<OrgAdmin[]>([]);
  const [orgDetailLoading, setOrgDetailLoading] = useState(false);
  const [orgDetailRefreshing, setOrgDetailRefreshing] = useState(false);

  // Modal states
  const [createOrgModalVisible, setCreateOrgModalVisible] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [creatingOrg, setCreatingOrg] = useState(false);

  const [createDocModalVisible, setCreateDocModalVisible] = useState(false);
  const [docFormData, setDocFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    specialization: '',
    licenseNumber: '',
    yearsOfExperience: 0
  });
  const [creatingDoc, setCreatingDoc] = useState(false);

  const [createAdminModalVisible, setCreateAdminModalVisible] = useState(false);
  const [adminFormData, setAdminFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: ''
  });
  const [creatingAdmin, setCreatingAdmin] = useState(false);

  const [assignDocModalVisible, setAssignDocModalVisible] = useState(false);
  const [availableDoctors, setAvailableDoctors] = useState<Doctor[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [assigningDocs, setAssigningDocs] = useState(false);

  const [toggleLoading, setToggleLoading] = useState<Record<string, boolean>>({});

  const formatWhen = (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString();
  };

  // Call the edge function to create user
  const callCreateUserFunction = async (userData: any, orgId?: string) => {
    const { data, error } = await supabase.functions.invoke('create-user', {
      body: {
        email: userData.email,
        password: userData.password,
        userData: userData,
        orgId: orgId
      }
    });

    if (error) throw error;
    return data;
  };

  // Fetch overview data
  const fetchOverviewData = useCallback(async () => {
    try {
      // Step 1: Fetch all orgs
      const { data: orgsData, error: orgsError } = await supabase
        .from('organizations')
        .select('*');
  
      if (orgsError) throw orgsError;
  
      // Step 2: Fetch mappings for all orgs
      const { data: mappings, error: mappingsError } = await supabase
        .from('org_user_mapping')
        .select('org_id, role, user_id');
  
      if (mappingsError) throw mappingsError;
  
      // Step 3: Count by role for each org
      const orgCounts: Record<string, { doctors: number; patients: number; admins: number }> = {};
  
      for (const map of mappings || []) {
        if (!orgCounts[map.org_id]) {
          orgCounts[map.org_id] = { doctors: 0, patients: 0, admins: 0 };
        }
        if (map.role === 'doctor') orgCounts[map.org_id].doctors += 1;
        if (map.role === 'patient') orgCounts[map.org_id].patients += 1;
        if (map.role === 'org_admin') orgCounts[map.org_id].admins += 1;
      }
  
      // Step 4: Attach counts to orgs
      const processedOrgs = (orgsData || []).map((org: any) => ({
        ...org,
        doctor_count: orgCounts[org.id]?.doctors || 0,
        patient_count: orgCounts[org.id]?.patients || 0,
        admin_count: orgCounts[org.id]?.admins || 0
      }));
  
      // Step 5: Fetch total stats
      const [doctorsCount, patientsCount, adminsCount] = await Promise.all([
        supabase.from('field_doctors').select('id', { count: 'exact', head: true }),
        supabase.from('patients').select('id', { count: 'exact', head: true }),
        supabase.from('org_user_mapping').select('id', { count: 'exact', head: true }).eq('role', 'org_admin')
      ]);
  
      setOrganizations(processedOrgs);
      setOverviewStats({
        totalOrgs: processedOrgs.length,
        totalDoctors: doctorsCount.count || 0,
        totalPatients: patientsCount.count || 0,
        totalAdmins: adminsCount.count || 0
      });
    } catch (error) {
      console.error('Error fetching overview data:', error);
    }
  }, []);
  // Fetch org-specific data
  const fetchOrgData = useCallback(async (orgId: string) => {
    if (!orgId) return;
  
    setOrgDetailLoading(true);
    try {
      // Step 1: get user_ids for doctors
      const { data: doctorMappings, error: doctorMapError } = await supabase
        .from('org_user_mapping')
        .select('user_id')
        .eq('org_id', orgId)
        .eq('role', 'doctor');
  
      if (doctorMapError) throw doctorMapError;
  
      // Step 2: fetch doctor details
      let doctorDetails: any[] = [];
      if (doctorMappings && doctorMappings.length > 0) {
        const doctorIds = doctorMappings.map((d) => d.user_id);
        const { data, error } = await supabase
          .from('field_doctors')
          .select('*')
          .in('auth_user_id', doctorIds);
  
        if (error) throw error;
        doctorDetails = data ?? [];
      }
  
      // Step 1: get user_ids for patients
      const { data: patientMappings, error: patientMapError } = await supabase
        .from('org_user_mapping')
        .select('user_id')
        .eq('org_id', orgId)
        .eq('role', 'patient');
  
      if (patientMapError) throw patientMapError;
  
      // Step 2: fetch patient details
      let patientDetails: any[] = [];
      if (patientMappings && patientMappings.length > 0) {
        const patientIds = patientMappings.map((p) => p.user_id);
        const { data, error } = await supabase
          .from('patients')
          .select('*')
          .in('auth_user_id', patientIds);
  
        if (error) throw error;
        patientDetails = data ?? [];
      }
  
      // Step 1: get user_ids for admins
      const { data: adminMappings, error: adminMapError } = await supabase
        .from('org_user_mapping')
        .select('user_id')
        .eq('org_id', orgId)
        .eq('role', 'org_admin');
  
      if (adminMapError) throw adminMapError;
  
      // Step 2: fetch admin details
      let adminDetails: any[] = [];
      if (adminMappings && adminMappings.length > 0) {
        const adminIds = adminMappings.map((a) => a.user_id);
        const { data, error } = await supabase
          .from('field_doctors') // org_admins are regular users
          .select('*')
          .in('auth_user_id', adminIds);
  
        if (error) throw error;
        adminDetails = data ?? [];
      }
  
      // Update state
      setOrgDoctors(doctorDetails.map((doc) => ({
        ...doc,
        banned: doc.banned || false,
      })));
  
      setOrgPatients(patientDetails.map((pat) => ({
        ...pat,
        banned: pat.banned || false,
      })));
  
      setOrgAdmins(adminDetails.map((adm) => ({
        ...adm,
        banned: adm.banned || false,
      })));
  
    } catch (error) {
      console.error('Error fetching org data:', error);
    } finally {
      setOrgDetailLoading(false);
    }
  }, []);

  // Fetch available doctors for assignment
  const fetchAvailableDoctors = useCallback(async () => {
    if (!selectedOrg) return;

    try {
      // Get all doctors not assigned to this org
      const { data: allDoctors, error } = await supabase
        .from('field_doctors')
        .select('*');

      if (error) throw error;

      const { data: assignedDoctors, error: assignedError } = await supabase
        .from('org_user_mapping')
        .select('user_id')
        .eq('org_id', selectedOrg.id)
        .eq('role', 'doctor');

      if (assignedError) throw assignedError;

      const assignedUserIds = new Set((assignedDoctors || []).map(item => item.user_id));
      const available = (allDoctors || []).filter(doc => !assignedUserIds.has(doc.auth_user_id));

      setAvailableDoctors(available);
    } catch (error) {
      console.error('Error fetching available doctors:', error);
    }
  }, [selectedOrg]);

  // Initial load
  useEffect(() => {
    (async () => {
      setOverviewLoading(true);
      await fetchOverviewData();
      setOverviewLoading(false);
    })();
  }, [fetchOverviewData]);

  // Load org data when org is selected
  useEffect(() => {
    if (selectedOrg && viewMode === 'org-detail') {
      fetchOrgData(selectedOrg.id);
    }
  }, [selectedOrg, viewMode, fetchOrgData]);

  // Refresh handlers
  const refreshOverview = useCallback(async () => {
    setOverviewRefreshing(true);
    await fetchOverviewData();
    setOverviewRefreshing(false);
  }, [fetchOverviewData]);

  const refreshOrgData = useCallback(async () => {
    if (!selectedOrg) return;
    setOrgDetailRefreshing(true);
    await fetchOrgData(selectedOrg.id);
    setOrgDetailRefreshing(false);
  }, [selectedOrg, fetchOrgData]);

  // Action handlers
  const createOrganization = async () => {
    if (!newOrgName.trim()) return;
    
    setCreatingOrg(true);
    try {
      const { data, error } = await supabase
        .from('organizations')
        .insert({ name: newOrgName.trim() })
        .select()
        .single();

      if (error) throw error;
      
      const newOrg = { ...data, doctor_count: 0, patient_count: 0, admin_count: 0 };
      setOrganizations(prev => [...prev, newOrg]);
      setOverviewStats(prev => ({ ...prev, totalOrgs: prev.totalOrgs + 1 }));
      setNewOrgName('');
      setCreateOrgModalVisible(false);
    } catch (error) {
      console.error('Error creating organization:', error);
    } finally {
      setCreatingOrg(false);
    }
  };

  const createDoctor = async () => {
    if (!selectedOrg || !docFormData.name || !docFormData.email || !docFormData.password) return;
    
    setCreatingDoc(true);
    try {
      // Use the edge function to create doctor with org assignment
      const userData = {
        name: docFormData.name,
        email: docFormData.email,
        password: docFormData.password,
        phone: docFormData.phone || null,
        specialization: docFormData.specialization || null,
        licenseNumber: docFormData.licenseNumber || null,
        yearsOfExperience: docFormData.yearsOfExperience || 0,
        role: 'field_doctor' // Use 'doctor' for org-assigned doctors
      };

      await callCreateUserFunction(userData, selectedOrg.id);
      
      // Reset and refresh
      setDocFormData({ 
        name: '', 
        email: '', 
        password: '', 
        phone: '', 
        specialization: '',
        licenseNumber: '',
        yearsOfExperience: 0
      });
      setCreateDocModalVisible(false);
      await fetchOrgData(selectedOrg.id);
      await fetchOverviewData();
    } catch (error) {
      console.error('Error creating doctor:', error);
    } finally {
      setCreatingDoc(false);
    }
  };

  const createOrgAdmin = async () => {
    if (!selectedOrg || !adminFormData.name || !adminFormData.email || !adminFormData.password) return;
    
    setCreatingAdmin(true);
    try {
      // Use the edge function to create org admin
      const userData = {
        name: adminFormData.name,
        email: adminFormData.email,
        password: adminFormData.password,
        phone: adminFormData.phone || null,
        role: 'org_admin'
      };

      await callCreateUserFunction(userData, selectedOrg.id);
      
      // Reset and refresh
      setAdminFormData({ name: '', email: '', password: '', phone: '' });
      setCreateAdminModalVisible(false);
      await fetchOrgData(selectedOrg.id);
      await fetchOverviewData();
    } catch (error) {
      console.error('Error creating org admin:', error);
    } finally {
      setCreatingAdmin(false);
    }
  };

  const assignDoctorsToOrg = async () => {
    if (!selectedOrg || selectedDocIds.size === 0) return;
    
    setAssigningDocs(true);
    try {
      const mappings = Array.from(selectedDocIds).map(docId => ({
        org_id: selectedOrg.id,
        user_id: docId,
        role: 'doctor'
      }));

      const { error } = await supabase
        .from('org_user_mapping')
        .insert(mappings);

      if (error) throw error;

      setSelectedDocIds(new Set());
      setAssignDocModalVisible(false);
      await fetchOrgData(selectedOrg.id);
      await fetchOverviewData();
    } catch (error) {
      console.error('Error assigning doctors:', error);
    } finally {
      setAssigningDocs(false);
    }
  };

  const toggleBan = async (authUserId: string, currentBanStatus: boolean) => {
    if (toggleLoading[authUserId]) return;

    try {
      setToggleLoading(prev => ({ ...prev, [authUserId]: true }));
      
      const { error } = await supabase.rpc('toggle_user_ban', {
        uid: authUserId,
        ban: !currentBanStatus,
      });
      
      if (error) throw error;

      // Update local state
      if (activeOrgTab === 'doctors') {
        setOrgDoctors(prev =>
          prev.map(u => (u.auth_user_id === authUserId ? { ...u, banned: !currentBanStatus } : u))
        );
      } else if (activeOrgTab === 'patients') {
        setOrgPatients(prev =>
          prev.map(u => (u.auth_user_id === authUserId ? { ...u, banned: !currentBanStatus } : u))
        );
      } else if (activeOrgTab === 'org-admins') {
        setOrgAdmins(prev =>
          prev.map(u => (u.auth_user_id === authUserId ? { ...u, banned: !currentBanStatus } : u))
        );
      }
    } catch (err) {
      console.error('Failed to toggle ban', err);
    } finally {
      setToggleLoading(prev => ({ ...prev, [authUserId]: false }));
    }
  };

  // Overview Header
  const OverviewHeader = useMemo(() => (
    <View style={styles.overviewHeader}>
      <View style={styles.headerRow}>
        <MaterialIcons name="dashboard" size={49} color="#4C51BF" />
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>Admin Dashboard</Text>
          <Text style={styles.headerSub}>Manage organizations and users</Text>
        </View>
      </View>
    </View>
  ), []);

  // Org Detail Header
  const OrgDetailHeader = useMemo(() => (
    <View style={styles.orgDetailHeader}>
      <View style={styles.orgHeaderTop}>
        <Button
          mode="outlined"
          onPress={() => setViewMode('overview')}
          icon="arrow-left"
          style={styles.backBtn}
        >
          Back
        </Button>
        <View style={styles.orgTitleWrap}>
          <Text style={styles.orgTitle}>{selectedOrg?.name}</Text>
          <Text style={styles.orgSub}>Organization Management</Text>
        </View>
      </View>

      <View style={styles.orgTabs}>
        {(['doctors', 'patients', 'org-admins'] as OrgTabKey[]).map((tab) => (
          <Button
            key={tab}
            mode={activeOrgTab === tab ? 'contained' : 'outlined'}
            onPress={() => setActiveOrgTab(tab)}
            buttonColor={activeOrgTab === tab ? '#4C51BF' : 'white'}
            textColor={activeOrgTab === tab ? 'white' : '#4C51BF'}
            style={styles.orgTabBtn}
          >
            {tab === 'doctors' ? 'Doctors' : tab === 'patients' ? 'Patients' : 'Admins'}
          </Button>
        ))}
      </View>
    </View>
  ), [selectedOrg, activeOrgTab]);

  // Overview Cards
  const renderOverviewCards = () => (
    <View style={styles.cardsContainer}>
      <View style={styles.cardRow}>
        <Card style={[styles.statCard, styles.orgsCard]}>
          <Card.Content>
            <View style={styles.cardContent}>
              <MaterialIcons name="business" size={32} color="#4C51BF" />
              <Text style={styles.statNumber}>{overviewStats.totalOrgs}</Text>
              <Text style={styles.statLabel}>Organizations</Text>
            </View>
          </Card.Content>
        </Card>

        <Card style={[styles.statCard, styles.doctorsCard]}>
          <Card.Content>
            <View style={styles.cardContent}>
              <MaterialIcons name="medical-services" size={32} color="#10B981" />
              <Text style={styles.statNumber}>{overviewStats.totalDoctors}</Text>
              <Text style={styles.statLabel}>Doctors</Text>
            </View>
          </Card.Content>
        </Card>
      </View>

      <View style={styles.cardRow}>
        <Card style={[styles.statCard, styles.patientsCard]}>
          <Card.Content>
            <View style={styles.cardContent}>
              <MaterialIcons name="people-alt" size={32} color="#F59E0B" />
              <Text style={styles.statNumber}>{overviewStats.totalPatients}</Text>
              <Text style={styles.statLabel}>Patients</Text>
            </View>
          </Card.Content>
        </Card>

        <Card style={[styles.statCard, styles.adminsCard]}>
          <Card.Content>
            <View style={styles.cardContent}>
              <MaterialIcons name="admin-panel-settings" size={32} color="#EF4444" />
              <Text style={styles.statNumber}>{overviewStats.totalAdmins}</Text>
              <Text style={styles.statLabel}>Org Admins</Text>
            </View>
          </Card.Content>
        </Card>
      </View>
    </View>
  );

  // Organization List
  const renderOrgItem = ({ item }: { item: Organization }) => (
    <Card style={styles.orgCard} onPress={() => {
      setSelectedOrg(item);
      setViewMode('org-detail');
    }}>
      <Card.Content>
        <View style={styles.orgCardContent}>
          <View style={styles.orgCardLeft}>
            <MaterialIcons name="business" size={24} color="#4C51BF" />
            <View style={styles.orgCardText}>
              <Text style={styles.orgCardTitle}>{item.name}</Text>
              <Text style={styles.orgCardDate}>Created {formatWhen(item.created_at)}</Text>
            </View>
          </View>
          <View style={styles.orgCardStats}>
            <Chip compact style={styles.orgChip}>{item.doctor_count || 0} Docs</Chip>
            <Chip compact style={styles.orgChip}>{item.patient_count || 0} Patients</Chip>
            <Chip compact style={styles.orgChip}>{item.admin_count || 0} Admins</Chip>
          </View>
        </View>
      </Card.Content>
    </Card>
  );

  // User list items
  const renderDoctorItem = ({ item }: { item: Doctor }) => (
    <List.Item
      title={item.name || 'Unnamed'}
      description={[
        item.email || '—',
        item.phone ? ` • ${item.phone}` : '',
        item.specialization ? ` • ${item.specialization}` : ''
      ].join('')}
      left={() => <MaterialIcons name="medical-services" size={20} color="#555" style={styles.leftIcon} />}
      right={() => (
        <View style={styles.userItemRight}>
          <Text style={styles.metaText}>{formatWhen(item.created_at)}</Text>
          <View style={styles.banToggleContainer}>
            <Text style={[styles.banLabel, item.banned && styles.banLabelActive]}>
              {item.banned ? 'Banned' : 'Active'}
            </Text>
            <Switch
              value={item.banned}
              trackColor={{ false: '#767577', true: '#4C51BF' }}
              thumbColor="white"
              onValueChange={() => toggleBan(item.auth_user_id, item.banned)}
              disabled={toggleLoading[item.auth_user_id]}
              style={styles.banSwitch}
            />
          </View>
        </View>
      )}
    />
  );

  const renderPatientItem = ({ item }: { item: Patient }) => (
    <List.Item
      title={item.name || 'Unnamed'}
      description={[
        item.email || '—',
        item.phone ? ` • ${item.phone}` : ''
      ].join('')}
      left={() => <MaterialIcons name="person" size={20} color="#555" style={styles.leftIcon} />}
      right={() => (
        <View style={styles.userItemRight}>
          <Text style={styles.metaText}>{formatWhen(item.created_at)}</Text>
          <View style={styles.banToggleContainer}>
            <Text style={[styles.banLabel, item.banned && styles.banLabelActive]}>
              {item.banned ? 'Banned' : 'Active'}
            </Text>
            <Switch
              value={item.banned}
              trackColor={{ false: '#767577', true: '#4C51BF' }}
              thumbColor="white"
              onValueChange={() => toggleBan(item.auth_user_id, item.banned)}
              disabled={toggleLoading[item.auth_user_id]}
              style={styles.banSwitch}
            />
          </View>
        </View>
      )}
    />
  );

  const renderAdminItem = ({ item }: { item: OrgAdmin }) => (
    <List.Item
      title={item.name || 'Unnamed'}
      description={[
        item.email || '—',
        item.phone ? ` • ${item.phone}` : ''
      ].join('')}
      left={() => <MaterialIcons name="admin-panel-settings" size={20} color="#555" style={styles.leftIcon} />}
      right={() => (
        <View style={styles.userItemRight}>
          <Text style={styles.metaText}>{formatWhen(item.created_at)}</Text>
          <View style={styles.banToggleContainer}>
            <Text style={[styles.banLabel, item.banned && styles.banLabelActive]}>
              {item.banned ? 'Banned' : 'Active'}
            </Text>
            <Switch
              value={item.banned}
              trackColor={{ false: '#767577', true: '#4C51BF' }}
              thumbColor="white"
              onValueChange={() => toggleBan(item.auth_user_id, item.banned)}
              disabled={toggleLoading[item.auth_user_id]}
              style={styles.banSwitch}
            />
          </View>
        </View>
      )}
    />
  );

  const renderAvailableDocItem = ({ item }: { item: Doctor }) => (
    <List.Item
      title={item.name || 'Unnamed'}
      description={[
        item.email || '—',
        item.specialization ? ` • ${item.specialization}` : ''
      ].join('')}
      left={() => (
        <Button
          mode={selectedDocIds.has(item.auth_user_id) ? 'contained' : 'outlined'}
          compact
          onPress={() => {
            setSelectedDocIds(prev => {
              const newSet = new Set(prev);
              if (newSet.has(item.auth_user_id)) {
                newSet.delete(item.auth_user_id);
              } else {
                newSet.add(item.auth_user_id);
              }
              return newSet;
            });
          }}
        >
          {selectedDocIds.has(item.auth_user_id) ? 'Selected' : 'Select'}
        </Button>
      )}
    />
  );

  // Get current data based on active tab
  const getCurrentData = () => {
    switch (activeOrgTab) {
      case 'doctors': return orgDoctors;
      case 'patients': return orgPatients;
      case 'org-admins': return orgAdmins;
      default: return [];
    }
  };

  const getCurrentRenderer = () => {
    switch (activeOrgTab) {
      case 'doctors': return renderDoctorItem;
      case 'patients': return renderPatientItem;
      case 'org-admins': return renderAdminItem;
      default: return renderDoctorItem;
    }
  };

  if (viewMode === 'overview') {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
        <ScrollView
          refreshControl={<RefreshControl refreshing={overviewRefreshing} onRefresh={refreshOverview} />}
          contentContainerStyle={styles.overviewContent}
        >
          {OverviewHeader}
          
          {overviewLoading ? (
            <ActivityIndicator style={styles.loader} size="large" />
          ) : (
            <>
              {renderOverviewCards()}
              
              <Text style={styles.sectionTitle}>Organizations</Text>
              
              {organizations.map(org => (
                <View key={org.id}>
                  {renderOrgItem({ item: org })}
                </View>
              ))}
            </>
          )}
        </ScrollView>

        <FAB
          icon="plus"
          style={styles.fab}
          onPress={() => setCreateOrgModalVisible(true)}
          label="New Org"
        />

        {/* Create Organization Modal */}
        <Portal>
          <Dialog visible={createOrgModalVisible} onDismiss={() => setCreateOrgModalVisible(false)}>
            <Dialog.Title>Create Organization</Dialog.Title>
            <Dialog.Content>
              <TextInput
                mode="outlined"
                label="Organization Name"
                value={newOrgName}
                onChangeText={setNewOrgName}
                style={styles.formInput}
              />
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setCreateOrgModalVisible(false)}>Cancel</Button>
              <Button 
                onPress={createOrganization}
                disabled={!newOrgName.trim() || creatingOrg}
                loading={creatingOrg}
                mode="contained"
              >
                Create
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      </SafeAreaView>
    );
  }

  // Org Detail View
  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <FlatList
        data={getCurrentData()}
        keyExtractor={(item) => item.id}
        renderItem={getCurrentRenderer()}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        ListHeaderComponent={OrgDetailHeader}
        ListHeaderComponentStyle={styles.headerShim}
        stickyHeaderIndices={[0]}
        refreshControl={<RefreshControl refreshing={orgDetailRefreshing} onRefresh={refreshOrgData} />}
        ListEmptyComponent={
          orgDetailLoading ? (
            <ActivityIndicator style={styles.loader} />
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                No {activeOrgTab === 'doctors' ? 'doctors' : activeOrgTab === 'patients' ? 'patients' : 'admins'} found
              </Text>
            </View>
          )
        }
      />

      {/* Floating Action Buttons */}
      <View style={styles.fabContainer}>
        {activeOrgTab === 'doctors' && (
          <>
            <FAB
              icon="plus"
              style={[styles.fab, styles.fabSecondary]}
              small
              onPress={() => setCreateDocModalVisible(true)}
              label="New Doctor"
            />
            <FAB
              icon="account-multiple-plus"
              style={[styles.fab, styles.fabPrimary]}
              small
              onPress={() => {
                fetchAvailableDoctors();
                setAssignDocModalVisible(true);
              }}
              label="Assign Existing"
            />
          </>
        )}
        
        {activeOrgTab === 'org-admins' && (
          <FAB
            icon="shield-account"
            style={[styles.fab, styles.fabPrimary]}
            onPress={() => setCreateAdminModalVisible(true)}
            label="New Admin"
          />
        )}
      </View>

      {/* Create Doctor Modal */}
      <Portal>
        <Dialog 
          visible={createDocModalVisible} 
          onDismiss={() => setCreateDocModalVisible(false)}
          style={styles.modal}
        >
          <Dialog.Title>Create New Doctor</Dialog.Title>
          <Dialog.Content>
            <TextInput
              mode="outlined"
              label="Full Name *"
              value={docFormData.name}
              onChangeText={(text) => setDocFormData(prev => ({ ...prev, name: text }))}
              style={styles.formInput}
            />
            <TextInput
              mode="outlined"
              label="Email *"
              value={docFormData.email}
              onChangeText={(text) => setDocFormData(prev => ({ ...prev, email: text }))}
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.formInput}
            />
            <TextInput
              mode="outlined"
              label="Password *"
              value={docFormData.password}
              onChangeText={(text) => setDocFormData(prev => ({ ...prev, password: text }))}
              secureTextEntry
              style={styles.formInput}
            />
            <TextInput
              mode="outlined"
              label="Phone Number"
              value={docFormData.phone}
              onChangeText={(text) => setDocFormData(prev => ({ ...prev, phone: text }))}
              keyboardType="phone-pad"
              style={styles.formInput}
            />
            <TextInput
              mode="outlined"
              label="Specialization"
              value={docFormData.specialization}
              onChangeText={(text) => setDocFormData(prev => ({ ...prev, specialization: text }))}
              style={styles.formInput}
            />
            <TextInput
              mode="outlined"
              label="License Number"
              value={docFormData.licenseNumber}
              onChangeText={(text) => setDocFormData(prev => ({ ...prev, licenseNumber: text }))}
              style={styles.formInput}
            />
            <TextInput
              mode="outlined"
              label="Years of Experience"
              value={docFormData.yearsOfExperience.toString()}
              onChangeText={(text) => setDocFormData(prev => ({ ...prev, yearsOfExperience: parseInt(text) || 0 }))}
              keyboardType="numeric"
              style={styles.formInput}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setCreateDocModalVisible(false)}>Cancel</Button>
            <Button 
              onPress={createDoctor}
              disabled={!docFormData.name || !docFormData.email || !docFormData.password || creatingDoc}
              loading={creatingDoc}
              mode="contained"
            >
              Create Doctor
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Create Admin Modal */}
      <Portal>
        <Dialog 
          visible={createAdminModalVisible} 
          onDismiss={() => setCreateAdminModalVisible(false)}
          style={styles.modal}
        >
          <Dialog.Title>Create Organization Admin</Dialog.Title>
          <Dialog.Content>
            <TextInput
              mode="outlined"
              label="Full Name *"
              value={adminFormData.name}
              onChangeText={(text) => setAdminFormData(prev => ({ ...prev, name: text }))}
              style={styles.formInput}
            />
            <TextInput
              mode="outlined"
              label="Email *"
              value={adminFormData.email}
              onChangeText={(text) => setAdminFormData(prev => ({ ...prev, email: text }))}
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.formInput}
            />
            <TextInput
              mode="outlined"
              label="Password *"
              value={adminFormData.password}
              onChangeText={(text) => setAdminFormData(prev => ({ ...prev, password: text }))}
              secureTextEntry
              style={styles.formInput}
            />
            <TextInput
              mode="outlined"
              label="Phone Number"
              value={adminFormData.phone}
              onChangeText={(text) => setAdminFormData(prev => ({ ...prev, phone: text }))}
              keyboardType="phone-pad"
              style={styles.formInput}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setCreateAdminModalVisible(false)}>Cancel</Button>
            <Button 
              onPress={createOrgAdmin}
              disabled={!adminFormData.name || !adminFormData.email || !adminFormData.password || creatingAdmin}
              loading={creatingAdmin}
              mode="contained"
            >
              Create Admin
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Assign Existing Doctors Modal */}
      <Portal>
        <Dialog 
          visible={assignDocModalVisible} 
          onDismiss={() => setAssignDocModalVisible(false)}
          style={styles.largeModal}
        >
          <Dialog.Title>Assign Existing Doctors</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.modalSubtext}>
              Select doctors to assign to {selectedOrg?.name}:
            </Text>
            <FlatList
              data={availableDoctors}
              keyExtractor={(item) => item.id}
              renderItem={renderAvailableDocItem}
              style={styles.modalList}
              ItemSeparatorComponent={() => <Divider />}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No available doctors to assign</Text>
                </View>
              }
            />
            <Text style={styles.selectionCount}>
              {selectedDocIds.size} doctor{selectedDocIds.size !== 1 ? 's' : ''} selected
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setAssignDocModalVisible(false)}>Cancel</Button>
            <Button 
              onPress={assignDoctorsToOrg}
              disabled={selectedDocIds.size === 0 || assigningDocs}
              loading={assigningDocs}
              mode="contained"
            >
              Assign {selectedDocIds.size > 0 ? `(${selectedDocIds.size})` : ''}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f5f5f5' 
  },

  // Overview styles
  overviewContent: {
    paddingBottom: 100,
  },

  overviewHeader: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5e5',
  },

  headerRow: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },

  headerTextWrap: { 
    marginLeft: 12, 
    flex: 1 
  },

  headerTitle: { 
    fontSize: 20, 
    fontWeight: 'bold',
    color: '#1f2937'
  },

  headerSub: { 
    color: '#6b7280', 
    marginTop: 2,
    fontSize: 14
  },

  // Cards styles
  cardsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },

  cardRow: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 12,
  },

  statCard: {
    flex: 1,
    elevation: 2,
  },

  orgsCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#4C51BF',
  },

  doctorsCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
  },

  patientsCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },

  adminsCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },

  cardContent: {
    alignItems: 'center',
    paddingVertical: 8,
  },

  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 8,
    color: '#1f2937',
  },

  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
    textAlign: 'center',
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginHorizontal: 16,
    marginBottom: 16,
    marginTop: 8,
  },

  // Organization card styles
  orgCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    elevation: 2,
  },

  orgCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  orgCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  orgCardText: {
    marginLeft: 12,
    flex: 1,
  },

  orgCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },

  orgCardDate: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },

  orgCardStats: {
    alignItems: 'flex-end',
  },

  orgChip: {
    marginBottom: 4,
    backgroundColor: '#f3f4f6',
  },

  // Org detail styles
  listContent: { 
    paddingBottom: 16 
  },

  headerShim: { 
    marginTop: -6 
  },

  orgDetailHeader: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5e5',
  },

  orgHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },

  backBtn: {
    marginRight: 12,
  },

  orgTitleWrap: {
    flex: 1,
  },

  orgTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },

  orgSub: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },

  orgTabs: {
    flexDirection: 'row',
    gap: 8,
  },

  orgTabBtn: {
    flex: 1,
  },

  // User item styles
  leftIcon: { 
    marginRight: 8, 
    marginTop: 2 
  },

  userItemRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },

  metaText: { 
    color: '#6b7280', 
    fontSize: 11,
    marginBottom: 4,
  },

  banToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  banLabel: {
    fontSize: 10,
    color: '#10B981',
    fontWeight: '500',
    marginRight: 6,
    minWidth: 35,
    textAlign: 'right',
  },

  banLabelActive: {
    color: '#EF4444',
  },

  banSwitch: {
    transform: [{ scaleX: 0.7 }, { scaleY: 0.7 }],
  },

  sep: { 
    height: StyleSheet.hairlineWidth, 
    backgroundColor: '#e5e5e5' 
  },

  // FAB styles
  fabContainer: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    flexDirection: 'column-reverse',
    alignItems: 'flex-end',
    gap: 8,
  },

  fab: {
    backgroundColor: '#4C51BF',
  },

  fabPrimary: {
    backgroundColor: '#4C51BF',
  },

  fabSecondary: {
    backgroundColor: '#10B981',
  },

  // Modal styles
  modal: {
    maxHeight: '80%',
  },

  largeModal: {
    maxHeight: '90%',
    marginHorizontal: 20,
  },

  formInput: {
    marginBottom: 12,
  },

  modalSubtext: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },

  modalList: {
    maxHeight: 300,
    marginBottom: 16,
  },

  selectionCount: {
    fontSize: 12,
    color: '#4C51BF',
    fontWeight: '500',
    textAlign: 'center',
  },

  // Empty states
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
  },

  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },

  loader: {
    marginTop: 40,
  },
});