import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import AdminLayout from "./components/AdminLayout";
import Layout from "./components/Layout";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import AdminAnalyticsPage from "./pages/admin/AdminAnalyticsPage";
import AdminAuditLogsPage from "./pages/admin/AdminAuditLogsPage";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import AdminGroupsPage from "./pages/admin/AdminGroupsPage";
import AdminMessagesPage from "./pages/admin/AdminMessagesPage";
import AdminNotificationsPage from "./pages/admin/AdminNotificationsPage";
import AdminPostsPage from "./pages/admin/AdminPostsPage";
import AdminReportsPage from "./pages/admin/AdminReportsPage";
import AdminSettingsPage from "./pages/admin/AdminSettingsPage";
import AdminUserActivitiesPage from "./pages/admin/AdminUserActivitiesPage";
import AdminUsersPage from "./pages/admin/AdminUsersPage";
import ChatPage from "./pages/ChatPage";
import ExplorePage from "./pages/ExplorePage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import GroupsPage from "./pages/GroupsPage";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import MessagesPage from "./pages/MessagesPage";
import NotificationsPage from "./pages/NotificationsPage";
import PrivacyPage from "./pages/PrivacyPage";
import ProfilePage from "./pages/ProfilePage";
import RegisterPage from "./pages/RegisterPage";
import SettingsPage from "./pages/SettingsPage";
import TermsPage from "./pages/TermsPage";
import WelcomePage from "./pages/WelcomePage";

function isAdminUser(user) {
  return Boolean(user && (user.role === "admin" || user.role === "super_admin"));
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return <div className="auth-page"><div className="card">Loading TZChat...</div></div>;
  }
  if (!user) {
    const next = `${location.pathname}${location.search}`;
    if (next && next !== "/") {
      sessionStorage.setItem("tzchat_next", next);
    }
    return <Navigate to="/login" state={{ from: next }} replace />;
  }
  if (isAdminUser(user)) return <Navigate to="/admin/dashboard" replace />;
  return children;
}

function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="auth-page"><div className="card">Loading TZChat Admin...</div></div>;
  }
  if (!user) return <Navigate to="/login" replace />;
  return isAdminUser(user) ? children : <Navigate to="/home" replace />;
}

function PublicOnlyRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="auth-page"><div className="card">Loading TZChat...</div></div>;
  }
  if (user) {
    if (isAdminUser(user)) return <Navigate to="/admin/dashboard" replace />;
    const next = sessionStorage.getItem("tzchat_next");
    if (next) {
      sessionStorage.removeItem("tzchat_next");
      return <Navigate to={next} replace />;
    }
    return <Navigate to="/home" replace />;
  }
  return children;
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public User Routes */}
            <Route path="/" element={<PublicOnlyRoute><WelcomePage /></PublicOnlyRoute>} />
            <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
            <Route path="/register" element={<PublicOnlyRoute><RegisterPage /></PublicOnlyRoute>} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />

            {/* User Dashboard Routes */}
            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route path="/home" element={<HomePage />} />
              <Route path="/explore" element={<ExplorePage />} />
              <Route path="/messages" element={<MessagesPage />} />
              <Route path="/chat/:id" element={<ChatPage />} />
              <Route path="/groups" element={<GroupsPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/profile/:username" element={<ProfilePage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>

            {/* Admin Portal Routes */}
            <Route path="/admin/login" element={<Navigate to="/login" replace />} />
            <Route element={<AdminRoute><AdminLayout /></AdminRoute>}>
              <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
              <Route path="/admin/users" element={<AdminUsersPage />} />
              <Route path="/admin/posts" element={<AdminPostsPage />} />
              <Route path="/admin/messages" element={<AdminMessagesPage />} />
              <Route path="/admin/groups" element={<AdminGroupsPage />} />
              <Route path="/admin/reports" element={<AdminReportsPage />} />
              <Route path="/admin/user-activities" element={<AdminUserActivitiesPage />} />
              <Route path="/admin/audit-logs" element={<AdminAuditLogsPage />} />
              <Route path="/admin/analytics" element={<AdminAnalyticsPage />} />
              <Route path="/admin/settings" element={<AdminSettingsPage />} />
              <Route path="/admin/notifications" element={<AdminNotificationsPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}
