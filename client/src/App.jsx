import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage.jsx';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          {/* Phase 2 routes will be mounted here */}
        </Routes>
      </div>
    </Router>
  );
}

export default App;
