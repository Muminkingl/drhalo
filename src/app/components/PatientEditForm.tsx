"use client";

import { useState, useEffect } from 'react';
import { Patient } from '../context/PatientContext';

interface PatientEditFormProps {
  patient: Patient;
  onSubmit: (data: Partial<Patient>) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
}

export default function PatientEditForm({ patient, onSubmit, onCancel, isLoading }: PatientEditFormProps) {
  const [formData, setFormData] = useState({
    name: patient.name,
    dob: patient.dob || '',
    hospitalFileNumber: patient.hospitalFileNumber,
    mobileNumber: patient.mobileNumber,
    sex: patient.sex,
    ageOfDiagnosis: patient.ageOfDiagnosis,
    diagnosis: patient.diagnosis,
    treatment: patient.treatment,
    currentTreatment: patient.currentTreatment || '',
    history: patient.history || '',
    pastMedicalHistory: patient.pastMedicalHistory || '',
    drugHistory: patient.drugHistory || '',
    pastSurgicalHistory: patient.pastSurgicalHistory || '',
    examination: patient.examination || '',
    note: patient.note || '',
    tableData: patient.tableData || '',
    followUpDate: patient.followUpDate || '',

    // clinicId is read-only, not included in editable form
  });

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

  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Reset the form when the patient changes
  useEffect(() => {
    setFormData({
      name: patient.name,
      dob: patient.dob || '',
      hospitalFileNumber: patient.hospitalFileNumber,
      mobileNumber: patient.mobileNumber,
      sex: patient.sex,
      ageOfDiagnosis: patient.ageOfDiagnosis,
      diagnosis: patient.diagnosis,
      treatment: patient.treatment,
      currentTreatment: patient.currentTreatment || '',
      history: patient.history || '',
      pastMedicalHistory: patient.pastMedicalHistory || '',
      drugHistory: patient.drugHistory || '',
      pastSurgicalHistory: patient.pastSurgicalHistory || '',
      examination: patient.examination || '',
      note: patient.note || '',
      tableData: patient.tableData || '',
      followUpDate: patient.followUpDate || '',

      // clinicId is read-only, not included in editable form
    });

    // Parse table data from JSON if it exists
    if (patient.tableData) {
      try {
        const parsedTable = JSON.parse(patient.tableData);
        if (Array.isArray(parsedTable) && parsedTable.length > 0 && Array.isArray(parsedTable[0])) {
          // Handle tables of any size
          setTableCells(parsedTable);
        } else {
          // Default to 8x8 if invalid format
          setTableCells(Array(8).fill(null).map(() => Array(8).fill('')));
        }
      } catch (err) {
        console.error("Error parsing table data:", err);
        setTableCells(Array(8).fill(null).map(() => Array(8).fill('')));
      }
    } else {
      setTableCells(Array(8).fill(null).map(() => Array(8).fill('')));
    }
  }, [patient]);

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

  const handlePrintGeneric = (content: string, title: string) => {
    // Create a new window for the print document
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups for this website');
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
          
          /* Patient info container - positioned at top left */
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
            top: 165px;  /* Shifted down next to green subtitle M.B.Ch.B */
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
          
          /* Content */
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
              display: none !important;
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
          <div class="age-arabic-container">${patient.dob || 'N/A'}</div>

          <!-- Today's date next to التاريخ: -->
          <div class="date-container">${new Date().toISOString().split('T')[0]}</div>

          <!-- Clinic ID next to green text -->
          <div class="clinic-container">
            <div class="clinic-id-label">clinic ID:</div>
            <div class="clinic-id-value">${patient.clinicId}</div>
          </div>

          <div class="treatment-data">
            <div class="treatment-content">${content}</div>
          </div>
        </div>
        
        <button class="print-button" onclick="window.print();return false;">Print</button>
        <script>
          window.onload = function() {
            document.documentElement.style.width = '148mm';
            document.documentElement.style.height = '210mm';
            document.body.style.width = '148mm';
            document.body.style.height = '210mm';
            document.body.style.margin = '0';
            document.body.style.padding = '0';
            document.body.style.border = 'none';
            document.body.style.overflow = 'hidden';
            
            const style = document.createElement('style');
            style.textContent = "@media print { @page { size: A5 portrait; margin: 0 !important; } body { margin: 0 !important; } }";
            document.head.appendChild(style);
            
            setTimeout(function() {
              window.print();
            }, 800);
          }
        </script>
      </body>
      </html>
    `);

    printWindow.document.close();
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    try {
      await onSubmit(formData);
      setSuccessMessage('Patient updated successfully');

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } catch (err) {
      setError('Failed to update patient');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-600 rounded-lg text-sm">
          {successMessage}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Name */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Name
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            disabled={isLoading}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:opacity-70 disabled:cursor-not-allowed"
          />
        </div>

        {/* DOB */}
        <div>
          <label htmlFor="dob" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            DOB <span className="text-xs text-gray-500">(Date of Birth)</span>
          </label>
          <input
            type="text"
            id="dob"
            name="dob"
            value={formData.dob}
            onChange={handleChange}
            placeholder="YYYY-MM-DD or Age"
            disabled={isLoading}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:opacity-70 disabled:cursor-not-allowed"
          />
        </div>

        {/* Hospital File Number */}
        <div>
          <label htmlFor="hospitalFileNumber" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Hospital File Number
          </label>
          <input
            type="text"
            id="hospitalFileNumber"
            name="hospitalFileNumber"
            value={formData.hospitalFileNumber}
            onChange={handleChange}
            disabled={isLoading}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:opacity-70 disabled:cursor-not-allowed"
          />
        </div>

        {/* Mobile Number */}
        <div>
          <label htmlFor="mobileNumber" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Mobile Number
          </label>
          <input
            type="text"
            id="mobileNumber"
            name="mobileNumber"
            value={formData.mobileNumber}
            onChange={handleChange}
            disabled={isLoading}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:opacity-70 disabled:cursor-not-allowed"
          />
        </div>

        {/* Sex */}
        <div>
          <label htmlFor="sex" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Sex
          </label>
          <select
            id="sex"
            name="sex"
            value={formData.sex}
            onChange={handleChange}
            disabled={isLoading}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <option value="">Select gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </div>

        {/* Age of Diagnosis */}
        <div>
          <label htmlFor="ageOfDiagnosis" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Age/Year of Diagnosis
          </label>
          <input
            type="text"
            id="ageOfDiagnosis"
            name="ageOfDiagnosis"
            value={formData.ageOfDiagnosis}
            onChange={handleChange}
            disabled={isLoading}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:opacity-70 disabled:cursor-not-allowed"
          />
        </div>

        {/* Diagnosis */}
        <div>
          <label htmlFor="diagnosis" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Diagnosis
          </label>
          <input
            type="text"
            id="diagnosis"
            name="diagnosis"
            value={formData.diagnosis}
            onChange={handleChange}
            disabled={isLoading}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:opacity-70 disabled:cursor-not-allowed"
          />
        </div>

        {/* Treatment */}
        <div>
          <label htmlFor="treatment" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Treatment
          </label>
          <input
            type="text"
            id="treatment"
            name="treatment"
            value={formData.treatment}
            onChange={handleChange}
            disabled={isLoading}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:opacity-70 disabled:cursor-not-allowed"
          />
        </div>

        {/* Current Treatment */}
        <div>
          <label htmlFor="currentTreatment" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Current Treatment
          </label>
          <textarea
            id="currentTreatment"
            name="currentTreatment"
            value={formData.currentTreatment}
            onChange={handleChange}
            rows={3}
            disabled={isLoading}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:opacity-70 disabled:cursor-not-allowed"
          />
        </div>

        {/* Clinic ID (Read-only) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Clinic ID
          </label>
          <div className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium text-sm">
            {patient.clinicId || 'Not assigned'}
          </div>
        </div>

        {/* History */}
        <div>
          <label htmlFor="history" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            History
          </label>
          <textarea
            id="history"
            name="history"
            value={formData.history}
            onChange={handleChange}
            rows={3}
            disabled={isLoading}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:opacity-70 disabled:cursor-not-allowed"
          />
        </div>

        {/* Past Medical History */}
        <div>
          <label htmlFor="pastMedicalHistory" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Past Medical History
          </label>
          <textarea
            id="pastMedicalHistory"
            name="pastMedicalHistory"
            value={formData.pastMedicalHistory}
            onChange={handleChange}
            rows={3}
            disabled={isLoading}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:opacity-70 disabled:cursor-not-allowed"
          />
        </div>

        {/* Drug History */}
        <div>
          <label htmlFor="drugHistory" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Drug History
          </label>
          <textarea
            id="drugHistory"
            name="drugHistory"
            value={formData.drugHistory}
            onChange={handleChange}
            rows={3}
            disabled={isLoading}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:opacity-70 disabled:cursor-not-allowed"
          />
        </div>

        {/* Past Surgical History */}
        <div>
          <label htmlFor="pastSurgicalHistory" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Past Surgical History
          </label>
          <textarea
            id="pastSurgicalHistory"
            name="pastSurgicalHistory"
            value={formData.pastSurgicalHistory}
            onChange={handleChange}
            rows={3}
            disabled={isLoading}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:opacity-70 disabled:cursor-not-allowed"
          />
        </div>

        {/* Examination */}
        <div>
          <label htmlFor="examination" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Examination
          </label>
          <textarea
            id="examination"
            name="examination"
            value={formData.examination}
            onChange={handleChange}
            rows={4}
            disabled={isLoading}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:opacity-70 disabled:cursor-not-allowed"
          />
        </div>

        {/* Follow up date */}
        <div>
          <label htmlFor="followUpDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Follow up date
          </label>
          <input
            type="text"
            id="followUpDate"
            name="followUpDate"
            value={formData.followUpDate}
            onChange={handleChange}
            disabled={isLoading}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:opacity-70 disabled:cursor-not-allowed"
            placeholder="Follow up date"
          />
        </div>

      </div>

      {/* Notes */}
      <div>
        <label htmlFor="note" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Notes
        </label>
        <textarea
          id="note"
          name="note"
          value={formData.note}
          onChange={handleChange}
          rows={3}
          disabled={isLoading}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:opacity-70 disabled:cursor-not-allowed"
        />
      </div>

      {/* Data Table (with dynamic sizing) */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Additional Data Table
          </label>
          <div className="flex space-x-2">
            <div className="flex space-x-1">
              <button
                type="button"
                onClick={addTableColumn}
                disabled={isLoading}
                className="px-2 py-1 text-xs bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 rounded-l border border-indigo-200 dark:border-indigo-800 focus:outline-none"
                title="Add column"
              >
                <div className="flex items-center">
                  <svg className="h-3 w-3 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2zM3 16a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2z" />
                  </svg>
                  Add Col
                </div>
              </button>
              <button
                type="button"
                onClick={removeTableColumn}
                disabled={isLoading || tableCells[0].length <= 1}
                className="px-2 py-1 text-xs bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-300 rounded-r border border-red-200 dark:border-red-800 focus:outline-none disabled:opacity-50"
                title="Remove column"
              >
                <div className="flex items-center">
                  <svg className="h-3 w-3 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 6a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2zm0 6a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1v-1z" clipRule="evenodd" />
                  </svg>
                  Del Col
                </div>
              </button>
            </div>

            <div className="flex space-x-1">
              <button
                type="button"
                onClick={addTableRow}
                disabled={isLoading}
                className="px-2 py-1 text-xs bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 rounded-l border border-indigo-200 dark:border-indigo-800 focus:outline-none"
                title="Add row"
              >
                <div className="flex items-center">
                  <svg className="h-3 w-3 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM14 11a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1h-1a1 1 0 110-2h1v-1a1 1 0 011-1z" />
                  </svg>
                  Add Row
                </div>
              </button>
              <button
                type="button"
                onClick={removeTableRow}
                disabled={isLoading || tableCells.length <= 1}
                className="px-2 py-1 text-xs bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-300 rounded-r border border-red-200 dark:border-red-800 focus:outline-none disabled:opacity-50"
                title="Remove row"
              >
                <div className="flex items-center">
                  <svg className="h-3 w-3 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                  </svg>
                  Del Row
                </div>
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto border border-gray-300 dark:border-gray-700 rounded-lg">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {tableCells[0].map((_, colIndex) => (
                  <th
                    key={colIndex}
                    className="border border-gray-300 dark:border-gray-600 px-3 py-2 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm font-medium"
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
                      className="border border-gray-300 dark:border-gray-600 px-1 py-1 bg-white dark:bg-gray-800"
                    >
                      <input
                        type="text"
                        name={`tableCell-${rowIndex}-${colIndex}`}
                        value={cell}
                        onChange={handleChange}
                        disabled={isLoading}
                        className="w-full px-2 py-1 bg-transparent text-gray-900 dark:text-white focus:outline-none text-sm"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Optional: Add any additional data in this table. Use the buttons above to add rows or columns.
        </p>
      </div>

      {/* Buttons */}
      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-md transition duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-70 disabled:cursor-not-allowed flex items-center"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </button>
      </div>
    </form>
  );
} 