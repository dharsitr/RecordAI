import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PublicOnlyRoute } from './components/PublicOnlyRoute';
import { AppLayout } from './components/AppLayout';
import { Navbar } from './components/Navbar';
import { DashboardPage } from './pages/DashboardPage';
import { ExperimentsPage } from './pages/ExperimentsPage';
import { TemplatesPage } from './pages/TemplatesPage';
import { CalculationsPage } from './pages/CalculationsPage';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { NewRecordPage } from './pages/NewRecordPage';
import { ProcessingPage } from './pages/ProcessingPage';
import { VerifyPage } from './pages/VerifyPage';
import { GeneratePage } from './pages/GeneratePage';
import { HistoryPage } from './pages/HistoryPage';
import { ProfilePage } from './pages/ProfilePage';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Auth Routes */}
          <Route element={<PublicOnlyRoute />}>
            <Route
              path="/login"
              element={
                <div className="min-h-screen bg-[#0b0f19] text-gray-100 selection:bg-emerald-500 selection:text-gray-950">
                  <Navbar />
                  <main className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
                    <LoginPage />
                  </main>
                </div>
              }
            />
            <Route
              path="/signup"
              element={
                <div className="min-h-screen bg-[#0b0f19] text-gray-100 selection:bg-emerald-500 selection:text-gray-950">
                  <Navbar />
                  <main className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 lg:px-8">
                    <SignupPage />
                  </main>
                </div>
              }
            />
          </Route>

          {/* Protected App Routes wrapped in AppLayout Shell */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/new-record" element={<NewRecordPage />} />
              <Route path="/process/:experimentId" element={<ProcessingPage />} />
              <Route path="/verify/:experimentId" element={<VerifyPage />} />
              <Route path="/generate/:experimentId" element={<GeneratePage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/experiments" element={<ExperimentsPage />} />
              <Route path="/templates" element={<TemplatesPage />} />
              <Route path="/calculations" element={<CalculationsPage />} />
            </Route>
          </Route>

          {/* Fallback Catch-all Route */}
          <Route
            path="*"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;



