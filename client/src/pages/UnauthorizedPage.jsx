import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldX, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function UnauthorizedPage() {
  const { user } = useAuth();

  const getDashboardLink = () => {
    if (!user) return '/login';
    if (user.role === 'admin') return '/admin';
    if (user.role === 'official') return '/official';
    return '/citizen';
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-center space-y-5">
        <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
          <ShieldX className="w-7 h-7" />
        </div>
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-slate-900">Access Denied (403 Forbidden)</h1>
          <p className="text-sm text-slate-600">
            You do not possess the required departmental or administrative permissions to access this destination.
          </p>
        </div>
        {user && (
          <div className="p-3 rounded-xl bg-slate-100 text-xs text-slate-600">
            Signed in as <strong>{user.full_name}</strong> (Role: <span className="font-semibold text-civic-700">{user.role}</span>)
          </div>
        )}
        <div className="pt-2">
          <Link
            to={getDashboardLink()}
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-lg bg-civic-600 hover:bg-civic-700 text-white text-sm font-semibold transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to My Authorized Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
