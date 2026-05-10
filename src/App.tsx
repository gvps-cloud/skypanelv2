import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import {
  ImpersonationProvider,
  useImpersonation,
} from "./contexts/ImpersonationContext";
import { ImpersonationLoadingOverlay } from "./components/admin/ImpersonationLoadingOverlay";
import { setupAutoLogout } from "@/lib/api";
import { lazy, Suspense, useEffect } from "react";
import { AnnouncementBanner } from "./components/AnnouncementBanner";
import { useSiteStatus } from "./hooks/useSiteStatus";
import ScrollToTop from "./components/ScrollToTop";
import { TerminalErrorScreen } from "./components/terminal";
import { useHostingStatus, useVpsProductStatus } from "./hooks/useHosting";
import AppLayout from "./components/AppLayout";
import PublicLayout from "./components/PublicLayout";

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      retry: 1,
      staleTime: 30000,
    },
  },
});

const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
  </div>
);

const Home = lazy(() => import("./pages/HomeRedesign"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const VPS = lazy(() => import("./pages/VPS"));
const Billing = lazy(() => import("./pages/Billing"));
const EgressCredits = lazy(() => import("./pages/EgressCredits"));
const InvoiceDetail = lazy(() => import("./pages/InvoiceDetail"));
const TransactionDetail = lazy(() => import("./pages/TransactionDetail"));
const BillingPaymentSuccess = lazy(() => import("./pages/BillingPaymentSuccess"));
const BillingPaymentCancel = lazy(() => import("./pages/BillingPaymentCancel"));
const Support = lazy(() => import("./pages/Support"));
const Settings = lazy(() => import("./pages/Settings"));
const Admin = lazy(() => import("./pages/Admin"));
const VPSDetail = lazy(() => import("./pages/VPSDetail"));
const ActivityPage = lazy(() => import("./pages/Activity"));
const ApiDocs = lazy(() => import("./pages/ApiDocs"));
const FAQ = lazy(() => import("./pages/FAQ"));
const AboutUs = lazy(() => import("./pages/AboutUs"));
const Contact = lazy(() => import("./pages/Contact"));
const Status = lazy(() => import("./pages/Status"));
const Regions = lazy(() => import("./pages/Regions"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const Pricing = lazy(() => import("./pages/Pricing"));
const HostingMarketing = lazy(() => import("./pages/HostingMarketing"));
const SSHKeys = lazy(() => import("./pages/SSHKeys"));
const Documentation = lazy(() => import("./pages/Documentation"));
const PersonalNotes = lazy(() => import("./pages/PersonalNotes"));
const OrganizationNotes = lazy(() => import("./pages/OrganizationNotes"));
const AdminUserDetail = lazy(() => import("./pages/admin/AdminUserDetail"));
const Organizations = lazy(() => import("./pages/Organizations"));
const AcceptInvitation = lazy(() => import("./pages/AcceptInvitation"));
const Hosting = lazy(() => import("./pages/Hosting"));
const HostingStore = lazy(() => import("./pages/HostingStore"));
const HostingDetail = lazy(() => import("./pages/HostingDetail"));
const Maintenance = lazy(() => import("./pages/Maintenance"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));

// Component to handle impersonation banner display
function ImpersonationWrapper({ children }: { children: React.ReactNode }) {
  const {
    isStarting,
    startingProgress,
    startingMessage,
    startingTargetUser,
    impersonatedUser,
  } = useImpersonation();

  return (
    <>
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
      {children}
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

// Admin Route Component (requires authenticated admin role)
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isImpersonating } = useAuth();

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

  if (user.role !== "admin" || isImpersonating) {
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

function HostingEnabledRoute({ children }: { children: React.ReactNode }) {
  const { data: hostingStatus, isLoading } = useHostingStatus();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!hostingStatus?.enabled) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function VpsEnabledRoute({ children }: { children: React.ReactNode }) {
  const { data: vpsStatus, isLoading } = useVpsProductStatus();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!vpsStatus?.enabled) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function HostingMarketingGate({ children }: { children: React.ReactNode }) {
  const { data: hostingStatus, isLoading } = useHostingStatus();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (hostingStatus?.enabled !== true) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

// Registration Guard: redirects to login when registrations are disabled
function RegistrationEnabledRoute({ children }: { children: React.ReactNode }) {
  const { data: siteStatus, isLoading } = useSiteStatus();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (siteStatus?.registrationDisabled) {
    return <Navigate to="/login" replace />;
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

function AnnouncementBannerWrapper({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AnnouncementBanner />
      <div style={{ paddingTop: 'var(--announcement-banner-height, 0px)' }}>
        {children}
      </div>
    </>
  );
}

// Maintenance Guard: redirects non-admin users to maintenance page when enabled
function MaintenanceGuard({ children }: { children: React.ReactNode }) {
  const { data: siteStatus, isLoading: siteStatusLoading } = useSiteStatus();
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();

  if (siteStatusLoading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!siteStatus?.maintenanceMode) {
    return <>{children}</>;
  }

  const isAdmin = user?.role === "admin";
  if (isAdmin) {
    return <>{children}</>;
  }

  const path = location.pathname;
  const search = location.search;
  const hasCode = new URLSearchParams(search).get("code");

  // Always allow maintenance page
  if (path === "/maintenance") {
    return <>{children}</>;
  }

  // Allow login page with bypass code
  if (path === "/login" && hasCode) {
    return <>{children}</>;
  }

  // Allow blog pages during maintenance
  if (path === "/blog" || path.startsWith("/blog/")) {
    return <>{children}</>;
  }

  // Redirect everything else to maintenance
  return <Navigate to="/maintenance" replace />;
}

function AppRoutes() {
  return (
    <>
      <ScrollToTop />
      <AutoLogoutSetup />
      <AnnouncementBannerWrapper>
      <MaintenanceGuard>
      <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/maintenance" element={<Maintenance />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/blog/:year/:slug" element={<BlogPost />} />
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
            <RegistrationEnabledRoute>
              <PublicRoute>
                <Register />
              </PublicRoute>
            </RegistrationEnabledRoute>
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
            <VpsEnabledRoute>
              <ProtectedRoute>
                <VPS />
              </ProtectedRoute>
            </VpsEnabledRoute>
          }
        />
        <Route
          path="/vps/:id"
          element={
            <VpsEnabledRoute>
              <ProtectedRoute>
                <VPSDetail />
              </ProtectedRoute>
            </VpsEnabledRoute>
          }
        />
        <Route
          path="/hosting"
          element={
            <HostingEnabledRoute>
              <ProtectedRoute>
                <Hosting />
              </ProtectedRoute>
            </HostingEnabledRoute>
          }
        />
        <Route
          path="/hosting/store"
          element={
            <HostingEnabledRoute>
              <ProtectedRoute>
                <HostingStore />
              </ProtectedRoute>
            </HostingEnabledRoute>
          }
        />
        <Route
          path="/hosting/:id"
          element={
            <HostingEnabledRoute>
              <ProtectedRoute>
                <HostingDetail />
              </ProtectedRoute>
            </HostingEnabledRoute>
          }
        />
        <Route
          path="/ssh-keys"
          element={
            <ProtectedRoute>
              <VpsEnabledRoute>
                <SSHKeys />
              </VpsEnabledRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/notes/personal"
          element={
            <ProtectedRoute>
              <PersonalNotes />
            </ProtectedRoute>
          }
        />
        <Route
          path="/notes/organizations"
          element={
            <ProtectedRoute>
              <OrganizationNotes />
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
            <VpsEnabledRoute>
              <ProtectedRoute>
                <EgressCredits />
              </ProtectedRoute>
            </VpsEnabledRoute>
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
        <Route path="/web-hosting" element={<HostingMarketingGate><HostingMarketing /></HostingMarketingGate>} />
        <Route path="/hosting-web" element={<HostingMarketingGate><Navigate to="/web-hosting" replace /></HostingMarketingGate>} />
        <Route path="/faq" element={<FAQ />} />
        <Route path="/docs" element={<Documentation />} />
        <Route path="/docs/:categorySlug" element={<Documentation />} />
        <Route path="/docs/:categorySlug/:articleSlug" element={<Documentation />} />
        <Route path="/about" element={<AboutUs />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/status" element={<Status />} />
        <Route path="/regions" element={<Regions />} />
        <Route path="/terms" element={<PublicLayout><TermsOfService /></PublicLayout>} />
        <Route path="/privacy" element={<PublicLayout><PrivacyPolicy /></PublicLayout>} />
        <Route path="/organizations/invitations/:token" element={<AcceptInvitation />} />
        <Route path="/organizations/invitations/:token/accept" element={<AcceptInvitation />} />
        <Route path="/organizations/invitations/:token/decline" element={<AcceptInvitation />} />
        <Route path="*" element={<TerminalErrorScreen code="404" title="NOT_FOUND" message="No route matched this path. Check the URL or return home." />} />
      </Routes>
      </Suspense>
      </MaintenanceGuard>
      </AnnouncementBannerWrapper>
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
