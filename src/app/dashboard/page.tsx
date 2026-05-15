"use client";

import { usePatients } from '../context/PatientContext';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import SupabaseSetupGuide from '../components/SupabaseSetupGuide';

export default function Dashboard() {
  const { patients } = usePatients();
  const { isReceptionAuth } = useAuth();

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
    </main>
  );
} 