import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  BookOpen,
  Calculator,
  FilePlus,
  FileText,
  History,
  LayoutDashboard,
  Layers,
  User,
  X,
} from 'lucide-react';

interface SidebarProps {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen = false, onCloseMobile }) => {
  const mainNavItems = [
    {
      label: 'Dashboard',
      path: '/',
      icon: LayoutDashboard,
      end: true,
    },
    {
      label: 'New Record',
      path: '/new-record',
      icon: FilePlus,
      highlight: true,
    },
    {
      label: 'History',
      path: '/history',
      icon: History,
    },
    {
      label: 'Profile',
      path: '/profile',
      icon: User,
    },
  ];

  const secondaryNavItems = [
    {
      label: 'Experiments',
      path: '/experiments',
      icon: Layers,
    },
    {
      label: 'Templates',
      path: '/templates',
      icon: FileText,
    },
    {
      label: 'Calculations',
      path: '/calculations',
      icon: Calculator,
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-gray-950/80 backdrop-blur-sm md:hidden transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-[65px] bottom-0 left-0 z-40 w-64 border-r border-gray-800/60 bg-[#0b0f19]/95 backdrop-blur-xl transition-transform duration-300 md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col justify-between p-4 overflow-y-auto">
          <div className="space-y-6">
            {/* Mobile Header Close */}
            <div className="flex items-center justify-between md:hidden px-2 pb-2 border-b border-gray-800/60">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Navigation</span>
              <button
                onClick={onCloseMobile}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Primary Navigation Section */}
            <div>
              <div className="px-3 mb-2 text-[11px] font-bold uppercase tracking-wider text-emerald-400/80">
                Core Workspace
              </div>
              <nav className="space-y-1">
                {mainNavItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end={item.end}
                      onClick={onCloseMobile}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all ${
                          isActive
                            ? 'bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm shadow-emerald-500/10'
                            : item.highlight
                            ? 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 border border-emerald-500/20'
                            : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
                        }`
                      }
                    >
                      <Icon className={`h-4 w-4 ${item.highlight ? 'text-emerald-400' : ''}`} />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </nav>
            </div>

            {/* Secondary Tools Section */}
            <div>
              <div className="px-3 mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                Tools & Library
              </div>
              <nav className="space-y-1">
                {secondaryNavItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={onCloseMobile}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all ${
                          isActive
                            ? 'bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
                        }`
                      }
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Sidebar Footer Info */}
          <div className="rounded-xl border border-gray-800/60 bg-gray-900/40 p-3 text-center">
            <div className="flex items-center justify-center gap-2 text-xs font-semibold text-emerald-400">
              <BookOpen className="h-3.5 w-3.5" />
              <span>RecordAI Lab System</span>
            </div>
            <p className="text-[10px] text-gray-500 mt-1">v1.0 • Intelligent Digitizer</p>
          </div>
        </div>
      </aside>
    </>
  );
};
