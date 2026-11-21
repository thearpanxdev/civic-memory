import React from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { Building2, Shield, LogOut, CheckSquare, Clock, AlertTriangle, Layers } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function OfficialDashboard() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Official Header */}
      <header className="bg-slate-900 text-white sticky top-0 z-20 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link to="/" className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm">
              <Building2 className="w-6 h-6" />
            </Link>
            <div>
              <span className="text-lg font-bold text-white tracking-tight">
                Civic<span className="text-blue-400">Memory</span>
              </span>
              <span className="ml-2 px-2 py-0.5 text-xs font-semibold bg-blue-500/20 text-blue-300 rounded-full border border-blue-400/30">
                Official Portal
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-sm font-bold text-slate-100">{user?.full_name}</span>
              <span className="text-xs text-blue-300">
                {user?.department_name || 'Department Official'}
              </span>
            </div>
            <button
              onClick={logout}
              className="p-2 sm:px-3 sm:py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-semibold flex items-center space-x-1.5 transition"
            >
              <LogOut className="w-4 h-4 text-slate-400" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 space-y-8">
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200">
              <Shield className="w-3.5 h-3.5" />
              <span>Assigned Department: {user?.department_name || 'Roads & Infrastructure'}</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">Official Management Console</h1>
            <p className="text-slate-600 text-sm">
              Review assigned civic complaints, update work progression, and review recurring failures.
            </p>
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Assigned Backlog</div>
            <div className="text-3xl font-extrabold text-slate-900 mt-1">4</div>
            <p className="text-xs text-amber-600 mt-1 font-medium">2 High Severity</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">In Progress</div>
            <div className="text-3xl font-extrabold text-blue-600 mt-1">2</div>
            <p className="text-xs text-slate-500 mt-1">Active repair crews</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Awaiting Verification</div>
            <div className="text-3xl font-extrabold text-purple-600 mt-1">1</div>
            <p className="text-xs text-slate-500 mt-1">Work evidence uploaded</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Recurring Clusters</div>
            <div className="text-3xl font-extrabold text-rose-600 mt-1">1</div>
            <p className="text-xs text-rose-600 mt-1 font-medium">Chronic failure alert</p>
          </div>
        </div>

        {/* Placeholder Info Box */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 text-center space-y-3 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
            <Shield className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Official Access Authorized</h3>
          <p className="text-sm text-slate-600 max-w-xl mx-auto">
            You are authenticated with official municipal credentials for <strong>{user?.department_name}</strong>. Full status lifecycle transition controls, before/after evidence uploads, and Gemini situation reports will be mounted in upcoming phases.
          </p>
        </div>
      </main>
    </div>
  );
}
