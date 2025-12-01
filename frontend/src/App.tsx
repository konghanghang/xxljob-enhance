import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { App as AntApp } from 'antd';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/AppLayout';
import LoginPage from './pages/LoginPage';
import JobListPage from './pages/JobListPage';
import JobLogsPage from './pages/JobLogsPage';
import UserManagementPage from './pages/UserManagementPage';
import RoleManagementPage from './pages/RoleManagementPage';

/**
 * Main Application Component
 * Configures routing and authentication
 * Wraps with Ant Design App component for notification support
 */

const App: React.FC = () => {
  return (
    <AntApp>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />

            {/* Protected routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/jobs" replace />} />
              <Route path="jobs" element={<JobListPage />} />
              <Route path="logs" element={<JobLogsPage />} />

              {/* Admin-only routes */}
              <Route
                path="users"
                element={
                  <ProtectedRoute requireAdmin>
                    <UserManagementPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="roles"
                element={
                  <ProtectedRoute requireAdmin>
                    <RoleManagementPage />
                  </ProtectedRoute>
                }
              />
            </Route>

            {/* Catch all - redirect to login */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </AntApp>
  );
};

export default App;
