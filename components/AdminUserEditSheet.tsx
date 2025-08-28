// components/UserEditSheet.tsx
import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { supabase } from '~/lib/supabase';

type RoleType = 'patient' | 'field_doctor';

type Props = {
  visible: boolean;
  role: RoleType;
  initial: any | null; // expects { id, name, email, phone, [specialization], ... }
  onClose: () => void;
  onSaved: (updatedRow: any) => void;
};

export default function UserEditSheet({ visible, role, initial, onClose, onSaved }: Props) {
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [specialization, setSpecialization] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(initial?.name ?? '');
    setEmail(initial?.email ?? '');
    setPhone(initial?.phone ?? '');
    setSpecialization(initial?.specialization ?? '');
  }, [initial]);

  const onSave = async () => {
    if (!initial?.id) return;
    setSaving(true);
    try {
      if (role === 'patient') {
        const { data, error } = await supabase
          .from('patients')
          .update({ name, email, phone })
          .eq('id', initial.id)
          .select('id, auth_user_id, name, email, phone')
          .maybeSingle();
        if (error) throw error;
        if (data) onSaved(data);
      } else {
        const { data, error } = await supabase
          .from('field_doctors')
          .update({ name, email, phone, specialization })
          .eq('id', initial.id)
          .select('id, auth_user_id, name, email, phone, specialization')
          .maybeSingle();
        if (error) throw error;
        if (data) onSaved(data);
      }
      onClose();
    } catch (e: any) {
      console.error('Save failed:', e);
      Alert.alert('Update failed', e?.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: 'padding', android: undefined })}
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.25)' }}
      >
        <View
          style={{
            backgroundColor: '#fff',
            padding: 16,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            maxHeight: '80%',
          }}
        >
          <View style={{ alignItems: 'center', marginBottom: 8 }}>
            <View style={{ width: 40, height: 5, backgroundColor: '#e5e5e5', borderRadius: 3 }} />
          </View>

          <Text style={{ fontSize: 18, fontWeight: '700' }}>
            Edit {role === 'patient' ? 'Patient' : 'Field Doctor'}
          </Text>

          <View style={{ marginTop: 12, gap: 10 }}>
            <TextInput
              placeholder="Name"
              value={name}
              onChangeText={setName}
              style={{
                borderWidth: 1, borderColor: '#ddd', borderRadius: 10,
                paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff',
              }}
            />
            <TextInput
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              style={{
                borderWidth: 1, borderColor: '#ddd', borderRadius: 10,
                paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff',
              }}
            />
            <TextInput
              placeholder="Phone"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              style={{
                borderWidth: 1, borderColor: '#ddd', borderRadius: 10,
                paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff',
              }}
            />
            {role === 'field_doctor' && (
              <TextInput
                placeholder="Specialization"
                value={specialization}
                onChangeText={setSpecialization}
                style={{
                  borderWidth: 1, borderColor: '#ddd', borderRadius: 10,
                  paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff',
                }}
              />
            )}
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 14, gap: 10 }}>
            <TouchableOpacity
              onPress={onClose}
              style={{ paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, backgroundColor: '#eee' }}
              disabled={saving}
            >
              <Text style={{ fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onSave}
              style={{ paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, backgroundColor: '#FF9800' }}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: '#fff', fontWeight: '700' }}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <Text style={{ marginTop: 8, fontSize: 12, opacity: 0.6 }}>
            Note: Changing the email here updates profile contact info, not the Supabase Auth email.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
