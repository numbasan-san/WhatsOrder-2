'use client';

import { PedidosProvider } from '@/context/PedidosContext';
import { ThemeProvider } from '@/components/ThemeProvider';
import Sidebar from '@/components/dashboard/Sidebar';
import { useState } from 'react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <ThemeProvider>
      <PedidosProvider>
        <div className="flex h-screen w-full bg-slate-50 dark:bg-slate-950 overflow-hidden">
          <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

          <div className="flex min-w-0 flex-1 flex-col h-full overflow-hidden">
            {/* Mobile header */}
            <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 px-4 py-3 backdrop-blur lg:hidden shrink-0">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <span className="text-sm font-semibold text-slate-900 dark:text-white">WhatsOrder</span>
            </div>

            <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
              {children}
            </main>
          </div>
        </div>
      </PedidosProvider>
    </ThemeProvider>
  );
}