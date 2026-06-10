"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import DatabaseStatus from '../components/DatabaseStatus';

// Navigation items for the sidebar
const navigationItems = [
  { 
    name: 'Dashboard', 
    href: '/dashboard', 
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    description: 'Overview & Analytics'
  },
  { 
    name: 'Patient Registration', 
    href: '/dashboard/patient-form', 
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    ),
    description: 'Add New Patient'
  },
  { 
    name: 'Appointments Schedule', 
    href: '/dashboard/schedule', 
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    description: 'Manage Appointments'
  },
  { 
    name: 'Patient Directory', 
    href: '/dashboard/patients', 
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    description: 'Browse All Patients'
  },
  { 
    name: 'Reports', 
    href: '/dashboard/reports', 
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    description: 'Analytics & Reports'
  }
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { logout, isAuthenticated, isStaffAuth, isAdminAuth, isReceptionAuth } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [greeting, setGreeting] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false); // Default closed on mobile
  const [isMobile, setIsMobile] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    // Set greeting based on time of day
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good Morning');
    else if (hour < 18) setGreeting('Good Afternoon');
    else setGreeting('Good Evening');

    // Check if mobile
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth >= 1024) {
        setSidebarOpen(true);
      } else {
        setSidebarOpen(false);
      }
    };

    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);

    // Update time every minute
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => {
      window.removeEventListener('resize', checkIsMobile);
      clearInterval(timeInterval);
    };
  }, []);

  // Function to handle sidebar toggle
  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // Close sidebar when clicking outside on mobile
  const closeSidebar = () => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  // Check if the current path matches a navigation item
  const isActivePath = (path: string) => {
    if (path === '/dashboard' && pathname === '/dashboard') {
      return true;
    }
    if (path !== '/dashboard') {
      return pathname?.startsWith(path) ?? false;
    }
    return false;
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile Overlay */}
      {isMobile && sidebarOpen && (
        <div 
          className="fixed inset-0 bg-gray-900 bg-opacity-50 z-40 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Mobile Menu Button - Fixed Position */}
      {isMobile && !sidebarOpen && (
        <button
          onClick={toggleSidebar}
          className="fixed top-4 left-4 z-50 p-2 rounded-lg bg-white dark:bg-gray-800 shadow-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}

      {/* Sidebar */}
      <div className={`${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } ${isMobile ? 'fixed' : 'relative'} z-50 bg-white dark:bg-gray-800 shadow-xl transition-all duration-300 ease-in-out lg:translate-x-0 ${
        sidebarOpen ? 'w-72' : 'w-20'
      } h-full overflow-y-auto scrollbar-hide`}>
        
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
          {(sidebarOpen || !isMobile) ? (
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              {(sidebarOpen || isMobile) && (
                <div>
                  <h1 className="font-bold text-xl text-gray-900 dark:text-white">Dr. Halo</h1>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Patient Management</p>
                </div>
              )}
            </div>
          ) : (
            <div className="w-full flex justify-center">
              <button
                onClick={() => setSidebarOpen(true)}
                className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg hover:from-blue-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                title="Expand sidebar"
              >
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </button>
            </div>
          )}
          
          {/* Close button for mobile */}
          {isMobile && (
            <button 
              onClick={closeSidebar}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:text-gray-200 transition-colors duration-200"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          
          {/* Toggle button for desktop */}
          {!isMobile && sidebarOpen && (
            <button 
              onClick={toggleSidebar}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:text-gray-200 transition-colors duration-200 z-20"
              title="Collapse sidebar"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
          )}
        </div>
        
        {/* Navigation */}
        <div className="flex flex-col h-full">
          <nav className="flex-1 px-4 py-6 overflow-y-auto overflow-x-hidden scrollbar-hide">
            <ul className="space-y-2">
              {navigationItems.filter(item => {
                if (isStaffAuth || isReceptionAuth) {
                  return item.name === 'Patient Registration' || item.name === 'Appointments Schedule';
                }
                return true;
              }).map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    onClick={closeSidebar}
                    className={`flex items-center p-3 rounded-xl transition-all duration-200 group ${
                      isActivePath(item.href)
                        ? 'bg-blue-50 text-blue-700 shadow-sm dark:bg-blue-900/30 dark:text-blue-300'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
                    }`}
                  >
                    <div className={`flex-shrink-0 p-1 rounded-lg ${
                      isActivePath(item.href)
                        ? 'bg-blue-100 text-blue-600 dark:bg-blue-800 dark:text-blue-300'
                        : 'bg-gray-100 text-gray-500 group-hover:bg-gray-200 dark:bg-gray-600 dark:text-gray-400'
                    }`}>
                      {item.icon}
                    </div>
                    {(sidebarOpen || isMobile) && (
                      <div className="ml-3 flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{item.name}</p>
                        <p className="text-xs opacity-70 truncate">{item.description}</p>
                      </div>
                    )}
                    {(sidebarOpen || isMobile) && isActivePath(item.href) && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          
          {/* Database Status */}
          <div className={`${sidebarOpen ? 'px-4' : 'px-1'} py-3 border-t border-gray-200 dark:border-gray-700 ${!sidebarOpen && !isMobile ? 'flex justify-center' : ''}`}>
            {sidebarOpen || isMobile ? (
              <DatabaseStatus />
            ) : (
              <div title="Database Status">
                <svg className="h-4 w-4 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </div>
          
          {/* User Section */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            {(sidebarOpen || isMobile) ? (
              <div className="space-y-3">
                <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-sm">
                    <span className="text-white font-semibold text-sm">{isStaffAuth ? 'ST' : isReceptionAuth ? 'RC' : 'AD'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{isStaffAuth ? 'Staff' : isReceptionAuth ? 'Reception' : 'Administrator'}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{isStaffAuth ? 'Clinic Staff' : isReceptionAuth ? 'Front Desk' : 'System Admin'}</p>
                  </div>
                </div>
                <button 
                  onClick={logout}
                  className="flex items-center justify-center w-full p-3 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-xl transition-colors duration-200 group"
                >
                  <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span className="text-sm font-medium">Sign Out</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="w-10 h-10 mx-auto bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-sm">
                  <span className="text-white font-semibold text-sm">{isStaffAuth ? 'ST' : isReceptionAuth ? 'RC' : 'AD'}</span>
                </div>
                <button 
                  onClick={logout}
                  className="w-full p-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-colors duration-200 flex items-center justify-center"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className={`bg-white dark:bg-gray-800 shadow-sm ${isMobile && !sidebarOpen ? 'pl-16' : ''}`}>
          <div className="flex items-center justify-between p-4">
            <div>
              <h1 className="text-xl font-semibold text-gray-800 dark:text-white">{greeting}</h1>
              <p className="text-sm text-gray-600 dark:text-gray-300">{formatDate(currentTime)}</p>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="hidden md:block text-right">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{formatTime(currentTime)}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Today</p>
              </div>
              
              <button
                onClick={logout}
                className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
                title="Logout"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className={`flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 ${isMobile && !sidebarOpen ? 'pt-4' : ''}`}>
          {children}
        </main>

        {/* Footer */}
                  <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 py-4 px-6">
           <div className="flex justify-center items-center">
             <div className="text-sm text-gray-500 dark:text-gray-400">
              &copy; 2025 TRX
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}