import React, { useState, useEffect } from 'react'
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Image,
  Linking,
  Modal,
  TouchableOpacity,
  Platform,
} from 'react-native'
import {
  Card,
  Text,
  Button,
  TextInput,
  ActivityIndicator,
  FAB,
  Chip,
  IconButton,
} from 'react-native-paper'
import { MaterialIcons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import { useAuth } from '../../contexts/AuthContext'
import { supabase, Patient } from '../../lib/supabase'
import EmptyState from '~/components/EmptyState'
import { showToast } from '../../utils/toast'

// Calendar Component
import CalendarPicker from '~/components/Calender'
interface Prescription {
  id: string
  patient_id: string
  prescription_name: string
  prescribed_date: string
  doctor_name?: string
  notes?: string
  file_path?: string
  file_type?: 'image' | 'pdf'
  original_filename?: string
  created_at: string
}

const PrescriptionsScreen: React.FC = () => {
  const { userProfile } = useAuth()
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [viewingFile, setViewingFile] = useState<{
    url: string
    type: 'image' | 'pdf'
    name: string
  } | null>(null)

  // Form fields
  const [prescriptionName, setPrescriptionName] = useState('')
  const [prescribedDate, setPrescribedDate] = useState('')
  const [doctorName, setDoctorName] = useState('')
  const [notes, setNotes] = useState('')
  const [selectedFile, setSelectedFile] = useState<{
    uri: string
    name: string
    type: 'image' | 'pdf'
  } | null>(null)

  // Date picker states
  const [showCalendar, setShowCalendar] = useState(false)
  const [selectedDate, setSelectedDate] = useState(new Date())

  const patient = userProfile as Patient

  // Date utility functions
  const formatDateForInput = (date: Date): string => {
    return date.toISOString().split('T')[0] // YYYY-MM-DD format
  }

  const formatDateForDisplay = (dateString: string): string => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    } catch {
      return dateString
    }
  }

  const handleCalendarDateSelect = (date: Date) => {
    setSelectedDate(date)
    setPrescribedDate(formatDateForInput(date))
  }

  const openCalendar = () => {
    // Set initial calendar date to current prescribed date if valid
    if (prescribedDate) {
      try {
        const date = new Date(prescribedDate)
        if (!isNaN(date.getTime())) {
          setSelectedDate(date)
        }
      } catch (e) {
        // Use current selected date
      }
    }
    setShowCalendar(true)
  }

  useEffect(() => {
    loadPrescriptions()
  }, [])

  const loadPrescriptions = async () => {
    if (!patient) return

    try {
      const { data, error } = await supabase
        .from('prescriptions')
        .select('*')
        .eq('patient_id', patient.id)
        .order('prescribed_date', { ascending: false })

      if (error) {
        console.error('Error loading prescriptions:', error)
        showToast.error('Failed to load prescriptions')
      } else {
        setPrescriptions(data || [])
      }
    } catch (error) {
      console.error('Error loading prescriptions:', error)
      showToast.networkError()
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const onRefresh = () => {
    setRefreshing(true)
    loadPrescriptions()
  }

  const resetForm = () => {
    setPrescriptionName('')
    setPrescribedDate('')
    setDoctorName('')
    setNotes('')
    setSelectedFile(null)
    setShowAddForm(false)
  }

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      showToast.error('Please grant camera roll permissions to upload images.')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    })

    if (!result.canceled && result.assets[0]) {
      setSelectedFile({
        uri: result.assets[0].uri,
        name: `prescription_${Date.now()}.jpg`,
        type: 'image',
      })
    }
  }

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      })

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0]
        const fileType = asset.mimeType?.includes('pdf') ? 'pdf' : 'image'

        setSelectedFile({
          uri: asset.uri,
          name:
            asset.name ||
            `prescription_${Date.now()}.${fileType === 'pdf' ? 'pdf' : 'jpg'}`,
          type: fileType,
        })
      }
    } catch (error) {
      console.error('Error picking document:', error)
      showToast.error('Failed to pick document')
    }
  }

  const uploadFile = async (uri: string, fileName: string): Promise<string | null> => {
    try {
      console.log('Starting upload for:', fileName, 'from URI:', uri)

      const fileExt = fileName.split('.').pop()
      const filePath = `prescriptions/${patient.id}/${Date.now()}_${fileName}`

      // Method 1: Try ArrayBuffer approach (works better in React Native)
      try {
        const response = await fetch(uri)
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const arrayBuffer = await response.arrayBuffer()
        console.log('File converted to ArrayBuffer, size:', arrayBuffer.byteLength)

        const { data, error } = await supabase.storage
          .from('prescription-files')
          .upload(filePath, arrayBuffer, {
            contentType: fileExt === 'pdf' ? 'application/pdf' : 'image/jpeg',
            upsert: false,
          })

        if (error) {
          console.error('Supabase upload error:', error)
          throw error
        }

        console.log('Upload successful:', data.path)
        return data.path
      } catch (arrayBufferError) {
        console.log(
          'ArrayBuffer method failed, trying FormData method:',
          arrayBufferError,
        )

        // Method 2: Fallback to FormData approach
        const formData = new FormData()
        formData.append('file', {
          uri: uri,
          type: fileExt === 'pdf' ? 'application/pdf' : 'image/jpeg',
          name: fileName,
        } as any)

        // For FormData, we need to use the REST API directly
        const uploadUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/prescription-files/${filePath}`

        const uploadResponse = await fetch(uploadUrl, {
          method: 'POST',
          body: formData,
          headers: {
            Authorization: `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
          },
        })

        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text()
          console.error('FormData upload error:', errorText)
          throw new Error(`Upload failed: ${uploadResponse.status}`)
        }

        console.log('FormData upload successful')
        return filePath
      }
    } catch (error) {
      console.error('Upload error:', error)
      return null
    }
  }

  const getSignedUrl = async (filePath: string): Promise<string | null> => {
    try {
      console.log('Attempting to get signed URL for path:', filePath)

      // First check if file exists
      const { data: fileData, error: listError } = await supabase.storage
        .from('prescription-files')
        .list(filePath.substring(0, filePath.lastIndexOf('/')), {
          search: filePath.substring(filePath.lastIndexOf('/') + 1),
        })

      if (listError) {
        console.error('Error checking file existence:', listError)
      } else {
        console.log('File search result:', fileData)
      }

      const { data, error } = await supabase.storage
        .from('prescription-files')
        .createSignedUrl(filePath, 3600) // 1 hour expiry

      if (error) {
        console.error('Error getting signed URL:', error)
        console.error('Error details:', JSON.stringify(error, null, 2))
        return null
      }

      console.log('Signed URL created successfully:', data.signedUrl)
      return data.signedUrl
    } catch (error) {
      console.error('Error getting signed URL:', error)
      return null
    }
  }

  const handleSave = async () => {
    if (!prescriptionName.trim() || !prescribedDate.trim()) {
      showToast.validationError('Please enter prescription name and date')
      return
    }

    setUploading(true)
    try {
      let filePath = null

      // Upload file if selected
      if (selectedFile) {
        filePath = await uploadFile(selectedFile.uri, selectedFile.name)
        if (!filePath) {
          showToast.error('Failed to upload file')
          setUploading(false)
          return
        }
      }

      // Save prescription data
      const prescriptionData = {
        patient_id: patient.id,
        prescription_name: prescriptionName.trim(),
        prescribed_date: prescribedDate.trim(),
        doctor_name: doctorName.trim() || null,
        notes: notes.trim() || null,
        file_path: filePath,
        file_type: selectedFile?.type || null,
        original_filename: selectedFile?.name || null,
      }

      const { error } = await supabase.from('prescriptions').insert(prescriptionData)

      if (error) {
        showToast.error('Failed to save prescription')
        console.error('Error saving prescription:', error)
      } else {
        showToast.saveSuccess('Prescription')
        resetForm()
        loadPrescriptions()
      }
    } catch (error) {
      showToast.networkError('An unexpected error occurred')
      console.error('Error saving prescription:', error)
    } finally {
      setUploading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const deletePrescription = async (id: string, filePath?: string) => {
    try {
      // Delete from database
      const { error } = await supabase.from('prescriptions').delete().eq('id', id)

      if (error) {
        showToast.error('Failed to delete prescription')
        console.error('Error deleting prescription:', error)
        return
      }

      // Delete file from storage if exists
      if (filePath) {
        const { error: storageError } = await supabase.storage
          .from('prescription-files')
          .remove([filePath])

        if (storageError) {
          console.error('Error deleting file from storage:', storageError)
          // Don't show error to user as the prescription was deleted successfully
        }
      }

      showToast.deleteSuccess('Prescription')
      loadPrescriptions()
    } catch (error) {
      showToast.networkError('An unexpected error occurred')
      console.error('Error deleting prescription:', error)
    }
  }

  const viewFile = async (prescription: Prescription) => {
    if (!prescription.file_path) return

    const signedUrl = await getSignedUrl(prescription.file_path)
    if (!signedUrl) {
      showToast.error('Failed to load file')
      return
    }

    if (prescription.file_type === 'pdf') {
      // Open PDF in browser/external app
      Linking.openURL(signedUrl)
    } else {
      // Show image in modal
      setViewingFile({
        url: signedUrl,
        type: 'image',
        name: prescription.original_filename || 'Prescription Image',
      })
    }
  }

  const downloadFile = async (prescription: Prescription) => {
    if (!prescription.file_path) return

    const signedUrl = await getSignedUrl(prescription.file_path)
    if (!signedUrl) {
      showToast.error('Failed to load file')
      return
    }

    Linking.openURL(signedUrl)
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Loading prescriptions...</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View style={styles.headerSection}>
          <Text style={styles.headerTitle}>My Prescriptions</Text>
          <Text style={styles.headerSubtitle}>
            Upload and manage your prescription records
          </Text>
        </View>

        {/* Add Prescription Form */}
        {showAddForm && (
          <View style={styles.formContainer}>
            <View style={styles.formCard}>
              <View style={styles.formHeader}>
                <View style={styles.formHeaderLeft}>
                  <View style={styles.iconContainer}>
                    <MaterialIcons name="add-circle" size={24} color="#FFFFFF" />
                  </View>
                  <View>
                    <Text style={styles.formTitle}>Add New Prescription</Text>
                    <Text style={styles.formSubtitle}>
                      Fill in the prescription details
                    </Text>
                  </View>
                </View>
                <TouchableOpacity onPress={resetForm} style={styles.closeButton}>
                  <MaterialIcons name="close" size={20} color="#666" />
                </TouchableOpacity>
              </View>

              <View style={styles.formContent}>
                {/* Basic Info Section */}
                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionTitle}>Basic Information</Text>

                  <View style={styles.inputGroup}>
                    <TextInput
                      label="Prescription Name"
                      value={prescriptionName}
                      onChangeText={setPrescriptionName}
                      mode="outlined"
                      style={styles.input}
                      placeholder="e.g., Amoxicillin 500mg"
                      outlineColor="#E5E7EB"
                      activeOutlineColor="#2196F3"
                      theme={{ colors: { background: '#FFFFFF' } }}
                      right={<TextInput.Icon icon="pill" iconColor="#2196F3" />}
                    />
                    {prescriptionName.length === 0 && (
                      <Text style={styles.requiredText}>* Required field</Text>
                    )}
                  </View>

                  <View style={styles.inputRow}>
                    <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                      <View style={styles.dateInputContainer}>
                        <TextInput
                          label="Prescribed Date"
                          value={prescribedDate}
                          onChangeText={setPrescribedDate}
                          mode="outlined"
                          style={[styles.input, styles.dateInput]}
                          placeholder="YYYY-MM-DD"
                          outlineColor="#E5E7EB"
                          activeOutlineColor="#2196F3"
                          theme={{ colors: { background: '#FFFFFF' } }}
                          right={
                            <TextInput.Icon
                              icon="calendar"
                              iconColor="#2196F3"
                              onPress={openCalendar}
                            />
                          }
                        />
                      </View>
                      {prescribedDate.length === 0 && (
                        <Text style={styles.requiredText}>* Required</Text>
                      )}
                    </View>

                    <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                      <TextInput
                        label="Doctor Name"
                        value={doctorName}
                        onChangeText={setDoctorName}
                        mode="outlined"
                        style={styles.input}
                        placeholder="Dr. Smith"
                        outlineColor="#E5E7EB"
                        activeOutlineColor="#2196F3"
                        theme={{ colors: { background: '#FFFFFF' } }}
                        right={<TextInput.Icon icon="doctor" iconColor="#2196F3" />}
                      />
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <TextInput
                      label="Notes"
                      value={notes}
                      onChangeText={setNotes}
                      mode="outlined"
                      style={[styles.input, styles.textAreaInput]}
                      multiline
                      numberOfLines={3}
                      placeholder="Additional notes about this prescription..."
                      outlineColor="#E5E7EB"
                      activeOutlineColor="#2196F3"
                      theme={{ colors: { background: '#FFFFFF' } }}
                      contentStyle={styles.textAreaContent}
                    />
                  </View>
                </View>

                {/* File Upload Section */}
                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionTitle}>Attach Prescription</Text>
                  <Text style={styles.sectionSubtitle}>
                    Upload a photo or PDF of your prescription
                  </Text>

                  {!selectedFile ? (
                    <View style={styles.uploadContainer}>
                      <View style={styles.uploadArea}>
                        <MaterialIcons name="cloud-upload" size={40} color="#9CA3AF" />
                        <Text style={styles.uploadText}>Choose file to upload</Text>
                        <Text style={styles.uploadSubtext}>
                          PNG, JPG or PDF up to 10MB
                        </Text>
                      </View>

                      <View style={styles.uploadButtons}>
                        <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
                          <MaterialIcons name="camera-alt" size={20} color="#2196F3" />
                          <Text style={styles.uploadButtonText}>Take Photo</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.uploadButton}
                          onPress={pickDocument}
                        >
                          <MaterialIcons name="attach-file" size={20} color="#2196F3" />
                          <Text style={styles.uploadButtonText}>Choose File</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.filePreviewContainer}>
                      <View style={styles.filePreviewHeader}>
                        <MaterialIcons
                          name={selectedFile.type === 'pdf' ? 'picture-as-pdf' : 'image'}
                          size={24}
                          color={selectedFile.type === 'pdf' ? '#f44336' : '#2196F3'}
                        />
                        <View style={styles.filePreviewInfo}>
                          <Text style={styles.filePreviewName}>{selectedFile.name}</Text>
                          <Text style={styles.filePreviewType}>
                            {selectedFile.type === 'pdf' ? 'PDF Document' : 'Image File'}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => setSelectedFile(null)}
                          style={styles.removeFileButton}
                        >
                          <MaterialIcons name="close" size={18} color="#f44336" />
                        </TouchableOpacity>
                      </View>

                      {selectedFile.type === 'image' && (
                        <Image
                          source={{ uri: selectedFile.uri }}
                          style={styles.imagePreview}
                        />
                      )}
                    </View>
                  )}
                </View>

                {/* Form Actions */}
                <View style={styles.formActions}>
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      styles.saveButton,
                      uploading && styles.buttonDisabled,
                    ]}
                    onPress={handleSave}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <MaterialIcons name="save" size={20} color="#FFFFFF" />
                    )}
                    <Text style={styles.saveButtonText}>
                      {uploading ? 'Saving...' : 'Save Prescription'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, styles.cancelButton]}
                    onPress={resetForm}
                    disabled={uploading}
                  >
                    <MaterialIcons name="cancel" size={20} color="#6B7280" />
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Prescriptions List */}
        {prescriptions.length > 0 ? (
          prescriptions.map((prescription) => (
            <Card key={prescription.id} style={styles.prescriptionCard}>
              <Card.Content>
                <View style={styles.prescriptionHeader}>
                  <View style={styles.prescriptionInfo}>
                    <Text style={styles.prescriptionName}>
                      {prescription.prescription_name}
                    </Text>
                    <Text style={styles.prescriptionDate}>
                      Prescribed: {formatDate(prescription.prescribed_date)}
                    </Text>
                    {prescription.doctor_name && (
                      <Text style={styles.doctorName}>
                        Dr. {prescription.doctor_name}
                      </Text>
                    )}
                  </View>
                  <Button
                    mode="text"
                    onPress={() =>
                      deletePrescription(prescription.id, prescription.file_path)
                    }
                    textColor="#f44336"
                    compact
                  >
                    Delete
                  </Button>
                </View>

                {prescription.notes && (
                  <View style={styles.notesSection}>
                    <Text style={styles.notesLabel}>Notes:</Text>
                    <Text style={styles.notesText}>{prescription.notes}</Text>
                  </View>
                )}

                {/* File Attachments */}
                {prescription.file_path && (
                  <View style={styles.fileSection}>
                    <View style={styles.fileInfo}>
                      <MaterialIcons
                        name={
                          prescription.file_type === 'pdf' ? 'picture-as-pdf' : 'image'
                        }
                        size={20}
                        color={prescription.file_type === 'pdf' ? '#f44336' : '#2196F3'}
                      />
                      <Text style={styles.fileName}>
                        {prescription.original_filename ||
                          `${prescription.file_type?.toUpperCase()} File`}
                      </Text>
                    </View>
                    <View style={styles.fileActions}>
                      <IconButton
                        icon="eye"
                        size={20}
                        onPress={() => viewFile(prescription)}
                      />
                      <IconButton
                        icon="download"
                        size={20}
                        onPress={() => downloadFile(prescription)}
                      />
                    </View>
                  </View>
                )}

                <Text style={styles.uploadedDate}>
                  Uploaded: {formatDate(prescription.created_at)}
                </Text>
              </Card.Content>
            </Card>
          ))
        ) : !showAddForm ? (
          <EmptyState
            icon="medication"
            title="No prescriptions yet"
            description="Upload your prescription records to keep track of your medications and medical history."
            actionText="Add First Prescription"
            onAction={() => setShowAddForm(true)}
          />
        ) : null}
      </ScrollView>

      {/* Custom Calendar Picker */}
      <CalendarPicker
        visible={showCalendar}
        onClose={() => setShowCalendar(false)}
        onDateSelect={handleCalendarDateSelect}
        selectedDate={selectedDate}
      />

      {/* Image Viewer Modal */}
      <Modal
        visible={viewingFile?.type === 'image'}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setViewingFile(null)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{viewingFile?.name}</Text>
            <IconButton
              icon="close"
              iconColor="#fff"
              onPress={() => setViewingFile(null)}
            />
          </View>
          {viewingFile?.url && (
            <Image
              source={{ uri: viewingFile.url }}
              style={styles.fullImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

      {/* Floating Action Button */}
      {!showAddForm && (
        <FAB
          style={styles.fab}
          icon="plus"
          onPress={() => setShowAddForm(true)}
          label="Add Prescription"
          color="white"
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#64748b',
    fontSize: 16,
  },
  headerSection: {
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#64748b',
    lineHeight: 22,
  },

  // Enhanced Form Styles
  formContainer: {
    marginBottom: 24,
  },
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  formHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#2196F3',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 2,
  },
  formSubtitle: {
    fontSize: 14,
    color: '#64748b',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formContent: {
    padding: 20,
  },

  // Section Styles
  sectionContainer: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 20,
  },

  // Input Styles
  inputGroup: {
    marginBottom: 20,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  input: {
    backgroundColor: '#ffffff',
    fontSize: 16,
  },
  dateInputContainer: {
    position: 'relative',
  },
  dateInput: {
    marginBottom: 8,
  },
  calendarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  calendarButtonText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '500',
  },
  textAreaInput: {
    minHeight: 100,
  },
  textAreaContent: {
    paddingTop: 12,
  },
  requiredText: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 4,
    marginLeft: 4,
  },

  // Upload Styles
  uploadContainer: {
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    borderRadius: 12,
    backgroundColor: '#f8fafc',
  },
  uploadArea: {
    padding: 32,
    alignItems: 'center',
  },
  uploadText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginTop: 12,
    marginBottom: 4,
  },
  uploadSubtext: {
    fontSize: 14,
    color: '#6b7280',
  },
  uploadButtons: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
  },
  uploadButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2196F3',
    backgroundColor: '#ffffff',
  },
  uploadButtonText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#2196F3',
  },

  // File Preview Styles
  filePreviewContainer: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  filePreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8fafc',
  },
  filePreviewInfo: {
    flex: 1,
    marginLeft: 12,
  },
  filePreviewName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 2,
  },
  filePreviewType: {
    fontSize: 12,
    color: '#64748b',
  },
  removeFileButton: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePreview: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },

  // Action Button Styles
  formActions: {
    gap: 12,
    marginTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  saveButton: {
    backgroundColor: '#2196F3',
    shadowColor: '#2196F3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  cancelButton: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  buttonDisabled: {
    opacity: 0.6,
  },

  // Prescription Card Styles
  prescriptionCard: {
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  prescriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  prescriptionInfo: {
    flex: 1,
  },
  prescriptionName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  prescriptionDate: {
    color: '#64748b',
    marginBottom: 4,
    fontSize: 14,
  },
  doctorName: {
    color: '#2196F3',
    fontWeight: '600',
    fontSize: 14,
  },
  notesSection: {
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  notesLabel: {
    fontWeight: '600',
    marginBottom: 6,
    color: '#1e293b',
    fontSize: 14,
  },
  notesText: {
    color: '#64748b',
    lineHeight: 20,
    fontSize: 14,
  },
  fileSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  fileName: {
    marginLeft: 12,
    flex: 1,
    color: '#1e293b',
    fontWeight: '500',
    fontSize: 14,
  },
  fileActions: {
    flexDirection: 'row',
  },
  uploadedDate: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'right',
    fontStyle: 'italic',
  },

  // FAB Styles
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#2196F3',
    borderRadius: 16,
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 50,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  fullImage: {
    flex: 1,
    width: '100%',
  },

  // Calendar Styles
  calendarModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  calendarModal: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 350,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 15,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  calendarTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
  },
  calendarCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthYear: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  calendarGrid: {
    paddingHorizontal: 20,
  },
  weekDays: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  weekDayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    paddingVertical: 8,
  },
  daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    marginBottom: 4,
  },
  selectedDay: {
    backgroundColor: '#2196F3',
  },
  todayDay: {
    backgroundColor: '#e3f2fd',
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  futureDay: {
    opacity: 0.3,
  },
  dayText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1e293b',
  },
  selectedDayText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  todayDayText: {
    color: '#2196F3',
    fontWeight: '700',
  },
  futureDayText: {
    color: '#cbd5e1',
  },
  calendarActions: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 16,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#2196F3',
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
})

export default PrescriptionsScreen
