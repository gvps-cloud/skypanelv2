import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import {
  ImpersonationProvider,
  useImpersonation,
} from "./contexts/ImpersonationContext";
import { ImpersonationBanner } from "./components/admin/ImpersonationBanner";
import { ImpersonationLoadingOverlay } from "./components/admin/ImpersonationLoadingOverlay";
import { setupAutoLogout } from "@/lib/api";
import { Suspense, useEffect, lazy } from "react";

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      retry: 1,
      staleTime: 30000, // 30 seconds
    },
  },
});

// ── Eager imports (critical path / lightweight) ─────────────────────────

import Home from "./pages/HomeRedesign";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import AppLayout from "./components/AppLayout";
import FAQ from "./pages/FAQ";
import AboutUs from "./pages/AboutUs";
import Contact from "./pages/Contact";
import Status from "./pages/Status";
import TermsOfService from "./pages/TermsOfService";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import AcceptInvitation from "./pages/AcceptInvitation";

// ── Lazy imports (route-level code splitting) ───────────────────────────

const Dashboard = lazy(() => import("./pages/Dashboard"));
const VPS = lazy(() => import("./pages/VPS"));
const VPSDetail = lazy(() => import("./pages/VPSDetail"));
const VpsSshConsole = lazy(() => import("./pages/VpsSshConsole"));
const SSHKeys = lazy(() => import("./pages/SSHKeys"));
const Organizations = lazy(() => import("./pages/Organizations"));
const Billing = lazy(() => import("./pages/Billing"));
const EgressCredits = lazy(() => import("./pages/EgressCredits"));
const InvoiceDetail = lazy(() => import("./pages/InvoiceDetail"));
const TransactionDetail = lazy(() => import("./pages/TransactionDetail"));
const BillingPaymentSuccess = lazy(() => import("./pages/BillingPaymentSuccess"));
const BillingPaymentCancel = lazy(() => import("./pages/BillingPaymentCancel"));
const Support = lazy(() => import("./pages/Support"));
const Settings = lazy(() => import("./pages/Settings"));
const ActivityPage = lazy(() => import("./pages/Activity"));
const ApiDocs = lazy(() => import("./pages/ApiDocs"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Documentation = lazy(() => import("./pages/Documentation"));
const Admin = lazy(() => import("./pages/Admin"));
const AdminUserDetail = lazy(() => import("./pages/admin/AdminUserDetail"));

// Component to handle impersonation banner display
function ImpersonationWrapper({ children }: { children: React.ReactNode }) {
  const {
    isImpersonating,
    impersonatedUser,
    exitImpersonation,
    isExiting,
    isStarting,
    startingProgress,
    startingMessage,
    startingTargetUser,
  } = useImpersonation();

  return (
    <>
      {isImpersonating && impersonatedUser && (
        <ImpersonationBanner
          impersonatedUser={impersonatedUser}
          onExitImpersonation={exitImpersonation}
          isExiting={isExiting}
        />
      )}
      {isStarting && (
        <ImpersonationLoadingOverlay
          targetUser={
            startingTargetUser ||
            impersonatedUser || {
              name: "User",
              email: "Loading...",
              role: "user",
            }
          }
          progress={startingProgress}
          message={startingMessage}
        />
      )}
      <div style={{ paddingTop: isImpersonating ? "60px" : "0" }}>
        {children}
      </div>
    </>
  );
}

// Protected Route Component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <ImpersonationWrapper>
      <AppLayout>{children}</AppLayout>
    </ImpersonationWrapper>
  );
}

function StandaloneProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <ImpersonationWrapper>{children}</ImpersonationWrapper>;
}

// Admin Route Component (requires authenticated admin role)
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <ImpersonationWrapper>
      <AppLayout>{children}</AppLayout>
    </ImpersonationWrapper>
  );
}

// Public Route Component (redirect to dashboard if authenticated)
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

// Component to setup auto-logout inside Router context
function AutoLogoutSetup() {
  const { logout } = useAuth();

  useEffect(() => {
    setupAutoLogout(logout);
  }, [logout]);

  return null;
}

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function AppRoutes() {
  return (
    <>
      <AutoLogoutSetup />
      <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicRoute>
              <Register />
            </PublicRoute>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <PublicRoute>
              <ForgotPassword />
            </PublicRoute>
          }
        />
        <Route
          path="/reset-password"
          element={
            <PublicRoute>
              <ResetPassword />
            </PublicRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/vps"
          element={
            <ProtectedRoute>
              <VPS />
            </ProtectedRoute>
          }
        />
        <Route
          path="/vps/:id"
          element={
            <ProtectedRoute>
              <VPSDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/vps/:id/ssh"
          element={
            <StandaloneProtectedRoute>
              <VpsSshConsole />
            </StandaloneProtectedRoute>
          }
        />
        <Route
          path="/ssh-keys"
          element={
            <ProtectedRoute>
              <SSHKeys />
            </ProtectedRoute>
          }
        />
        <Route
          path="/organizations"
          element={
            <ProtectedRoute>
              <Organizations />
            </ProtectedRoute>
          }
        />
        <Route
          path="/organizations/:id"
          element={
            <ProtectedRoute>
              <Organizations />
            </ProtectedRoute>
          }
        />
        <Route
          path="/billing"
          element={
            <ProtectedRoute>
              <Billing />
            </ProtectedRoute>
          }
        />
        <Route
          path="/billing/invoice/:id"
          element={
            <ProtectedRoute>
              <InvoiceDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/billing/transaction/:id"
          element={
            <ProtectedRoute>
              <TransactionDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/billing/payment/success"
          element={
            <ProtectedRoute>
              <BillingPaymentSuccess />
            </ProtectedRoute>
          }
        />
        <Route
          path="/billing/payment/cancel"
          element={
            <ProtectedRoute>
              <BillingPaymentCancel />
            </ProtectedRoute>
          }
        />
        <Route
          path="/egress-credits"
          element={
            <ProtectedRoute>
              <EgressCredits />
            </ProtectedRoute>
          }
        />
        <Route
          path="/support"
          element={
            <ProtectedRoute>
              <Support />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/activity"
          element={
            <ProtectedRoute>
              <ActivityPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <Admin />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/user/:id"
          element={
            <AdminRoute>
              <AdminUserDetail />
            </AdminRoute>
          }
        />
        <Route
          path="/api-docs"
          element={
            <ProtectedRoute>
              <ApiDocs />
            </ProtectedRoute>
          }
        />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/faq" element={<FAQ />} />
        <Route path="/docs" element={<Documentation />} />
        <Route path="/docs/:categorySlug" element={<Documentation />} />
        <Route path="/docs/:categorySlug/:articleSlug" element={<Documentation />} />
        <Route path="/about" element={<AboutUs />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/status" element={<Status />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/organizations/invitations/:token" element={<AcceptInvitation />} />
        <Route path="/organizations/invitations/:token/accept" element={<AcceptInvitation />} />
        <Route path="/organizations/invitations/:token/decline" element={<AcceptInvitation />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <ImpersonationProvider>
            <Router>
              <AppRoutes />
              <Toaster position="bottom-right" richColors closeButton />
            </Router>
          </ImpersonationProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
