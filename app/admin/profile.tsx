import React, { useMemo, useState } from 'react'
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Text, Card, Button, Divider } from 'react-native-paper'
import { MaterialIcons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useAuth } from '../../contexts/AuthContext'
import type { Admin } from '../../lib/supabase'

export default function AdminProfileScreen() {
  const { userProfile, signOut, refreshProfile } = useAuth()
  const admin = (userProfile || {}) as Partial<Admin>
  const [refreshing, setRefreshing] = useState(false)

  const handleSignOut = async () => {
    try {
      await signOut()
    } finally {
      // Explicitly send to landing with the 3 portals
      router.replace('/auth/role-selection')
    }
  }

  const onRefresh = async () => {
    setRefreshing(true)
    try {
      await refreshProfile()
    } finally {
      setRefreshing(false)
    }
  }

  const StickyHeader = useMemo(
    () => (
      <View style={styles.stickyHeader}>
        <View style={styles.headerRow}>
          <MaterialIcons name="admin-panel-settings" size={20} color="#4C51BF" />
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle}>Profile</Text>
            <Text style={styles.headerSub}>System Administrator</Text>
          </View>
        </View>
      </View>
    ),
    []
  )

  return (
    // exclude TOP edge so header sits snug under the orange app bar
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.headerShim} />
        {/* {StickyHeader} */}

        {/* Details */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Details</Text>
            <Divider style={styles.divider} />

            <View style={styles.row}>
              <Text style={styles.label}>Name</Text>
              <Text style={styles.value}>{admin?.name || '—'}</Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>Email</Text>
              <Text style={styles.value}>{admin?.email || '—'}</Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>Phone</Text>
              <Text style={styles.value}>{admin?.phone || '—'}</Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>Permissions</Text>
              <Text style={styles.value}>
                {Array.isArray(admin?.permissions) && admin?.permissions?.length
                  ? admin.permissions!.join(', ')
                  : '—'}
              </Text>
            </View>
          </Card.Content>
        </Card>

        {/* Actions */}
        <Card style={styles.card}>
          <Card.Content>
            <Button
              mode="contained"
              icon={({ size, color }) => (
                <MaterialIcons name="logout" size={size} color="white" />
              )}
              onPress={handleSignOut}
              style={styles.signOutBtn}
              contentStyle={{ paddingVertical: 8 }}
            >
              Sign Out
            </Button>
          </Card.Content>
        </Card>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scrollContent: { paddingBottom: 24 },
  headerShim: { height: 0, marginTop: -6 }, // tuck header under the orange bar
  stickyHeader: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e5e5',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  headerTextWrap: { marginLeft: 8, flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: 'bold' },
  headerSub: { color: '#666', marginTop: 2 },

  card: { marginHorizontal: 16, marginTop: 12, elevation: 2 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  divider: { marginVertical: 8 },

  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  label: { color: '#666' },
  value: { color: '#333', fontWeight: '600', marginLeft: 8, flexShrink: 1, textAlign: 'right' },

  signOutBtn: { backgroundColor: '#4C51BF' },
})
