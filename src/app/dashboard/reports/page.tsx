"use client";

import { useMemo, useEffect, useCallback } from 'react';
import { usePatients, Patient } from '@/app/context/PatientContext';
import { supabase, ensureVisitsTableExists } from '@/lib/supabase';
import { useState } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { useRouter } from 'next/navigation';
import { generatePatientPDF } from '@/lib/pdfGenerator';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
);

export default function ReportsPage() {
  const { patients, isLoading } = usePatients();
  const { isStaffAuth, isReceptionAuth } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isReceptionAuth) {
      router.push('/dashboard');
    }
  }, [isReceptionAuth, router]);

  const [visitCountToday, setVisitCountToday] = useState<number>(0);
  const [visitPatientsToday, setVisitPatientsToday] = useState<string[]>([]);
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [visitsForDate, setVisitsForDate] = useState<any[]>([]);
  const [visitPatients, setVisitPatients] = useState<Record<string, Patient>>({});
  const [isLoadingVisits, setIsLoadingVisits] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showPatientDetails, setShowPatientDetails] = useState(false);

  // Function to load visits for a specific date
  const loadVisitsForDate = async (date: Date) => {
    setIsLoadingVisits(true);
    try {
      // First check if visits table exists
      const visitsTableExists = await ensureVisitsTableExists();

      if (!visitsTableExists) {
        console.warn("Visits table doesn't exist yet - showing zero visits for date");
        setVisitsForDate([]);
        setVisitPatients({});
        setIsLoadingVisits(false);
        return;
      }

      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from('visits')
        .select('id, patient_id, created_at')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading visits for date:', error);
        setVisitsForDate([]);
        setVisitPatients({});
        return;
      }

      if (data) {
        setVisitsForDate(data);

        // Get patient details for each visit
        const patientIds = Array.from(new Set(data.map(v => v.patient_id)));
        const patientMap: Record<string, Patient> = {};

        if (patientIds.length > 0) {
          const { data: patientData, error: patientError } = await supabase
            .from('patients')
            .select('*')
            .in('id', patientIds);

          if (patientError) {
            console.error('Error loading patient details:', patientError);
          } else if (patientData) {
            patientData.forEach((p: any) => {
              patientMap[p.id] = {
                id: p.id,
                name: p.name,
                dob: p.dob,
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
                followUpDate: p.follow_up_date || '',
                createdAt: p.created_at,
                userId: p.user_id
              };
            });
          }
        }

        setVisitPatients(patientMap);
      }
    } catch (e) {
      console.error('Failed to load visits:', e);
      setVisitsForDate([]);
      setVisitPatients({});
    } finally {
      setIsLoadingVisits(false);
    }
  };

  // Format time for display
  const formatTime = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    };
    return new Date(dateString).toLocaleTimeString(undefined, options);
  };

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
            width: 100%;
            height: 100%;
            margin: 0;
            padding: 0;
            background: white;
            font-family: Arial, sans-serif;
            overflow: hidden;
          }
          
          .print-container {
            width: 148mm; /* A5 portrait width */
            height: 210mm; /* A5 portrait height */
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
              size: A5 portrait;
              margin: 0 !important;
              padding: 0 !important;
              border: none !important;
            }
            
            html, body {
              width: 148mm;
              height: 210mm;
              margin: 0 !important;
              padding: 0 !important;
              overflow: hidden;
              background: white;
            }
            
            .print-container {
              width: 100%;
              height: 100%;
              margin: 0 !important;
              padding: 0 !important;
              position: absolute;
              top: 0;
              left: 0;
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
              display: none;
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
            <!-- Clinic ID next to green text -->
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
            // Force the window to be exactly A5 portrait size
            document.documentElement.style.width = '148mm';
            document.documentElement.style.height = '210mm';
            document.body.style.width = '148mm';
            document.body.style.height = '210mm';
            
            // Remove any browser-specific margins and borders
            document.body.style.margin = '0';
            document.body.style.padding = '0';
            document.body.style.border = 'none';
            document.body.style.overflow = 'hidden';
            
            // Apply browser-specific overrides to remove margins
            // This helps with Chrome's default print margins
            const style = document.createElement('style');
            style.textContent = "@media print { @page { size: A5 portrait; margin: 0 !important; } body { margin: 0 !important; } }";
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



  // Handle report generation
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

  // Handle patient selection for details view
  const handleViewPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    setShowPatientDetails(true);
  };

  // Function to load today's visits
  const loadTodaysVisits = useCallback(async () => {
    try {
      // First check if visits table exists
      const visitsTableExists = await ensureVisitsTableExists();

      if (!visitsTableExists) {
        console.warn("Visits table doesn't exist yet - showing zero visits");
        setVisitCountToday(0);
        setVisitPatientsToday([]);
        return;
      }

      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from('visits')
        .select('id, patient_id, created_at')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      if (error) {
        console.error('Error loading visits:', error);
        return;
      }

      if (data) {
        setVisitCountToday(data.length);
        setVisitPatientsToday(Array.from(new Set(data.map(v => v.patient_id))));
      }
    } catch (e) {
      console.error('Failed to load visits:', e);
    }
  }, []);

  // Event listener for visit updates
  useEffect(() => {
    // Handler for the custom event
    const handleVisitsUpdated = () => {
      loadTodaysVisits();
    };

    // Add event listener
    window.addEventListener('visitsUpdated', handleVisitsUpdated);

    // Cleanup
    return () => {
      window.removeEventListener('visitsUpdated', handleVisitsUpdated);
    };
  }, [loadTodaysVisits]);

  useEffect(() => {
    document.title = 'Reports & Analytics';

    // Load today's visits count
    loadTodaysVisits();
  }, [loadTodaysVisits]);

  const now = new Date();
  const thisYear = now.getFullYear();

  const metrics = useMemo(() => {
    const byMonth = new Array(12).fill(0);
    const bySex: Record<string, number> = {};
    let thisYearCount = 0;
    let last30d = 0;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    patients.forEach(p => {
      const created = new Date(p.createdAt);
      if (created.getFullYear() === thisYear) {
        thisYearCount += 1;
        byMonth[created.getMonth()] += 1;
      }
      if (created >= thirtyDaysAgo) last30d += 1;
      const sexKey = (p.sex || 'Unknown').trim();
      bySex[sexKey] = (bySex[sexKey] || 0) + 1;
    });

    const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    return { byMonth, bySex, thisYearCount, last30d, monthLabels };
  }, [patients, thisYear]);

  const barData = useMemo(() => ({
    labels: metrics.monthLabels,
    datasets: [
      {
        label: `New Patients ${thisYear}`,
        data: metrics.byMonth,
        backgroundColor: 'rgba(99, 102, 241, 0.6)',
        borderColor: 'rgba(99, 102, 241, 1)',
        borderWidth: 1,
        borderRadius: 6,
      },
    ],
  }), [metrics, thisYear]);

  const lineData = useMemo(() => ({
    labels: metrics.monthLabels,
    datasets: [
      {
        label: 'Cumulative Patients',
        data: metrics.byMonth.reduce<number[]>((acc, val, i) => {
          const sum = (acc[i - 1] ?? 0) + val;
          acc.push(sum);
          return acc;
        }, []),
        fill: true,
        borderColor: 'rgba(34,197,94,1)',
        backgroundColor: 'rgba(34,197,94,0.15)',
        tension: 0.35,
        pointRadius: 2,
      },
    ],
  }), [metrics]);

  const doughnutData = useMemo(() => {
    const labels = Object.keys(metrics.bySex);
    const data = Object.values(metrics.bySex);
    const palette = [
      'rgba(99,102,241,0.8)',
      'rgba(16,185,129,0.8)',
      'rgba(234,179,8,0.8)',
      'rgba(239,68,68,0.8)',
      'rgba(14,165,233,0.8)'
    ];
    return {
      labels,
      datasets: [
        {
          label: 'Sex Distribution',
          data,
          backgroundColor: labels.map((_, i) => palette[i % palette.length]),
          borderWidth: 0,
        },
      ],
    };
  }, [metrics]);

  const statCard = (title: string, value: string | number, sub?: string) => (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 md:p-5 shadow-sm border border-gray-100 dark:border-gray-700">
      <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{title}</p>
      <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{sub}</p>}
    </div>
  );

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Reports & Analytics</h1>
        <p className="text-gray-600 dark:text-gray-300">Patient volumes, distributions, and trends</p>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
        {statCard('Total Patients', patients.length, 'All time')}
        {statCard('This Year', metrics.thisYearCount, `${thisYear}`)}
        {statCard('Last 30 Days', metrics.last30d)}
        <div
          className="bg-white dark:bg-gray-800 rounded-xl p-4 md:p-5 shadow-sm border border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors"
          onClick={() => {
            setSelectedDate(new Date());
            loadVisitsForDate(new Date());
            setShowVisitModal(true);
          }}
        >
          <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Visits Today</p>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{visitCountToday}</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{visitPatientsToday.length} unique patients</p>
          <div className="mt-2 text-xs text-blue-600 dark:text-blue-400 flex items-center">
            <span>Click to view details</span>
            <svg className="h-3 w-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Visit Details Modal */}
      {showVisitModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Patient Visits</h2>
              <button
                onClick={() => setShowVisitModal(false)}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <svg className="h-5 w-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex-grow">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Select Date
                  </label>
                  <input
                    type="date"
                    value={selectedDate.toISOString().split('T')[0]}
                    onChange={(e) => {
                      const newDate = new Date(e.target.value);
                      setSelectedDate(newDate);
                      loadVisitsForDate(newDate);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div className="flex-shrink-0 mt-6">
                  <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-lg">
                    <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                      {visitsForDate.length} visits ({Object.keys(visitPatients).length} unique patients)
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {isLoadingVisits ? (
                <div className="flex justify-center items-center h-40">
                  <svg className="animate-spin h-8 w-8 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              ) : visitsForDate.length === 0 ? (
                <div className="text-center py-10">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No visits found</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    There are no recorded visits for this date.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {visitsForDate.map((visit) => {
                    const patient = visitPatients[visit.patient_id];
                    return (
                      <div key={visit.id} className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-sm p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-lg font-medium text-gray-900 dark:text-white cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400" onClick={() => handleViewPatient(patient)}>
                                {patient?.name || 'Unknown Patient'}
                              </h3>
                              <div className="text-right">
                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                  {formatTime(visit.created_at)}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  Visit Time
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2 mb-2">
                              {patient?.clinicId && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                  ID: {patient.clinicId}
                                </span>
                              )}
                              {patient?.dob && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">
                                  Age: {calculateAge(patient.dob)} / DOB: {patient.dob}
                                </span>
                              )}
                              {patient?.sex && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                                  {patient.sex}
                                </span>
                              )}
                            </div>
                            {patient?.diagnosis && (
                              <p className="text-sm text-gray-600 dark:text-gray-300">
                                <span className="font-medium">Diagnosis:</span> {patient.diagnosis}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Patient Details Modal */}
      {showPatientDetails && selectedPatient && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Patient Details</h2>
              <button
                onClick={() => {
                  setShowPatientDetails(false);
                  setSelectedPatient(null);
                }}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <svg className="h-5 w-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
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
                    onClick={() => handleGenerateReport(selectedPatient)}
                    className="p-2 text-green-600 hover:bg-green-100 rounded-md transition duration-150"
                    title="Generate PDF Report"
                  >
                    <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleLogVisit(selectedPatient)}
                    className="p-2 text-amber-600 hover:bg-amber-100 rounded-md transition duration-150"
                    title="Log Visit (Returning Patient)"
                  >
                    <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Personal Information</h3>
                  <div className="space-y-3">
                    {selectedPatient.dob && (
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Age</span>
                        <span className="text-sm text-gray-900 dark:text-gray-100">{calculateAge(selectedPatient.dob)}</span>
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
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Medical Information</h3>
                  <div className="space-y-3">
                    {selectedPatient.ageOfDiagnosis && (
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Diagnosis Age</span>
                        <span className="text-sm text-gray-900 dark:text-gray-100">{selectedPatient.ageOfDiagnosis}</span>
                      </div>
                    )}
                    {selectedPatient.diagnosis && (
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Diagnosis</span>
                        <span className="text-sm text-gray-900 dark:text-gray-100">{selectedPatient.diagnosis}</span>
                      </div>
                    )}
                    {selectedPatient.treatment && (
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Treatment</span>
                        <span className="text-sm text-gray-900 dark:text-gray-100">{selectedPatient.treatment}</span>
                      </div>
                    )}
                    {selectedPatient.currentTreatment ? (
                      <div className="flex flex-col">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Current Treatment</span>
                          <button
                            onClick={() => handlePrintTreatment(selectedPatient)}
                            title="Print treatment card for this patient"
                            className="flex items-center px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs"
                          >
                            <svg className="h-3 w-3 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                            </svg>
                            Print
                          </button>
                        </div>
                        <div className="mt-1 bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-600 max-h-40 overflow-y-auto">
                          <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words">{selectedPatient.currentTreatment}</p>
                        </div>
                      </div>
                    ) : null}
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Clinic ID</span>
                      <span className="text-sm text-gray-900 dark:text-gray-100">{selectedPatient.clinicId}</span>
                    </div>
                    {selectedPatient.history && (
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">History</span>
                        <div className="mt-1 bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-600 max-h-40 overflow-y-auto">
                          <span className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words">{selectedPatient.history}</span>
                        </div>
                      </div>
                    )}
                    {selectedPatient.pastMedicalHistory && (
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Past Medical History</span>
                        <div className="mt-1 bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-600 max-h-40 overflow-y-auto">
                          <span className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words">{selectedPatient.pastMedicalHistory}</span>
                        </div>
                      </div>
                    )}
                    {selectedPatient.drugHistory && (
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Drug History</span>
                        <div className="mt-1 bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-600 max-h-40 overflow-y-auto">
                          <span className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words">{selectedPatient.drugHistory}</span>
                        </div>
                      </div>
                    )}
                    {selectedPatient.pastSurgicalHistory && (
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Past Surgical History</span>
                        <div className="mt-1 bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-600 max-h-40 overflow-y-auto">
                          <span className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words">{selectedPatient.pastSurgicalHistory}</span>
                        </div>
                      </div>
                    )}
                    {selectedPatient.followUpDate && (
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Follow Up Date</span>
                        <span className="text-sm text-gray-900 dark:text-gray-100">{selectedPatient.followUpDate}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Notes Section */}
              {selectedPatient.note && (
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg mb-6">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Notes</h3>
                  <p className="text-sm text-gray-800 dark:text-gray-200">
                    {selectedPatient.note}
                  </p>
                </div>
              )}

              {/* Table Data Section */}
              {selectedPatient.tableData && (
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Additional Data</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse rounded-lg overflow-hidden">
                      <tbody>
                        {(() => {
                          try {
                            const tableData = JSON.parse(selectedPatient.tableData);
                            if (Array.isArray(tableData) && tableData.length > 0) {
                              return tableData.map((row, rowIndex) => (
                                <tr key={rowIndex}>
                                  {Array.isArray(row) && row.map((cell, colIndex) => (
                                    <td
                                      key={`${rowIndex}-${colIndex}`}
                                      className={`border border-gray-300 dark:border-gray-600 px-2 py-1 text-xs ${cell ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100' :
                                        'bg-gray-100 dark:bg-gray-800/50'
                                        }`}
                                    >
                                      {cell || ''}
                                    </td>
                                  ))}
                                </tr>
                              ));
                            }
                          } catch (e) {
                            return (
                              <tr>
                                <td className="text-sm text-red-500 p-2">Error parsing table data</td>
                              </tr>
                            );
                          }
                          return null;
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Charts grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white dark:bg-gray-800 rounded-xl p-4 md:p-6 shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-3">Monthly New Patients ({thisYear})</h2>
          <Bar data={barData} options={{
            responsive: true,
            plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
            scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
          }} />
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 md:p-6 shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-3">Sex Distribution</h2>
          <Doughnut data={doughnutData} options={{
            responsive: true,
            plugins: { legend: { position: 'bottom' } },
            cutout: '60%'
          }} />
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 md:p-6 shadow-sm border border-gray-100 dark:border-gray-700 xl:col-span-3">
          <h2 className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-3">Cumulative Growth</h2>
          <Line data={lineData} options={{
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
          }} />
        </div>
      </div>
    </div>
  );
}