import React, { useCallback, useEffect, useState } from 'react'
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Text, Card, Button, ActivityIndicator } from 'react-native-paper'
import { MaterialIcons } from '@expo/vector-icons'
import { useAuth } from '~/contexts/AuthContext'
import { supabase } from '~/lib/supabase'

type Org = {
  id: string
  name: string | null
  address: string | null
  phone: string | null
  created_at: string | null
}

// --- Palette (visual-only) ---
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

export default function OrganizationDashboard() {
  const { user } = useAuth()

  // resolved from DB (don’t rely on userRole for org details)
  const [org, setOrg] = useState<Org | null>(null)

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [counts, setCounts] = useState({ doctors: 0, patients: 0, admins: 0 })

  // 1) find the org this signed-in user admin belongs to
  const resolveOrg = useCallback(async () => {
    if (!user?.id) return null
    const { data: mapRow, error: mapErr } = await supabase
      .from('org_user_mapping')
      .select('org_id')
      .eq('user_id', user.id)
      .eq('role', 'org_admin')
      .maybeSingle()
    if (mapErr) throw mapErr
    if (!mapRow?.org_id) return null

    const { data: orgRow, error: orgErr } = await supabase
      .from('organizations')
      .select('id,name,address,phone,created_at')
      .eq('id', mapRow.org_id)
      .single()
    if (orgErr) throw orgErr
    return orgRow as Org
  }, [user?.id])

  const loadCounts = useCallback(
    async (orgId: string) => {
      const { data: mappings, error } = await supabase
        .from('org_user_mapping')
        .select('role')
        .eq('org_id', orgId)
      if (error) throw error

      const d = mappings?.filter(m => m.role === 'doctor').length ?? 0
      const p = mappings?.filter(m => m.role === 'patient').length ?? 0
      const a = mappings?.filter(m => m.role === 'org_admin').length ?? 0
      setCounts({ doctors: d, patients: p, admins: a })
    },
    []
  )

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const nextOrg = await resolveOrg()
      setOrg(nextOrg)
      if (nextOrg?.id) await loadCounts(nextOrg.id)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [resolveOrg, loadCounts])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const onRefresh = async () => {
    setRefreshing(true)
    await loadAll()
    setRefreshing(false)
  }

  if (!org) return null

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.content}
      >
        <View style={styles.headerRow}>
          <MaterialIcons name="business" size={28} color={COLORS.primary} />
          <View style={styles.headerTextWrap}>
            <Text variant="titleMedium" style={styles.titleLine}>
              {org.name ?? 'Organization'}
            </Text>
            <Text style={styles.subLine}>Organization Dashboard</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator style={styles.loading} />
        ) : (
          <View style={styles.cardsRow}>
            <Card style={styles.card} elevation={2}>
              <Card.Content style={styles.cardContent}>
                <MaterialIcons name="medical-services" size={22} color={COLORS.muted} />
                <Text style={styles.cardNumber}>{counts.doctors}</Text>
                <Text style={styles.cardLabel}>Doctors</Text>
              </Card.Content>
            </Card>

            <Card style={styles.card} elevation={2}>
              <Card.Content style={styles.cardContent}>
                <MaterialIcons name="people" size={22} color={COLORS.muted} />
                <Text style={styles.cardNumber}>{counts.patients}</Text>
                <Text style={styles.cardLabel}>Patients</Text>
              </Card.Content>
            </Card>

            <Card style={styles.card} elevation={2}>
              <Card.Content style={styles.cardContent}>
                <MaterialIcons name="admin-panel-settings" size={22} color={COLORS.muted} />
                <Text style={styles.cardNumber}>{counts.admins}</Text>
                <Text style={styles.cardLabel}>Admins</Text>
              </Card.Content>
            </Card>
          </View>
        )}

        <Button
          mode="contained"
          icon="refresh"
          onPress={loadAll}
          style={styles.refreshBtn}
          buttonColor={COLORS.primary}
          textColor={COLORS.surface}
          contentStyle={styles.refreshContent}
        >
          Refresh
        </Button>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surfaceMuted,
  },
  content: {
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTextWrap: {
    marginLeft: 10,
  },
  titleLine: {
    color: COLORS.text,
    fontWeight: '700',
  },
  subLine: {
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  loading: {
    marginTop: 24,
  },
  cardsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  card: {
    flex: 1,
    backgroundColor: COLORS.surface,       // white cards (no dark fill)
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardContent: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  cardNumber: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '700',
    marginTop: 6,
  },
  cardLabel: {
    color: COLORS.muted,
    marginTop: 2,
    fontSize: 12,
  },
  refreshBtn: {
    marginTop: 14,
    borderRadius: 12,
    alignSelf: 'stretch',
  },
  refreshContent: {
    paddingVertical: 6,
  },
})