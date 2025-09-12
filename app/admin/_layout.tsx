import React, { useEffect } from 'react'
import { Tabs, useRouter } from 'expo-router'
import { MaterialIcons } from '@expo/vector-icons'
import { useAuth } from '../../contexts/AuthContext'
import { PaperProvider } from 'react-native-paper'
import { AppTheme } from '../../lib/theme'
import { supabase }  from '~/lib/supabase'


export default function AdminLayout() {
  const { user, userRole, loading } = useAuth()
  const router = useRouter()

  // Redirect non-admins to the role selection screen
  useEffect(() => {
    if (!loading && (!user || !userRole || userRole.role !== 'admin')) {
      router.replace('/auth/role-selection')
    }
  }, [user, userRole, loading])

  // Keep the screen empty while redirecting/loading (your global splash handles UX)
  if (loading) return null
  if (!user || !userRole || userRole.role !== 'admin') return null

  return (
    <PaperProvider theme={AppTheme}>
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
            headerShown: false,
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="dashboard" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="users"
          options={{
            title: 'Users',
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="people" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="visits"
          options={{
            title: 'Visits',
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="assignment" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="analytics"
          options={{
            href: null

          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size }) => (
              <MaterialIcons name="person" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </PaperProvider>
  )
}