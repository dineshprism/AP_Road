import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import apLogo from "@/Andhra_Pradesh_logo.jpg";

const GovHeader = () => {
  const { user, isAdmin, profile, signOut } = useAuth();

  return (
    <header>
      <div className="gov-saffron-stripe" />
      <div className="gov-banner px-4 py-3">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={apLogo} alt="Government of Andhra Pradesh" className="h-11 w-11 rounded-full object-contain bg-white p-0.5" />
            <div>
              <h1 className="text-primary-foreground text-lg font-bold leading-tight">
                Government of Andhra Pradesh
              </h1>
              <p className="text-primary-foreground/80 text-xs">
                Police, Tranksport, Roads & Buildings Department
              </p>
            </div>
          </div>
          {user && (
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-primary-foreground text-sm font-medium">
                  {profile?.full_name || user.email}
                </p>
                <p className="text-primary-foreground/70 text-xs">
                  {isAdmin ? "Administrator" : `District: ${profile?.district || "N/A"}`}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={signOut}
                className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10"
              >
                <LogOut className="w-4 h-4" />
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
