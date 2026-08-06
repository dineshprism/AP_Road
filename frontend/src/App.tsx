import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { canAccessDistrictDashboard, canWriteSubmissions } from "@/lib/roles";
import Index from "./pages/Index";
import AuthPage from "./pages/AuthPage";
import UserDashboard from "./pages/UserDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import AdgpDashboard from "./pages/AdgpDashboard";
import EnhancedAnalytics from "./pages/EnhancedAnalytics";
import AnalyticsPro from "./pages/AnalyticsPro";
import AnalyticsNew from "./pages/AnalyticsNew";
import AccidentForm from "./pages/AccidentForm";
import SubmissionView from "./pages/SubmissionView";
import NotFound from "./pages/NotFound";
import AppFooter from "./components/AppFooter";
import PrismDashboard from "./pages/PrismDashboard";
import DsrReports from "./pages/DsrReports";
import MapPreview from "./pages/MapPreview";

const queryClient = new QueryClient();

const RouteLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <p className="text-muted-foreground">Loading...</p>
  </div>
);

const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { user, loading } = useAuth();

  if (loading) return <RouteLoader />;
  if (!user) return <Navigate to="/auth" replace />;
  return children;
};

const RoleRoute = ({
  children,
  allowedRoles,
  deniedRoles = [],
  accessCheck,
}: {
  children: JSX.Element;
  allowedRoles?: string[];
  deniedRoles?: string[];
  accessCheck?: (roles: string[]) => boolean;
}) => {
  const { user, loading, roles } = useAuth();

  if (loading) return <RouteLoader />;
  if (!user) return <Navigate to="/auth" replace />;
  if (deniedRoles.some((role) => roles.includes(role))) return <Navigate to="/" replace />;
  if (accessCheck && !accessCheck(roles)) return <Navigate to="/" replace />;
  if (allowedRoles && !allowedRoles.some((role) => roles.includes(role))) {
    return <Navigate to="/" replace />;
  }
  return children;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <div className="flex min-h-screen flex-col bg-background">
            <div className="flex flex-1 flex-col">
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/map-preview" element={<MapPreview />} />
                <Route
                  path="/dashboard"
                  element={
                    <RoleRoute accessCheck={canAccessDistrictDashboard}>
                      <UserDashboard />
                    </RoleRoute>
                  }
                />
                <Route
                  path="/prism-dashboard"
                  element={
                    <RoleRoute allowedRoles={["prism"]}>
                      <PrismDashboard />
                    </RoleRoute>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <RoleRoute allowedRoles={["admin", "dgp"]}>
                      <AdminDashboard />
                    </RoleRoute>
                  }
                />
                <Route
                  path="/adgp-dashboard"
                  element={
                    <RoleRoute allowedRoles={["adgp"]}>
                      <AdgpDashboard />
                    </RoleRoute>
                  }
                />
                <Route
                  path="/analytics"
                  element={
                    <ProtectedRoute>
                      <EnhancedAnalytics />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/enhanced-analytics"
                  element={
                    <ProtectedRoute>
                      <EnhancedAnalytics />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/analytics/pro"
                  element={
                    <ProtectedRoute>
                      <AnalyticsPro />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/analytics_new"
                  element={
                    <ProtectedRoute>
                      <AnalyticsNew />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/submit"
                  element={
                    <RoleRoute accessCheck={canWriteSubmissions}>
                      <AccidentForm />
                    </RoleRoute>
                  }
                />
                <Route
                  path="/submission/:id"
                  element={
                    <ProtectedRoute>
                      <SubmissionView />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dsr-reports"
                  element={
                    <RoleRoute allowedRoles={["admin", "dgp", "adgp", "prism"]}>
                      <DsrReports />
                    </RoleRoute>
                  }
                />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </div>
            <AppFooter />
          </div>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
