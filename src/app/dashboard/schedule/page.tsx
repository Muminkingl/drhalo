"use client";

import { useState, useEffect, useMemo } from 'react';
import { usePatients, Appointment } from '@/app/context/PatientContext';
import { useAuth } from '@/app/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function AppointmentsSchedulePage() {
  const { appointments, addAppointment, editAppointment, deleteAppointment, isLoading, error } = usePatients();
  const { isReceptionAuth, isStaffAuth } = useAuth();
  const router = useRouter();

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Date filter: default to today's date formatted as YYYY-MM-DD
  const getTodayString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };
  
  const [dateFilter, setDateFilter] = useState<string>(getTodayString());

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);

  // Form States for Add/Edit
  const [formData, setFormData] = useState({
    patientName: '',
    phoneNumber: '',
    appointmentDate: getTodayString(),
    appointmentTime: '10:00',
    notes: '',
    status: 'Scheduled' as 'Scheduled' | 'Arrived' | 'Completed' | 'Cancelled'
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Stats computation for today
  const todayStats = useMemo(() => {
    const todayStr = getTodayString();
    const todayAppts = appointments.filter(app => app.appointmentDate === todayStr);
    
    return {
      total: todayAppts.length,
      scheduled: todayAppts.filter(app => app.status === 'Scheduled').length,
      arrived: todayAppts.filter(app => app.status === 'Arrived').length,
      completed: todayAppts.filter(app => app.status === 'Completed').length,
      cancelled: todayAppts.filter(app => app.status === 'Cancelled').length
    };
  }, [appointments]);

  // Filter and Search Appointments
  const filteredAppointments = useMemo(() => {
    return appointments.filter(app => {
      // 1. Search term filter (name or phone)
      const matchesSearch = searchTerm.trim() === '' || 
        app.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.phoneNumber.includes(searchTerm);

      // 2. Status filter
      const matchesStatus = statusFilter === 'all' || app.status === statusFilter;

      // 3. Date filter
      const matchesDate = dateFilter === '' || app.appointmentDate === dateFilter;

      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [appointments, searchTerm, statusFilter, dateFilter]);

  // Handle Add Appointment Open
  const handleOpenAddModal = () => {
    setFormData({
      patientName: '',
      phoneNumber: '',
      appointmentDate: dateFilter || getTodayString(),
      appointmentTime: '10:00',
      notes: '',
      status: 'Scheduled'
    });
    setFormError(null);
    setShowAddModal(true);
  };

  // Handle Edit Appointment Open
  const handleOpenEditModal = (app: Appointment) => {
    setSelectedAppointment(app);
    setFormData({
      patientName: app.patientName,
      phoneNumber: app.phoneNumber,
      appointmentDate: app.appointmentDate,
      appointmentTime: app.appointmentTime,
      notes: app.notes,
      status: app.status
    });
    setFormError(null);
    setShowEditModal(true);
  };

  // Form Submission for Adding
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.patientName.trim() || !formData.phoneNumber.trim()) {
      setFormError('Patient name and phone number are required.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      await addAppointment(formData);
      setShowAddModal(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to create appointment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Form Submission for Editing
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppointment) return;
    if (!formData.patientName.trim() || !formData.phoneNumber.trim()) {
      setFormError('Patient name and phone number are required.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      await editAppointment(selectedAppointment.id, formData);
      setShowEditModal(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to update appointment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick status update helper
  const handleUpdateStatus = async (app: Appointment, newStatus: 'Scheduled' | 'Arrived' | 'Completed' | 'Cancelled') => {
    try {
      await editAppointment(app.id, { status: newStatus });
    } catch (err) {
      console.error('Failed to update status', err);
      alert('Failed to update status.');
    }
  };

  // Delete appointment
  const handleDelete = async (id: string) => {
    if (isStaffAuth || isReceptionAuth) {
      alert("You don't have permission to delete appointments.");
      return;
    }
    if (confirm('Are you sure you want to delete this appointment?')) {
      try {
        await deleteAppointment(id);
      } catch (err: any) {
        console.error('Failed to delete appointment', err);
        alert(err.message || 'Failed to delete appointment.');
      }
    }
  };

  // Redirect to registration form with pre-filled details
  const handleRegisterPatient = (app: Appointment) => {
    // If not Arrived yet, automatically mark Arrived first (Staff registration convenience)
    if (app.status !== 'Arrived' && app.status !== 'Completed') {
      handleUpdateStatus(app, 'Arrived');
    }
    
    // Redirect with query parameters
    const url = `/dashboard/patient-form?appointmentId=${app.id}&name=${encodeURIComponent(app.patientName)}&phone=${encodeURIComponent(app.phoneNumber)}`;
    router.push(url);
  };

  // Quick date filter buttons helpers
  const setToToday = () => setDateFilter(getTodayString());
  const setToTomorrow = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yyyy = tomorrow.getFullYear();
    const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const dd = String(tomorrow.getDate()).padStart(2, '0');
    setDateFilter(`${yyyy}-${mm}-${dd}`);
  };
  const clearDateFilter = () => setDateFilter('');

  // Status badge style helper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Scheduled':
        return 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800';
      case 'Arrived':
        return 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800 animate-pulse';
      case 'Completed':
        return 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300 border border-green-200 dark:border-green-800';
      case 'Cancelled':
        return 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 border border-red-200 dark:border-red-800';
      default:
        return 'bg-gray-50 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300 border border-gray-200';
    }
  };

  return (
    <div className="p-4 md:p-6 min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Clinic Appointment Schedule</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Manage future and current patient appointments.
          </p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md transition duration-150 flex items-center justify-center font-semibold text-sm gap-2"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Appointment
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider dark:text-gray-400">Today's Total</span>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{todayStats.total}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <span className="text-xs font-semibold text-blue-500 uppercase tracking-wider">Scheduled</span>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{todayStats.scheduled}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <span className="text-xs font-semibold text-amber-500 uppercase tracking-wider">Arrived & Waiting</span>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{todayStats.arrived}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <span className="text-xs font-semibold text-green-500 uppercase tracking-wider">Completed</span>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{todayStats.completed}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 col-span-2 lg:col-span-1">
          <span className="text-xs font-semibold text-red-500 uppercase tracking-wider">Cancelled</span>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{todayStats.cancelled}</p>
        </div>
      </div>

      {/* Filters and Search Panel */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
          
          {/* Status Pills */}
          <div className="flex bg-gray-100 dark:bg-gray-700/50 p-1 rounded-xl gap-1 w-full lg:w-auto overflow-x-auto scrollbar-hide">
            {[
              { id: 'all', label: 'All Statuses' },
              { id: 'Scheduled', label: 'Scheduled' },
              { id: 'Arrived', label: 'Arrived' },
              { id: 'Completed', label: 'Completed' },
              { id: 'Cancelled', label: 'Cancelled' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  statusFilter === tab.id 
                    ? 'bg-white dark:bg-gray-800 shadow-sm text-indigo-600 dark:text-indigo-400' 
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search, Date and Actions */}
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto items-stretch sm:items-center">
            
            {/* Search Input */}
            <div className="relative flex-grow sm:w-64">
              <input
                type="text"
                placeholder="Search patient or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50/50 dark:bg-gray-700/50 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <svg className="absolute left-3 top-3 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Date Input & quick selectors */}
            <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-xl overflow-hidden bg-gray-50/50 dark:bg-gray-700/50">
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-3 py-2 bg-transparent text-gray-900 dark:text-white text-sm focus:outline-none border-r border-gray-300 dark:border-gray-600"
              />
              <div className="flex text-xs font-semibold text-gray-600 dark:text-gray-400 px-1 gap-1">
                <button onClick={setToToday} className={`px-2 py-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded ${dateFilter === getTodayString() ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' : ''}`}>Today</button>
                <button onClick={setToTomorrow} className="px-2 py-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded">Tomorrow</button>
                <button onClick={clearDateFilter} className={`px-2 py-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded ${dateFilter === '' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' : ''}`}>All</button>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Appointments List/Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        {isLoading && appointments.length === 0 ? (
          <div className="p-8 text-center">
            <svg className="animate-spin h-8 w-8 text-indigo-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-gray-500 dark:text-gray-400">Loading appointments...</p>
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="h-12 w-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">No appointments found</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Try modifying your filters, date selection, or search query.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th scope="col" className="px-6 py-4.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Patient Details</th>
                  <th scope="col" className="px-6 py-4.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Schedule Time</th>
                  <th scope="col" className="px-6 py-4.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-6 py-4.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Notes</th>
                  <th scope="col" className="px-6 py-4.5 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                {filteredAppointments.map((app) => (
                  <tr key={app.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center font-bold">
                          {app.patientName.charAt(0).toUpperCase()}
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{app.patientName}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                            <svg className="h-3 w-3 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            {app.phoneNumber}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{app.appointmentTime}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{app.appointmentDate}</p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-1.5 rounded-full text-xs font-semibold ${getStatusBadge(app.status)}`}>
                        {app.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs text-gray-700 dark:text-gray-300 max-w-xs truncate" title={app.notes}>
                        {app.notes || <span className="text-gray-400 dark:text-gray-500 italic">No notes</span>}
                      </p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-xs font-medium space-x-1.5">
                      {/* Workflow Actions */}
                      {app.status === 'Scheduled' && (
                        <>
                          <button
                            onClick={() => handleUpdateStatus(app, 'Arrived')}
                            className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:hover:bg-amber-900/40 dark:text-amber-300 rounded-lg transition-colors border border-amber-200 dark:border-amber-800"
                          >
                            Mark Arrived
                          </button>
                          <button
                            onClick={() => handleRegisterPatient(app)}
                            className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-900/20 dark:hover:bg-indigo-900/40 dark:text-indigo-300 rounded-lg transition-colors border border-indigo-200 dark:border-indigo-800"
                          >
                            Register
                          </button>
                        </>
                      )}

                      {app.status === 'Arrived' && (
                        <>
                          <button
                            onClick={() => handleRegisterPatient(app)}
                            className="px-2.5 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors shadow-sm"
                          >
                            Register Patient
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(app, 'Completed')}
                            className="px-2.5 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300 rounded-lg transition-colors border border-gray-200 dark:border-gray-700"
                          >
                            Mark Complete
                          </button>
                        </>
                      )}

                      {/* General Actions dropdown or small icon buttons */}
                      <button
                        onClick={() => handleOpenEditModal(app)}
                        className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                        title="Edit Appointment"
                      >
                        <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>

                      {!(isStaffAuth || isReceptionAuth) && (
                        <button
                          onClick={() => handleDelete(app.id)}
                          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                          title="Delete Appointment"
                        >
                          <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Appointment Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-700">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Schedule New Appointment</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3.5 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 text-xs font-semibold rounded-lg border border-red-200 dark:border-red-800">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">Patient Name *</label>
                <input
                  type="text"
                  required
                  value={formData.patientName}
                  onChange={(e) => setFormData(prev => ({ ...prev, patientName: e.target.value }))}
                  className="w-full px-4.5 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="Enter full name"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">Phone Number *</label>
                <input
                  type="text"
                  required
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                  className="w-full px-4.5 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="Enter phone number"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.appointmentDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, appointmentDate: e.target.value }))}
                    className="w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">Time *</label>
                  <input
                    type="time"
                    required
                    value={formData.appointmentTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, appointmentTime: e.target.value }))}
                    className="w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">Notes (optional)</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-4.5 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="Reason for visit, extra instructions..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition flex items-center gap-1.5"
                >
                  {isSubmitting ? 'Scheduling...' : 'Confirm Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Appointment Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-700">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Edit Appointment</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3.5 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 text-xs font-semibold rounded-lg border border-red-200 dark:border-red-800">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">Patient Name *</label>
                <input
                  type="text"
                  required
                  value={formData.patientName}
                  onChange={(e) => setFormData(prev => ({ ...prev, patientName: e.target.value }))}
                  className="w-full px-4.5 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">Phone Number *</label>
                <input
                  type="text"
                  required
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                  className="w-full px-4.5 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.appointmentDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, appointmentDate: e.target.value }))}
                    className="w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">Time *</label>
                  <input
                    type="time"
                    required
                    value={formData.appointmentTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, appointmentTime: e.target.value }))}
                    className="w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                    className="w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none font-semibold"
                  >
                    <option value="Scheduled">Scheduled</option>
                    <option value="Arrived">Arrived</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">Notes</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-4.5 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition flex items-center gap-1.5"
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
