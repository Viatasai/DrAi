import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  Text,
  Button,
  List,
  ActivityIndicator,
  TextInput,
  Portal,
  Dialog,
  FAB,
  Divider,
  Snackbar,
  IconButton, 
} from 'react-native-paper'
import { MaterialIcons } from '@expo/vector-icons'
import { supabase } from '~/lib/supabase'
import { useAuth } from '~/contexts/AuthContext'

type OrgTabKey = 'doctors' | 'patients' | 'org-admins'

type Doctor = {
  id: string
  auth_user_id: string
  name: string | null
  email: string | null
  phone: string | null
  specialization?: string | null
  created_at: string | null
  banned: boolean
}

type Patient = {
  id: string
  auth_user_id: string
  name: string | null
  email: string | null
  phone: string | null
  created_at: string | null
  banned: boolean
}

type OrgAdmin = {
  id: string
  auth_user_id: string
  name: string | null
  email: string | null
  phone: string | null
  created_at: string | null
  banned: boolean
}

//Palette 
const COLORS = {
  primary: '#4C51BF',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  text: '#111827',
  textSecondary: '#374151',
  muted: '#6B7280',
  surface: '#FFFFFF',
  surfaceMuted: '#F9FAFB',
  border: '#E5E7EB',
}

export default function OrganizationUsersScreen() {
  
  const { user } = useAuth()

  const [orgId, setOrgId] = useState<string | null>(null)
  const [org, setOrg] = useState<{ id: string; name: string | null } | null>(null)

  const [activeTab, setActiveTab] = useState<OrgTabKey>('doctors')

  const [orgDoctors, setOrgDoctors] = useState<Doctor[]>([])
  const [orgPatients, setOrgPatients] = useState<Patient[]>([])
  const [orgAdmins, setOrgAdmins] = useState<OrgAdmin[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [refreshing, setRefreshing] = useState<boolean>(false)
  const [snack, setSnack] = useState<{ visible: boolean; text: string }>({
    visible: false,
    text: '',
  })
  const showSnack = (text: string) => setSnack({ visible: true, text })
  const hideSnack = () => setSnack({ visible: false, text: '' })

  // create doctor
  const [createDocModalVisible, setCreateDocModalVisible] = useState(false)
  const [docFormData, setDocFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    specialization: '',
    licenseNumber: '',
    yearsOfExperience: 0,
  })
  const [creatingDoc, setCreatingDoc] = useState(false)

  // create admin
  const [createAdminModalVisible, setCreateAdminModalVisible] = useState(false)
  const [adminFormData, setAdminFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
  })
  const [creatingAdmin, setCreatingAdmin] = useState(false)

  // assign existing doctors
  const [assignDocModalVisible, setAssignDocModalVisible] = useState(false)
  const [availableDoctors, setAvailableDoctors] = useState<Doctor[]>([])
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set())
  const [assigningDocs, setAssigningDocs] = useState(false)

  // confirmation state for “remove from org”
  const [confirmRemove, setConfirmRemove] = useState<{
    visible: boolean
    authUserId: string | null
    name: string
    role: 'doctor' | 'patient' | 'org_admin'
  }>({ visible: false, authUserId: null, name: '', role: 'doctor' })

  const [toggleLoading, setToggleLoading] = useState<Record<string, boolean>>({})

  const formatWhen = (iso?: string | null) => {
    if (!iso) return ''
    const d = new Date(iso)
    return d.toLocaleDateString()
  }

  const callCreateUserFunction = async (userData: any, orgIdArg?: string) => {
    const { data, error } = await supabase.functions.invoke('create-user', {
      body: {
        email: userData.email,
        password: userData.password,
        userData,
        orgId: orgIdArg,
      },
    })
    if (error) throw error
    return data
  }

  // resolve org for signed-in admin (logic unchanged)
  useEffect(() => {
    if (!user?.id) return
    ;(async () => {
      try {
        const { data: mapRow, error: mapErr } = await supabase
          .from('org_user_mapping')
          .select('org_id')
          .eq('user_id', user.id)
          .eq('role', 'org_admin')
          .maybeSingle()

        if (mapErr) throw mapErr
        if (!mapRow?.org_id) return

        setOrgId(mapRow.org_id)

        const { data: orgRow, error: orgErr } = await supabase
          .from('organizations')
          .select('id, name')
          .eq('id', mapRow.org_id)
          .single()

        if (orgErr) throw orgErr
        setOrg({ id: orgRow.id, name: orgRow.name })
      } catch (e) {
        console.error('Failed to resolve organization for admin', e)
      }
    })()
  }, [user?.id])

  const fetchOrgData = useCallback(
    async (theOrgId: string) => {
      setLoading(true)
      try {
        // doctors
        const { data: doctorMappings, error: doctorMapError } = await supabase
          .from('org_user_mapping')
          .select('user_id')
          .eq('org_id', theOrgId)
          .eq('role', 'doctor')
        if (doctorMapError) throw doctorMapError

        let doctorDetails: any[] = []
        if ((doctorMappings ?? []).length > 0) {
          const doctorIds = doctorMappings.map((d) => d.user_id)
          const { data, error } = await supabase
            .from('field_doctors')
            .select('*')
            .in('auth_user_id', doctorIds)
          if (error) throw error
          doctorDetails = data ?? []
        }

        // patients
        const { data: patientMappings, error: patientMapError } = await supabase
          .from('org_user_mapping')
          .select('user_id')
          .eq('org_id', theOrgId)
          .eq('role', 'patient')
        if (patientMapError) throw patientMapError

        let patientDetails: any[] = []
        if ((patientMappings ?? []).length > 0) {
          const patientIds = patientMappings.map((p) => p.user_id)
          const { data, error } = await supabase
            .from('patients')
            .select('*')
            .in('auth_user_id', patientIds)
          if (error) throw error
          patientDetails = data ?? []
        }

        // admins (with fallback)
        const { data: adminMappings, error: adminMapError } = await supabase
          .from('org_user_mapping')
          .select('user_id')
          .eq('org_id', theOrgId)
          .eq('role', 'org_admin')
        if (adminMapError) throw adminMapError

        let adminDetails: any[] = []
        if ((adminMappings ?? []).length > 0) {
          const adminIds = adminMappings.map((a) => a.user_id)

          const { data: adminsByAuth, error: a1Err } = await supabase
            .from('admins')
            .select('*')
            .in('auth_user_id', adminIds)
          if (a1Err) throw a1Err
          adminDetails = adminsByAuth ?? []

          if (adminDetails.length === 0) {
            const { data: adminsFromDoctors, error: a2Err } = await supabase
              .from('field_doctors')
              .select('*')
              .in('auth_user_id', adminIds)
            if (a2Err) throw a2Err
            adminDetails = adminsFromDoctors ?? []
          }
        }

        setOrgDoctors(
          (doctorDetails ?? []).map((doc: any) => ({
            ...doc,
            id: doc.id || doc.auth_user_id,
            banned: doc.banned || false,
          })),
        )
        setOrgPatients(
          (patientDetails ?? []).map((p: any) => ({
            ...p,
            id: p.id || p.auth_user_id,
            banned: p.banned || false,
          })),
        )
        setOrgAdmins(
          (adminDetails ?? []).map((a: any) => ({
            ...a,
            id: a.id || a.auth_user_id,
            name: a.name ?? null,
            email: a.email ?? null,
            phone: a.phone ?? null,
            created_at: a.created_at ?? null,
            banned: a.banned ?? false,
            auth_user_id: a.auth_user_id ?? a.id,
          })),
        )
      } catch (e) {
        console.error('Error fetching org data:', e)
        setOrgDoctors([])
        setOrgPatients([])
        setOrgAdmins([])
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    if (orgId) fetchOrgData(orgId)
  }, [orgId, fetchOrgData])

  const onRefresh = useCallback(async () => {
    if (!orgId) return
    setRefreshing(true)
    await fetchOrgData(orgId)
    setRefreshing(false)
  }, [orgId, fetchOrgData])

  const createDoctor = async () => {
    if (!orgId || !docFormData.name || !docFormData.email || !docFormData.password) return
    setCreatingDoc(true)
    try {
      const userData = {
        name: docFormData.name,
        email: docFormData.email,
        password: docFormData.password,
        phone: docFormData.phone || null,
        specialization: docFormData.specialization || null,
        licenseNumber: docFormData.licenseNumber || null,
        yearsOfExperience: docFormData.yearsOfExperience || 0,
        role: 'field_doctor',
      }
      await callCreateUserFunction(userData, orgId)
      setDocFormData({
        name: '',
        email: '',
        password: '',
        phone: '',
        specialization: '',
        licenseNumber: '',
        yearsOfExperience: 0,
      })
      setCreateDocModalVisible(false)
      await fetchOrgData(orgId)
      showSnack('Doctor created & added')
    } catch (e) {
      console.error('Error creating doctor:', e)
      showSnack('Failed to create doctor')
    } finally {
      setCreatingDoc(false)
    }
  }

  const createOrgAdmin = async () => {
    if (!orgId || !adminFormData.name || !adminFormData.email || !adminFormData.password) return
    setCreatingAdmin(true)
    try {
      const userData = {
        name: adminFormData.name,
        email: adminFormData.email,
        password: adminFormData.password,
        phone: adminFormData.phone || null,
        role: 'org_admin',
      }
      await callCreateUserFunction(userData, orgId)
      setAdminFormData({ name: '', email: '', password: '', phone: '' })
      setCreateAdminModalVisible(false)
      await fetchOrgData(orgId)
      showSnack('Org admin created')
    } catch (e) {
      console.error('Error creating org admin:', e)
      showSnack('Failed to create org admin')
    } finally {
      setCreatingAdmin(false)
    }
  }

  const fetchAvailableDoctors = useCallback(async () => {
    if (!orgId) return
    try {
      const { data: allDoctors, error } = await supabase.from('field_doctors').select('*')
      if (error) throw error

      const { data: assigned, error: assignedErr } = await supabase
        .from('org_user_mapping')
        .select('user_id')
        .eq('org_id', orgId)
        .eq('role', 'doctor')
      if (assignedErr) throw assignedErr

      const assignedIds = new Set((assigned || []).map((r) => r.user_id))
      const available = (allDoctors || []).filter((d: any) => !assignedIds.has(d.auth_user_id))
      setAvailableDoctors(available)
    } catch (e) {
      console.error('Error fetching available doctors:', e)
      setAvailableDoctors([])
    }
  }, [orgId])

  const assignDoctorsToOrg = async () => {
    if (!orgId || selectedDocIds.size === 0) return
    setAssigningDocs(true)
    try {
      const rows = Array.from(selectedDocIds).map((authUserId) => ({
        org_id: orgId,
        user_id: authUserId,
        role: 'doctor',
      }))
      const { error } = await supabase.from('org_user_mapping').insert(rows)
      if (error) throw error
      setSelectedDocIds(new Set())
      setAssignDocModalVisible(false)
      await fetchOrgData(orgId)
      showSnack('Doctor(s) assigned')
    } catch (e) {
      console.error('Error assigning doctors:', e)
      showSnack('Failed to assign doctors')
    } finally {
      setAssigningDocs(false)
    }
  }

  // ask for confirmation to remove a member from this org
  const askRemove = (authUserId: string, displayName: string, role: 'doctor' | 'patient' | 'org_admin') => {
    setConfirmRemove({
      visible: true,
      authUserId,
      name: displayName || 'this user',
      role,
    })
  }

  // remove mapping org↔user for selected role
  const removeFromOrg = async () => {
    if (!orgId || !confirmRemove.authUserId) return
    try {
      const { error } = await supabase
        .from('org_user_mapping')
        .delete()
        .eq('org_id', orgId)
        .eq('user_id', confirmRemove.authUserId)
        .eq('role', confirmRemove.role)

      if (error) throw error

      // Update local lists
      if (confirmRemove.role === 'doctor') {
        setOrgDoctors((prev) => prev.filter((u) => u.auth_user_id !== confirmRemove.authUserId))
      } else if (confirmRemove.role === 'patient') {
        setOrgPatients((prev) => prev.filter((u) => u.auth_user_id !== confirmRemove.authUserId))
      } else {
        setOrgAdmins((prev) => prev.filter((u) => u.auth_user_id !== confirmRemove.authUserId))
      }

      showSnack('Removed from organization')
    } catch (e) {
      console.error('Failed to remove from organization', e)
      showSnack('Failed to remove')
    } finally {
      setConfirmRemove({ visible: false, authUserId: null, name: '', role: 'doctor' })
    }
  }

  // UI
  const header = useMemo(
    () => (
      <View style={styles.orgDetailHeader}>
        <View style={styles.orgHeaderTop}>
          <MaterialIcons name="business" size={24} color={COLORS.primary} />
          <View style={styles.orgTitleWrap}>
            <Text style={styles.orgTitle}>{org?.name ?? 'Organization'}</Text>
            <Text style={styles.orgSub}>Organization Management</Text>
          </View>
        </View>

        <View style={styles.orgTabs}>
          {(['doctors', 'patients', 'org-admins'] as OrgTabKey[]).map((tab) => (
            <Button
              key={tab}
              mode={activeTab === tab ? 'contained' : 'outlined'}
              onPress={() => setActiveTab(tab)}
              buttonColor={activeTab === tab ? COLORS.primary : COLORS.surface}
              textColor={activeTab === tab ? COLORS.surface : COLORS.text}
              style={[styles.orgTabBtn, activeTab !== tab && { borderColor: COLORS.border }]}
            >
              {tab === 'doctors' ? 'Doctors' : tab === 'patients' ? 'Patients' : 'Admins'}
            </Button>
          ))}
        </View>
      </View>
    ),
    [org?.name, activeTab],
  )

  // ⬇️ UI rows: swap the previous Active/Banned switch for a trash icon with confirm dialog
  const renderDoctorItem = ({ item }: { item: Doctor }) => (
    <List.Item
      title={item.name || 'Unnamed'}
      description={[item.email || '—', item.phone ? ` • ${item.phone}` : '', item.specialization ? ` • ${item.specialization}` : ''].join('')}
      titleStyle={styles.listItemTitle}
      descriptionStyle={styles.listItemDesc}
      left={() => <MaterialIcons name="medical-services" size={20} color={COLORS.muted} style={styles.leftIcon} />}
      right={() => (
        <View style={styles.userItemRight}>
          <Text style={styles.metaText}>{formatWhen(item.created_at)}</Text>
          <IconButton
            icon="delete-outline"
            iconColor={COLORS.danger}
            size={20}
            onPress={() => askRemove(item.auth_user_id, item.name || item.email || '', 'doctor')}
          />
        </View>
      )}
      contentStyle={styles.listItemContent}
    />
  )

  const renderPatientItem = ({ item }: { item: Patient }) => (
    <List.Item
      title={item.name || 'Unnamed'}
      description={[item.email || '—', item.phone ? ` • ${item.phone}` : ''].join('')}
      titleStyle={styles.listItemTitle}
      descriptionStyle={styles.listItemDesc}
      left={() => <MaterialIcons name="person" size={20} color={COLORS.muted} style={styles.leftIcon} />}
      right={() => (
        <View style={styles.userItemRight}>
          <Text style={styles.metaText}>{formatWhen(item.created_at)}</Text>
          <IconButton
            icon="delete-outline"
            iconColor={COLORS.danger}
            size={20}
            onPress={() => askRemove(item.auth_user_id, item.name || item.email || '', 'patient')}
          />
        </View>
      )}
      contentStyle={styles.listItemContent}
    />
  )

  const renderAdminItem = ({ item }: { item: OrgAdmin }) => (
    <List.Item
      title={item.name || 'Unnamed'}
      description={[item.email || '—', item.phone ? ` • ${item.phone}` : ''].join('')}
      titleStyle={styles.listItemTitle}
      descriptionStyle={styles.listItemDesc}
      left={() => <MaterialIcons name="admin-panel-settings" size={20} color={COLORS.muted} style={styles.leftIcon} />}
      right={() => (
        <View style={styles.userItemRight}>
          <Text style={styles.metaText}>{formatWhen(item.created_at)}</Text>
          <IconButton
            icon="delete-outline"
            iconColor={COLORS.danger}
            size={20}
            onPress={() => askRemove(item.auth_user_id, item.name || item.email || '', 'org_admin')}
          />
        </View>
      )}
      contentStyle={styles.listItemContent}
    />
  )

  const currentData =
    activeTab === 'doctors' ? orgDoctors : activeTab === 'patients' ? orgPatients : orgAdmins
  const currentRenderer =
    activeTab === 'doctors' ? renderDoctorItem : activeTab === 'patients' ? renderPatientItem : renderAdminItem

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <FlatList
        data={currentData}
        keyExtractor={(item) => item.id}
        renderItem={currentRenderer}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        ListHeaderComponent={header}
        ListHeaderComponentStyle={styles.headerShim}
        stickyHeaderIndices={[0]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={styles.loader} />
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                No {activeTab === 'doctors' ? 'doctors' : activeTab === 'patients' ? 'patients' : 'admins'} found
              </Text>
            </View>
          )
        }
      />

      
      <View style={styles.fabContainer}>
        {activeTab === 'doctors' && (
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
              onPress={async () => {
                await fetchAvailableDoctors()
                setAssignDocModalVisible(true)
              }}
              label="Assign Existing"
            />
          </>
        )}

        {activeTab === 'org-admins' && (
          <FAB
            icon="shield-account"
            style={[styles.fab, styles.fabPrimary]}
            onPress={() => setCreateAdminModalVisible(true)}
            label="New Admin"
          />
        )}
      </View>

      
      <Portal>
        <Dialog
          visible={createDocModalVisible}
          onDismiss={() => setCreateDocModalVisible(false)}
          style={styles.modal}
        >
          <Dialog.Title style={styles.dialogTitle}>Create New Doctor</Dialog.Title>
          <Dialog.Content>
            <TextInput
              mode="outlined"
              label="Full Name *"
              value={docFormData.name}
              onChangeText={(t) => setDocFormData((p) => ({ ...p, name: t }))}
              style={[styles.formInput, styles.formInputSurface]}
              outlineColor={COLORS.text}
              activeOutlineColor={COLORS.primary}
              textColor={COLORS.text}
              placeholderTextColor={COLORS.muted}
            />
            <TextInput
              mode="outlined"
              label="Email *"
              value={docFormData.email}
              onChangeText={(t) => setDocFormData((p) => ({ ...p, email: t }))}
              keyboardType="email-address"
              autoCapitalize="none"
              style={[styles.formInput, styles.formInputSurface]}
              outlineColor={COLORS.text}
              activeOutlineColor={COLORS.primary}
              textColor={COLORS.text}
              placeholderTextColor={COLORS.muted}
            />
            <TextInput
              mode="outlined"
              label="Password *"
              value={docFormData.password}
              onChangeText={(t) => setDocFormData((p) => ({ ...p, password: t }))}
              secureTextEntry
              style={[styles.formInput, styles.formInputSurface]}
              outlineColor={COLORS.text}
              activeOutlineColor={COLORS.primary}
              textColor={COLORS.text}
              placeholderTextColor={COLORS.muted}
            />
            <TextInput
              mode="outlined"
              label="Phone Number"
              value={docFormData.phone}
              onChangeText={(t) => setDocFormData((p) => ({ ...p, phone: t }))}
              keyboardType="phone-pad"
              style={[styles.formInput, styles.formInputSurface]}
              outlineColor={COLORS.text}
              activeOutlineColor={COLORS.primary}
              textColor={COLORS.text}
              placeholderTextColor={COLORS.muted}
            />
            <TextInput
              mode="outlined"
              label="Specialization"
              value={docFormData.specialization}
              onChangeText={(t) => setDocFormData((p) => ({ ...p, specialization: t }))}
              style={[styles.formInput, styles.formInputSurface]}
              outlineColor={COLORS.text}
              activeOutlineColor={COLORS.primary}
              textColor={COLORS.text}
              placeholderTextColor={COLORS.muted}
            />
            <TextInput
              mode="outlined"
              label="License Number"
              value={docFormData.licenseNumber}
              onChangeText={(t) => setDocFormData((p) => ({ ...p, licenseNumber: t }))}
              style={[styles.formInput, styles.formInputSurface]}
              outlineColor={COLORS.text}
              activeOutlineColor={COLORS.primary}
              textColor={COLORS.text}
              placeholderTextColor={COLORS.muted}
            />
            <TextInput
              mode="outlined"
              label="Years of Experience"
              value={docFormData.yearsOfExperience.toString()}
              onChangeText={(t) =>
                setDocFormData((p) => ({ ...p, yearsOfExperience: parseInt(t) || 0 }))
              }
              keyboardType="numeric"
              style={[styles.formInput, styles.formInputSurface]}
              outlineColor={COLORS.text}
              activeOutlineColor={COLORS.primary}
              textColor={COLORS.text}
              placeholderTextColor={COLORS.muted}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setCreateDocModalVisible(false)}>Cancel</Button>
            <Button
              onPress={createDoctor}
              disabled={!docFormData.name || !docFormData.email || !docFormData.password || creatingDoc}
              loading={creatingDoc}
              mode="contained"
              buttonColor={
                !docFormData.name || !docFormData.email || !docFormData.password || creatingDoc
                  ? '#C7D2FE' /* soft primary when disabled */
                  : COLORS.primary
              }
              textColor={COLORS.surface}
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
          <Dialog.Title style={styles.dialogTitle}>Create Organization Admin</Dialog.Title>
          <Dialog.Content>
            <TextInput
              mode="outlined"
              label="Full Name *"
              value={adminFormData.name}
              onChangeText={(t) => setAdminFormData((p) => ({ ...p, name: t }))}
              style={[styles.formInput, styles.formInputSurface]}
              outlineColor={COLORS.text}
              activeOutlineColor={COLORS.primary}
              textColor={COLORS.text}
              placeholderTextColor={COLORS.muted}
            />
            <TextInput
              mode="outlined"
              label="Email *"
              value={adminFormData.email}
              onChangeText={(t) => setAdminFormData((p) => ({ ...p, email: t }))}
              keyboardType="email-address"
              autoCapitalize="none"
              style={[styles.formInput, styles.formInputSurface]}
              outlineColor={COLORS.text}
              activeOutlineColor={COLORS.primary}
              textColor={COLORS.text}
              placeholderTextColor={COLORS.muted}
            />
            <TextInput
              mode="outlined"
              label="Password *"
              value={adminFormData.password}
              onChangeText={(t) => setAdminFormData((p) => ({ ...p, password: t }))}
              secureTextEntry
              style={[styles.formInput, styles.formInputSurface]}
              outlineColor={COLORS.text}
              activeOutlineColor={COLORS.primary}
              textColor={COLORS.text}
              placeholderTextColor={COLORS.muted}
            />
            <TextInput
              mode="outlined"
              label="Phone Number"
              value={adminFormData.phone}
              onChangeText={(t) => setAdminFormData((p) => ({ ...p, phone: t }))}
              keyboardType="phone-pad"
              style={[styles.formInput, styles.formInputSurface]}
              outlineColor={COLORS.text}
              activeOutlineColor={COLORS.primary}
              textColor={COLORS.text}
              placeholderTextColor={COLORS.muted}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setCreateAdminModalVisible(false)}>Cancel</Button>
            <Button
              onPress={createOrgAdmin}
              disabled={!adminFormData.name || !adminFormData.email || !adminFormData.password || creatingAdmin}
              loading={creatingAdmin}
              mode="contained"
              buttonColor={
                !adminFormData.name || !adminFormData.email || !adminFormData.password || creatingAdmin
                  ? '#C7D2FE'
                  : COLORS.primary
              }
              textColor={COLORS.surface}
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
          <Dialog.Title style={styles.dialogTitle}>Assign Existing Doctors</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.modalSubtext}>Select doctors to assign to {org?.name}:</Text>
            <FlatList
              data={availableDoctors}
              keyExtractor={(item) => item.auth_user_id}
              renderItem={({ item }) => {
                const selected = selectedDocIds.has(item.auth_user_id)
                return (
                  <List.Item
                    title={item.name || 'Unnamed'}
                    description={[item.email || '—', item.specialization ? ` • ${item.specialization}` : ''].join('')}
                    titleStyle={styles.listItemTitle}
                    descriptionStyle={styles.listItemDesc}
                    left={() => (
                      <Button
                        mode={selected ? 'contained' : 'outlined'}
                        compact
                        onPress={() =>
                          setSelectedDocIds((prev) => {
                            const s = new Set(prev)
                            if (s.has(item.auth_user_id)) s.delete(item.auth_user_id)
                            else s.add(item.auth_user_id)
                            return s
                          })
                        }
                        buttonColor={selected ? COLORS.primary : undefined}
                        textColor={selected ? COLORS.surface : COLORS.text}
                        style={!selected ? { borderColor: COLORS.text } : undefined}
                      >
                        {selected ? 'Selected' : 'Select'}
                      </Button>
                    )}
                    contentStyle={styles.listItemContent}
                  />
                )
              }}
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
              buttonColor={selectedDocIds.size === 0 || assigningDocs ? '#C7D2FE' : COLORS.primary}
              textColor={COLORS.surface}
            >
              Assign {selectedDocIds.size > 0 ? `(${selectedDocIds.size})` : ''}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      
      <Portal>
        <Dialog
          visible={confirmRemove.visible}
          onDismiss={() => setConfirmRemove({ visible: false, authUserId: null, name: '', role: 'doctor' })}
          style={styles.modal}
        >
          <Dialog.Title style={styles.dialogTitle}>Remove from Organization?</Dialog.Title>
          <Dialog.Content>
            <Text style={{ color: COLORS.textSecondary, marginBottom: 8 }}>
              You’re about to remove <Text style={{ fontWeight: '600', color: COLORS.text }}>{confirmRemove.name || 'this user'}</Text> from this organization.
            </Text>
            <Text style={{ color: COLORS.textSecondary }}>
              This does <Text style={{ fontWeight: '700', color: COLORS.text }}>not</Text> delete their account or records. You can add them back later or assign them to a different organization.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirmRemove({ visible: false, authUserId: null, name: '', role: 'doctor' })}>
              Cancel
            </Button>
            <Button mode="contained" buttonColor={COLORS.danger} textColor={COLORS.surface} onPress={removeFromOrg}>
              Remove
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar visible={snack.visible} onDismiss={hideSnack} duration={2000}>
        {snack.text}
      </Snackbar>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surfaceMuted,
  },

  listContent: {
    paddingBottom: 16,
  },
  headerShim: {
    marginTop: -6,
  },

  orgDetailHeader: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  orgHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  orgTitleWrap: {
    flex: 1,
  },
  orgTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  orgSub: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 2,
  },
  orgTabs: {
    flexDirection: 'row',
    gap: 8,
  },
  orgTabBtn: {
    flex: 1,
    borderRadius: 24,
  },

  leftIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  listItemContent: {
    paddingVertical: 6,
  },
  listItemTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
  listItemDesc: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  userItemRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  metaText: {
    color: COLORS.muted,
    fontSize: 11,
    marginBottom: 4,
  },
  banToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  banLabel: {
    fontSize: 10,
    color: COLORS.success,
    fontWeight: '500',
    marginRight: 6,
    minWidth: 38,
    textAlign: 'right',
  },
  banLabelActive: {
    color: COLORS.danger,
  },
  banSwitch: {
    transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }],
  },
  sep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.border,
  },

  fabContainer: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    flexDirection: 'column-reverse',
    alignItems: 'flex-end',
    gap: 8,
  },
  fab: {
    backgroundColor: COLORS.primary,
  },
  fabPrimary: {
    backgroundColor: COLORS.primary,
  },
  fabSecondary: {
    backgroundColor: COLORS.success,
  },

 
  modal: {
    maxHeight: '80%',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  largeModal: {
    maxHeight: '90%',
    marginHorizontal: 20,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dialogTitle: {
    color: COLORS.text,
    fontWeight: '700',
  },


  formInput: {
    marginBottom: 12,
  },
  formInputSurface: {
    backgroundColor: COLORS.surface, 
  },

  modalSubtext: {
    fontSize: 14,
    color: COLORS.muted,
    marginBottom: 16,
  },
  modalList: {
    maxHeight: 300,
    marginBottom: 16,
  },
  selectionCount: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '500',
    textAlign: 'center',
  },

  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.muted,
    textAlign: 'center',
  },
  loader: {
    marginTop: 40,
  },
})
