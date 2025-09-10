import React, { useEffect } from 'react'
import { Tabs, useRouter } from 'expo-router'
import { MaterialIcons } from '@expo/vector-icons'
import { PaperProvider } from 'react-native-paper'
import { useAuth } from '~/contexts/AuthContext'

export default function OrganizationLayout() {
  const { user, userRole, loading } = useAuth()
  const router = useRouter()

  // Only org_admins can access /organization
  useEffect(() => {
    if (!loading && (!user || !userRole || userRole.role !== 'org_admin')) {
      router.replace('/auth/role-selection')
    }
  }, [user, userRole, loading])

  if (loading) return null
  if (!user || !userRole || userRole.role !== 'org_admin') return null

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
