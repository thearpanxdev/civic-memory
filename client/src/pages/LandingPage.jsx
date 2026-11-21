import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { 
  Building2, 
  Sparkles, 
  History, 
  MapPin, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  Activity, 
  ArrowRight, 
  Users, 
  Camera, 
  Layers, 
  RefreshCw,
  Search,
  Check,
  Server,
  LogOut,
  User
} from 'lucide-react';

export default function LandingPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [health, setHealth] = useState(null);
  const [loadingHealth, setLoadingHealth] = useState(true);

  useEffect(() => {
    fetch('/api/health')
      .then((res) => {
        if (!res.ok) throw new Error('Healthcheck failed');
        return res.json();
      })
      .then((data) => {
        setHealth(data);
        setLoadingHealth(false);
      })
      .catch((err) => {
        console.warn('API health check error:', err);
        setHealth({ status: 'offline', error: err.message });
        setLoadingHealth(false);
      });
  }, []);

  const getDashboardPath = () => {
    if (!user) return '/login';
    if (user.role === 'admin') return '/admin';
    if (user.role === 'official') return '/official';
    return '/citizen';
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Top System Health Notification Bar */}
      <div className="bg-slate-900 text-slate-300 text-xs py-2 px-4 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="font-medium text-slate-200">Google × MLH Hackathon Edition</span>
            <span className="text-slate-500">|</span>
            <span className="text-slate-400">Civic Intelligence & Problem Memory Platform</span>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1.5">
              <Server className="w-3.5 h-3.5 text-slate-400" />
              <span>Backend:</span>
              {loadingHealth ? (
                <span className="text-amber-400">Checking...</span>
              ) : health?.status === 'healthy' ? (
                <span className="text-emerald-400 font-medium">Online ({health.database?.type})</span>
              ) : (
                <span className="text-rose-400 font-medium">Offline</span>
              )}
            </div>
            <span className="text-slate-600">|</span>
            <div className="flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5 text-civic-400" />
              <span>Engine:</span>
              <span className="text-civic-300 font-medium">Gemini @google/genai</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <header className="bg-white/95 backdrop-blur sticky top-0 z-50 border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link to="/" className="w-10 h-10 rounded-xl bg-civic-600 flex items-center justify-center text-white shadow-md shadow-civic-600/20">
              <Building2 className="w-6 h-6" />
            </Link>
            <div>
              <Link to="/" className="text-xl font-bold tracking-tight text-slate-900">
                Civic<span className="text-civic-600">Memory</span>
              </Link>
              <span className="hidden sm:inline-block ml-2 px-2 py-0.5 text-[10px] font-semibold bg-civic-50 text-civic-700 rounded-full border border-civic-200 uppercase tracking-wider">
                Public Beta
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center space-x-8 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-civic-600 transition-colors">Features</a>
            <a href="#differentiator" className="hover:text-civic-600 transition-colors">The Memory Advantage</a>
            <a href="#gemini-engine" className="hover:text-civic-600 transition-colors">Gemini AI Engine</a>
            <a href="#lifecycle" className="hover:text-civic-600 transition-colors">Verified Lifecycle</a>
          </nav>

          <div className="flex items-center space-x-3">
            {user ? (
              <div className="flex items-center space-x-2">
                <Link
                  to={getDashboardPath()}
                  className="px-3.5 py-1.5 rounded-lg bg-civic-50 hover:bg-civic-100 text-civic-700 border border-civic-200 text-xs font-bold flex items-center space-x-1.5 transition"
                >
                  <User className="w-3.5 h-3.5 text-civic-600" />
                  <span>{user.full_name?.split(' ')[0]} ({user.role})</span>
                </Link>
                <button
                  onClick={logout}
                  title="Sign Out"
                  className="p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-3.5 py-2 text-sm font-medium text-slate-700 hover:text-civic-600 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-civic-600 hover:bg-civic-700 text-white shadow-sm hover:shadow transition-all flex items-center space-x-1.5"
                >
                  <span>Register</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-civic-50/70 via-white to-slate-50 py-20 lg:py-28 border-b border-slate-200">
        <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] pointer-events-none"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center max-w-3xl mx-auto space-y-6">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-civic-100/80 border border-civic-200 text-civic-800 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-civic-600" />
              <span>Powered by Google Gemini Multimodal AI</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.15]">
              Every civic issue has a story. <br className="hidden sm:inline" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-civic-600 to-indigo-600">
                CivicMemory remembers it.
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-slate-600 leading-relaxed font-normal">
              A transparent civic problem reporting and municipal intelligence platform that maintains historical records of civic infrastructure failures. Stop treating recurring potholes, flooded drains, and chronic leaks as isolated events.
            </p>

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to={user ? getDashboardPath() : '/login'}
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-civic-600 hover:bg-civic-700 text-white font-semibold shadow-md shadow-civic-600/25 flex items-center justify-center space-x-2 transition-all"
              >
                <Camera className="w-5 h-5" />
                <span>Submit a Complaint</span>
              </Link>
              <Link
                to={user ? getDashboardPath() : '/login'}
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 font-semibold border border-slate-300 shadow-sm flex items-center justify-center space-x-2 transition-all"
              >
                <ShieldCheck className="w-5 h-5 text-civic-600" />
                <span>Municipal Official Portal</span>
              </Link>
            </div>

            {/* Quick Metrics */}
            <div className="pt-10 grid grid-cols-2 md:grid-cols-4 gap-4 text-left border-t border-slate-200 mt-12">
              <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
                <div className="text-2xl font-bold text-slate-900">100%</div>
                <div className="text-xs text-slate-500 mt-0.5">Historical Memory Retention</div>
              </div>
              <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
                <div className="text-2xl font-bold text-civic-600">Multimodal</div>
                <div className="text-xs text-slate-500 mt-0.5">Gemini Visual Understanding</div>
              </div>
              <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
                <div className="text-2xl font-bold text-emerald-600">Zero Duplicates</div>
                <div className="text-xs text-slate-500 mt-0.5">Semantic Match & Support</div>
              </div>
              <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
                <div className="text-2xl font-bold text-indigo-600">Auditable</div>
                <div className="text-xs text-slate-500 mt-0.5">Citizen Verification Gate</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The Central Differentiator: CivicMemory */}
      <section id="differentiator" className="py-20 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
              <History className="w-3.5 h-3.5 text-amber-600" />
              <span>The Core Differentiator</span>
            </div>
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Why CivicMemory? The Power of Infrastructure Memory
            </h2>
            <p className="text-slate-600">
              Ordinary complaint portals treat every report as a clean slate. When the same pothole reopens every monsoon, records vanish. CivicMemory links recurring incidents to uncover chronic infrastructure failures.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Visual Timeline of a Recurring Problem */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-6 sm:p-8 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-6">
                <div>
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Historical Incident Timeline</span>
                  <h4 className="text-base font-bold text-slate-900 mt-0.5">Main Arterial Road & 4th Cross — Ward 7</h4>
                </div>
                <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                  Chronic Recurrence (3x in 8 mos)
                </span>
              </div>

              <div className="space-y-6 relative before:absolute before:inset-0 before:left-3 before:w-0.5 before:bg-slate-200">
                <div className="relative pl-8">
                  <div className="absolute left-1.5 top-1.5 w-3.5 h-3.5 rounded-full bg-slate-400 ring-4 ring-white"></div>
                  <div className="text-xs font-medium text-slate-500">March 12, 2026 • Report #CM-4091</div>
                  <div className="text-sm font-semibold text-slate-900 mt-0.5">Deep asphalt pothole reported by 14 citizens</div>
                  <div className="text-xs text-slate-600 mt-1">Status: Marked "Resolved" via surface patch. Closed after 8 days.</div>
                </div>

                <div className="relative pl-8">
                  <div className="absolute left-1.5 top-1.5 w-3.5 h-3.5 rounded-full bg-amber-500 ring-4 ring-white"></div>
                  <div className="text-xs font-medium text-slate-500">July 28, 2026 • Report #CM-7203</div>
                  <div className="text-sm font-semibold text-slate-900 mt-0.5">Subsurface collapse at exact same coordinate (12.9716, 77.5946)</div>
                  <div className="text-xs text-slate-600 mt-1">Status: Quick cold-mix tar applied. Heavy monsoon rains flushed it away in 3 weeks.</div>
                </div>

                <div className="relative pl-8">
                  <div className="absolute left-1.5 top-1.5 w-3.5 h-3.5 rounded-full bg-rose-600 ring-4 ring-white"></div>
                  <div className="text-xs font-medium text-rose-600 font-semibold">October 19, 2026 • Report #CM-9944 (Current Active)</div>
                  <div className="text-sm font-semibold text-slate-900 mt-0.5">Reopened with water pooling & structural foundation sinkhole</div>
                  <div className="mt-3 p-3.5 rounded-xl bg-civic-50 border border-civic-200 text-xs text-civic-900 space-y-1">
                    <div className="font-semibold flex items-center space-x-1 text-civic-800">
                      <Sparkles className="w-3.5 h-3.5 text-civic-600" />
                      <span>CivicMemory Intelligence Engine Flag:</span>
                    </div>
                    <p className="text-slate-700 leading-relaxed">
                      "Surface patching has failed twice within 220 days. Recurring water seepage strongly indicates an unaddressed pressurized water main leak underneath the sub-base. Do not re-tar without municipal water board joint inspection."
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Explanatory Features */}
            <div className="space-y-6">
              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 rounded-xl bg-civic-100 text-civic-700 flex items-center justify-center shrink-0 font-bold">
                  1
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Perpetual Incident History</h3>
                  <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                    Complaints are never erased upon status changes. The database maintains relational root incident links, tracking exactly when and where problems resurface.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 rounded-xl bg-civic-100 text-civic-700 flex items-center justify-center shrink-0 font-bold">
                  2
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Preventing Contractor Surface-Washing</h3>
                  <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                    Officials see historical contractor repair logs. If a contractor’s work fails within warranty, municipal engineers are automatically alerted to hold vendors accountable.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 rounded-xl bg-civic-100 text-civic-700 flex items-center justify-center shrink-0 font-bold">
                  3
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Data-Driven Budget Allocation</h3>
                  <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                    Municipal commissioners can view chronic infrastructure failure hotspots on an interactive map, justifying long-term capital investments over endless temporary fixes.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Google Gemini Civic Intelligence Section */}
      <section id="gemini-engine" className="py-20 bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-civic-100 border border-civic-200 text-civic-800 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-civic-600" />
              <span>Google Gemini Integration</span>
            </div>
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Six Purpose-Built AI Capabilities
            </h2>
            <p className="text-slate-600">
              No generic chatbots. Google Gemini is embedded directly into the civic problem-solving pipeline using the official <code className="text-xs bg-slate-200 px-1 py-0.5 rounded font-mono">@google/genai</code> SDK.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow space-y-3">
              <div className="w-10 h-10 rounded-xl bg-civic-50 text-civic-600 flex items-center justify-center">
                <Camera className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">1. Multimodal Issue Vision</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Gemini 4 Hydrogen analyzes citizen defect photos, recommending precise category tags, suggested severity levels, and identifying missing details for complete reporting.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">2. Semantic Duplicate Matching</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Prevents duplicate tickets by cross-referencing GPS radius with Gemini semantic text embeddings. Citizens can simply "Support" existing issues with one tap.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Activity className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">3. Civic Intelligence Dashboard</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Synthesizes hard database metrics into executive ward situation reports, identifying backlogged departments and emerging infrastructure patterns.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow space-y-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Search className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">4. Function-Calling Assistant</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Natural-language civic assistant with controlled function execution. Citizens query nearby issues and complaint statuses safely without direct SQL access.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">5. Resolution Evidence Assistant</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Compares before-and-after repair photographs, identifying visible improvements and flagging poor repair work or false closures for human official review.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow space-y-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <History className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">6. Chronic Failure Intelligence</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Analyzes multi-year complaint clusters to detect recurring failures, generating engineering hypotheses to transition from cosmetic patches to permanent fixes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Verified Resolution Lifecycle */}
      <section id="lifecycle" className="py-20 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Strict 9-Stage Auditable Lifecycle
            </h2>
            <p className="text-slate-600">
              An issue cannot be marked finally resolved simply because an official clicks a button. Citizen verification is mandatory.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-9 gap-3 text-center">
            {[
              { step: '1', title: 'Submitted', color: 'bg-slate-100 text-slate-700' },
              { step: '2', title: 'Under Review', color: 'bg-blue-100 text-blue-700' },
              { step: '3', title: 'Verified', color: 'bg-indigo-100 text-indigo-700' },
              { step: '4', title: 'Assigned', color: 'bg-purple-100 text-purple-700' },
              { step: '5', title: 'In Progress', color: 'bg-amber-100 text-amber-700' },
              { step: '6', title: 'Work Done', color: 'bg-cyan-100 text-cyan-700' },
              { step: '7', title: 'Citizen Check', color: 'bg-orange-100 text-orange-700' },
              { step: '8', title: 'Resolved', color: 'bg-emerald-100 text-emerald-700' },
              { step: '9', title: 'Reopened', color: 'bg-rose-100 text-rose-700' },
            ].map((item, idx) => (
              <div key={idx} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex flex-col items-center justify-center space-y-2">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${item.color}`}>
                  {item.step}
                </span>
                <span className="text-xs font-semibold text-slate-800">{item.title}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-civic-600 flex items-center justify-center text-white">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-lg font-bold text-white tracking-tight">CivicMemory</span>
              <p className="text-xs text-slate-500">Google × MLH Hackathon 2026</p>
            </div>
          </div>

          <div className="flex items-center space-x-6 text-sm">
            <span>Powered by Google Gemini</span>
            <span>•</span>
            <span>Map data © OpenStreetMap contributors</span>
            <span>•</span>
            <span>Auditable Civic Tech</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
