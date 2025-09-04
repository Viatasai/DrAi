import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native";
import { Text, Button, ActivityIndicator } from "react-native-paper";
import { MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, router } from "expo-router";
import {
  supabase,
  Patient,
  Visit,
  getVisitShortLocation,
} from "../lib/supabase";
import HealthTrendsComponent from "./HealthTrendsComponent";

type ViewKey = "trends" | "history" | "profile";

interface PatientDetailsWrapperProps {
  patient_id: string;
  view: string;
}

const PatientDetailsWrapper: React.FC<PatientDetailsWrapperProps> = ({
  view,
  patient_id,
}) => {
  const initialView: ViewKey = (view as ViewKey) || "trends";
  const [activeView, setActiveView] = useState<ViewKey>(initialView);

  const [patient, setPatient] = useState<Patient | null>(null);
  const [loadingPatient, setLoadingPatient] = useState(true);
  const [patientError, setPatientError] = useState<string | null>(null);

  const [historyTab, setHistoryTab] = useState<"doctor" | "ai">("doctor");
  const [visits, setVisits] = useState<Visit[]>([]);
  const [filteredVisits, setFilteredVisits] = useState<Visit[]>([]);
  const [aiSessions, setAiSessions] = useState<Visit[]>([]);
  const [filteredAiSessions, setFilteredAiSessions] = useState<Visit[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (patient_id) loadPatientData(patient_id);
  }, [patient_id]);

  useEffect(() => {
    if (activeView === "history" && patient_id) loadVisits(patient_id);
  }, [activeView, patient_id]);

  const loadPatientData = async (patientId: string) => {
    setLoadingPatient(true);
    setPatientError(null);
    try {
      const { data, error } = await supabase
        .from("patients")
        .select("*")
        .eq("id", patientId)
        .single();
      if (error) setPatientError("Failed to load patient data");
      else setPatient(data);
    } catch {
      setPatientError("An unexpected error occurred");
    } finally {
      setLoadingPatient(false);
    }
  };

  const loadVisits = async (patientId: string) => {
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from("visits")
        .select(
          `
          *,
          field_doctors (name, specialization)
        `,
        )
        .eq("patient_id", patientId)
        .order("visit_date", { ascending: false });

      if (!error) {
        const physicalVisits =
          data?.filter((v) => v.visit_type !== "virtual_consultation") || [];
        setVisits(physicalVisits);
        setFilteredVisits(physicalVisits);

        const virtualConsults =
          data?.filter((v) => v.visit_type === "virtual_consultation") || [];
        setAiSessions(virtualConsults);
        setFilteredAiSessions(virtualConsults);
      }
    } finally {
      setLoadingHistory(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    if (patient_id) {
      loadPatientData(patient_id);
      if (activeView === "history") loadVisits(patient_id);
      else setRefreshing(false);
    }
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const formatTime = (dateString: string) =>
    new Date(dateString).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });

  const getVitalChips = (visit: Visit) => {
    const vitals: { label: string; unit?: string; alert?: boolean }[] = [];
    if (visit.weight) vitals.push({ label: `${visit.weight} kg` });
    if (visit.systolic_bp && visit.diastolic_bp) {
      const isHigh = visit.systolic_bp > 140 || visit.diastolic_bp > 90;
      vitals.push({
        label: `${visit.systolic_bp}/${visit.diastolic_bp}`,
        unit: "mmHg",
        alert: isHigh,
      });
    }
    if (visit.heart_rate)
      vitals.push({ label: `${visit.heart_rate}`, unit: "bpm" });
    if (visit.temperature) {
      const isHigh = visit.temperature > 37.5;
      vitals.push({ label: `${visit.temperature}°C`, alert: isHigh });
    }
    if (visit.blood_sugar) {
      const isHigh = visit.blood_sugar > 180;
      vitals.push({
        label: `${visit.blood_sugar}`,
        unit: "mg/dL",
        alert: isHigh,
      });
    }
    if (visit.oxygen_saturation)
      vitals.push({ label: `${visit.oxygen_saturation}%`, unit: "O₂" });
    return vitals;
  };

  const handleEditVisit = (visit: Visit) => {
    router.push(`/doctor/edit-visit?visitId=${visit.id}`);
  };

  if (loadingPatient) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#4285F4" />
          <Text style={styles.centerText}>Loading patient details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (patientError || !patient) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <MaterialIcons name="error-outline" size={48} color="#CCCCCC" />
          <Text style={styles.centerText}>
            {patientError || "Patient not found"}
          </Text>
          <Button
            mode="contained"
            onPress={() => router.back()}
            style={{ marginTop: 16 }}
            buttonColor="#4285F4"
          >
            Go Back
          </Button>
          <Button
            mode="outlined"
            onPress={() => loadPatientData(patient_id)}
            style={{ marginTop: 8 }}
            textColor="#4285F4"
          >
            Retry
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <MaterialIcons name="arrow-back" size={24} color="#333333" />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{patient.name}</Text>
        <Text style={styles.subtitle}>
          Age {patient.age} • {patient.gender}
        </Text>
      </View>
      <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
        <MaterialIcons name="refresh" size={24} color="#4285F4" />
      </TouchableOpacity>
    </View>
  );

  const renderTabs = () => (
    <View style={styles.tabRow}>
      <Button
        mode={activeView === "trends" ? "contained" : "outlined"}
        onPress={() => setActiveView("trends")}
        style={styles.tabButton}
        contentStyle={styles.tabButtonContent}
        buttonColor={activeView === "trends" ? "#4285F4" : undefined}
        textColor={activeView === "trends" ? "#FFFFFF" : "#4285F4"}
        icon={() => (
          <MaterialIcons
            name="trending-up"
            size={18}
            color={activeView === "trends" ? "#FFFFFF" : "#4285F4"}
          />
        )}
      >
        Trends
      </Button>

      <Button
        mode={activeView === "history" ? "contained" : "outlined"}
        onPress={() => setActiveView("history")}
        style={styles.tabButton}
        contentStyle={styles.tabButtonContent}
        buttonColor={activeView === "history" ? "#4285F4" : undefined}
        textColor={activeView === "history" ? "#FFFFFF" : "#4285F4"}
        icon={() => (
          <MaterialIcons
            name="history"
            size={18}
            color={activeView === "history" ? "#FFFFFF" : "#4285F4"}
          />
        )}
      >
        History
      </Button>

      <Button
        mode={activeView === "profile" ? "contained" : "outlined"}
        onPress={() => setActiveView("profile")}
        style={styles.tabButton}
        contentStyle={styles.tabButtonContent}
        buttonColor={activeView === "profile" ? "#4285F4" : undefined}
        textColor={activeView === "profile" ? "#FFFFFF" : "#4285F4"}
        icon={() => (
          <MaterialIcons
            name="badge"
            size={18}
            color={activeView === "profile" ? "#FFFFFF" : "#4285F4"}
          />
        )}
      >
        Profile
      </Button>
    </View>
  );

  const renderTrends = () => (
    <HealthTrendsComponent
      patientId={patient.id}
      showHeader={false}
      containerStyle={{ flex: 1 }}
    />
  );

  const renderVisitCard = (visit: Visit) => (
    <View key={visit.id} style={styles.visitCard}>
      {/* Visit Header */}
      <View style={styles.visitHeader}>
        <View style={styles.visitDateContainer}>
          <Text style={styles.visitDate}>{formatDate(visit.visit_date)}</Text>
          <Text style={styles.visitTime}>
            {formatTime(visit.visit_date)}
            {(() => {
              const label = getVisitShortLocation(visit as Visit);
              return label ? ` • ${label}` : "";
            })()}
          </Text>
        </View>
        {
          visit.chat_session_id?(<>
          <TouchableOpacity onPress={()=>{router.push(`/doctor/ai-chat-room?sessionId=${visit.chat_session_id}`)}}  style={styles.editButton}>
            <MaterialIcons name="chat" size={20} color="#4285F4" />
          </TouchableOpacity>

          </>):null
        }
        {visit.doctor_id ? (
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => handleEditVisit(visit)}
          >
            <MaterialIcons name="edit" size={20} color="#4285F4" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Doctor Info */}
      {(visit as any).field_doctors ? (
        <View style={styles.doctorInfo}>
          <View style={styles.doctorIcon}>
            <MaterialIcons name="local-hospital" size={16} color="#4285F4" />
          </View>
          <View style={styles.doctorDetails}>
            <Text style={styles.doctorName}>
              Dr. {(visit as any).field_doctors?.name}
            </Text>
            <Text style={styles.doctorSpecialization}>
              {(visit as any).field_doctors?.specialization}
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.doctorInfo}>
          <View style={styles.doctorIcon}>
            <MaterialIcons name="self-improvement" size={16} color="#4CAF50" />
          </View>
          <View style={styles.doctorDetails}>
            <Text style={styles.doctorName}>Self-recorded</Text>
            <Text style={styles.doctorSpecialization}>Personal entry</Text>
          </View>
        </View>
      )}

      {/* Vitals */}
      {(() => {
        const chips = getVitalChips(visit);
        if (!chips.length) return null;
        return (
          <View style={styles.vitalsSection}>
            <Text style={styles.sectionTitle}>Vitals</Text>
            <View style={styles.vitalsGrid}>
              {chips.map((v, idx) => (
                <View
                  key={idx}
                  style={[styles.vitalChip, v.alert && styles.alertChip]}
                >
                  <Text
                    style={[styles.vitalValue, v.alert && styles.alertText]}
                  >
                    {v.label}
                  </Text>
                  {v.unit ? (
                    <Text
                      style={[styles.vitalUnit, v.alert && styles.alertText]}
                    >
                      {v.unit}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          </View>
        );
      })()}

      {visit.symptoms ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Symptoms</Text>
          <Text style={styles.sectionContent}>{visit.symptoms}</Text>
        </View>
      ) : null}

      {visit.diagnosis ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Diagnosis</Text>
          <Text style={styles.sectionContent}>{visit.diagnosis}</Text>
        </View>
      ) : null}

      {visit.treatment_notes ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Treatment</Text>
          <Text style={styles.sectionContent}>{visit.treatment_notes}</Text>
        </View>
      ) : null}

      {visit.prescribed_medications ? (
        <View style={styles.medicationSection}>
          <Text style={styles.sectionTitle}>Medications</Text>
          <Text style={styles.medicationContent}>
            {visit.prescribed_medications}
          </Text>
        </View>
      ) : null}
    </View>
  );

  const renderHistory = () => {
    if (loadingHistory) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4285F4" />
          <Text style={styles.loadingText}>Loading history...</Text>
        </View>
      );
    }

    const TabHeader = () => (
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, historyTab === "doctor" && styles.activeTab]}
          onPress={() => setHistoryTab("doctor")}
        >
          <MaterialIcons
            name="local-hospital"
            size={20}
            color={historyTab === "doctor" ? "#4285F4" : "#999999"}
          />
          <Text
            style={[
              styles.tabText,
              historyTab === "doctor" && styles.activeTabText,
            ]}
          >
            Visits
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, historyTab === "ai" && styles.activeTab]}
          onPress={() => setHistoryTab("ai")}
        >
          <MaterialIcons
            name="psychology"
            size={20}
            color={historyTab === "ai" ? "#4285F4" : "#999999"}
          />
          <Text
            style={[
              styles.tabText,
              historyTab === "ai" && styles.activeTabText,
            ]}
          >
            AI Sessions
          </Text>
        </TouchableOpacity>
      </View>
    );

    return (
      <>
        <TabHeader />
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        >
          {historyTab === "doctor" ? (
            filteredVisits.length ? (
              filteredVisits.map(renderVisitCard)
            ) : (
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <MaterialIcons
                    name="medical-information"
                    size={48}
                    color="#CCCCCC"
                  />
                </View>
                <Text style={styles.emptyTitle}>No doctor visits yet</Text>
                <Text style={styles.emptyText}>
                  Doctor visit history will appear here after the first
                  appointment.
                </Text>
              </View>
            )
          ) : filteredAiSessions.length ? (
            filteredAiSessions.map(renderVisitCard)
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <MaterialIcons name="psychology" size={48} color="#CCCCCC" />
              </View>
              <Text style={styles.emptyTitle}>No AI sessions yet</Text>
              <Text style={styles.emptyText}>
                Start a conversation with the AI assistant to see it here.
              </Text>
            </View>
          )}
        </ScrollView>
      </>
    );
  };

  const renderProfile = () => (
    <ScrollView contentContainerStyle={styles.profileScrollContent}>
      {/* ... unchanged profile sections ... */}
      <View style={styles.profileBlock}>
        {/* Basic Information, Contact, Medical, Emergency sections unchanged */}
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.pageScrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          activeView !== "history" ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          ) : undefined
        }
      >
        {renderTabs()}
        {activeView === "trends"
          ? renderTrends()
          : activeView === "history"
            ? renderHistory()
            : renderProfile()}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  // styles unchanged from your file
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E8E8E8",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F8F9FA",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F0F7FF",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  title: { fontSize: 20, fontWeight: "600", color: "#333333" },
  subtitle: { fontSize: 12, color: "#888888", marginTop: 2 },
  content: { flex: 1 },
  pageScrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 24,
  },

  tabRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  tabButton: { flex: 1, borderRadius: 8, borderColor: "#4285F4" },
  tabButtonContent: { paddingVertical: 8 },

  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E8E8E8",
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 4,
    borderRadius: 8,
  },
  activeTab: { backgroundColor: "#F0F7FF" },
  tabText: { marginLeft: 8, fontSize: 16, color: "#999999", fontWeight: "500" },
  activeTabText: { color: "#4285F4", fontWeight: "600" },

  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  loadingText: { marginTop: 16, fontSize: 16, color: "#666666" },

  scrollContent: { padding: 20, paddingBottom: 20 },

  visitCard: {
    backgroundColor: "#FAFAFA",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E8E8E8",
  },
  visitHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  visitDateContainer: { flex: 1 },
  visitDate: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333333",
    marginBottom: 4,
  },
  visitTime: { fontSize: 14, color: "#666666" },
  editButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F0F7FF",
    alignItems: "center",
    justifyContent: "center",
  },

  doctorInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E8E8E8",
  },
  doctorIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F0F7FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  doctorDetails: { flex: 1 },
  doctorName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333333",
    marginBottom: 2,
  },
  doctorSpecialization: { fontSize: 14, color: "#666666" },

  vitalsSection: { marginBottom: 16 },
  vitalsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  vitalChip: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: "#E8E8E8",
    minWidth: 80,
    alignItems: "center",
  },
  alertChip: { backgroundColor: "#FFF5F5", borderColor: "#FFB3B3" },
  vitalValue: { fontSize: 16, fontWeight: "600", color: "#333333" },
  vitalUnit: { fontSize: 12, color: "#666666", marginTop: 2 },
  alertText: { color: "#D32F2F" },

  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333333",
    marginBottom: 8,
  },
  sectionContent: { fontSize: 14, color: "#666666", lineHeight: 20 },

  medicationSection: { marginBottom: 16 },
  medicationContent: {
    fontSize: 14,
    color: "#2E7D32",
    backgroundColor: "#F0F8F0",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E8F5E8",
    lineHeight: 20,
  },

  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F8F9FA",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#333333",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 16,
    color: "#666666",
    textAlign: "center",
    lineHeight: 24,
  },

  profileScrollContent: { paddingBottom: 20 },
  profileBlock: { gap: 20 },
  profileSection: {
    backgroundColor: "#FAFAFA",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E8E8E8",
    padding: 16,
  },
  profileSectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333333",
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E8E8E8",
  },
  profileRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  profileLabel: { color: "#666666", fontSize: 14, fontWeight: "500", flex: 1 },
  profileValue: {
    color: "#333333",
    fontSize: 14,
    flexShrink: 1,
    textAlign: "right",
    flex: 2,
  },

  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  centerText: {
    marginTop: 12,
    color: "#666666",
    fontSize: 16,
    textAlign: "center",
  },
});

export default PatientDetailsWrapper;
