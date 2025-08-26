// utils/location.ts
import * as ExpoLocation from 'expo-location'

export type VisitLocation = {
  lat: number
  lon: number
  accuracy?: number
  name?: string
}

export async function getCurrentLocation(): Promise<VisitLocation | null> {
  try {
    // Ask permission
    const { status } = await ExpoLocation.requestForegroundPermissionsAsync()
    if (status !== 'granted') return null

    // Get coordinates
    const pos = await ExpoLocation.getCurrentPositionAsync({
      accuracy: ExpoLocation.Accuracy.Balanced,
    })
    const lat = pos.coords.latitude
    const lon = pos.coords.longitude
    const accuracy = pos.coords.accuracy ?? undefined

    // Reverse geocode to a friendly string
    let name: string | undefined
    try {
      const results = await ExpoLocation.reverseGeocodeAsync({
        latitude: lat,
        longitude: lon,
      })
      const first = results?.[0]
      if (first) {
        name = [first.name, first.street, first.city, first.region, first.country]
          .filter(Boolean)
          .join(', ')
      }
    } catch {
      /* swallow, keep coords only */
    }

    return { lat, lon, accuracy, name }
  } catch {
    return null
  }
}
