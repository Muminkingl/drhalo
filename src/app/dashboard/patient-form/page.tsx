"use client";

import { useState, useEffect, Suspense } from 'react';
import { usePatients, Patient } from '../../context/PatientContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';

function PatientFormContent() {
  const { addPatient, addVisit, patients, isLoading, error, editAppointment } = usePatients();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isStaffAuth, isReceptionAuth } = useAuth();
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [prefilledAppointmentId, setPrefilledAppointmentId] = useState<string | null>(null);

  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  // Role flags
  const isStaff = Boolean(isStaffAuth);
  const isReception = Boolean(isReceptionAuth);

  const [formData, setFormData] = useState({
    name: '',
    dob: '',
    hospitalFileNumber: '',
    mobileNumber: '',
    sex: '',
    ageOfDiagnosis: '',
    diagnosis: '',
    treatment: '',
    currentTreatment: '',
    history: '',
    pastMedicalHistory: '',
    drugHistory: '',
    pastSurgicalHistory: '',
    examination: '',
    note: '',
    tableData: '',
    followUpDate: '',
    // clinicId is not included here as it's auto-generated
  });

  useEffect(() => {
    const name = searchParams.get('name');
    const phone = searchParams.get('phone');
    const apptId = searchParams.get('appointmentId');
    if (name || phone || apptId) {
      setFormData(prev => ({
        ...prev,
        name: name || '',
        mobileNumber: phone || ''
      }));
      if (apptId) {
        setPrefilledAppointmentId(apptId);
      }
      // Clear query params so reloading doesn't re-trigger prefill
      router.replace('/dashboard/patient-form', { scroll: false });
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setSearchResults([]);
      return;
    }
    const lowerQuery = searchQuery.toLowerCase();
    const results = patients.filter(p => 
      p.name.toLowerCase().includes(lowerQuery) || 
      (p.clinicId && p.clinicId.toLowerCase().includes(lowerQuery)) ||
      (p.mobileNumber && p.mobileNumber.toLowerCase().includes(lowerQuery))
    );
    setSearchResults(results.slice(0, 10)); // max 10 results
  }, [searchQuery, patients]);

  // State for table cells with dynamic sizing (default 8x8)
  const [tableCells, setTableCells] = useState(
    Array(8).fill(null).map(() => Array(8).fill(''))
  );

  // Functions to add or remove rows/columns from the table
  const addTableRow = () => {
    const newRow = Array(tableCells[0].length).fill('');
    const newTableCells = [...tableCells, newRow];
    setTableCells(newTableCells);

    // Update tableData in formData
    const tableDataString = JSON.stringify(newTableCells);
    setFormData(prev => ({
      ...prev,
      tableData: tableDataString
    }));
  };

  const addTableColumn = () => {
    const newTableCells = tableCells.map(row => [...row, '']);
    setTableCells(newTableCells);

    // Update tableData in formData
    const tableDataString = JSON.stringify(newTableCells);
    setFormData(prev => ({
      ...prev,
      tableData: tableDataString
    }));
  };

  const removeTableRow = () => {
    if (tableCells.length <= 1) return; // Don't remove the last row

    const newTableCells = tableCells.slice(0, -1); // Remove the last row
    setTableCells(newTableCells);

    // Update tableData in formData
    const tableDataString = JSON.stringify(newTableCells);
    setFormData(prev => ({
      ...prev,
      tableData: tableDataString
    }));
  };

  const removeTableColumn = () => {
    if (tableCells[0].length <= 1) return; // Don't remove the last column

    const newTableCells = tableCells.map(row => row.slice(0, -1)); // Remove the last column
    setTableCells(newTableCells);

    // Update tableData in formData
    const tableDataString = JSON.stringify(newTableCells);
    setFormData(prev => ({
      ...prev,
      tableData: tableDataString
    }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    // Handle table cell changes
    if (name.startsWith('tableCell-')) {
      const [_, rowIndex, colIndex] = name.split('-');
      const newTableCells = [...tableCells];
      newTableCells[Number(rowIndex)][Number(colIndex)] = value;
      setTableCells(newTableCells);

      // Convert table data to JSON string for storage
      const tableDataString = JSON.stringify(newTableCells);
      setFormData(prev => ({
        ...prev,
        tableData: tableDataString
      }));
    } else {
      // Handle regular form fields
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Reception only has 1 step — always submit immediately
    if (currentStep < 3 && !isReception) {
      nextStep();
      return;
    }

    setLocalError(null);

    try {
      setFormSubmitted(true);
      
      if (mode === 'existing' && selectedPatient) {
        await addVisit(selectedPatient.id, { ...formData, clinicId: '' });
      } else {
        // Since clinicId is auto-generated on the server, we don't include it in the form data
        await addPatient({ ...formData, clinicId: '' });
      }

      // If we have a prefilled appointment, update its status to Completed
      if (prefilledAppointmentId && editAppointment) {
        await editAppointment(prefilledAppointmentId, { status: 'Completed' });
      }

      // Reset form after submission
      setTimeout(() => {
        setFormData({
          name: '',
          dob: '',
          hospitalFileNumber: '',
          mobileNumber: '',
          sex: '',
          ageOfDiagnosis: '',
          diagnosis: '',
          treatment: '',
          currentTreatment: '',
          history: '',
          pastMedicalHistory: '',
          drugHistory: '',
          pastSurgicalHistory: '',
          examination: '',
          note: '',
          tableData: '',
          followUpDate: '',
        });
        // Reset table cells
        setTableCells(Array(8).fill(null).map(() => Array(8).fill('')));
        setFormSubmitted(false);
        setSelectedPatient(null);
        setMode('new');
        setSearchQuery('');
        setPrefilledAppointmentId(null);
        setCurrentStep(1); // Reset to first step for next registration
      }, 1500);
    } catch (err) {
      console.error('Error submitting patient data:', err);
      setLocalError('Failed to add patient. Please try again.');
      setFormSubmitted(false);
    }
  };

  const [currentStep, setCurrentStep] = useState(1);

  // Functions to navigate steps
  const nextStep = () => {
    if (currentStep < 3) setCurrentStep(prev => prev + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(prev => prev - 1);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header Section */}
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Patient Registration
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            {isReception ? 'Fill in the basic patient details' : 'Enter patient information below'}
          </p>
        </div>

        {/* Prefilled Appointment Banner (Reception Mode) */}
        {prefilledAppointmentId && isReception && (
          <div className="max-w-lg mx-auto mb-6">
            <div className="p-4 bg-indigo-50 dark:bg-indigo-950/30 border-l-4 border-indigo-500 text-indigo-700 dark:text-indigo-300 rounded-r-lg shadow-sm flex justify-between items-center">
              <div>
                <span className="font-semibold text-sm block">Prefilled from Active Appointment</span>
                <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5">Patient details pre-loaded. Registering will automatically mark the appointment as Completed.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPrefilledAppointmentId(null);
                  setFormData(prev => ({ ...prev, name: '', mobileNumber: '' }));
                }}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 bg-white dark:bg-gray-800 border border-indigo-200 dark:border-gray-700 px-2.5 py-1.5 rounded-lg shadow-xs transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* ── RECEPTION: Simplified single-step form ─────────────────────── */}
        {isReception && (
          <div className="max-w-lg mx-auto">

            {/* New / Returning toggle */}
            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-xl p-1 mb-6 gap-1">
              <button
                type="button"
                onClick={() => { setMode('new'); setSelectedPatient(null); setSearchQuery(''); setSearchResults([]); }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${mode === 'new' ? 'bg-white dark:bg-gray-800 shadow text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}
              >
                🆕 New Patient
              </button>
              <button
                type="button"
                onClick={() => { setMode('existing'); setSelectedPatient(null); setSearchQuery(''); setSearchResults([]); }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${mode === 'existing' ? 'bg-white dark:bg-gray-800 shadow text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}
              >
                🔁 Returning Patient
              </button>
            </div>

            {/* Returning patient — search */}
            {mode === 'existing' && !selectedPatient && (
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Search by name or mobile number…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
                {searchQuery && searchResults.length > 0 && (
                  <div className="mt-1 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 overflow-hidden shadow-lg">
                    {searchResults.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedPatient(p);
                          setSearchQuery('');
                          setSearchResults([]);
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 border-b border-gray-100 dark:border-gray-700 last:border-0 transition-colors"
                      >
                        <div className="font-medium text-gray-900 dark:text-white">{p.name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {p.mobileNumber && <span className="mr-3">📞 {p.mobileNumber}</span>}
                          {p.dob && <span>DOB: {p.dob}</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {searchQuery && searchResults.length === 0 && (
                  <div className="mt-1 p-3 text-sm text-center text-gray-500 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                    No patients found for &quot;{searchQuery}&quot;
                  </div>
                )}
              </div>
            )}

            {/* Returning — selected patient banner */}
            {mode === 'existing' && selectedPatient && (
              <div className="mb-4 flex items-center justify-between p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl border border-indigo-200 dark:border-indigo-800">
                <div>
                  <p className="text-xs text-indigo-500 font-medium mb-0.5">Returning visit for</p>
                  <p className="font-bold text-indigo-900 dark:text-indigo-100">{selectedPatient.name}</p>
                  {selectedPatient.mobileNumber && <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5">📞 {selectedPatient.mobileNumber}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => { setSelectedPatient(null); setSearchQuery(''); }}
                  className="text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 bg-white dark:bg-gray-800 px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-700 shadow-sm transition-colors"
                >
                  Change
                </button>
              </div>
            )}

            {/* Error */}
            {(localError || error) && (
              <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-400 text-red-700 rounded-r-lg">
                <span className="font-medium">{localError || error}</span>
              </div>
            )}
            {/* Success */}
            {formSubmitted && !error && !localError && (
              <div className="mb-4 p-4 bg-green-50 border-l-4 border-green-400 text-green-700 rounded-r-lg">
                <span className="font-medium">
                  {mode === 'existing' ? 'New visit logged successfully!' : 'Patient registered successfully!'} Ready for the next one.
                </span>
              </div>
            )}

            {/* Only show the form fields for new patients OR once a returning patient is selected */}
            {(mode === 'new' || (mode === 'existing' && selectedPatient)) && (
              <form
                onSubmit={handleSubmit}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-8 space-y-5"
              >
                {/* Full Name — editable only for new, read-only for returning */}
                {mode === 'new' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      disabled={isLoading || formSubmitted}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white disabled:opacity-70"
                      placeholder="Patient&apos;s full name"
                    />
                  </div>
                )}
                {/* Gender */}
                {mode === 'new' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Gender</label>
                    <select
                      name="sex"
                      value={formData.sex}
                      onChange={handleChange}
                      disabled={isLoading || formSubmitted}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white disabled:opacity-70"
                    >
                      <option value="">Select gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                )}
                {/* DOB */}
                {mode === 'new' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Date of Birth <span className="text-xs font-normal text-gray-400">(YYYY-MM-DD)</span>
                    </label>
                    <input
                      type="text"
                      name="dob"
                      value={formData.dob}
                      onChange={handleChange}
                      disabled={isLoading || formSubmitted}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white disabled:opacity-70"
                      placeholder="e.g. 1990-05-20"
                    />
                  </div>
                )}
                {/* Mobile */}
                {mode === 'new' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Mobile Number</label>
                    <input
                      type="text"
                      name="mobileNumber"
                      value={formData.mobileNumber}
                      onChange={handleChange}
                      disabled={isLoading || formSubmitted}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white disabled:opacity-70"
                      placeholder="Mobile number"
                    />
                  </div>
                )}
                {/* Notes */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Notes</label>
                  <textarea
                    name="note"
                    value={formData.note}
                    onChange={handleChange}
                    rows={3}
                    disabled={isLoading || formSubmitted}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white disabled:opacity-70"
                    placeholder="Any additional notes about the patient..."
                  />
                </div>
                {/* Submit */}
                <button
                  type="submit"
                  disabled={isLoading || formSubmitted || (mode === 'new' && !formData.name.trim())}
                  className="w-full py-3 px-6 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors"
                >
                  {isLoading || formSubmitted
                    ? (mode === 'existing' ? 'Logging Visit…' : 'Registering…')
                    : (mode === 'existing' ? 'Log Return Visit' : 'Register Patient')}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Mode Toggle — hidden for reception */}
        {!isReception && (
          <>
        <div className="max-w-3xl mx-auto mb-8 flex justify-center">
          <div className="inline-flex bg-gray-200 dark:bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => { setMode('new'); setSelectedPatient(null); setCurrentStep(1); }}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${mode === 'new' ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
            >
              New Patient
            </button>
            <button
              onClick={() => setMode('existing')}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${mode === 'existing' ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
            >
              Existing Patient
            </button>
          </div>
        </div>

        {/* Existing Patient Search */}
        {mode === 'existing' && !selectedPatient && (
          <div className="max-w-3xl mx-auto mb-8">
            <input
              type="text"
              placeholder="Search patient by name, mobile, or clinic ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
            {searchQuery && searchResults.length > 0 && (
              <div className="mt-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 overflow-hidden shadow-lg">
                {searchResults.map(p => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedPatient(p);
                      setFormData(prev => ({
                        ...prev,
                        name: p.name,
                        dob: p.dob || '',
                        sex: p.sex || '',
                        mobileNumber: p.mobileNumber || '',
                        hospitalFileNumber: p.hospitalFileNumber || '',
                        diagnosis: '',
                        treatment: '',
                        currentTreatment: '',
                        history: '',
                        pastMedicalHistory: '',
                        drugHistory: '',
                        pastSurgicalHistory: '',
                        examination: '',
                        note: '',
                        followUpDate: ''
                      }));
                      setCurrentStep(2); // Jump straight to medical info
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-0"
                  >
                    <div className="font-medium text-gray-900 dark:text-white">{p.name}</div>
                    <div className="text-sm text-gray-500 mt-1">
                      {p.clinicId && <span className="mr-3">ID: {p.clinicId}</span>}
                      {p.dob && <span>DOB: {p.dob}</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}
            {searchQuery && searchResults.length === 0 && (
              <div className="mt-2 p-4 text-center text-gray-500 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                No patients found matching "{searchQuery}"
              </div>
            )}
          </div>
        )}

        {mode === 'existing' && selectedPatient && (
           <div className="max-w-3xl mx-auto mb-8 flex justify-between items-center bg-indigo-50 dark:bg-indigo-900/30 p-4 rounded-lg border border-indigo-100 dark:border-indigo-800">
             <div>
               <span className="text-sm text-indigo-600 dark:text-indigo-400 block mb-1">Adding new visit for</span>
               <span className="font-bold text-lg text-indigo-900 dark:text-indigo-100">{selectedPatient.name}</span>
               <span className="text-sm text-indigo-700 dark:text-indigo-300 ml-3">ID: {selectedPatient.clinicId}</span>
             </div>
             <button 
               onClick={() => { setSelectedPatient(null); setCurrentStep(1); }} 
               className="text-sm font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 bg-white dark:bg-gray-800 px-3 py-1.5 rounded shadow-sm border border-indigo-200 dark:border-indigo-700 transition-colors"
             >
               Change Patient
             </button>
           </div>
        )}

        {/* Form Container (Only show if new patient or if existing patient is selected) */}
        {(mode === 'new' || (mode === 'existing' && selectedPatient)) && (
          <>
        {/* Step Navigation */}
        <div className="max-w-3xl mx-auto mb-10">
          <div className="flex justify-between items-center relative">
            <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-full h-1 bg-gray-200 dark:bg-gray-700 z-0 rounded-full"></div>
            <div 
              className="absolute left-0 top-1/2 transform -translate-y-1/2 h-1 bg-indigo-600 z-0 rounded-full transition-all duration-300" 
              style={{ width: `${((currentStep - 1) / 2) * 100}%` }}
            ></div>
            
            {[
              { num: 1, label: 'Personal Info' },
              { num: 2, label: 'Medical Info' },
              { num: 3, label: 'Additional Notes' }
            ].map((step) => (
              <div key={step.num} className="relative z-10 flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => setCurrentStep(step.num)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-colors duration-200 shadow-sm ${
                    currentStep === step.num 
                      ? 'bg-indigo-600 text-white ring-4 ring-indigo-100 dark:ring-indigo-900/50' 
                      : currentStep > step.num
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white dark:bg-gray-800 text-gray-500 border-2 border-gray-200 dark:border-gray-700'
                  }`}
                >
                  {currentStep > step.num ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                  ) : step.num}
                </button>
                <span className={`mt-2 text-xs sm:text-sm font-medium ${currentStep === step.num ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'}`}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Prefilled Appointment Banner (Standard Mode) */}
        {prefilledAppointmentId && !isReception && (
          <div className="mb-6 max-w-3xl mx-auto">
            <div className="p-4 bg-indigo-50 dark:bg-indigo-950/30 border-l-4 border-indigo-500 text-indigo-700 dark:text-indigo-300 rounded-r-lg shadow-sm flex justify-between items-center">
              <div>
                <span className="font-semibold text-sm block">Prefilled from Active Appointment</span>
                <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5">Patient details pre-loaded. Registering will automatically mark the appointment as Completed.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPrefilledAppointmentId(null);
                  setFormData(prev => ({ ...prev, name: '', mobileNumber: '' }));
                }}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 bg-white dark:bg-gray-800 border border-indigo-200 dark:border-gray-700 px-2.5 py-1.5 rounded-lg shadow-xs transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Error Message */}
        {(localError || error) && (
          <div className="mb-6 max-w-3xl mx-auto">
            <div className="p-4 bg-red-50 border-l-4 border-red-400 text-red-700 rounded-r-lg shadow-sm">
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"></path>
                </svg>
                <span className="font-medium">{localError || error}</span>
              </div>
            </div>
          </div>
        )}

        {/* Success Message */}
        {formSubmitted && !error && !localError && (
          <div className="mb-6 max-w-3xl mx-auto">
            <div className="p-4 bg-green-50 border-l-4 border-green-400 text-green-700 rounded-r-lg shadow-sm">
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
                </svg>
                <span className="font-medium">Patient record created successfully! Ready for the next one.</span>
              </div>
            </div>
          </div>
        )}

        {/* Form Container */}
        <div className="max-w-3xl mx-auto">
          <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-100 dark:border-gray-700">
            <div className="p-6 sm:p-10 min-h-[400px]">
              
              {/* STEP 1: Personal Info */}
              {currentStep === 1 && (
                <div className="animate-fadeIn">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 pb-3 border-b border-gray-100 dark:border-gray-700">
                    Step 1: Personal Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    {/* Name */}
                    <div className="md:col-span-2">
                      <label htmlFor="name" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Full Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                        disabled={isLoading || formSubmitted}
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white disabled:opacity-70 transition-all duration-200"
                        placeholder="Enter patient's full name"
                      />
                    </div>

                    {/* Sex */}
                    <div>
                      <label htmlFor="sex" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Gender
                      </label>
                      <select
                        id="sex"
                        name="sex"
                        value={formData.sex}
                        onChange={handleChange}
                        disabled={isLoading || formSubmitted}
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white disabled:opacity-70 transition-all duration-200"
                      >
                        <option value="">Select gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                    </div>

                    {/* DOB */}
                    <div>
                      <label htmlFor="dob" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        DOB <span className="text-xs text-gray-500 font-normal">(Date of Birth)</span>
                      </label>
                      <input
                        type="text"
                        id="dob"
                        name="dob"
                        value={formData.dob}
                        onChange={handleChange}
                        placeholder="YYYY-MM-DD"
                        disabled={isLoading || formSubmitted}
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white disabled:opacity-70 transition-all duration-200"
                      />
                    </div>

                    {/* Mobile Number */}
                    <div>
                      <label htmlFor="mobileNumber" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Mobile Number
                      </label>
                      <input
                        type="text"
                        id="mobileNumber"
                        name="mobileNumber"
                        value={formData.mobileNumber}
                        onChange={handleChange}
                        disabled={isLoading || formSubmitted}
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white disabled:opacity-70 transition-all duration-200"
                        placeholder="Mobile number"
                      />
                    </div>

                    {/* Age/Year of Diagnosis */}
                    <div>
                      <label htmlFor="ageOfDiagnosis" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Age/Year of Diagnosis
                      </label>
                      <input
                        type="text"
                        id="ageOfDiagnosis"
                        name="ageOfDiagnosis"
                        value={formData.ageOfDiagnosis}
                        onChange={handleChange}
                        disabled={isLoading || formSubmitted}
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white disabled:opacity-70 transition-all duration-200"
                        placeholder="Age or year"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: Medical Info */}
              {currentStep === 2 && (
                <div className="animate-fadeIn">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 pb-3 border-b border-gray-100 dark:border-gray-700">
                    Step 2: Medical Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    {/* Clinic ID (display only) */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Clinic ID
                      </label>
                      <div className="w-full px-4 py-3 border border-blue-200 dark:border-blue-700 rounded-lg bg-blue-50/50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-300 font-medium">
                        {mode === 'existing' && selectedPatient ? selectedPatient.clinicId : 'Auto-generated after submission'}
                      </div>
                      {mode === 'new' && (
                        <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                          Format: [PatientNumber(2-digits)][DDMMYY]
                        </p>
                      )}
                    </div>

                    {/* Age/Year of Diagnosis (Also in Step 1, but keeping as requested by the task if they meant to mirror it. Actually, it's better to render it once, but if task says both steps, we can render it here too. Let's render it to fulfill the list literally) */}
                    <div>
                      <label htmlFor="ageOfDiagnosis2" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Age/Year of Diagnosis
                      </label>
                      <input
                        type="text"
                        id="ageOfDiagnosis2"
                        name="ageOfDiagnosis"
                        value={formData.ageOfDiagnosis}
                        onChange={handleChange}
                        disabled={isLoading || formSubmitted}
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white disabled:opacity-70 transition-all duration-200"
                        placeholder="Age or year"
                      />
                    </div>

                    {/* Diagnosis */}
                    {!isStaff && (
                      <div className="md:col-span-2">
                        <label htmlFor="diagnosis" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          Diagnosis
                        </label>
                        <input
                          type="text"
                          id="diagnosis"
                          name="diagnosis"
                          value={formData.diagnosis}
                          onChange={handleChange}
                          disabled={isLoading || formSubmitted || isStaff}
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white disabled:opacity-70 transition-all duration-200"
                          placeholder="Patient diagnosis"
                        />
                      </div>
                    )}

                    {/* Treatment */}
                    {!isStaff && (
                      <div className="md:col-span-2">
                        <label htmlFor="treatment" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          Treatment
                        </label>
                        <input
                          type="text"
                          id="treatment"
                          name="treatment"
                          value={formData.treatment}
                          onChange={handleChange}
                          disabled={isLoading || formSubmitted || isStaff}
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white disabled:opacity-70 transition-all duration-200"
                          placeholder="Treatment information"
                        />
                      </div>
                    )}

                    {/* Current Treatment */}
                    {!isStaff && (
                      <div className="md:col-span-2">
                        <label htmlFor="currentTreatment" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          Current Treatment
                        </label>
                        <textarea
                          id="currentTreatment"
                          name="currentTreatment"
                          value={formData.currentTreatment}
                          onChange={handleChange}
                          rows={2}
                          disabled={isLoading || formSubmitted || isStaff}
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white disabled:opacity-70 transition-all duration-200"
                          placeholder="Current treatment details..."
                        />
                      </div>
                    )}

                    {/* History */}
                    {!isStaff && (
                      <div className="md:col-span-2">
                        <label htmlFor="history" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          History
                        </label>
                        <textarea
                          id="history"
                          name="history"
                          value={formData.history}
                          onChange={handleChange}
                          rows={3}
                          disabled={isLoading || formSubmitted || isStaff}
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white disabled:opacity-70 transition-all duration-200"
                          placeholder="History details..."
                        />
                      </div>
                    )}

                    {/* Past Medical History */}
                    {!isStaff && (
                      <div className="md:col-span-2">
                        <label htmlFor="pastMedicalHistory" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          Past Medical History
                        </label>
                        <textarea
                          id="pastMedicalHistory"
                          name="pastMedicalHistory"
                          value={formData.pastMedicalHistory}
                          onChange={handleChange}
                          rows={2}
                          disabled={isLoading || formSubmitted || isStaff}
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white disabled:opacity-70 transition-all duration-200"
                          placeholder="Past medical history details..."
                        />
                      </div>
                    )}

                    {/* Drug History */}
                    {!isStaff && (
                      <div className="md:col-span-2">
                        <label htmlFor="drugHistory" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          Drug History
                        </label>
                        <textarea
                          id="drugHistory"
                          name="drugHistory"
                          value={formData.drugHistory}
                          onChange={handleChange}
                          rows={2}
                          disabled={isLoading || formSubmitted || isStaff}
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white disabled:opacity-70 transition-all duration-200"
                          placeholder="Drug history details..."
                        />
                      </div>
                    )}

                    {/* Past Surgical History */}
                    {!isStaff && (
                      <div className="md:col-span-2">
                        <label htmlFor="pastSurgicalHistory" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          Past Surgical History
                        </label>
                        <textarea
                          id="pastSurgicalHistory"
                          name="pastSurgicalHistory"
                          value={formData.pastSurgicalHistory}
                          onChange={handleChange}
                          rows={2}
                          disabled={isLoading || formSubmitted || isStaff}
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white disabled:opacity-70 transition-all duration-200"
                          placeholder="Past surgical history details..."
                        />
                      </div>
                    )}

                    {/* Examination */}
                    {!isStaff && (
                      <div className="md:col-span-2">
                        <label htmlFor="examination" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          Examination
                        </label>
                        <textarea
                          id="examination"
                          name="examination"
                          value={formData.examination}
                          onChange={handleChange}
                          rows={3}
                          disabled={isLoading || formSubmitted || isStaff}
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white disabled:opacity-70 transition-all duration-200"
                          placeholder="Examination details..."
                        />
                      </div>
                    )}

                    {/* Follow up date */}
                    {!isStaff && (
                      <div className="md:col-span-2">
                        <label htmlFor="followUpDate" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          Follow Up Date
                        </label>
                        <input
                          type="text"
                          id="followUpDate"
                          name="followUpDate"
                          value={formData.followUpDate}
                          onChange={handleChange}
                          disabled={isLoading || formSubmitted || isStaff}
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white disabled:opacity-70 transition-all duration-200"
                          placeholder="Follow up date"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 3: Additional Notes */}
              {currentStep === 3 && (
                <div className="animate-fadeIn">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 pb-3 border-b border-gray-100 dark:border-gray-700">
                    Step 3: Additional Notes
                  </h3>
                  
                  {!isStaff && (
                    <div className="space-y-8">
                      <div>
                        <label htmlFor="note" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          Notes
                        </label>
                        <textarea
                          id="note"
                          name="note"
                          value={formData.note}
                          onChange={handleChange}
                          rows={8}
                          disabled={isLoading || formSubmitted || isStaff}
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white disabled:opacity-70 transition-all duration-200"
                          placeholder="Enter any additional notes or observations about the patient..."
                        />
                      </div>

                      {/* Optional Data Table hidden by default unless they used it before. Kept for backwards compatibility */}
                      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50/50 dark:bg-gray-800/50">
                        <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
                          <h4 className="text-base font-semibold text-gray-900 dark:text-white">
                            Data Table <span className="text-xs font-normal text-gray-500">(Optional)</span>
                          </h4>
                          <div className="flex space-x-2">
                            <div className="flex space-x-1">
                              <button
                                type="button"
                                onClick={addTableColumn}
                                disabled={isLoading || formSubmitted || isStaff}
                                className="flex items-center px-2 py-1 text-xs bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded border border-indigo-200 dark:border-indigo-800"
                              >
                                + Col
                              </button>
                              <button
                                type="button"
                                onClick={removeTableColumn}
                                disabled={isLoading || formSubmitted || tableCells[0].length <= 1 || isStaff}
                                className="flex items-center px-2 py-1 text-xs bg-red-50 hover:bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded border border-red-200 dark:border-red-800 disabled:opacity-50"
                              >
                                - Col
                              </button>
                            </div>
                            <div className="flex space-x-1">
                              <button
                                type="button"
                                onClick={addTableRow}
                                disabled={isLoading || formSubmitted || isStaff}
                                className="flex items-center px-2 py-1 text-xs bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded border border-indigo-200 dark:border-indigo-800"
                              >
                                + Row
                              </button>
                              <button
                                type="button"
                                onClick={removeTableRow}
                                disabled={isLoading || formSubmitted || tableCells.length <= 1 || isStaff}
                                className="flex items-center px-2 py-1 text-xs bg-red-50 hover:bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded border border-red-200 dark:border-red-800 disabled:opacity-50"
                              >
                                - Row
                              </button>
                            </div>
                          </div>
                        </div>
                        
                        <div className="overflow-x-auto border border-gray-300 dark:border-gray-700 rounded shadow-sm">
                          <table className="w-full border-collapse">
                            <thead>
                              <tr>
                                {tableCells[0].map((_, colIndex) => (
                                  <th
                                    key={colIndex}
                                    className="border border-gray-300 dark:border-gray-600 px-2 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium"
                                  >
                                    C{colIndex + 1}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {tableCells.map((row, rowIndex) => (
                                <tr key={rowIndex}>
                                  {row.map((cell, colIndex) => (
                                    <td
                                      key={`${rowIndex}-${colIndex}`}
                                      className="border border-gray-300 dark:border-gray-600 p-0 bg-white dark:bg-gray-800"
                                    >
                                      <input
                                        type="text"
                                        name={`tableCell-${rowIndex}-${colIndex}`}
                                        value={cell}
                                        onChange={handleChange}
                                        disabled={isLoading || formSubmitted || isStaff}
                                        className="w-full px-2 py-1.5 bg-transparent text-gray-900 dark:text-white focus:outline-none focus:bg-indigo-50 dark:focus:bg-indigo-900/20 text-sm"
                                      />
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                  {isStaff && (
                    <div className="text-center py-10 text-gray-500">
                      Staff accounts do not have permission to add medical notes.
                    </div>
                  )}
                </div>
              )}

              {/* Form Navigation / Submission */}
              <div className="mt-10 pt-6 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
                <button
                  type="button"
                  onClick={prevStep}
                  disabled={currentStep === 1 || isLoading || formSubmitted}
                  className={`px-6 py-2.5 rounded-lg font-medium transition-colors ${
                    currentStep === 1
                      ? 'text-gray-400 bg-gray-100 dark:bg-gray-800 cursor-not-allowed'
                      : 'text-gray-700 bg-gray-200 hover:bg-gray-300 dark:text-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600'
                  }`}
                >
                  Previous
                </button>

                {currentStep < 3 ? (
                  <button
                    key="next-btn"
                    type="button"
                    onClick={nextStep}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm transition-colors"
                  >
                    Next Step
                  </button>
                ) : (
                  <button
                    key="submit-btn"
                    type="submit"
                    disabled={isLoading || formSubmitted}
                    className={`px-8 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg shadow-md transition-all flex items-center justify-center ${
                      isLoading || formSubmitted ? 'opacity-70 cursor-not-allowed' : 'hover:shadow-lg transform hover:-translate-y-0.5'
                    }`}
                  >
                    {isLoading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Submitting...
                      </>
                    ) : formSubmitted ? (
                      'Submitted!'
                    ) : (
                      'Submit Patient Data'
                    )}
                  </button>
                )}
              </div>

            </div>
          </form>
        </div>
          </>
        )}
          </>
        )}
      </div>

    </div>
  );
}

export default function PatientForm() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8 flex justify-center items-center">
        <div className="text-center">
          <svg className="animate-spin h-10 w-10 text-indigo-600 dark:text-indigo-400 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-gray-700 dark:text-gray-300">Loading Patient Registration form...</p>
        </div>
      </div>
    }>
      <PatientFormContent />
    </Suspense>
  );
}