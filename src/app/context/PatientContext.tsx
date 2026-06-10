"use client";

import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase, ensurePatientsTableExists, ensureVisitsTableExists } from '@/lib/supabase';
import { useAuth } from './AuthContext';

// Define the Patient interface
export interface Patient {
  id: string;
  name: string;
  dob: string;
  hospitalFileNumber: string;
  mobileNumber: string;
  sex: string;
  ageOfDiagnosis: string;
  diagnosis: string;
  treatment: string;
  currentTreatment: string;
  clinicId: string;
  note: string;
  tableData?: string;
  history?: string;
  pastMedicalHistory?: string;
  drugHistory?: string;
  pastSurgicalHistory?: string;
  examination?: string;
  followUpDate?: string;
  prescription?: string;
  createdAt: string;
  userId?: string;
}

// Define the Visit interface
export interface Visit {
  id: string;
  patient_id: string;
  diagnosis: string;
  treatment: string;
  current_treatment: string;
  history: string;
  past_medical_history: string;
  drug_history: string;
  past_surgical_history: string;
  examination: string;
  follow_up_date: string;
  note: string;
  table_data: string;
  prescription?: string;
  visited_at: string;
  user_id: string;
  investigations?: Array<{ id: string; imageUrl: string; fileName: string; uploadedAt: string }>;
}

// Define the Appointment interface
export interface Appointment {
  id: string;
  patientName: string;
  phoneNumber: string;
  appointmentDate: string;
  appointmentTime: string;
  notes: string;
  status: 'Scheduled' | 'Arrived' | 'Completed' | 'Cancelled';
  createdAt: string;
  userId: string;
}

// Define the database record shape
interface PatientRecord {
  id: string;
  name: string;
  dob: string;
  hospital_file_number: string;
  mobile_number: string;
  sex: string;
  age_of_diagnosis: string;
  diagnosis: string;
  treatment: string;
  current_treatment: string;
  clinic_id: string;
  note: string;
  table_data?: string;
  history?: string;
  past_medical_history?: string;
  drug_history?: string;
  past_surgical_history?: string;
  examination?: string;
  follow_up_date?: string;
  created_at: string;
  user_id: string;
}

interface PatientContextType {
  patients: Patient[];
  appointments: Appointment[];
  isLoading: boolean;
  error: string | null;
  addPatient: (patient: Omit<Patient, 'id' | 'createdAt' | 'userId'>) => Promise<void>;
  editPatient: (id: string, patient: Partial<Omit<Patient, 'id' | 'createdAt' | 'userId'>>) => Promise<void>;
  getPatient: (id: string) => Patient | undefined;
  deletePatient: (id: string) => Promise<void>;
  refreshPatients: () => Promise<void>;
  addVisit: (patientId: string, visitData: Partial<Patient>) => Promise<void>;
  editVisit: (visitId: string, visitData: Partial<Visit>) => Promise<void>;
  getPatientVisits: (patientId: string) => Promise<Visit[]>;
  addAppointment: (appointment: Omit<Appointment, 'id' | 'createdAt' | 'userId'>) => Promise<void>;
  editAppointment: (id: string, appointment: Partial<Omit<Appointment, 'id' | 'createdAt' | 'userId'>>) => Promise<void>;
  deleteAppointment: (id: string) => Promise<void>;
  refreshAppointments: () => Promise<void>;
}

const PatientContext = createContext<PatientContextType | undefined>(undefined);

export function PatientProvider({ children }: { children: React.ReactNode }) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tableChecked, setTableChecked] = useState(false);
  const { session, isAuthenticated, userId, isStaffAuth, isReceptionAuth } = useAuth();

  // Check if the patients table exists
  useEffect(() => {
    async function checkTable() {
      if (isAuthenticated) {
        const exists = await ensurePatientsTableExists();
        if (!exists) {
          setError('Database table not found. Please contact the administrator.');
        }
        await ensureVisitsTableExists();
        setTableChecked(true);
      } else {
        setTableChecked(true);
      }
    }

    if (!tableChecked && isAuthenticated) {
      checkTable();
    }
  }, [isAuthenticated, tableChecked]);

  // Load patients data
  const fetchPatients = async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (!isAuthenticated || !userId) {
        // Not authenticated
        setPatients([]);
        return;
      }

      // For admin user, don't filter by user_id to get all records
      let query = supabase
        .from('patients')
        .select('*')
        .order('created_at', { ascending: false });

      // If not the admin user, filter by user_id
      if (userId !== '00000000-0000-0000-0000-000000000000') {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Supabase error fetching patients:', error);
        throw new Error(`Database error: ${error.message}`);
      }

      if (data) {
        // Map from snake_case to camelCase
        const formattedPatients = data.map((p: PatientRecord) => ({
          id: p.id,
          name: p.name,
          dob: p.dob || '',
          hospitalFileNumber: p.hospital_file_number,
          mobileNumber: p.mobile_number,
          sex: p.sex,
          ageOfDiagnosis: p.age_of_diagnosis,
          diagnosis: p.diagnosis,
          treatment: p.treatment,
          currentTreatment: p.current_treatment || '',
          clinicId: p.clinic_id || '',
          note: p.note,
          tableData: p.table_data || '',
          history: p.history || '',
          pastMedicalHistory: p.past_medical_history || '',
          drugHistory: p.drug_history || '',
          pastSurgicalHistory: p.past_surgical_history || '',
          examination: p.examination || '',
          followUpDate: p.follow_up_date || '',
          createdAt: p.created_at,
          userId: p.user_id
        }));

        setPatients(formattedPatients);
      }
    } catch (err) {
      console.error('Error fetching patients:', err);
      setError(err instanceof Error ? err.message : 'Failed to load patients');
    } finally {
      setIsLoading(false);
    }
  };

  // Load appointments data
  const fetchAppointments = async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (!isAuthenticated || !userId) {
        setAppointments([]);
        return;
      }

      let query = supabase
        .from('appointments')
        .select('*')
        .order('appointment_date', { ascending: true })
        .order('appointment_time', { ascending: true });

      if (userId !== '00000000-0000-0000-0000-000000000000') {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Supabase error fetching appointments:', error);
        throw new Error(`Database error: ${error.message}`);
      }

      if (data) {
        const formattedAppointments = data.map((a: any) => ({
          id: a.id,
          patientName: a.patient_name,
          phoneNumber: a.phone_number,
          appointmentDate: a.appointment_date,
          appointmentTime: a.appointment_time,
          notes: a.notes || '',
          status: a.status as 'Scheduled' | 'Arrived' | 'Completed' | 'Cancelled',
          createdAt: a.created_at,
          userId: a.user_id
        }));

        setAppointments(formattedAppointments);
      }
    } catch (err) {
      console.error('Error fetching appointments:', err);
      setError(err instanceof Error ? err.message : 'Failed to load appointments');
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh patients and appointments when auth state changes
  useEffect(() => {
    if (tableChecked && isAuthenticated && userId) {
      fetchPatients();
      fetchAppointments();
    } else {
      setPatients([]);
      setAppointments([]);
    }
  }, [isAuthenticated, userId, tableChecked]);

  // Add a new patient
  const addPatient = async (patientData: Omit<Patient, 'id' | 'createdAt' | 'userId'>) => {
    try {
      setIsLoading(true);
      setError(null);

      if (!isAuthenticated || !userId) {
        throw new Error('Not authenticated');
      }

      // For staff/reception: ignore restricted fields on create (server-side guard)
      const sanitizedData = (isStaffAuth || isReceptionAuth) ? {
        ...patientData,
        diagnosis: '',
        treatment: '',
        currentTreatment: '',
        note: '',
        tableData: '',
        history: '',
        pastMedicalHistory: '',
        drugHistory: '',
        pastSurgicalHistory: '',
        examination: '',
        followUpDate: '',
      } : patientData;

      // Generate Clinic ID: [PatientCount][DDMMYY]
      // 1. Get today's date in DDMMYY format
      const today = new Date();
      const day = String(today.getDate()).padStart(2, '0');
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const year = String(today.getFullYear()).slice(-2);
      const dateFormat = `${day}${month}${year}`;

      // 2. Count patients added today to determine count
      const startOfDay = new Date(today);
      startOfDay.setHours(0, 0, 0, 0);

      const { data: todaysPatients, error: countError } = await supabase
        .from('patients')
        .select('id')
        .gte('created_at', startOfDay.toISOString());

      if (countError) {
        console.error('Error counting today\'s patients:', countError);
        throw new Error(`Database error: ${countError.message}`);
      }

      // Add 1 to the count (zero-indexed array)
      const patientCount = (todaysPatients?.length || 0) + 1;

      // Create clinic ID with 2-digit patient count (padded with leading zero if needed)
      const patientCountFormatted = String(patientCount).padStart(2, '0');

      // Create clinic ID
      const clinicId = `${patientCountFormatted}${dateFormat}`;

      // Always use Supabase for data storage
      const { data, error } = await supabase
        .from('patients')
        .insert({
          name: sanitizedData.name, // Only name is required
          dob: sanitizedData.dob || '',
          hospital_file_number: sanitizedData.hospitalFileNumber || '',
          mobile_number: sanitizedData.mobileNumber || '',
          sex: sanitizedData.sex || '',
          age_of_diagnosis: sanitizedData.ageOfDiagnosis || '',
          diagnosis: sanitizedData.diagnosis || '',
          treatment: sanitizedData.treatment || '',
          current_treatment: sanitizedData.currentTreatment || '',
          clinic_id: clinicId,
          note: sanitizedData.note || '',
          table_data: sanitizedData.tableData || '',
          history: sanitizedData.history || '',
          past_medical_history: sanitizedData.pastMedicalHistory || '',
          drug_history: sanitizedData.drugHistory || '',
          past_surgical_history: sanitizedData.pastSurgicalHistory || '',
          examination: sanitizedData.examination || '',
          follow_up_date: sanitizedData.followUpDate || '',
          user_id: userId
        })
        .select();

      if (error) {
        console.error('Supabase error adding patient:', error);
        throw new Error(`Database error: ${error.message}`);
      }

      if (data && data[0]) {
        const newPatientData = data[0];
        
        // Add the new patient to the state
        const newPatient: Patient = {
          id: newPatientData.id,
          name: newPatientData.name,
          dob: newPatientData.dob || '',
          hospitalFileNumber: newPatientData.hospital_file_number,
          mobileNumber: newPatientData.mobile_number,
          sex: newPatientData.sex,
          ageOfDiagnosis: newPatientData.age_of_diagnosis,
          diagnosis: newPatientData.diagnosis,
          treatment: newPatientData.treatment,
          currentTreatment: newPatientData.current_treatment || '',
          clinicId: newPatientData.clinic_id || '',
          note: newPatientData.note,
          tableData: newPatientData.table_data || '',
          history: newPatientData.history || '',
          pastMedicalHistory: newPatientData.past_medical_history || '',
          drugHistory: newPatientData.drug_history || '',
          pastSurgicalHistory: newPatientData.past_surgical_history || '',
          examination: newPatientData.examination || '',
          followUpDate: newPatientData.follow_up_date || '',
          createdAt: newPatientData.created_at,
          userId: newPatientData.user_id
        };

        setPatients(prevPatients => [newPatient, ...prevPatients]);

        // Automatically log a visit for new patients
        try {
          // Check if visits table exists first
          const visitsTableExists = await ensureVisitsTableExists();

          if (visitsTableExists) {
            const visitData = {
              patient_id: data[0].id,
              diagnosis: sanitizedData.diagnosis || '',
              treatment: sanitizedData.treatment || '',
              current_treatment: sanitizedData.currentTreatment || '',
              history: sanitizedData.history || '',
              past_medical_history: sanitizedData.pastMedicalHistory || '',
              drug_history: sanitizedData.drugHistory || '',
              past_surgical_history: sanitizedData.pastSurgicalHistory || '',
              examination: sanitizedData.examination || '',
              follow_up_date: sanitizedData.followUpDate || '',
              note: sanitizedData.note || '',
              table_data: sanitizedData.tableData || '',
              user_id: userId
            };
            const { error: visitError } = await supabase.from('visits').insert(visitData);
            if (visitError) {
              console.error('Error logging initial visit for new patient:', visitError);
            } else {
              console.log('Successfully logged initial visit for new patient');
            }
          } else {
            console.error('Skipping visit logging - visits table does not exist');
          }
        } catch (visitErr) {
          console.error('Error logging initial visit for new patient:', visitErr);
          // Don't throw - we still created the patient successfully
        }
      }
    } catch (err) {
      console.error('Error adding patient:', err);
      setError('Failed to add patient');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Edit a patient
  const editPatient = async (id: string, patientData: Partial<Omit<Patient, 'id' | 'createdAt' | 'userId'>>) => {
    try {
      setIsLoading(true);
      setError(null);

      if (!isAuthenticated || !userId) {
        throw new Error('Not authenticated');
      }

      // Disallow editing for staff/reception role
      if (isStaffAuth || isReceptionAuth) {
        const msg = "You don’t have permission to edit patient data.";
        setError(msg);
        throw new Error(msg);
      }

      // Convert camelCase to snake_case for database
      const dbData: any = {};

      if (patientData.name !== undefined) dbData.name = patientData.name;
      if (patientData.dob !== undefined) dbData.dob = patientData.dob;
      if (patientData.hospitalFileNumber !== undefined) dbData.hospital_file_number = patientData.hospitalFileNumber;
      if (patientData.mobileNumber !== undefined) dbData.mobile_number = patientData.mobileNumber;
      if (patientData.sex !== undefined) dbData.sex = patientData.sex;
      if (patientData.ageOfDiagnosis !== undefined) dbData.age_of_diagnosis = patientData.ageOfDiagnosis;
      if (patientData.diagnosis !== undefined) dbData.diagnosis = patientData.diagnosis;
      if (patientData.treatment !== undefined) dbData.treatment = patientData.treatment;
      if (patientData.currentTreatment !== undefined) dbData.current_treatment = patientData.currentTreatment;
      // Note: we don't allow editing clinicId as it's system-generated
      if (patientData.note !== undefined) dbData.note = patientData.note;
      if (patientData.tableData !== undefined) dbData.table_data = patientData.tableData;
      if (patientData.history !== undefined) dbData.history = patientData.history;
      if (patientData.pastMedicalHistory !== undefined) dbData.past_medical_history = patientData.pastMedicalHistory;
      if (patientData.drugHistory !== undefined) dbData.drug_history = patientData.drugHistory;
      if (patientData.pastSurgicalHistory !== undefined) dbData.past_surgical_history = patientData.pastSurgicalHistory;
      if (patientData.examination !== undefined) dbData.examination = patientData.examination;
      if (patientData.followUpDate !== undefined) dbData.follow_up_date = patientData.followUpDate;

      // Always use Supabase for data storage
      const { error } = await supabase
        .from('patients')
        .update(dbData)
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        console.error('Supabase error editing patient:', error);
        throw new Error(`Database error: ${error.message}`);
      }

      // Update local state
      setPatients((prevPatients: Patient[]) => prevPatients.map((patient: Patient) =>
        patient.id === id ? { ...patient, ...patientData } : patient
      ));
    } catch (err) {
      console.error('Error editing patient:', err);
      setError('Failed to edit patient');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Get a patient by ID
  const getPatient = (id: string) => {
    return patients.find(patient => patient.id === id);
  };

  // Delete a patient
  const deletePatient = async (id: string) => {
    try {
      setIsLoading(true);
      setError(null);

      if (!isAuthenticated || !userId) {
        throw new Error('Not authenticated');
      }

      // Always use Supabase for data storage
      // 1. Cleanup R2 storage first (best effort)
      try {
        await fetch('/api/r2/delete-patient', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ patientId: id }),
        });
      } catch (cleanupErr) {
        console.error('Failed to cleanup R2 storage for patient:', cleanupErr);
        // Continue with DB deletion even if R2 cleanup fails
      }

      // 2. Delete patient from DB (visits will be deleted via cascade if set, but we might need to manually handle visits if not)
      const { error } = await supabase
        .from('patients')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        console.error('Supabase error deleting patient:', error);
        throw new Error(`Database error: ${error.message}`);
      }

      // Update local state
      setPatients((prevPatients: Patient[]) => prevPatients.filter((patient: Patient) => patient.id !== id));
    } catch (err) {
      console.error('Error deleting patient:', err);
      setError('Failed to delete patient');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh patients data
  const refreshPatients = async () => {
    await fetchPatients();
  };

  // Add a new visit for an existing patient
  const addVisit = async (patientId: string, visitData: Partial<Patient>) => {
    try {
      setIsLoading(true);
      setError(null);

      if (!isAuthenticated || !userId) {
        throw new Error('Not authenticated');
      }

      // First check if visits table exists
      const visitsTableExists = await ensureVisitsTableExists();
      if (!visitsTableExists) {
        throw new Error('Visits table does not exist. Please contact administrator.');
      }

      const dbVisitData = {
        patient_id: patientId,
        diagnosis: visitData.diagnosis || '',
        treatment: visitData.treatment || '',
        current_treatment: visitData.currentTreatment || '',
        history: visitData.history || '',
        past_medical_history: visitData.pastMedicalHistory || '',
        drug_history: visitData.drugHistory || '',
        past_surgical_history: visitData.pastSurgicalHistory || '',
        examination: visitData.examination || '',
        follow_up_date: visitData.followUpDate || '',
        note: visitData.note || '',
        table_data: visitData.tableData || '',
        user_id: userId
      };

      const { error: visitError } = await supabase.from('visits').insert(dbVisitData);
      if (visitError) {
        console.error('Error logging new visit:', visitError);
        throw new Error(`Failed to add visit: ${visitError.message}`);
      }

      // Optional: Update the patient's record with the latest visit info so it reflects in the main table
      const { error: updateError } = await supabase
        .from('patients')
        .update({
          diagnosis: dbVisitData.diagnosis,
          treatment: dbVisitData.treatment,
          current_treatment: dbVisitData.current_treatment,
          history: dbVisitData.history,
          past_medical_history: dbVisitData.past_medical_history,
          drug_history: dbVisitData.drug_history,
          past_surgical_history: dbVisitData.past_surgical_history,
          examination: dbVisitData.examination,
          follow_up_date: dbVisitData.follow_up_date,
          note: dbVisitData.note,
          table_data: dbVisitData.table_data
        })
        .eq('id', patientId);

      if (updateError) {
        console.error('Error updating patient with latest visit info:', updateError);
        // Don't throw here, the visit was successfully created
      } else {
        // Update local state if successful
        setPatients((prevPatients) => prevPatients.map(p => 
          p.id === patientId ? { ...p, ...visitData } : p
        ));
      }

    } catch (err) {
      console.error('Error adding visit:', err);
      setError(err instanceof Error ? err.message : 'Failed to add visit');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Get visits for a specific patient
  const getPatientVisits = async (patientId: string): Promise<Visit[]> => {
    try {
      const { data, error: visitError } = await supabase
        .from('visits')
        .select('*')
        .eq('patient_id', patientId)
        .order('visited_at', { ascending: false });

      if (visitError) {
        console.error('Error fetching patient visits:', visitError);
        return [];
      }

      return data || [];
    } catch (err) {
      console.error('Exception in getPatientVisits:', err);
      return [];
    }
  };

  // Edit a specific visit record (does NOT touch other visits)
  const editVisit = async (visitId: string, visitData: Partial<Visit>) => {
    try {
      const dbData: Record<string, string> = {};
      if (visitData.diagnosis !== undefined) dbData.diagnosis = visitData.diagnosis;
      if (visitData.treatment !== undefined) dbData.treatment = visitData.treatment;
      if (visitData.current_treatment !== undefined) dbData.current_treatment = visitData.current_treatment;
      if (visitData.history !== undefined) dbData.history = visitData.history;
      if (visitData.past_medical_history !== undefined) dbData.past_medical_history = visitData.past_medical_history;
      if (visitData.drug_history !== undefined) dbData.drug_history = visitData.drug_history;
      if (visitData.past_surgical_history !== undefined) dbData.past_surgical_history = visitData.past_surgical_history;
      if (visitData.examination !== undefined) dbData.examination = visitData.examination;
      if (visitData.follow_up_date !== undefined) dbData.follow_up_date = visitData.follow_up_date;
      if (visitData.note !== undefined) dbData.note = visitData.note;
      if (visitData.prescription !== undefined) dbData.prescription = visitData.prescription;
      if (visitData.table_data !== undefined) dbData.table_data = visitData.table_data;

      const { error } = await supabase
        .from('visits')
        .update(dbData)
        .eq('id', visitId);

      if (error) {
        console.error('Error editing visit:', error);
        throw new Error(`Failed to edit visit: ${error.message}`);
      }
    } catch (err) {
      console.error('Exception in editVisit:', err);
      throw err;
    }
  };

  const addAppointment = async (apptData: Omit<Appointment, 'id' | 'createdAt' | 'userId'>) => {
    try {
      setIsLoading(true);
      setError(null);

      if (!isAuthenticated || !userId) {
        throw new Error('Not authenticated');
      }

      const { data, error } = await supabase
        .from('appointments')
        .insert({
          patient_name: apptData.patientName,
          phone_number: apptData.phoneNumber,
          appointment_date: apptData.appointmentDate,
          appointment_time: apptData.appointmentTime,
          notes: apptData.notes || '',
          status: apptData.status || 'Scheduled',
          user_id: userId
        })
        .select();

      if (error) {
        console.error('Supabase error adding appointment:', error);
        throw new Error(`Database error: ${error.message}`);
      }

      if (data && data[0]) {
        const newAppt: Appointment = {
          id: data[0].id,
          patientName: data[0].patient_name,
          phoneNumber: data[0].phone_number,
          appointmentDate: data[0].appointment_date,
          appointmentTime: data[0].appointment_time,
          notes: data[0].notes || '',
          status: data[0].status as 'Scheduled' | 'Arrived' | 'Completed' | 'Cancelled',
          createdAt: data[0].created_at,
          userId: data[0].user_id
        };

        setAppointments(prev => [...prev, newAppt].sort((a, b) => 
          a.appointmentDate.localeCompare(b.appointmentDate) || a.appointmentTime.localeCompare(b.appointmentTime)
        ));
      }
    } catch (err) {
      console.error('Error adding appointment:', err);
      setError(err instanceof Error ? err.message : 'Failed to add appointment');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const editAppointment = async (id: string, apptData: Partial<Omit<Appointment, 'id' | 'createdAt' | 'userId'>>) => {
    try {
      setIsLoading(true);
      setError(null);

      if (!isAuthenticated || !userId) {
        throw new Error('Not authenticated');
      }

      const dbData: any = {};
      if (apptData.patientName !== undefined) dbData.patient_name = apptData.patientName;
      if (apptData.phoneNumber !== undefined) dbData.phone_number = apptData.phoneNumber;
      if (apptData.appointmentDate !== undefined) dbData.appointment_date = apptData.appointmentDate;
      if (apptData.appointmentTime !== undefined) dbData.appointment_time = apptData.appointmentTime;
      if (apptData.notes !== undefined) dbData.notes = apptData.notes;
      if (apptData.status !== undefined) dbData.status = apptData.status;

      const { error } = await supabase
        .from('appointments')
        .update(dbData)
        .eq('id', id);

      if (error) {
        console.error('Supabase error editing appointment:', error);
        throw new Error(`Database error: ${error.message}`);
      }

      setAppointments(prev => prev.map(app => 
        app.id === id ? { ...app, ...apptData } : app
      ).sort((a, b) => 
        a.appointmentDate.localeCompare(b.appointmentDate) || a.appointmentTime.localeCompare(b.appointmentTime)
      ));
    } catch (err) {
      console.error('Error editing appointment:', err);
      setError(err instanceof Error ? err.message : 'Failed to edit appointment');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteAppointment = async (id: string) => {
    try {
      setIsLoading(true);
      setError(null);

      if (!isAuthenticated || !userId) {
        throw new Error('Not authenticated');
      }

      if (isStaffAuth || isReceptionAuth) {
        throw new Error("You don't have permission to delete appointments.");
      }

      const { error } = await supabase
        .from('appointments')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Supabase error deleting appointment:', error);
        throw new Error(`Database error: ${error.message}`);
      }

      setAppointments(prev => prev.filter(app => app.id !== id));
    } catch (err) {
      console.error('Error deleting appointment:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete appointment');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const refreshAppointments = async () => {
    await fetchAppointments();
  };

  return (
    <PatientContext.Provider value={{
      patients,
      appointments,
      isLoading,
      error,
      addPatient,
      editPatient,
      getPatient,
      deletePatient,
      refreshPatients,
      addVisit,
      editVisit,
      getPatientVisits,
      addAppointment,
      editAppointment,
      deleteAppointment,
      refreshAppointments
    }}>
      {children}
    </PatientContext.Provider>
  );
}

export function usePatients() {
  const context = useContext(PatientContext);
  if (context === undefined) {
    throw new Error('usePatients must be used within a PatientProvider');
  }
  return context;
} 