import React, { useEffect, useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Text, Card, Button } from 'react-native-paper'
import { useAuth } from '~/contexts/AuthContext'
import { useRouter } from 'expo-router'
import { supabase } from '~/lib/supabase'

type Org = {
  id: string
  name: string | null
  address: string | null
  phone: string | null
  created_at: string | null
}

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

export default function OrganizationProfile() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const [org, setOrg] = useState<Org | null>(null)

  useEffect(() => {
    ;(async () => {
      if (!user?.id) return
      const { data: mapRow } = await supabase
        .from('org_user_mapping')
        .select('org_id')
        .eq('user_id', user.id)
        .eq('role', 'org_admin')
        .maybeSingle()
      if (!mapRow?.org_id) return
      const { data } = await supabase
        .from('organizations')
        .select('id,name,address,phone,created_at')
        .eq('id', mapRow.org_id)
        .single()
      setOrg((data as Org) ?? null)
    })()
  }, [user?.id])

  const handleSignOut = async () => {
    await signOut()
    router.replace('/auth/role-selection')
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <Text variant="titleMedium" style={styles.header}>Profile</Text>

      <Card style={styles.card} elevation={2}>
        <Card.Content style={styles.cardContent}>
          <View style={styles.row}>
            <Text style={styles.label}>Name</Text>
            <Text style={styles.value}>{org?.name ?? 'Organization'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Address</Text>
            <Text style={styles.value}>{org?.address || '—'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Phone</Text>
            <Text style={styles.value}>{org?.phone || '—'}</Text>
          </View>
          <View style={styles.rowLast}>
            <Text style={styles.label}>Created</Text>
            <Text style={styles.value}>
              {org?.created_at ? new Date(org.created_at).toLocaleDateString() : '—'}
            </Text>
          </View>
        </Card.Content>
      </Card>

      <Button
        mode="contained"
        style={styles.signOut}
        contentStyle={styles.signOutContent}
        buttonColor={COLORS.primary}
        textColor={COLORS.surface}
        onPress={handleSignOut}
      >
        Sign Out
      </Button>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surfaceMuted,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  header: {
    color: COLORS.text,           
    fontWeight: '700',
    marginBottom: 12,
  },
  card: {
    backgroundColor: COLORS.surface,  
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardContent: {
    paddingVertical: 8,
  },
  row: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,  
  },
  rowLast: {
    paddingVertical: 12,
  },
  label: {
    color: COLORS.muted,              
    fontSize: 13,
    marginBottom: 2,
  },
  value: {
    color: COLORS.text,                
    fontWeight: '600',
    fontSize: 15,
  },
  signOut: {
    marginTop: 16,
    borderRadius: 12,
    alignSelf: 'stretch',
  },
  signOutContent: {
    paddingVertical: 8,
  },
})