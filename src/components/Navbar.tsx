import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BookOpen, Calculator, Database, FileText, FlaskConical, Layers, LogOut, Menu, User as UserIcon } from 'lucide-react';

interface NavbarProps {
  onToggleMobileMenu?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleMobileMenu }) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [supabaseConnected, setSupabaseConnected] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if Supabase client environment variables are configured
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (url && key && url !== 'https://your-project-ref.supabase.co') {
      setSupabaseConnected(true);
    } else {
      setSupabaseConnected(false);
    }
  }, []);

  const handleLogout = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const displayName = user?.user_metadata?.full_name || user?.email || 'Researcher';

  return (
    <nav className="glass-panel sticky top-0 z-50 border-b border-gray-800/60 px-4 sm:px-6 py-3.5">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        {/* Brand Logo & Mobile Menu Trigger */}
        <div className="flex items-center gap-3">
          {user && onToggleMobileMenu && (
            <button
              onClick={onToggleMobileMenu}
              className="flex md:hidden items-center justify-center rounded-xl border border-gray-800 bg-gray-900/80 p-2 text-gray-400 hover:text-white"
              title="Open Navigation Menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}

          <NavLink to="/" className="flex items-center gap-3 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-500 p-2 shadow-lg shadow-emerald-500/20 transition-transform group-hover:scale-105">
              <FlaskConical className="h-6 w-6 text-gray-950 font-extrabold" />
            </div>
            <div>
              <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-indigo-400 bg-clip-text text-xl font-bold tracking-tight text-transparent">
                RecordAI
              </span>
              <span className="hidden sm:inline-block ml-2 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                Lab Record Digitizer
              </span>
            </div>
          </NavLink>
        </div>


        {/* Router Navigation Links (Only shown when authenticated) */}
        {user && (
          <div className="flex items-center gap-1 rounded-xl bg-gray-900/60 p-1 border border-gray-800/80">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                }`
              }
            >
              <BookOpen className="h-4 w-4" />
              Dashboard
            </NavLink>

            <NavLink
              to="/experiments"
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                }`
              }
            >
              <Layers className="h-4 w-4" />
              Experiments
            </NavLink>

            <NavLink
              to="/templates"
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                }`
              }
            >
              <FileText className="h-4 w-4" />
              Templates
            </NavLink>

            <NavLink
              to="/calculations"
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                }`
              }
            >
              <Calculator className="h-4 w-4" />
              Calculations
            </NavLink>
          </div>
        )}

        {/* User Badge / Auth Actions */}
        <div className="flex items-center gap-3 text-xs">
          {/* Supabase Status Indicator */}
          <div
            className={`hidden sm:flex items-center gap-2 rounded-full border px-3 py-1 font-mono transition-all ${
              supabaseConnected
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-400'
            }`}
          >
            <Database className="h-3.5 w-3.5" />
            <span>{supabaseConnected ? 'Supabase' : 'No .env'}</span>
            <span
              className={`h-2 w-2 rounded-full ${
                supabaseConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
          </div>

          {user ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-xl bg-gray-900/80 px-3 py-1.5 border border-gray-800 text-gray-200">
                <UserIcon className="h-4 w-4 text-emerald-400" />
                <span className="max-w-[140px] truncate text-xs font-medium">{displayName}</span>
              </div>
              <button
                onClick={handleLogout}
                title="Sign Out"
                className="flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 transition-all hover:bg-red-500/20 hover:border-red-500/40 cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Logout</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <NavLink
                to="/login"
                className="rounded-xl px-3.5 py-1.5 text-xs font-semibold text-gray-300 hover:text-white hover:bg-gray-800/60 transition-all"
              >
                Sign In
              </NavLink>
              <NavLink
                to="/signup"
                className="rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-3.5 py-1.5 text-xs font-semibold text-gray-950 shadow-md shadow-emerald-500/20 hover:brightness-110 transition-all"
              >
                Sign Up
              </NavLink>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

