import React, { useState, useEffect } from 'react'
import {
  View,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
} from 'react-native'
import { Text, Button, ActivityIndicator, RadioButton } from 'react-native-paper'
import { MaterialIcons } from '@expo/vector-icons'
import { supabase } from '~/lib/supabase'
import { useAuth } from '~/contexts/AuthContext'

interface Organization {
  id: string
  name: string
  type: string
  address?: string
  phone?: string
}

interface OrganizationSelectorProps {
  visible: boolean
  onDismiss: () => void
  onSelect: (orgId: string, orgName: string) => void
  title?: string
  message?: string
}

const OrganizationSelector: React.FC<OrganizationSelectorProps> = ({
  visible,
  onDismiss,
  onSelect,
  title = "Select Organization",
  message = "Choose the organization for this patient:"
}) => {
  const { userProfile } = useAuth()
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [selectedOrgId, setSelectedOrgId] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (visible) {
      loadOrganizations()
    }
  }, [visible])

  const loadOrganizations = async () => {
    if (!userProfile?.auth_user_id) return

    try {
      setLoading(true)
      
      // Get organizations this doctor belongs to
      const { data: orgMappings, error: mappingError } = await supabase
        .from('org_user_mapping')
        .select('org_id')
        .eq('user_id', userProfile.auth_user_id)

      if (mappingError) throw mappingError

      const orgIds = orgMappings?.map(mapping => mapping.org_id) || []

      if (orgIds.length === 0) {
        setOrganizations([])
        return
      }

      // Get organization details
      const { data: orgs, error: orgError } = await supabase
        .from('organizations')
        .select('id, name, type, address, phone')
        .in('id', orgIds)

      if (orgError) throw orgError

      setOrganizations(orgs || [])
      
      // Auto-select if only one organization
      if (orgs && orgs.length === 1) {
        setSelectedOrgId(orgs[0].id)
      }
    } catch (error) {
      console.error('Error loading organizations:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = () => {
    if (!selectedOrgId) return

    const selectedOrg = organizations.find(org => org.id === selectedOrgId)
    if (selectedOrg) {
      onSelect(selectedOrgId, selectedOrg.name)
    }
  }

  const getOrganizationTypeLabel = (type: string) => {
    switch (type) {
      case '1':
        return 'Healthcare Organization'
      case '2':
        return 'Individual Practice'
      default:
        return 'Organization'
    }
  }

  const getOrganizationIcon = (type: string) => {
    switch (type) {
      case '1':
        return 'business'
      case '2':
        return 'person'
      default:
        return 'business'
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onDismiss}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={onDismiss}>
            <MaterialIcons name="close" size={24} color="#333333" />
          </TouchableOpacity>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.message}>{message}</Text>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4285F4" />
              <Text style={styles.loadingText}>Loading organizations...</Text>
            </View>
          ) : organizations.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <MaterialIcons name="business" size={48} color="#CCCCCC" />
              </View>
              <Text style={styles.emptyTitle}>No Organizations Found</Text>
              <Text style={styles.emptyText}>
                You don't belong to any organizations. Contact your administrator.
              </Text>
            </View>
          ) : (
            <>
              <ScrollView style={styles.organizationList}>
                <RadioButton.Group
                  onValueChange={setSelectedOrgId}
                  value={selectedOrgId}
                >
                  {organizations.map((org) => (
                    <TouchableOpacity
                      key={org.id}
                      style={[
                        styles.organizationCard,
                        selectedOrgId === org.id && styles.selectedCard
                      ]}
                      onPress={() => setSelectedOrgId(org.id)}
                    >
                      <View style={styles.cardContent}>
                        <View style={styles.orgIcon}>
                          <MaterialIcons 
                            name={getOrganizationIcon(org.type)} 
                            size={24} 
                            color="#4285F4" 
                          />
                        </View>
                        <View style={styles.orgInfo}>
                          <Text style={styles.orgName}>{org.name}</Text>
                          <Text style={styles.orgType}>
                            {getOrganizationTypeLabel(org.type)}
                          </Text>
                          {org.address && (
                            <Text style={styles.orgDetail} numberOfLines={2}>
                              {org.address}
                            </Text>
                          )}
                          {org.phone && (
                            <Text style={styles.orgDetail}>{org.phone}</Text>
                          )}
                        </View>
                        <RadioButton value={org.id} />
                      </View>
                    </TouchableOpacity>
                  ))}
                </RadioButton.Group>
              </ScrollView>

              {/* Action Buttons */}
              <View style={styles.buttonContainer}>
                <Button
                  mode="outlined"
                  onPress={onDismiss}
                  style={styles.cancelButton}
                  textColor="#666666"
                >
                  Cancel
                </Button>
                <Button
                  mode="contained"
                  onPress={handleSelect}
                  disabled={!selectedOrgId}
                  style={[styles.selectButton, !selectedOrgId && styles.disabledButton]}
                  buttonColor="#4285F4"
                >
                  Select
                </Button>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    color: '#333333',
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  message: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 24,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 24,
  },
  organizationList: {
    flex: 1,
    marginBottom: 24,
  },
  organizationCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    marginBottom: 12,
    overflow: 'hidden',
  },
  selectedCard: {
    borderColor: '#4285F4',
    backgroundColor: '#F0F7FF',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  orgIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  orgInfo: {
    flex: 1,
  },
  orgName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  orgType: {
    fontSize: 14,
    color: '#4285F4',
    marginBottom: 4,
    fontWeight: '500',
  },
  orgDetail: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 2,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 34,
  },
  cancelButton: {
    flex: 1,
    borderRadius: 8,
    borderColor: '#E8E8E8',
  },
  selectButton: {
    flex: 1,
    borderRadius: 8,
  },
  disabledButton: {
    backgroundColor: '#CCCCCC',
  },
})

export default OrganizationSelector