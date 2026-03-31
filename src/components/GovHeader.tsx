import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import apLogo from "@/Andhra_Pradesh_logo.jpg";

const GovHeader = () => {
  const { user, isAdmin, roles, profile, signOut } = useAuth();

  const getRoleLabel = () => {
    if (roles.includes("dgp")) return "DGP — Administrator";
    if (roles.includes("adgp")) return "ADGP — Administrator";
    if (isAdmin) return "Administrator";
    return `District: ${profile?.district || "N/A"}`;
  };

  return (
    <header className="sticky top-0 z-50 shadow-sm">
      <div className="gov-tricolor-top" />
      <div className="gov-banner px-4 py-3">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={apLogo} alt="Government of Andhra Pradesh" className="h-12 w-12 rounded-full object-contain bg-white p-0.5 shadow-md" />
            <div>
              <h1 className="text-white text-lg font-bold leading-tight tracking-wide">
                Government of Andhra Pradesh
              </h1>
              <p className="text-white/70 text-[11px] font-medium tracking-wide">
                Police, Transport, Roads &amp; Buildings Department &mdash; DRSC Portal
              </p>
            </div>
          </div>
          {user && (
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-white text-sm font-semibold">
                  {profile?.full_name || user.email}
                </p>
                <p className="text-white/60 text-xs">
                  {getRoleLabel()}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={signOut}
                className="text-white/70 hover:text-white hover:bg-white/10 border border-white/20"
              >
                <LogOut className="w-4 h-4 mr-1" />
                <span className="hidden sm:inline text-xs">Logout</span>
              </Button>
            </div>
          )}
        </div>
      </div>
      <div className="gov-saffron-stripe" />
    </header>
  );
};

export default GovHeader;
