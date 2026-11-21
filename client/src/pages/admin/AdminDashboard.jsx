import React from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { Building2, ShieldAlert, LogOut, Users, Settings, Database, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AdminDashboard() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Admin Header */}
      <header className="bg-purple-950 text-white sticky top-0 z-20 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link to="/" className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center text-white shadow-sm">
              <Building2 className="w-6 h-6" />
            </Link>
            <div>
              <span className="text-lg font-bold text-white tracking-tight">
                Civic<span className="text-purple-400">Memory</span>
              </span>
              <span className="ml-2 px-2 py-0.5 text-xs font-semibold bg-purple-500/20 text-purple-300 rounded-full border border-purple-400/30">
                Administration Console
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-sm font-bold text-slate-100">{user?.full_name}</span>
              <span className="text-xs text-purple-300">Municipal Administrator</span>
            </div>
            <button
              onClick={logout}
              className="p-2 sm:px-3 sm:py-1.5 rounded-lg border border-purple-800 hover:bg-purple-900 text-slate-300 text-xs font-semibold flex items-center space-x-1.5 transition"
            >
              <LogOut className="w-4 h-4 text-purple-300" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 space-y-8">
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 text-xs font-bold border border-purple-200">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Full System Privileges</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">Platform Administrative Overview</h1>
            <p className="text-slate-600 text-sm">
              Monitor platform health, authorize officials, inspect audit logs, and oversee cross-departmental operations.
            </p>
          </div>
        </div>

        {/* High-level stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Users</div>
            <div className="text-3xl font-extrabold text-slate-900 mt-1">10</div>
            <p className="text-xs text-slate-500 mt-1">4 Citizens, 5 Officials, 1 Admin</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Departments</div>
            <div className="text-3xl font-extrabold text-purple-600 mt-1">5</div>
            <p className="text-xs text-slate-500 mt-1">All active & responding</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Complaints</div>
            <div className="text-3xl font-extrabold text-indigo-600 mt-1">8</div>
            <p className="text-xs text-slate-500 mt-1">1 Chronic Recurring Cluster</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Audit Log Status</div>
            <div className="text-3xl font-extrabold text-emerald-600 mt-1">Active</div>
            <p className="text-xs text-slate-500 mt-1">Integrity verified</p>
          </div>
        </div>

        {/* Notice */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 text-center space-y-3 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Administrator Access Confirmed</h3>
          <p className="text-sm text-slate-600 max-w-xl mx-auto">
            Logged in as <strong>{user?.full_name}</strong> (`admin`). User account management, department configuration, and system-wide Gemini intelligence telemetry will be linked in Phase 4.
          </p>
        </div>
      </main>
    </div>
  );
}
