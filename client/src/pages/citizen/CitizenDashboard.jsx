import React from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { Building2, User, LogOut, PlusCircle, FileText, CheckCircle2, History, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function CitizenDashboard() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Portal Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link to="/" className="w-10 h-10 rounded-xl bg-civic-600 flex items-center justify-center text-white shadow-sm">
              <Building2 className="w-6 h-6" />
            </Link>
            <div>
              <span className="text-lg font-bold text-slate-900">
                Civic<span className="text-civic-600">Memory</span>
              </span>
              <span className="ml-2 px-2 py-0.5 text-xs font-semibold bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
                Citizen Portal
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-sm font-bold text-slate-900">{user?.full_name}</span>
              <span className="text-xs text-slate-500">{user?.email}</span>
            </div>
            <button
              onClick={logout}
              className="p-2 sm:px-3 sm:py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center space-x-1.5 transition"
            >
              <LogOut className="w-4 h-4 text-slate-500" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 space-y-8">
        {/* Welcome Banner */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-civic-600 to-indigo-700 text-white shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold">Welcome back, {user?.full_name?.split(' ')[0]}!</h1>
            <p className="text-civic-100 text-sm">
              Your reports help create an immutable, auditable memory of community infrastructure.
            </p>
          </div>
          <button className="px-5 py-2.5 rounded-xl bg-white text-civic-700 font-bold text-sm shadow hover:bg-civic-50 transition flex items-center space-x-2">
            <PlusCircle className="w-4 h-4 text-civic-600" />
            <span>Report New Problem</span>
          </button>
        </div>

        {/* Placeholder Stat Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">My Submissions</span>
              <FileText className="w-5 h-5 text-civic-600" />
            </div>
            <div className="text-3xl font-extrabold text-slate-900">2</div>
            <p className="text-xs text-slate-500">1 In Progress, 1 Resolved</p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Supported Issues</span>
              <History className="w-5 h-5 text-purple-600" />
            </div>
            <div className="text-3xl font-extrabold text-slate-900">3</div>
            <p className="text-xs text-slate-500">Community problems backed by you</p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Verification</span>
              <CheckCircle2 className="w-5 h-5 text-amber-500" />
            </div>
            <div className="text-3xl font-extrabold text-slate-900">1</div>
            <p className="text-xs text-slate-500">Awaiting your resolution sign-off</p>
          </div>
        </div>

        {/* Phase 2B Placeholder Notice */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 text-center space-y-3 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-civic-50 text-civic-600 flex items-center justify-center mx-auto">
            <Building2 className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Phase 2B Authentication & Session Active</h3>
          <p className="text-sm text-slate-600 max-w-xl mx-auto">
            You are securely authenticated as a <strong>Citizen</strong>. The full interactive complaint submission, multimodal vision photo uploader, and resolution verification tools will be connected in subsequent phases.
          </p>
        </div>
      </main>
    </div>
  );
}
