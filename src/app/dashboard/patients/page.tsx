"use client";

import { useState, useEffect, Suspense } from 'react';
import { usePatients, Patient, Visit } from '../../context/PatientContext';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import PatientEditForm from '../../components/PatientEditForm';
import InvestigationModal from '../../components/InvestigationModal';
import { exportToExcel } from '@/lib/excelExport';
import { generatePatientPDF } from '@/lib/pdfGenerator';
import { supabase } from '@/lib/supabase';
import { useAuth } from '../../context/AuthContext';

function PatientsPageContent() {
  const { patients, deletePatient, editPatient, isLoading, error, refreshPatients, getPatientVisits, editVisit } = usePatients();
  const { isStaffAuth, isReceptionAuth, isAuthenticated } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  useEffect(() => {
    if (isStaffAuth || isReceptionAuth) {
      router.push('/dashboard/schedule');
    }
  }, [isStaffAuth, isReceptionAuth, router]);

  useEffect(() => {
    const query = searchParams.get('search');
    if (query) {
      setSearchTerm(query);
    }
  }, [searchParams]);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showMobileDetails, setShowMobileDetails] = useState(false);
  const [ageFilter, setAgeFilter] = useState<string>('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [customMinAge, setCustomMinAge] = useState<string>('');
  const [customMaxAge, setCustomMaxAge] = useState<string>('');
  const [showCustomAgeInputs, setShowCustomAgeInputs] = useState(false);
  // New filter state
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [patientVisits, setPatientVisits] = useState<Visit[]>([]);
  const [isLoadingVisits, setIsLoadingVisits] = useState(false);

  // Visit selector modals
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [showEditVisitModal, setShowEditVisitModal] = useState(false);
  const [editingVisit, setEditingVisit] = useState<Visit | null>(null);
  const [editVisitForm, setEditVisitForm] = useState<Partial<Visit>>({});
  const [isSavingVisit, setIsSavingVisit] = useState(false);
  
  // Print options modal
  const [showPrintOptionsModal, setShowPrintOptionsModal] = useState(false);
  const [printingVisit, setPrintingVisit] = useState<Visit | null>(null);

  // Quick Actions states
  const [showQuickExamModal, setShowQuickExamModal] = useState(false);
  const [showQuickPrescriptionModal, setShowQuickPrescriptionModal] = useState(false);
  const [showQuickInvestigationModal, setShowQuickInvestigationModal] = useState(false);
  const [quickActionVisit, setQuickActionVisit] = useState<Visit | null>(null);
  const [quickActionPatient, setQuickActionPatient] = useState<Patient | null>(null);
  const [isPerformingQuickAction, setIsPerformingQuickAction] = useState<string | null>(null); // patientId
  const [patientVisitsMap, setPatientVisitsMap] = useState<Record<string, Visit[]>>({});
  const [selectedVisitIdMap, setSelectedVisitIdMap] = useState<Record<string, string>>({});

  // Fetch all visit summaries for the dropdowns
  const fetchAllVisitSummaries = async () => {
    try {
      const { data, error } = await supabase
        .from('visits')
        .select('id, patient_id, visited_at')
        .order('visited_at', { ascending: false });

      if (error) throw error;

      const map: Record<string, Visit[]> = {};
      data?.forEach((v: any) => {
        if (!map[v.patient_id]) map[v.patient_id] = [];
        map[v.patient_id].push(v as Visit);
      });
      setPatientVisitsMap(map);
    } catch (err) {
      console.error('Error fetching visit summaries:', err);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchAllVisitSummaries();
    }
  }, [isAuthenticated, patients]);


  // Format date for display
  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  // Calculate age from DOB
  const calculateAge = (dob: string): number | string => {
    if (!dob) return 'N/A';
    const birthDate = new Date(dob);
    if (isNaN(birthDate.getTime())) return 'N/A';

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age;
  };

  // Generic print function to handle all print types
  const handlePrintGeneric = (patient: Patient, content: string, title: string) => {
    // Create a new window for the print document
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups for this website');
      return;
    }

    // Check if patient has necessary fields
    if (!patient.name || !patient.clinicId) {
      alert('Patient information is incomplete. Please ensure name and clinic ID are filled.');
      printWindow.close();
      return;
    }

    // Create content for the print window
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title} - ${patient.name}</title>
        <style>
          /* Reset all margins and paddings */
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          html, body {
            width: 148mm;
            height: 210mm;
            margin: 0;
            padding: 0;
            background: white;
            font-family: Arial, sans-serif;
            overflow: hidden;
          }
          
          .print-container {
            width: 148mm;
            height: 210mm;
            position: relative;
            border: none;
            display: flex;
            margin: 0 auto;
            background: white;
            page-break-inside: avoid;
            page-break-after: always;
          }
            
          .report-image {
            width: 100%;
            height: 100%;
            display: block;
            position: absolute;
            top: 0;
            left: 0;
            object-fit: contain;
            object-position: top left;
            image-rendering: -webkit-optimize-contrast;
            image-rendering: crisp-edges;
            image-rendering: pixelated;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
            
          /* Treatment data container - positioned at middle left */
          .treatment-data {
            position: absolute;
            top: 295px;  /* Shifted down to be fully under the Rx: label */
            left: 20px;
            width: 90%;
            padding: 10px;
            box-sizing: border-box;
          }
          
          .clinic-container {
            position: absolute;
            top: 165px;  /* Shifted down from 122px next to green text M.B.Ch.B */
            right: 30px;
            display: flex;
          }
          .clinic-id-label {
            font-size: 10px;
            font-weight: bold;
            margin-right: 6px;
          }
          .clinic-id-value {
            font-size: 10px;
            font-weight: bold;
          }

          .name-arabic-container {
            position: absolute;
            top: 232px;  /* Align perfectly on the dotted line of اسم المريض */
            right: 110px; /* Shifted left to prevent overlap with اسم المريض label */
            width: 40%;
            padding: 10px;
            box-sizing: border-box;
            text-align: left; /* Left aligned to grow leftward naturally and prevent overlap */
            font-size: 10px;
            font-weight: bold;
          }
          
          .age-arabic-container {
            position: absolute;
            top: 270px;  /* Align perfectly on the العمر dotted line */
            right: 80px; /* Kept at 80px because it was perfect */
            width: 30%;
            padding: 10px;
            box-sizing: border-box;
            text-align: right; /* Right aligned next to العمر label */
            font-size: 10px;
            font-weight: bold;
          }

          .date-container {
            position: absolute;
            top: 232px;  /* Align perfectly on the dotted line of التاريخ */
            left: 55px;  /* Shifted slightly to the right to align perfectly above the dotted line */
            width: 150px;
            padding: 10px;
            box-sizing: border-box;
            text-align: left; /* Left aligned to print directly on the dotted line */
            font-size: 10px;
            font-weight: bold;
          }
          
          /* Current treatment */
          .treatment-content {
            font-size: 10px;
            line-height: 1.6;
            white-space: pre-wrap;
            padding-top: 10px;
            padding-left: 10px;
            padding-right: 10px;
          }
          
          @media print {
            @page {
              size: 148mm 210mm;
              margin: 0 !important;
              padding: 0 !important;
              border: none !important;
            }
            
            html, body {
              width: 148mm !important;
              height: 210mm !important;
              margin: 0 !important;
              padding: 0 !important;
              overflow: hidden !important;
              background: white !important;
            }
            
            .print-container {
              width: 148mm !important;
              height: 210mm !important;
              margin: 0 !important;
              padding: 0 !important;
              position: absolute !important;
              top: 0 !important;
              left: 0 !important;
            }
            
            .report-image {
              width: 100% !important;
              height: 100% !important;
              object-fit: contain !important;
              object-position: top left !important;
              image-rendering: -webkit-optimize-contrast !important;
              image-rendering: crisp-edges !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            
            .name-arabic-container {
              position: absolute !important;
              top: 232px !important;
              right: 110px !important;
              width: 40% !important;
              text-align: left !important;
            }

            .age-arabic-container {
              position: absolute !important;
              top: 270px !important;
              right: 80px !important;
              width: 30% !important;
              text-align: right !important;
            }

            .date-container {
              position: absolute !important;
              top: 232px !important;
              left: 55px !important;
              width: 150px !important;
              text-align: left !important;
            }

            .clinic-container {
              position: absolute !important;
              top: 165px !important;
              right: 30px !important;
            }

            .treatment-data {
              position: absolute !important;
              top: 295px !important;
              left: 20px !important;
              width: 90% !important;
            }
            
            .print-button {
              display: none !important;
            }
          }
        
          .print-button {
            position: fixed;
            top: 10px;
            right: 10px;
            padding: 8px 16px;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
          }
        </style>
      </head>
      <body>
        <div class="print-container">
          <img src="/drhawar.jpg" class="report-image" />
          
          <!-- Name next to اسم المريض: -->
          <div class="name-arabic-container">${patient.name}</div>
          
          <!-- Age next to العمر: -->
          <div class="age-arabic-container">${calculateAge(patient.dob)}</div>

          <!-- Today's date next to التاريخ: -->
          <div class="date-container">${new Date().toISOString().split('T')[0]}</div>

          <!-- Clinic ID next to green text -->
          <div class="clinic-container">
            <div class="clinic-id-label">clinic ID:</div>
            <div class="clinic-id-value">${patient.clinicId}</div>
          </div>

          <!-- Treatment data in green area -->
          <div class="treatment-data">
            <!-- Content (without label) -->
            <div class="treatment-content">${content}</div>
          </div>
        </div>
        
        <button class="print-button" onclick="window.print();return false;">Print</button>
        <script>
          // Auto-print with better fit for A5 portrait
          window.onload = function() {
            // Force the window to be exactly A5 portrait size (148mm x 210mm)
            document.documentElement.style.width = '148mm';
            document.documentElement.style.height = '210mm';
            document.body.style.width = '148mm';
            document.body.style.height = '210mm';
            
            // Remove any browser-specific margins and borders
            document.body.style.margin = '0';
            document.body.style.padding = '0';
            document.body.style.border = 'none';
            document.body.style.overflow = 'hidden';
            
            // Apply browser-specific overrides for A5 portrait
            const style = document.createElement('style');
            style.textContent = "@media print { @page { size: 148mm 210mm; margin: 0 !important; } html, body { width: 148mm !important; height: 210mm !important; margin: 0 !important; } }";
            document.head.appendChild(style);
            
            // Trigger print after ensuring layout is complete
            setTimeout(function() {
              window.print();
            }, 800);
          }
        </script>
      </body>
      </html>
    `);

    // Finish writing and close the document
    printWindow.document.close();
  };

  // Print treatment function
  const handlePrintTreatment = (patient: Patient) => {
    const content = patient.currentTreatment || 'No current treatment specified.';
    handlePrintGeneric(patient, content, 'Treatment Card');
  };

  // Handle Quick Actions for speed
  const handleQuickAction = async (patient: Patient, actionType: 'exam' | 'prescription' | 'investigation') => {
    try {
      setIsPerformingQuickAction(patient.id);
      
      // Get the selected visit ID from the map, or default to the latest
      const visits = patientVisitsMap[patient.id] || [];
      const selectedId = selectedVisitIdMap[patient.id] || (visits.length > 0 ? visits[0].id : null);

      if (!selectedId) {
        alert("No visits found for this patient. Please add a visit first.");
        return;
      }
      
      // Fetch the FULL visit data for the selected visit
      const { data: fullVisit, error } = await supabase
        .from('visits')
        .select('*')
        .eq('id', selectedId)
        .single();

      if (error || !fullVisit) throw new Error('Failed to load visit details');
      
      setQuickActionVisit(fullVisit as Visit);
      setQuickActionPatient(patient);
      setEditVisitForm(fullVisit as Visit);
      
      if (actionType === 'exam') setShowQuickExamModal(true);
      else if (actionType === 'prescription') setShowQuickPrescriptionModal(true);
      else if (actionType === 'investigation') setShowQuickInvestigationModal(true);
      
    } catch (err) {
      console.error('Error starting quick action:', err);
      alert('Failed to load visit data.');
    } finally {
      setIsPerformingQuickAction(null);
    }
  };



  // Handle report generation for a specific visit
  const handleGenerateVisitReport = async (patient: Patient, visit: Visit) => {
    try {
      // Create a virtual patient object with data from this specific visit
      const visitPatient: Patient = {
        ...patient,
        diagnosis: visit.diagnosis || patient.diagnosis,
        treatment: visit.treatment || patient.treatment,
        currentTreatment: visit.current_treatment || patient.currentTreatment,
        history: visit.history || patient.history,
        pastMedicalHistory: visit.past_medical_history || patient.pastMedicalHistory,
        drugHistory: visit.drug_history || patient.drugHistory,
        pastSurgicalHistory: visit.past_surgical_history || patient.pastSurgicalHistory,
        examination: visit.examination || patient.examination,
        followUpDate: visit.follow_up_date || patient.followUpDate,
        note: visit.note || patient.note,
        tableData: visit.table_data || patient.tableData,
        prescription: visit.prescription || patient.prescription,
      };
      
      await generatePatientPDF(visitPatient);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF report. Please try again.');
    }
  };

  // Handle report generation (default to latest)
  const handleGenerateReport = async (patient: Patient) => {
    try {
      await generatePatientPDF(patient);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF report. Please try again.');
    }
  };

  // Handle logging a visit (returning patient)
  const handleLogVisit = async (patient: Patient) => {
    try {
      // Import the function to ensure visits table exists
      const { ensureVisitsTableExists } = await import('@/lib/supabase');

      // Check if visits table exists
      const visitsTableExists = await ensureVisitsTableExists();

      if (!visitsTableExists) {
        alert('Unable to record visit. The visits table does not exist in the database.');
        return;
      }

      // Write a visit record; do not create duplicate patient
      const { error } = await supabase.from('visits').insert({ patient_id: patient.id });

      if (error) {
        console.error('Error inserting visit record:', error);
        alert('Failed to record visit. Database error.');
        return;
      }

      alert('Visit recorded successfully.');

      // Refresh the visits count in reports if possible
      try {
        // This is a simple event to inform other components that visits have changed
        window.dispatchEvent(new CustomEvent('visitsUpdated'));
      } catch (e) {
        // Ignore errors from event dispatch
      }
    } catch (e) {
      console.error('Error logging visit:', e);
      alert('Failed to record visit.');
    }
  };

  // Refresh data when component mounts
  useEffect(() => {
    refreshPatients();
  }, []);

  // Filter patients based on search term, active filter field, and age filter
  const filteredPatients = patients.filter(patient => {
    // Text search filter based on the active filter field
    let matchesSearch = true;

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();

      if (activeFilter === 'all') {
        // Search all fields
        matchesSearch = Boolean(
          patient.name.toLowerCase().includes(searchLower) ||
          patient.hospitalFileNumber.toLowerCase().includes(searchLower) ||
          patient.diagnosis.toLowerCase().includes(searchLower) ||
          (patient.dob && calculateAge(patient.dob).toString().includes(searchLower)) ||
          (patient.dob && patient.dob.includes(searchLower)) ||
          (patient.treatment && patient.treatment.toLowerCase().includes(searchLower)) ||
          (patient.sex && patient.sex.toLowerCase().includes(searchLower)) ||
          (patient.history && patient.history.toLowerCase().includes(searchLower)) ||
          (patient.mobileNumber && patient.mobileNumber.toLowerCase().includes(searchLower)) ||
          (patient.clinicId && patient.clinicId.toLowerCase().includes(searchLower))
        );
      } else {
        // Search specific field based on activeFilter
        switch (activeFilter) {
          case 'name':
            matchesSearch = Boolean(patient.name.toLowerCase().includes(searchLower));
            break;
          case 'age':
            matchesSearch = Boolean(patient.dob && calculateAge(patient.dob).toString().includes(searchLower));
            break;
          case 'diagnosis':
            matchesSearch = Boolean(patient.diagnosis.toLowerCase().includes(searchLower));
            break;
          case 'treatment':
            matchesSearch = Boolean(patient.treatment && patient.treatment.toLowerCase().includes(searchLower));
            break;
          case 'gender':
            matchesSearch = Boolean(
              patient.sex && patient.sex.trim().toLowerCase() === searchLower.trim().toLowerCase()
            );
            break;
          case 'history':
            matchesSearch = Boolean(patient.history && patient.history.toLowerCase().includes(searchLower));
            break;
          case 'mobile':
            matchesSearch = Boolean(patient.mobileNumber && patient.mobileNumber.toLowerCase().includes(searchLower));
            break;
          case 'hospitalFile':
            matchesSearch = Boolean(patient.hospitalFileNumber.toLowerCase().includes(searchLower));
            break;
          case 'clinicId':
            matchesSearch = Boolean(patient.clinicId && patient.clinicId.toLowerCase().includes(searchLower));
            break;
          case 'dob':
            matchesSearch = Boolean(patient.dob && patient.dob.includes(searchLower));
            break;
          default:
            matchesSearch = true;
        }
      }
    }

    // Age filter
    let matchesAge = true;
    if (ageFilter !== 'all') {
      const calculatedAge = calculateAge(patient.dob);
      const patientAge = typeof calculatedAge === 'number' ? calculatedAge : 0;

      switch (ageFilter) {
        case 'under18':
          matchesAge = patientAge < 18;
          break;
        case '18to30':
          matchesAge = patientAge >= 18 && patientAge <= 30;
          break;
        case '31to50':
          matchesAge = patientAge >= 31 && patientAge <= 50;
          break;
        case 'over50':
          matchesAge = patientAge > 50;
          break;
        case 'custom':
          const minAge = parseInt(customMinAge) || 0;
          const maxAge = parseInt(customMaxAge) || 999;
          matchesAge = patientAge >= minAge && patientAge <= maxAge;
          break;
        default:
          matchesAge = true;
      }
    }

    return matchesSearch && matchesAge;
  });

  // Handle patient selection for details view
  const handleViewPatient = async (patient: Patient) => {
    setSelectedPatient(patient);
    setShowMobileDetails(true);
    setIsEditing(false);
    
    // Fetch visits for this patient
    setIsLoadingVisits(true);
    try {
      const visits = await getPatientVisits(patient.id);
      setPatientVisits(visits);
    } catch (err) {
      console.error('Error loading visits:', err);
    } finally {
      setIsLoadingVisits(false);
    }
  };

  // Handle patient deletion
  const handleDeletePatient = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this patient record?')) {
      try {
        setIsDeleting(id);
        await deletePatient(id);
        if (selectedPatient?.id === id) {
          setSelectedPatient(null);
        }
      } finally {
        setIsDeleting(null);
      }
    }
  };

  // Handle patient edit form submission
  const handleEditSubmit = async (data: Partial<Patient>) => {
    if (!selectedPatient) return;

    try {
      await editPatient(selectedPatient.id, data);
      // Update the selected patient with new data after successful edit
      setSelectedPatient(prev => prev ? { ...prev, ...data } : null);
      setIsEditing(false); // Close the form after successful edit
    } catch (err) {
      console.error('Error updating patient:', err);
    }
  };

  // Handle Excel export
  const handleExportToExcel = () => {
    try {
      if (isStaffAuth) {
        alert("You don’t have permission to export data.");
        return;
      }
      setIsExporting(true);

      // Use the filtered patients if there's a search term, otherwise use all patients
      const dataToExport = filteredPatients;

      // Generate a filename with current date
      const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      const filename = `patients-data-${date}`;

      // Export the data
      exportToExcel(dataToExport, filename);
    } catch (err) {
      console.error('Error exporting to Excel:', err);
      alert('Failed to export data. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  // Toggle back to list view on mobile
  const handleBackToList = () => {
    setShowMobileDetails(false);
  };

  // Loading state
  if (isLoading && patients.length === 0) {
    return (
      <div className="p-4 md:p-6 flex items-center justify-center h-96">
        <div className="text-center">
          <svg className="inline animate-spin h-10 w-10 text-indigo-600 dark:text-indigo-400 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-gray-700 dark:text-gray-300">Loading patients data...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-4 md:p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 p-4 rounded-lg text-red-700 dark:text-red-300">
          <h3 className="text-lg font-medium mb-2">Error Loading Data</h3>
          <p>{error}</p>
          <button
            onClick={() => refreshPatients()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 inline-flex items-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="p-4 md:p-6">
      {/* Header Section */}
      <div className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-800 dark:text-white">Patients Records</h1>
            <p className="text-gray-600 dark:text-gray-300 mt-1">
              {filteredPatients.length} {filteredPatients.length === 1 ? 'record' : 'records'} found
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/patient-form" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-md transition duration-150 inline-flex items-center">
              <svg className="h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Patient
            </Link>
            {!isStaffAuth && (
              <button
                onClick={handleExportToExcel}
                disabled={isExporting || filteredPatients.length === 0}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg shadow-md transition duration-150 inline-flex items-center"
              >
                {isExporting ? (
                  <>
                    <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Exporting...
                  </>
                ) : (
                  <>
                    <svg className="h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Export Excel
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Search and Filter Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-6">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="relative flex-grow">
              <input
                type="text"
                placeholder={
                  activeFilter === 'all'
                    ? "Search all patient fields..."
                    : activeFilter === 'name'
                      ? "Search by patient name..."
                      : activeFilter === 'age'
                        ? "Search by age..."
                        : activeFilter === 'diagnosis'
                          ? "Search by diagnosis..."
                          : activeFilter === 'treatment'
                            ? "Search by treatment..."
                            : activeFilter === 'gender'
                              ? "Search by gender..."
                              : activeFilter === 'history'
                                ? "Search by history..."
                                : activeFilter === 'mobile'
                                  ? "Search by mobile number..."
                                  : activeFilter === 'hospitalFile'
                                    ? "Search by hospital file number..."
                                    : activeFilter === 'dob'
                                      ? "Search by DOB..."
                                      : "Search by clinic ID..."
                }
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            <div className="relative">
              <button
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className="w-full md:w-auto px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg inline-flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-600 transition duration-150"
              >
                <svg className="h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                Filters
                {ageFilter !== 'all' && (
                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                    {ageFilter === 'custom' && (customMinAge || customMaxAge) ? '2' : '1'}
                  </span>
                )}
              </button>

              {isFilterOpen && (
                <div className="absolute z-50 mt-2 w-80 right-0 md:right-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4">
                  {/* Search Field Selector */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Search Field
                    </label>
                    <select
                      value={activeFilter}
                      onChange={(e) => setActiveFilter(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    >
                      <option value="all">All Fields</option>
                      <option value="name">Name</option>
                      <option value="age">Age</option>
                      <option value="diagnosis">Diagnosis</option>
                      <option value="treatment">Treatment</option>
                      <option value="gender">Gender</option>
                      <option value="history">History</option>
                      <option value="mobile">Mobile Number</option>
                      <option value="hospitalFile">Hospital File Number</option>
                      <option value="clinicId">Clinic ID</option>
                      <option value="dob">Date of Birth</option>
                    </select>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Select "All Fields" to search across all patient data
                    </p>
                  </div>

                  {/* Age Filter Section */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Age Range
                    </label>
                    <select
                      value={ageFilter}
                      onChange={(e) => setAgeFilter(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    >
                      <option value="all">All Ages</option>
                      <option value="under18">Under 18</option>
                      <option value="18to30">18-30</option>
                      <option value="31to50">31-50</option>
                      <option value="over50">Over 50</option>
                      <option value="custom">Custom Range</option>
                    </select>
                  </div>

                  {ageFilter === 'custom' && (
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Custom Age Range (Min - Max)
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          placeholder="Min Age"
                          value={customMinAge}
                          onChange={(e) => setCustomMinAge(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                        <input
                          type="number"
                          placeholder="Max Age"
                          value={customMaxAge}
                          onChange={(e) => setCustomMaxAge(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <button
                      onClick={() => {
                        setAgeFilter('all');
                        setCustomMinAge('');
                        setCustomMaxAge('');
                        setActiveFilter('all');
                        setSearchTerm('');
                        setIsFilterOpen(false);
                      }}
                      className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                    >
                      Clear All Filters
                    </button>
                    <button
                      onClick={() => setIsFilterOpen(false)}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile View: Toggle between list and details */}
      <div className="block md:hidden mb-4">
        {showMobileDetails && selectedPatient && (
          <button
            onClick={handleBackToList}
            className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-700 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <svg className="h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to List
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Patients List - Only render if not editing */}
        {!isEditing && (
          <div className={`lg:col-span-1 bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden ${showMobileDetails ? 'hidden md:block' : 'block'}`}>
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">Patient List</h2>
            </div>

            <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[600px] overflow-y-auto">
              {filteredPatients.length > 0 ? (
                filteredPatients.map((patient) => (
                  <div
                    key={patient.id}
                    className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer ${selectedPatient?.id === patient.id ? 'bg-gray-100 dark:bg-gray-700 border-l-4 border-indigo-500' : ''
                      }`}
                    onClick={() => handleViewPatient(patient)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white">{patient.name}</h3>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {patientVisitsMap[patient.id] && patientVisitsMap[patient.id].length > 0 && (
                            <span className="inline-flex items-center text-[9px] bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-bold px-1.5 py-0.5 rounded border border-indigo-100 dark:border-indigo-800/50">
                              <svg className="h-2 w-2 mr-1" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" /></svg>
                              Latest: Visit {patientVisitsMap[patient.id].length}
                            </span>
                          )}
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Age: {calculateAge(patient.dob)} | {patient.diagnosis}
                          </p>
                        </div>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                          Added: {formatDate(patient.createdAt)}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-xs bg-blue-100 text-blue-800 rounded-full px-2 py-0.5 font-medium">
                          {patient.clinicId}
                        </span>
                        <span className="text-xs bg-gray-100 text-gray-700 rounded-full px-2 py-0.5">
                          {patient.hospitalFileNumber}
                        </span>
                      </div>
                    </div>

                    {/* Quick Actions Row */}
                    {!isStaffAuth && (
                      <div className="mt-3 flex items-center gap-2 pt-3 border-t border-gray-100 dark:border-gray-600/50 relative">
                        {isPerformingQuickAction === patient.id && (
                          <div className="absolute inset-0 bg-white/60 dark:bg-gray-800/60 z-10 flex items-center justify-center rounded-lg">
                            <svg className="animate-spin h-4 w-4 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          </div>
                        )}
                        
                        {/* Visit Selector Dropdown */}
                        <div className="relative">
                          <select
                            value={selectedVisitIdMap[patient.id] || (patientVisitsMap[patient.id]?.[0]?.id || '')}
                            onChange={(e) => {
                              e.stopPropagation();
                              setSelectedVisitIdMap(prev => ({ ...prev, [patient.id]: e.target.value }));
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="appearance-none text-[10px] font-bold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1.5 pr-6 focus:ring-2 focus:ring-indigo-500 text-gray-700 dark:text-gray-300 cursor-pointer hover:border-indigo-300 transition-colors"
                          >
                            {(patientVisitsMap[patient.id] || []).map((v, i, arr) => (
                              <option key={v.id} value={v.id}>
                                V{arr.length - i}
                              </option>
                            ))}
                            {(patientVisitsMap[patient.id] || []).length === 0 && (
                              <option value="">No Visit</option>
                            )}
                          </select>
                          <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-gray-400">
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                          </div>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQuickAction(patient, 'exam');
                          }}
                          disabled={isPerformingQuickAction === patient.id}
                          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg text-[10px] font-bold uppercase tracking-tight hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors border border-blue-100 dark:border-blue-900/30"
                          title="Quick Examination"
                        >
                          Exam
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQuickAction(patient, 'prescription');
                          }}
                          disabled={isPerformingQuickAction === patient.id}
                          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg text-[10px] font-bold uppercase tracking-tight hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors border border-green-100 dark:border-green-900/30"
                          title="Quick Prescription"
                        >
                          Rx
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQuickAction(patient, 'investigation');
                          }}
                          disabled={isPerformingQuickAction === patient.id}
                          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-lg text-[10px] font-bold uppercase tracking-tight hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors border border-purple-100 dark:border-purple-900/30"
                          title="Quick Investigation Upload"
                        >
                          Labs
                        </button>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  No patients found. Please add a patient or adjust your search.
                </div>
              )}
            </div>

            {/* Show loading indicator when refreshing data */}
            {isLoading && patients.length > 0 && (
              <div className="p-2 bg-gray-50 dark:bg-gray-700 text-center">
                <svg className="inline animate-spin h-4 w-4 text-indigo-600 dark:text-indigo-400 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-xs text-gray-600 dark:text-gray-300">Refreshing...</span>
              </div>
            )}
          </div>
        )}

        {/* Patient Details */}
        <div className={`${isEditing ? 'lg:col-span-3' : 'lg:col-span-2'} bg-white dark:bg-gray-800 rounded-lg shadow-md ${!showMobileDetails ? 'hidden md:block' : 'block'}`}>
          {selectedPatient ? (
            <div className="p-4 md:p-6">
              {!isEditing ? (
                <>
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{selectedPatient.name}</h2>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span className="px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-full font-medium text-sm">
                          Clinic ID: {selectedPatient.clinicId}
                        </span>
                        <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full text-sm">
                          File #: {selectedPatient.hospitalFileNumber}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                        Added: {formatDate(selectedPatient.createdAt)}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setShowPdfModal(true)}
                        className="p-2 text-green-600 hover:bg-green-100 rounded-md transition duration-150"
                        title="Generate PDF Report"
                      >
                        <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </button>

                      <button
                        onClick={() => handleDeletePatient(selectedPatient.id)}
                        disabled={isDeleting === selectedPatient.id}
                        className={`p-2 text-red-600 hover:bg-red-100 rounded-md transition duration-150 ${isDeleting === selectedPatient.id ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                        title="Delete Patient"
                      >
                        {isDeleting === selectedPatient.id ? (
                          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        ) : (
                          <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6 mb-6">
                    <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Personal Information</h3>
                      <div className="space-y-3">
                        {selectedPatient.dob && (
                          <div className="flex justify-between">
                            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">DOB</span>
                            <span className="text-sm text-gray-900 dark:text-gray-100">{selectedPatient.dob}</span>
                          </div>
                        )}
                        {selectedPatient.sex && (
                          <div className="flex justify-between">
                            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Sex</span>
                            <span className="text-sm text-gray-900 dark:text-gray-100">{selectedPatient.sex}</span>
                          </div>
                        )}
                        {selectedPatient.mobileNumber && (
                          <div className="flex justify-between">
                            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Mobile</span>
                            <span className="text-sm text-gray-900 dark:text-gray-100">{selectedPatient.mobileNumber}</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                          <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">Clinic ID</span>
                          <span className="text-sm font-bold text-gray-900 dark:text-white bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded">{selectedPatient.clinicId}</span>
                        </div>
                      </div>
                    </div>
                  </div>


                  {/* Visit History Section */}
                  <div className="mt-8 pt-8 border-t border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                        <svg className="h-5 w-5 mr-2 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Visit History
                        <span className="ml-2 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded-full font-normal">
                          {patientVisits.length} visits
                        </span>
                      </h3>
                    </div>

                    {isLoadingVisits ? (
                      <div className="flex justify-center py-8">
                        <svg className="animate-spin h-8 w-8 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      </div>
                    ) : patientVisits.length > 0 ? (
                      <div className="max-h-[500px] overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                        {patientVisits.map((visit, index) => (
                          <details key={visit.id} className="group bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-100 dark:border-gray-600 overflow-hidden transition-all duration-200" open={index === 0}>
                            <summary className="flex justify-between items-center p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 list-none">
                              <div className="flex items-center gap-3">
                                <div className="flex flex-col">
                                  <span className="text-sm font-bold text-gray-900 dark:text-white">
                                    {formatDate(visit.visited_at)}
                                  </span>
                                  {index === 0 && (
                                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider">Latest Visit</span>
                                  )}
                                </div>
                                <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[150px] md:max-w-[300px]">
                                  {visit.diagnosis || 'No diagnosis'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                {!isStaffAuth && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPrintingVisit(visit);
                                      setShowPrintOptionsModal(true);
                                    }}
                                    className="text-[10px] px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                                  >
                                    Print
                                  </button>
                                )}
                                {!isStaffAuth && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingVisit(visit);
                                      setEditVisitForm(visit);
                                      setShowEditVisitModal(false);
                                      setIsEditing(false);
                                    }}
                                    className="text-[10px] px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
                                  >
                                    Edit
                                  </button>
                                )}
                                <svg className="h-4 w-4 text-gray-400 group-open:rotate-180 transition-transform duration-200" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </div>
                            </summary>
                            
                            <div className="p-4 pt-0 border-t border-gray-100 dark:border-gray-600 grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                              {visit.diagnosis && (
                                <div>
                                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 block uppercase tracking-tighter mb-1">Diagnosis</span>
                                  <p className="text-sm text-gray-900 dark:text-gray-100 leading-relaxed">{visit.diagnosis}</p>
                                </div>
                              )}
                              {visit.treatment && (
                                <div>
                                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 block uppercase tracking-tighter mb-1">Treatment</span>
                                  <p className="text-sm text-gray-900 dark:text-gray-100 leading-relaxed">{visit.treatment}</p>
                                </div>
                              )}
                              {visit.examination && (
                                <div className="md:col-span-2">
                                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 block uppercase tracking-tighter mb-1">Examination</span>
                                  <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap bg-white dark:bg-gray-800 p-2 rounded border border-gray-100 dark:border-gray-700">{visit.examination}</p>
                                </div>
                              )}
                              {visit.current_treatment && (
                                <div className="md:col-span-2">
                                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 block uppercase tracking-tighter mb-1">Current Treatment</span>
                                  <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap bg-white dark:bg-gray-800 p-2 rounded border border-gray-100 dark:border-gray-700">{visit.current_treatment}</p>
                                </div>
                              )}
                              {visit.prescription && (
                                <div className="md:col-span-2">
                                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 block uppercase tracking-tighter mb-1">Prescription</span>
                                  <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap bg-white dark:bg-gray-800 p-2 rounded border border-gray-100 dark:border-gray-700">{visit.prescription}</p>
                                </div>
                              )}
                              {visit.note && (
                                <div className="md:col-span-2 bg-amber-50 dark:bg-amber-900/10 p-2 rounded border border-amber-100 dark:border-amber-900/30">
                                  <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 block uppercase tracking-tighter mb-1">Internal Note</span>
                                  <p className="text-sm text-gray-700 dark:text-gray-300 italic">{visit.note}</p>
                                </div>
                              )}
                            </div>
                          </details>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-dashed border-gray-200 dark:border-gray-600">
                        <p className="text-sm text-gray-500 dark:text-gray-400">No visit history found for this patient.</p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Edit Patient</h2>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="flex items-center text-sm px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                    >
                      <svg className="h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      Back to View
                    </button>
                  </div>
                  <PatientEditForm
                    patient={selectedPatient}
                    onSubmit={handleEditSubmit}
                    onCancel={() => setIsEditing(false)}
                    isLoading={isLoading}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <svg className="h-16 w-16 text-gray-300 dark:text-gray-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">Select a patient</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Click on a patient from the list to view details
              </p>
            </div>
          )}
        </div>
      </div>
    </div>

      {/* PDF Visit Selector Modal */}
      {showPdfModal && selectedPatient && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Generate PDF — Select Visit</h3>
              <button onClick={() => setShowPdfModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
              {patientVisits.map((visit, index) => (
                <button
                  key={visit.id}
                  onClick={() => {
                    handleGenerateVisitReport(selectedPatient, visit);
                    setShowPdfModal(false);
                  }}
                  className="w-full text-left flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-100 dark:border-gray-600 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">Visit {patientVisits.length - index}</span>
                      {index === 0 && <span className="text-[10px] px-1.5 py-0.5 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 rounded-full font-bold uppercase">Latest</span>}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(visit.visited_at)} · {visit.diagnosis || 'No diagnosis'}</p>
                  </div>
                  <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Edit Visit Modal */}
      {editingVisit && selectedPatient && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-800 z-10">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Visit</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(editingVisit.visited_at)} · {selectedPatient.name}</p>
              </div>
              <button onClick={() => setEditingVisit(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form className="p-5 space-y-4" onSubmit={async (e) => {
              e.preventDefault();
              setIsSavingVisit(true);
              try {
                await editVisit(editingVisit.id, editVisitForm);
                const updated = await getPatientVisits(selectedPatient.id);
                setPatientVisits(updated);
                setEditingVisit(null);
              } catch (err) {
                console.error(err);
              } finally {
                setIsSavingVisit(false);
              }
            }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {([
                  'diagnosis',
                  'treatment',
                  'current_treatment',
                  'history',
                  'past_medical_history',
                  'drug_history',
                  'past_surgical_history',
                  'examination',
                  'prescription',
                  'follow_up_date',
                  'note'
                ] as (keyof Visit)[]).map((field) => (
                  <div key={field} className={field === 'current_treatment' || field === 'history' || field === 'note' || field === 'examination' || field === 'prescription' ? 'md:col-span-2' : ''}>
                    <label className="block text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-tighter mb-1">
                      {field.replace(/_/g, ' ')}
                    </label>
                    <textarea
                      rows={field === 'current_treatment' || field === 'history' ? 3 : 2}
                      className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                      value={(editVisitForm[field] as string) || ''}
                      onChange={(e) => setEditVisitForm(prev => ({ ...prev, [field]: e.target.value }))}
                    />
                  </div>
                ))}
                
                {/* Investigation Upload — opens real modal */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-tighter mb-2 flex items-center gap-2">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Investigation Images
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setQuickActionVisit(editingVisit);
                      setQuickActionPatient(selectedPatient);
                      setShowQuickInvestigationModal(true);
                    }}
                    className="w-full flex items-center justify-center gap-3 p-4 bg-purple-50 dark:bg-purple-900/20 border-2 border-dashed border-purple-200 dark:border-purple-800/50 rounded-xl text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors group"
                  >
                    <div className="p-2 bg-white dark:bg-gray-700 rounded-full shadow-sm group-hover:shadow-purple-200 dark:group-hover:shadow-none transition-shadow">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                    </div>
                    <span className="text-sm font-semibold">Upload Investigation Images</span>
                    <span className="text-xs text-purple-400 dark:text-purple-500">JPG · PNG · WEBP</span>
                  </button>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-2 pt-4 border-t border-gray-100 dark:border-gray-700">
                <button type="button" onClick={() => setEditingVisit(null)} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600">Cancel</button>
                <button type="submit" disabled={isSavingVisit} className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
                  {isSavingVisit && <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                  Save Visit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Print Options Modal */}
      {showPrintOptionsModal && printingVisit && selectedPatient && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-sm">
            <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Print Options</h3>
              <button onClick={() => setShowPrintOptionsModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-4 space-y-3">
              <button
                onClick={() => {
                  handlePrintGeneric(selectedPatient, printingVisit.prescription || '', 'Prescription Card');
                  setShowPrintOptionsModal(false);
                }}
                className="w-full flex items-center gap-3 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/50 dark:bg-indigo-900/10 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/20 transition-colors"
              >
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <span className="font-semibold">Prescription</span>
              </button>
              
              <button
                onClick={() => {
                  handlePrintGeneric(selectedPatient, printingVisit.treatment || '', 'Treatment Card');
                  setShowPrintOptionsModal(false);
                }}
                className="w-full flex items-center gap-3 p-4 rounded-xl border border-green-100 dark:border-green-900/30 bg-green-50/50 dark:bg-green-900/10 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/20 transition-colors"
              >
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                </div>
                <span className="font-semibold">Treatment</span>
              </button>

              <button
                onClick={() => {
                  handlePrintGeneric(selectedPatient, printingVisit.current_treatment || '', 'Current Treatment Card');
                  setShowPrintOptionsModal(false);
                }}
                className="w-full flex items-center gap-3 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30 bg-blue-50/50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/20 transition-colors"
              >
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <span className="font-semibold">Current Treatment</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Examination Modal */}
      {showQuickExamModal && quickActionVisit && quickActionPatient && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Quick Examination</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">{quickActionPatient.name} · Latest Visit</p>
              </div>
              <button onClick={() => setShowQuickExamModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form className="p-5 space-y-4" onSubmit={async (e) => {
              e.preventDefault();
              setIsSavingVisit(true);
              try {
                await editVisit(quickActionVisit.id, editVisitForm);
                setShowQuickExamModal(false);
                if (selectedPatient?.id === quickActionPatient.id) {
                   const updated = await getPatientVisits(selectedPatient.id);
                   setPatientVisits(updated);
                }
              } catch (err) {
                console.error(err);
              } finally {
                setIsSavingVisit(false);
              }
            }}>
              <div>
                <label className="block text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-tighter mb-1">Examination Results</label>
                <textarea
                  rows={6}
                  autoFocus
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                  value={(editVisitForm.examination as string) || ''}
                  onChange={(e) => setEditVisitForm(prev => ({ ...prev, examination: e.target.value }))}
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowQuickExamModal(false)} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg">Cancel</button>
                <button type="submit" disabled={isSavingVisit} className="px-6 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
                  {isSavingVisit && <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                  Save Exam
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Prescription Modal */}
      {showQuickPrescriptionModal && quickActionVisit && quickActionPatient && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg">
            <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Quick Prescription</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">{quickActionPatient.name} · Latest Visit</p>
              </div>
              <button onClick={() => setShowQuickPrescriptionModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form className="p-5 space-y-4" onSubmit={async (e) => {
              e.preventDefault();
              setIsSavingVisit(true);
              try {
                await editVisit(quickActionVisit.id, editVisitForm);
                setShowQuickPrescriptionModal(false);
                if (selectedPatient?.id === quickActionPatient.id) {
                   const updated = await getPatientVisits(selectedPatient.id);
                   setPatientVisits(updated);
                }
              } catch (err) {
                console.error(err);
              } finally {
                setIsSavingVisit(false);
              }
            }}>
              <div>
                <label className="block text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-tighter mb-1">Prescription</label>
                <textarea
                  rows={8}
                  autoFocus
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                  value={(editVisitForm.prescription as string) || ''}
                  onChange={(e) => setEditVisitForm(prev => ({ ...prev, prescription: e.target.value }))}
                />
              </div>
              <div className="flex justify-between items-center pt-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handlePrintGeneric(quickActionPatient, editVisitForm.prescription || '', 'Prescription Card')}
                    className="px-3 py-2 text-xs font-medium bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300 rounded-lg border border-green-100 dark:border-green-900/30 hover:bg-green-100 transition-colors flex items-center gap-1"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                    Print Rx
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePrintGeneric(quickActionPatient, editVisitForm.treatment || '', 'Treatment Card')}
                    className="px-3 py-2 text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-lg border border-blue-100 dark:border-blue-900/30 hover:bg-blue-100 transition-colors flex items-center gap-1"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    Print Treatment
                  </button>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowQuickPrescriptionModal(false)} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg">Cancel</button>
                  <button type="submit" disabled={isSavingVisit} className="px-6 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
                    {isSavingVisit && <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                    Save Rx
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Investigation Modal */}
      {showQuickInvestigationModal && quickActionVisit && quickActionPatient && (
        <InvestigationModal
          patient={quickActionPatient}
          visit={quickActionVisit}
          onClose={() => setShowQuickInvestigationModal(false)}
        />
      )}
    </>
  );
}

export default function PatientsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8 flex justify-center items-center">
        <div className="text-center">
          <svg className="animate-spin h-10 w-10 text-indigo-600 dark:text-indigo-400 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-gray-700 dark:text-gray-300">Loading Patients Directory...</p>
        </div>
      </div>
    }>
      <PatientsPageContent />
    </Suspense>
  );
}