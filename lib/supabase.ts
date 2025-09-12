import { createClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'

// Supabase configuration
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'YOUR_SUPABASE_URL'
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY'

// Enhanced storage adapter for native platforms
const ExpoSecureStoreAdapter = {
  getItem: async (key: string) => {
    try {
      return await SecureStore.getItemAsync(key)
    } catch (error) {
      console.error('SecureStore getItem error:', error)
      return null
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      await SecureStore.setItemAsync(key, value)
    } catch (error) {
      console.error('SecureStore setItem error:', error)
    }
  },
  removeItem: async (key: string) => {
    try {
      await SecureStore.deleteItemAsync(key)
    } catch (error) {
      console.error('SecureStore removeItem error:', error)
    }
  },
}

// Enhanced web storage adapter with better error handling
const createWebStorageAdapter = () => {
  const isWebBrowser =
    typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
  if (isWebBrowser) {
    return {
      getItem: async (key: string) => {
        try {
          return window.localStorage.getItem(key)
        } catch (error) {
          console.error('localStorage getItem error:', error)
          return null
        }
      },
      setItem: async (key: string, value: string) => {
        try {
          window.localStorage.setItem(key, value)
        } catch (error) {
          console.error('localStorage setItem error:', error)
        }
      },
      removeItem: async (key: string) => {
        try {
          window.localStorage.removeItem(key)
        } catch (error) {
          console.error('localStorage removeItem error:', error)
        }
      },
    }
  }

  // In-memory fallback for server-side or restricted environments
  const memoryStorage: Record<string, string> = {}
  console.warn(
    'Using in-memory storage fallback - sessions will not persist across page reloads',
  )
  return {
    getItem: async (key: string) => memoryStorage[key] ?? null,
    setItem: async (key: string, value: string) => {
      memoryStorage[key] = value
    },
    removeItem: async (key: string) => {
      delete memoryStorage[key]
    },
  }
}

// Dynamically select storage adapter based on platform
const storageAdapter =
  Platform.OS === 'web' ? createWebStorageAdapter() : ExpoSecureStoreAdapter

// Create Supabase client with enhanced configuration
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: storageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
    // flowType: 'pkce',
    debug: false,
  },
  global: {
    headers: { 'X-Client-Info': `healthcare-app-${Platform.OS}` },
  },
})

// ---------------------
// Database types
// ---------------------

export interface Patient {
  id: string
  auth_user_id: string
  name: string
  age: number
  gender: 'male' | 'female' | 'other' | 'prefer_not_to_say'
  phone?: string
  email?: string
  address?: string
  emergency_contact_name?: string
  emergency_contact_phone?: string
  medical_history?: string
  allergies?: string
  current_medications?: string
  created_at: string
  updated_at: string
}

export interface FieldDoctor {
  id: string
  auth_user_id: string
  name: string
  specialization?: string
  license_number?: string
  phone?: string
  email?: string
  years_of_experience?: number
  created_at: string
  updated_at: string
}

export interface Admin {
  id: string
  auth_user_id: string
  name: string
  phone?: string
  email?: string
  permissions?: string[]
  created_at: string
  updated_at: string
}

/** Typed alias for our JSONB location shape on visits */
export interface VisitLocation {
  lat: number
  lon: number
  accuracy?: number | null
  name?: string | null
}

export interface Visit {
  id: string
  patient_id: string
  doctor_id: string
  visit_date: string

  weight?: number
  height?: number
  systolic_bp?: number
  diastolic_bp?: number
  heart_rate?: number
  temperature?: number
  blood_sugar?: number
  oxygen_saturation?: number
  respiratory_rate?: number
  symptoms?: string
  diagnosis?: string
  treatment_notes?: string
  prescribed_medications?: string
  follow_up_instructions?: string
chat_session_id?: string | null
  visit_type?: 'in_person' | 'virtual_consultation' | 'self_recorded' | string
  location?: VisitLocation | null

  created_at: string
  updated_at: string
}

export interface ChatMessage {
  id: string
  patient_id: string
  session_id: string
  role: 'user' | 'ai'
  message: string
  context_visits?: string[]
  timestamp: string
}

export interface UserRole {
  id: string
  auth_user_id: string
  role: 'patient' | 'field_doctor' | 'admin' | 'org_admin' 
  created_at: string
}

// ---------------------
// Helpers
// ---------------------

export const getCurrentUser = async () => {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()
    if (error) {
      console.error('Error getting current user:', error)
      return null
    }
    return user
  } catch (error) {
    console.error('Unexpected error getting current user:', error)
    return null
  }
}

export const getUserRole = async (userId: string): Promise<UserRole | null> => {
  try {
    const { data, error } = await supabase
      .from('user_roles')
      .select('*')
      .eq('auth_user_id', userId)
      .maybeSingle()
    if (error) {
      console.error('Error fetching user role:', error)
      return null
    }
    return data
  } catch (error) {
    console.error('Unexpected error fetching user role:', error)
    return null
  }
}

export const getPatientProfile = async (userId: string): Promise<Patient | null> => {
  try {
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .eq('auth_user_id', userId)
      .single()
    if (error) {
      console.error('Error fetching patient profile:', error)
      return null
    }
    return data
  } catch (error) {
    console.error('Unexpected error fetching patient profile:', error)
    return null
  }
}

export const getDoctorProfile = async (userId: string): Promise<FieldDoctor | null> => {
  try {
    const { data, error } = await supabase
      .from('field_doctors')
      .select('*')
      .eq('auth_user_id', userId)
      .single()
    if (error) {
      console.error('Error fetching doctor profile:', error)
      return null
    }
    return data
  } catch (error) {
    console.error('Unexpected error fetching doctor profile:', error)
    return null
  }
}

export const getAdminProfile = async (userId: string): Promise<Admin | null> => {
  try {
    const { data, error } = await supabase
      .from('admins')
      .select('*')
      .eq('auth_user_id', userId)
      .single()
    if (error) {
      console.error('Error fetching admin profile:', error)
      return null
    }
    return data
  } catch (error) {
    console.error('Unexpected error fetching admin profile:', error)
    return null
  }
}

/** Small pure helpers for showing a compact location label in cards */
export const shortLocationFromName = (name: string): string => {
  const parts = name
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const countryFull = parts[parts.length - 1] || ''
  const countryCode = /united states/i.test(countryFull)
    ? 'US'
    : /india/i.test(countryFull)
      ? 'IN'
      : countryFull.length <= 3
        ? countryFull.toUpperCase()
        : countryFull.slice(0, 2).toUpperCase()

  const city = parts[parts.length - 3] || parts[parts.length - 2] || parts[0]
  const street = parts[0]
  const looksLikeStreet =
    /\d/.test(street) ||
    /(road|rd|street|st|avenue|ave|blvd|lane|ln|dr|terrace|trl)/i.test(street)

  return looksLikeStreet
    ? `${street}, ${city}, ${countryCode}`
    : `${city}, ${countryCode}`
}

export const getVisitShortLocation = (visit: Visit): string | null => {
  const loc = visit.location
  if (!loc) return null
  if (loc.name) return shortLocationFromName(loc.name)
  if (typeof loc.lat === 'number' && typeof loc.lon === 'number') {
    return `${loc.lat.toFixed(3)}, ${loc.lon.toFixed(3)}`
  }
  return null
}
