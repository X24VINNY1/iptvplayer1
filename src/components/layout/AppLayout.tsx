import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useTVRemote } from '@/hooks/useTVRemote';

export default function AppLayout() {
  useTVRemote();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setSidebarCollapsed(true);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden text-gray-100 font-sans">
      <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
      
      {isMobile && !sidebarCollapsed && (
        <div 
          className="fixed inset-0 bg-black/60 z-40"
          onClick={() => setSidebarCollapsed(true)}
        />
      )}

      <div className={`flex-1 flex flex-col transition-all duration-300 ${isMobile ? 'ml-0' : sidebarCollapsed ? 'ml-20' : 'ml-64'}`}>
        <Header onToggleSidebar={toggleSidebar} />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6 md:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
