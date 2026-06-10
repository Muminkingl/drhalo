"use client";

import { useState, useMemo, useEffect } from 'react';
import { usePatients, Appointment } from '../context/PatientContext';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/navigation';
import SupabaseSetupGuide from '../components/SupabaseSetupGuide';

export default function Dashboard() {
  const { patients, appointments, editAppointment } = usePatients();
  const { isStaffAuth, isReceptionAuth } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isStaffAuth || isReceptionAuth) {
      router.push('/dashboard/schedule');
    }
  }, [isStaffAuth, isReceptionAuth, router]);
  
  // Dashboard appointments search & status filter
  const [appointmentSearch, setAppointmentSearch] = useState('');
  const [appointmentStatusFilter, setAppointmentStatusFilter] = useState('all');

  const getTodayString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const todayStr = getTodayString();

  // Find a registered patient by name or phone
  const findMatchingPatient = (name: string, phone: string) => {
    if (!name && !phone) return null;
    return patients.find(p => 
      p.name.trim().toLowerCase() === name.trim().toLowerCase() ||
      (p.mobileNumber && p.mobileNumber.trim() === phone.trim())
    );
  };

  // Filter appointments for today
  const filteredTodayAppts = useMemo(() => {
    return (appointments || []).filter(app => {
      const isToday = app.appointmentDate === todayStr;
      if (!isToday) return false;

      const matchesSearch = appointmentSearch.trim() === '' ||
        app.patientName.toLowerCase().includes(appointmentSearch.toLowerCase()) ||
        app.phoneNumber.includes(appointmentSearch);

      const matchesStatus = appointmentStatusFilter === 'all' || app.status === appointmentStatusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [appointments, todayStr, appointmentSearch, appointmentStatusFilter]);

  // Filter upcoming appointments
  const filteredUpcomingAppts = useMemo(() => {
    return (appointments || []).filter(app => {
      const isUpcoming = app.appointmentDate > todayStr;
      if (!isUpcoming) return false;

      const matchesSearch = appointmentSearch.trim() === '' ||
        app.patientName.toLowerCase().includes(appointmentSearch.toLowerCase()) ||
        app.phoneNumber.includes(appointmentSearch);

      const matchesStatus = appointmentStatusFilter === 'all' || app.status === appointmentStatusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [appointments, todayStr, appointmentSearch, appointmentStatusFilter]);

  // Calculate age from DOB
  const calculateAge = (dob: string): number => {
    if (!dob) return 0;

    // Check if dob is just an age number (some legacy data might be like this)
    if (/^\d{1,3}$/.test(dob)) {
      return parseInt(dob, 10);
    }

    const birthDate = new Date(dob);
    // Check if date is valid
    if (isNaN(birthDate.getTime())) return 0;

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthCX = today.getMonth() - birthDate.getMonth();

    if (monthCX < 0 || (monthCX === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age;
  };

  // Calculate some basic stats from patients data
  const totalPatients = patients.length;
  const malePatients = patients.filter(p => p.sex === 'Male').length;
  const femalePatients = patients.filter(p => p.sex === 'Female').length;
  const averageAge = patients.length > 0
    ? Math.round(patients.reduce((sum, patient) => sum + (calculateAge(patient.dob) || 0), 0) / patients.length)
    : 0;

  // Stats for the dashboard
  const stats = [
    {
      id: 1,
      name: 'Total Patients',
      value: totalPatients.toString(),
      change: '+' + (patients.length > 0 ? patients.filter(p => {
        const createdDate = new Date(p.createdAt);
        const lastWeek = new Date();
        lastWeek.setDate(lastWeek.getDate() - 7);
        return createdDate > lastWeek;
      }).length : 0) + ' this week',
      trend: 'up'
    },
    {
      id: 2,
      name: 'Male Patients',
      value: malePatients.toString(),
      change: malePatients > 0 ? Math.round((malePatients / totalPatients) * 100) + '%' : '0%',
      trend: 'up'
    },
    {
      id: 3,
      name: 'Female Patients',
      value: femalePatients.toString(),
      change: femalePatients > 0 ? Math.round((femalePatients / totalPatients) * 100) + '%' : '0%',
      trend: 'up'
    },
    {
      id: 4,
      name: 'Average Age',
      value: averageAge > 0 ? averageAge.toString() : 'N/A',
      change: 'years',
      trend: 'neutral'
    },
  ];

  // Get recent patients (last 5)
  const recentPatients = [...patients]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  // Format date function
  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  return (
    <main className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-800 dark:text-white">Dashboard Overview</h1>
        <p className="text-gray-600 dark:text-gray-300 mt-2">
          {isReceptionAuth 
            ? "Welcome! Use the button below to register a new patient."
            : patients.length === 0
              ? "Welcome! Start by adding your first patient."
              : `Managing ${totalPatients} patient${totalPatients !== 1 ? 's' : ''}`
          }
        </p>
      </div>

      {/* Supabase Setup Guide - will only show if database is not properly configured */}
      <SupabaseSetupGuide />

      {/* Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => (
          <div key={stat.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{stat.name}</h3>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${stat.trend === 'up' ? 'bg-green-100 text-green-600' :
                stat.trend === 'down' ? 'bg-red-100 text-red-600' :
                  'bg-gray-100 text-gray-600'
                }`}>
                {stat.change}
              </span>
            </div>
            <div className="flex items-baseline">
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions and Recent Patients */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-6">Quick Actions</h3>
          <div className="space-y-4">
            <Link
              href="/dashboard/patient-form"
              className="flex items-center p-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition duration-150"
            >
              <svg className="h-5 w-5 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add New Patient
            </Link>
            {!isReceptionAuth && (
              <Link
                href="/dashboard/patients"
                className="flex items-center p-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition duration-150"
              >
                <svg className="h-5 w-5 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                </svg>
                View All Patients
              </Link>
            )}
          </div>
        </div>

        {/* Recent Patients */}
        {!isReceptionAuth && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Recent Patients</h3>
            <Link href="/dashboard/patients" className="text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300">
              View all →
            </Link>
          </div>

          {recentPatients.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Name
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      File No.
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Date Added
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                  {recentPatients.map((patient) => (
                    <tr key={patient.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-8 w-8 bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium">{patient.name.charAt(0)}</span>
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{patient.name}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{patient.diagnosis}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-gray-100">{patient.hospitalFileNumber}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(patient.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <svg className="mx-auto h-12 w-12 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No patients yet</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Get started by adding your first patient.</p>
              <div className="mt-6">
                <Link
                  href="/dashboard/patient-form"
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Patient
                </Link>
              </div>
            </div>
          )}
        </div>
        )}
      </div>

      {/* Clinic Appointments Tracker (Doctor Dashboard) */}
      {!isReceptionAuth && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 mt-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-gray-100 dark:border-gray-700 pb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Clinic Appointments Tracker</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Track today's queue and upcoming patient visits.</p>
            </div>
            
            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search name or phone..."
                  value={appointmentSearch}
                  onChange={(e) => setAppointmentSearch(e.target.value)}
                  className="pl-8 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <svg className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              
              <select
                value={appointmentStatusFilter}
                onChange={(e) => setAppointmentStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none font-semibold"
              >
                <option value="all">All Statuses</option>
                <option value="Scheduled">Scheduled</option>
                <option value="Arrived">Arrived</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Column 1: Today's Appointments */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Today's Appointments ({filteredTodayAppts.length})</span>
                <span className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold">{todayStr}</span>
              </div>
              
              {filteredTodayAppts.length === 0 ? (
                <div className="p-8 text-center bg-gray-50 dark:bg-gray-800/30 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400 italic">No appointments for today matching filters.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                  {filteredTodayAppts.map(app => {
                    const matchedPatient = findMatchingPatient(app.patientName, app.phoneNumber);
                    return (
                      <div key={app.id} className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-100 dark:border-gray-700/50 flex items-center justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                            app.status === 'Arrived' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 animate-pulse' :
                            app.status === 'Completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                            app.status === 'Cancelled' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                            'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                          }`}>
                            {app.appointmentTime}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-gray-900 dark:text-white">{app.patientName}</span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                app.status === 'Arrived' ? 'bg-amber-100 text-amber-700' :
                                app.status === 'Completed' ? 'bg-green-100 text-green-700' :
                                app.status === 'Cancelled' ? 'bg-red-100 text-red-700' :
                                'bg-blue-100 text-blue-700'
                              }`}>{app.status}</span>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">📞 {app.phoneNumber}</p>
                            {app.notes && <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 italic">&quot;{app.notes}&quot;</p>}
                          </div>
                        </div>

                        {/* Integration lookup & Status Updates */}
                        <div className="flex flex-col items-end gap-2">
                          {matchedPatient ? (
                            <Link
                              href={`/dashboard/patients?search=${encodeURIComponent(matchedPatient.name)}`}
                              className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-900/20 dark:hover:bg-indigo-900/40 dark:text-indigo-300 text-xs font-semibold rounded-lg transition-colors border border-indigo-100 dark:border-indigo-800"
                            >
                              View File
                            </Link>
                          ) : (
                            <span className="px-2.5 py-1.5 bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 text-[10px] font-semibold rounded-lg border border-gray-200 dark:border-gray-700">
                              Not Registered
                            </span>
                          )}
                          
                          {/* Doctor Quick Actions */}
                          {app.status === 'Arrived' && editAppointment && (
                            <button
                              onClick={async () => {
                                try {
                                  await editAppointment(app.id, { status: 'Completed' });
                                } catch (e) {
                                  console.error(e);
                                }
                              }}
                              className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-[10px] font-semibold rounded shadow-xs"
                            >
                              Seen
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Column 2: Upcoming Appointments */}
            <div>
              <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-4">Upcoming Appointments ({filteredUpcomingAppts.length})</span>
              
              {filteredUpcomingAppts.length === 0 ? (
                <div className="p-8 text-center bg-gray-50 dark:bg-gray-800/30 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400 italic">No upcoming appointments matching filters.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                  {filteredUpcomingAppts.map(app => {
                    const matchedPatient = findMatchingPatient(app.patientName, app.phoneNumber);
                    return (
                      <div key={app.id} className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-100 dark:border-gray-700/50 flex items-center justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className="h-8 w-8 bg-indigo-50 dark:bg-indigo-900/10 text-indigo-600 dark:text-indigo-400 rounded-lg flex flex-col items-center justify-center font-bold p-1 leading-none text-center">
                            <span className="text-[10px]">{app.appointmentDate.split('-')[2]}</span>
                            <span className="text-[8px] uppercase">{new Date(app.appointmentDate).toLocaleString('en-US', { month: 'short' })}</span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-gray-900 dark:text-white">{app.patientName}</span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">@{app.appointmentTime}</span>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Status: {app.status}</p>
                          </div>
                        </div>

                        {matchedPatient ? (
                          <Link
                            href={`/dashboard/patients?search=${encodeURIComponent(matchedPatient.name)}`}
                            className="px-2 py-1 text-indigo-600 hover:text-indigo-800 text-xs font-semibold"
                          >
                            View File
                          </Link>
                        ) : (
                          <span className="text-gray-400 text-[10px] italic">Not Registered</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
} 