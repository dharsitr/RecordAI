import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Mail, ShieldCheck, User } from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const { user } = useAuth();

  const fullName = user?.user_metadata?.full_name || 'Researcher';
  const email = user?.email || 'N/A';
  const createdDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Recently';

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <User className="h-6 w-6 text-emerald-400" />
          Researcher Profile
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Manage your RecordAI user details and laboratory credentials.
        </p>
      </div>

      <div className="glass-panel rounded-2xl p-6 border border-gray-800 space-y-6">
        <div className="flex items-center gap-4 pb-6 border-b border-gray-800/80">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-500 to-cyan-500 text-gray-950 font-bold text-2xl shadow-lg shadow-emerald-500/20">
            {fullName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">{fullName}</h2>
            <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
              <Mail className="h-3.5 w-3.5 text-gray-500" />
              <span>{email}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Account Status</span>
            <div className="flex items-center gap-2 mt-1 font-semibold text-emerald-400 text-sm">
              <ShieldCheck className="h-4 w-4" />
              <span>Active & Authenticated</span>
            </div>
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Member Since</span>
            <p className="mt-1 font-semibold text-gray-200 text-sm">{createdDate}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
