import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Pressable,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native";
import { Text, Button, ActivityIndicator } from "react-native-paper";
import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
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

const LB_PER_KG = 2.2046226218;
const KG_PER_ST = 6.35029318;
const MMHG_PER_KPA = 7.50061683;
const MGDL_PER_MMOLL = 18;

const fromKg = (kg: number, u: "kg" | "lb" | "st") =>
  u === "kg" ? kg : u === "lb" ? kg * LB_PER_KG : kg / KG_PER_ST;

const fromCm = (cm: number, u: "cm" | "in" | "ft") =>
  u === "cm" ? cm : u === "in" ? cm / 2.54 : cm / 30.48;

const fromMmHg = (mmHg: number, u: "mmHg" | "kPa") =>
  u === "mmHg" ? mmHg : mmHg / MMHG_PER_KPA;

const fromC = (c: number, u: "C" | "F") => (u === "C" ? c : c * (9 / 5) + 32);

const fromMgdl = (mgdl: number, u: "mg_dL" | "mmol_L") =>
  u === "mg_dL" ? mgdl : mgdl / MGDL_PER_MMOLL;

const fmt = (n: number, d = 2) =>
  Number.isFinite(n) ? Number(n.toFixed(d)).toString() : "";

/* ---------- Small custom dropdown (single-open, no external deps) ---------- */
type UnitOption<T extends string> = { label: string; value: T };

function UnitDropdown<T extends string>({
  rowKey,
  label,
  value,
  options,
  openKey,
  setOpenKey,
  onChange,
  zIndexBase = 1000,
}: {
  rowKey: string;
  label: string;
  value: T;
  options: UnitOption<T>[];
  openKey: string | null;
  setOpenKey: (k: string | null) => void;
  onChange: (v: T) => void;
  zIndexBase?: number;
}) {
  const isOpen = openKey === rowKey;
  return (
    <View style={[styles.dropdownRow, isOpen && { zIndex: zIndexBase, elevation: 16 }]}>
      <Text style={styles.panelLabel}>{label}</Text>

      <View style={{ position: "relative" }}>
        <TouchableOpacity
          style={[styles.dropdownButton, isOpen && styles.dropdownButtonActive]}
          onPress={() => setOpenKey(isOpen ? null : rowKey)}
        >
          <Text style={styles.dropdownButtonText}>
            {options.find(o => o.value === value)?.label}
          </Text>
          <MaterialIcons name="arrow-drop-down" size={18} color="#333" />
        </TouchableOpacity>

        {isOpen ? (
          <>
            
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpenKey(null)} />
            <View style={styles.dropdownList}>
              {options.map(o => {
                const selected = o.value === value;
                return (
                  <TouchableOpacity
                    key={`${rowKey}-${o.value}`}
                    style={[styles.dropdownItem, selected && styles.dropdownItemSelected]}
                    onPress={() => {
                      onChange(o.value);
                      setOpenKey(null);
                    }}
                  >
                    <Text style={[styles.dropdownItemText, selected && styles.dropdownItemTextSelected]}>
                      {o.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        ) : null}
      </View>
    </View>
  );
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

  /* ---------- Global display-unit state (History -> Visits only) ---------- */
  const [dispWeight, setDispWeight] = useState<"kg" | "lb" | "st">("kg");
  const [dispHeight, setDispHeight] = useState<"cm" | "in" | "ft">("cm");
  const [dispBP, setDispBP] = useState<"mmHg" | "kPa">("mmHg");
  const [dispTemp, setDispTemp] = useState<"C" | "F">("C");
  const [dispSugar, setDispSugar] = useState<"mg_dL" | "mmol_L">("mg_dL");
  const [openKey, setOpenKey] = useState<string | null>(null); // only one dropdown open
  const [unitsModal, setUnitsModal] = useState(false);

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
        `
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
    if (visit.weight != null) {
      const w = fromKg(visit.weight, dispWeight);
      vitals.push({ label: `${fmt(w)} ${dispWeight}` });
    }
    if (visit.systolic_bp && visit.diastolic_bp) {
      const s = fromMmHg(visit.systolic_bp, dispBP);
      const d = fromMmHg(visit.diastolic_bp, dispBP);
      const isHigh = visit.systolic_bp > 140 || visit.diastolic_bp > 90;
      vitals.push({
        label: `${fmt(s, dispBP === "kPa" ? 1 : 0)}/${fmt(
          d,
          dispBP === "kPa" ? 1 : 0
        )}`,
        unit: dispBP,
        alert: isHigh,
      });
    }
    if (visit.heart_rate != null)
      vitals.push({ label: `${visit.heart_rate}`, unit: "bpm" });
    if (visit.temperature != null) {
      const t = fromC(visit.temperature, dispTemp);
      vitals.push({ label: `${fmt(t, 1)}°${dispTemp}` });
    }
    if (visit.blood_sugar != null) {
      const b = fromMgdl(visit.blood_sugar, dispSugar);
      vitals.push({
        label: `${fmt(b, dispSugar === "mmol_L" ? 1 : 0)}`,
        unit: dispSugar === "mg_dL" ? "mg/dL" : "mmol/L",
        alert: visit.blood_sugar > 180,
      });
    }
    if (visit.oxygen_saturation != null)
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
          onPress={() => { setHistoryTab("doctor"); setOpenKey(null); }}
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
          onPress={() => { setHistoryTab("ai"); setOpenKey(null); }}
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

       

     
        {historyTab === "doctor" ? (
          <>
            <Button style={{alignSelf:'flex-end'}} onPress={() => setUnitsModal(true)}>
              <MaterialIcons name="menu" size={25} color="#4285F4" />
            </Button>
            <Modal 
              visible={unitsModal}
              transparent={true}
              animationType="fade"
              onRequestClose={() => setUnitsModal(false)}
            >
              <TouchableOpacity 
                style={styles.modalOverlay}
                activeOpacity={1}
                onPress={() => setUnitsModal(false)}
              >
                <View style={styles.modalContainer}>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Unit Settings</Text>
                    <TouchableOpacity 
                      style={styles.modalCloseButton}
                      onPress={() => setUnitsModal(false)}
                    >
                      <MaterialIcons name="close" size={24} color="#666666" />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.unitPanel}>
                    <UnitDropdown
                      rowKey="w"
                      label="Weight"
                      value={dispWeight}
                      onChange={(v) => setDispWeight(v as any)}
                      options={[
                        { label: "kg", value: "kg" },
                        { label: "lb", value: "lb" },
                        { label: "st", value: "st" },
                      ]}
                      openKey={openKey}
                      setOpenKey={setOpenKey}
                      zIndexBase={1050}
                    />
                    <UnitDropdown
                      rowKey="h"
                      label="Height"
                      value={dispHeight}
                      onChange={(v) => setDispHeight(v as any)}
                      options={[
                        { label: "cm", value: "cm" },
                        { label: "in", value: "in" },
                        { label: "ft", value: "ft" },
                      ]}
                      openKey={openKey}
                      setOpenKey={setOpenKey}
                      zIndexBase={1040}
                    />
                    <UnitDropdown
                      rowKey="t"
                      label="Temperature"
                      value={dispTemp}
                      onChange={(v) => setDispTemp(v as any)}
                      options={[
                        { label: "°C", value: "C" },
                        { label: "°F", value: "F" },
                      ]}
                      openKey={openKey}
                      setOpenKey={setOpenKey}
                      zIndexBase={1030}
                    />
                    <UnitDropdown
                      rowKey="bp"
                      label="Blood Pressure"
                      value={dispBP}
                      onChange={(v) => setDispBP(v as any)}
                      options={[
                        { label: "mmHg", value: "mmHg" },
                        { label: "kPa", value: "kPa" },
                      ]}
                      openKey={openKey}
                      setOpenKey={setOpenKey}
                      zIndexBase={1020}
                    />
                    <UnitDropdown
                      rowKey="s"
                      label="Blood Sugar"
                      value={dispSugar}
                      onChange={(v) => setDispSugar(v as any)}
                      options={[
                        { label: "mg/dL", value: "mg_dL" },
                        { label: "mmol/L", value: "mmol_L" },
                      ]}
                      openKey={openKey}
                      setOpenKey={setOpenKey}
                      zIndexBase={1010}
                    />
                  </View>
                </View>
              </TouchableOpacity>
            </Modal>
          </>
        ) : null}

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
      <View style={styles.profileBlock} />
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
  // original styles preserved
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

  
  unitPanel: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8E8E8",
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 8,
  },
  dropdownRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  panelLabel: { fontSize: 14, fontWeight: "600", color: "#333" },
  dropdownButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: "#F5F5F5",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  dropdownButtonActive: { borderColor: "#4285F4" },
  dropdownButtonText: { fontSize: 14, color: "#333", fontWeight: "600", marginRight: 2 },
  dropdownList: {
    position: "absolute",
    top: 36,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
    overflow: "hidden",
    elevation: 16,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 6 },
    zIndex: 9999,
  },
  dropdownItem: { paddingVertical: 8, paddingHorizontal: 12, minWidth: 90 },
  dropdownItemSelected: { backgroundColor: "#E9F2FF" },
  dropdownItemText: { fontSize: 14, color: "#333" },
  dropdownItemTextSelected: { color: "#1a73e8", fontWeight: "700" },

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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    maxWidth: 400,
    width: '100%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default PatientDetailsWrapper;
