import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";

const Index = () => {
  const { user, loading, isAdmin, roles } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (roles.includes("adgp")) return <Navigate to="/adgp-dashboard" replace />;
  if (roles.includes("dgp")) return <Navigate to="/admin" replace />;
  if (isAdmin) return <Navigate to="/admin" replace />;
  return <Navigate to="/dashboard" replace />;
};

export default Index;
