import React, { useEffect, useMemo } from 'react'
import { Tabs, useRouter } from 'expo-router'
import { MaterialIcons } from '@expo/vector-icons'
import { PaperProvider } from 'react-native-paper'
import { useAuth } from '~/contexts/AuthContext'

export default function OrganizationLayout() {
  const { user, userRole, loading } = useAuth()
  const router = useRouter()

  // Only org_admins can access /organization
  const ready = useMemo(() => !loading && user !== null && userRole !== null, [loading, user, userRole])

  useEffect(() => {
    if (!ready) return
    if (userRole!.role !== 'org_admin') {
      router.replace('/auth/role-selection')
    }
  }, [ready, userRole, router])

  if (!ready) return null
  if (userRole!.role !== 'org_admin') return null

  return (
    <PaperProvider>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#4C51BF',
          tabBarInactiveTintColor: 'gray',
          headerStyle: { backgroundColor: '#4C51BF' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="dashboard" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="users"
          options={{
            title: 'Users',
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="groups" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="apartment" color={color} size={size} />
            ),
          }}
        />
      </Tabs>
    </PaperProvider>
  )
}
