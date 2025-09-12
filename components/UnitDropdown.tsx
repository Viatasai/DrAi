import React, { useState } from 'react'
import { View, StyleSheet, TouchableOpacity, Modal, FlatList } from 'react-native'
import { Text } from 'react-native-paper'
import { MaterialIcons } from '@expo/vector-icons'

export type UnitOption<T extends string> = {
  label: string
  value: T
}

interface UnitDropdownProps<T extends string> {
  options: UnitOption<T>[]
  value: T
  onChange: (value: T) => void
  placeholder?: string
}

export default function UnitDropdown<T extends string>({
  options,
  value,
  onChange,
  placeholder = "Select unit"
}: UnitDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false)
  
  const selectedOption = options.find(option => option.value === value)
  
  const handleSelect = (optionValue: T) => {
    onChange(optionValue)
    setIsOpen(false)
  }
  
  return (
    <View>
      <TouchableOpacity 
        style={styles.dropdownButton}
        onPress={() => setIsOpen(true)}
      >
        <Text style={styles.buttonText}>
          {selectedOption?.label || placeholder}
        </Text>
        <MaterialIcons 
          name="keyboard-arrow-down" 
          size={20} 
          color="#666666" 
        />
      </TouchableOpacity>
      
      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <TouchableOpacity 
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setIsOpen(false)}
        >
          <View style={styles.dropdown}>
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.option,
                    item.value === value && styles.selectedOption
                  ]}
                  onPress={() => handleSelect(item.value)}
                >
                  <Text style={[
                    styles.optionText,
                    item.value === value && styles.selectedOptionText
                  ]}>
                    {item.label}
                  </Text>
                  {item.value === value && (
                    <MaterialIcons 
                      name="check" 
                      size={20} 
                      color="#4285F4" 
                    />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D7E3FF',
    borderRadius: 8,
    minWidth: 80,
  },
  buttonText: {
    fontSize: 14,
    color: '#333333',
    fontWeight: '500',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdown: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    minWidth: 120,
    maxHeight: 200,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  selectedOption: {
    backgroundColor: '#F0F7FF',
  },
  optionText: {
    fontSize: 16,
    color: '#333333',
  },
  selectedOptionText: {
    color: '#4285F4',
    fontWeight: '600',
  },
})