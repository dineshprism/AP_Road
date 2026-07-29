import { useState } from "react";
import { Navigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AP_DISTRICTS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import apLogo from "@/Andhra_Pradesh_logo.jpg";
import apPoliceLogo from "@/AP_Police_logo.png";
import memoRoadSafetyPdf from "@/../memo_road_safety.pdf";
import { Download, FileText } from "lucide-react";

const DEMO_DISTRICTS = ["Prism"];
const STANDARD_DISTRICTS = AP_DISTRICTS.filter((district) => !DEMO_DISTRICTS.includes(district));

/** Shared shell so memo + sign-in panels match size and shape on desktop */
const AUTH_PANEL =
  "flex h-full min-h-[min(520px,62vh)] w-full flex-col overflow-hidden rounded-2xl border-0 bg-white/95 shadow-2xl";

const TRICOLOR_STRIPE = "h-1.5 shrink-0 bg-gradient-to-r from-[#ff9933] via-white to-[#138808]";

const PANEL_HEADER =
  "shrink-0 border-b border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#eef4ff_100%)] py-2";

type PriorityRole = {
  value: string;
  title: string;
  subtitle: string;
};

const PRIORITY_ROLES: PriorityRole[] = [
  { value: "DGP", title: "DGP", subtitle: "" },
  { value: "ADGP", title: "ADGP", subtitle: "" },
  { value: "Prism", title: "Prism", subtitle: "" },
];

function PriorityRoleOption({ role }: { role: PriorityRole }) {
  return (
    <SelectItem value={role.value} className="rounded-md">
      <div className="flex w-full flex-col text-left">
        <span className="font-normal leading-tight">{role.title}</span>
        <span className="text-xs text-muted-foreground">{role.subtitle}</span>
      </div>
    </SelectItem>
  );
}

const AuthPage = () => {
  const { user, loading: authLoading, isAdmin, roles, refreshAuth } = useAuth();
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  if (!authLoading && user) {
    if (roles.includes("prism")) return <Navigate to="/prism-dashboard" replace />;
    if (roles.includes("dgp")) return <Navigate to="/admin" replace />;
    if (roles.includes("adgp")) return <Navigate to="/adgp-dashboard" replace />;
    if (isAdmin) return <Navigate to="/admin" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username) {
      toast.error("Please select a user");
      return;
    }

    setLoading(true);
    const { data, error } = await api.auth.login(username, password);
    if (error || !data) {
      toast.error(error || "Login failed");
    } else {
      await refreshAuth();
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-1 flex-col bg-[radial-gradient(circle_at_top_left,#274b93_0%,#132b5e_36%,#08173f_100%)]">
      <div className="gov-tricolor-top" />
      <div className="flex flex-1 flex-col overflow-y-auto px-4 py-2 lg:px-6">
        <div className="container mx-auto shrink-0">
          <div className="mb-2 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-5">
            <img
              src={apLogo}
              alt="Fatal Road Accident & Scientific Investigation Portal"
              className="h-16 w-16 shrink-0 rounded-full bg-white p-1 object-contain shadow-lg sm:h-20 sm:w-20"
            />
            <div className="text-center">
              <h1 className="text-lg font-bold tracking-wide text-white sm:text-xl">
              Andhra Pradesh Fatal Road Accident & Scientific Investigation Portal
              </h1>
              <p className="text-xs font-medium leading-snug text-white/80 sm:text-sm">

              </p>
              <p className="text-[11px] font-semibold tracking-wider text-[#f5a623] sm:text-xs">
                G.O.Ms.No.42 • Section 135, MV Act 1988
              </p>
            </div>
            <img
              src={apPoliceLogo}
              alt="Andhra Pradesh Police"
              className="hidden h-16 w-16 shrink-0 rounded-full bg-white p-1 object-contain shadow-lg sm:block sm:h-20 sm:w-20"
            />
          </div>
        </div>

        <div className="container mx-auto flex flex-1 flex-col justify-center py-3">
          <div className="grid w-full grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
            {/* Memo panel */}
            <Card className={cn(AUTH_PANEL, "hidden lg:flex")}>
              <div className={TRICOLOR_STRIPE} />
              <CardHeader className={PANEL_HEADER}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg font-bold text-primary">
                      <FileText className="h-4 w-4 text-secondary" />
                      Road Safety Memo
                    </CardTitle>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      View the official memo directly on the login page.
                    </p>
                  </div>
                  <a href={memoRoadSafetyPdf} download="memo_road_safety.pdf">
                    <Button type="button" variant="outline" size="sm" className="shrink-0 border-primary/20 bg-white text-sm">
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </Button>
                  </a>
                </div>
              </CardHeader>
              <CardContent className="flex min-h-0 flex-1 flex-col bg-slate-100 p-3">
                <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-inner">
                  <iframe
                    src={`${memoRoadSafetyPdf}#view=FitH`}
                    title="Road Safety Memo"
                    className="h-full min-h-[min(300px,32vh)] w-full flex-1"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Sign-in panel — same dimensions as memo */}
            <Card className={cn(AUTH_PANEL, "overflow-visible")}>
              <div className={TRICOLOR_STRIPE} />
              <CardHeader className={cn(PANEL_HEADER, "text-center gap-0.5")}>
                <CardTitle className="text-base font-bold text-primary sm:text-lg">Sign In</CardTitle>
                <p className="-mt-1 text-xs text-muted-foreground">Access the DRSC Portal</p>
              </CardHeader>

              <CardContent className="flex min-h-0 flex-1 flex-col p-3 sm:p-4">
                <form onSubmit={handleLogin} className="flex min-h-0 flex-1 flex-col justify-center gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="username" className="text-sm font-semibold sm:text-base">
                      Select User *
                    </Label>
                    <Select value={username} onValueChange={setUsername}>
                      <SelectTrigger id="username" aria-label="Select user">
                        <SelectValue placeholder="Select District / Role" />
                      </SelectTrigger>
                      <SelectContent
                        position="popper"
                        side="bottom"
                        align="start"
                        sideOffset={8}
                        avoidCollisions={false}
                      >
                        <SelectGroup>
                          <SelectLabel className="text-[#1e3a8a]">State & priority access</SelectLabel>
                          {PRIORITY_ROLES.map((role) => (
                            <PriorityRoleOption key={role.value} role={role} />
                          ))}
                        </SelectGroup>
                        <SelectSeparator />
                        <SelectGroup>
                          <SelectLabel>Districts ({STANDARD_DISTRICTS.length})</SelectLabel>
                          {STANDARD_DISTRICTS.map((district) => (
                            <SelectItem key={district} value={district} className="rounded-md text-sm">
                              {district}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="password" className="text-sm font-semibold sm:text-base">
                      Password *
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      className="h-10 text-base"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="h-10 w-full bg-primary text-base font-semibold text-white shadow-md hover:bg-primary/90"
                    disabled={loading}
                  >
                    {loading ? "Please wait..." : "Sign In"}
                  </Button>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm leading-relaxed text-muted-foreground lg:hidden">
                    <div className="font-semibold text-primary">Road Safety Memo</div>
                    <p className="mt-1">Open or download the official memo from here.</p>
                    <div className="mt-2 flex gap-2">
                      <a href={memoRoadSafetyPdf} target="_blank" rel="noreferrer">
                        <Button type="button" variant="outline" size="sm" className="text-sm">
                          View
                        </Button>
                      </a>
                      <a href={memoRoadSafetyPdf} download="memo_road_safety.pdf">
                        <Button type="button" variant="outline" size="sm" className="text-sm">
                          Download
                        </Button>
                      </a>
                    </div>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
