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
import memoRoadSafetyPdf from "@/../memo_road_safety.pdf";
import {
  Crown,
  Download,
  Eye,
  FileText,
  Shield,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const DEMO_DISTRICTS = ["Prism"];
const STANDARD_DISTRICTS = AP_DISTRICTS.filter((district) => !DEMO_DISTRICTS.includes(district));

/** Shared shell so memo + sign-in panels match size and shape on desktop */
const AUTH_PANEL =
  "flex h-full min-h-[min(640px,78vh)] w-full flex-col overflow-hidden rounded-2xl border-0 bg-white/95 shadow-2xl";

const TRICOLOR_STRIPE = "h-1.5 shrink-0 bg-gradient-to-r from-[#ff9933] via-white to-[#138808]";

const PANEL_HEADER =
  "shrink-0 border-b border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#eef4ff_100%)] pb-4";

type PriorityRole = {
  value: string;
  title: string;
  subtitle: string;
  badge: string;
  icon: typeof Crown;
  cardClass: string;
  itemClass: string;
  badgeClass: string;
};

const PRIORITY_ROLES: PriorityRole[] = [
  {
    value: "DGP",
    title: "DGP",
    subtitle: "Statewide oversight & admin",
    badge: "All districts",
    icon: Crown,
    cardClass:
      "border-[#1e3a8a]/30 bg-gradient-to-br from-[#1e3a8a]/12 via-[#eef4ff] to-white hover:border-[#1e3a8a]/50 hover:shadow-md",
    itemClass:
      "my-1 rounded-xl border-2 border-[#1e3a8a]/25 bg-gradient-to-r from-[#1e3a8a]/10 to-[#eef4ff] py-3 pl-3 focus:bg-[#1e3a8a]/15 data-[state=checked]:border-[#1e3a8a] data-[state=checked]:bg-[#1e3a8a]/12 data-[state=checked]:ring-2 data-[state=checked]:ring-[#1e3a8a]/25",
    badgeClass: "bg-[#1e3a8a] text-white",
  },
  {
    value: "ADGP",
    title: "ADGP",
    subtitle: "State analytics & review",
    badge: "Statewide",
    icon: Shield,
    cardClass:
      "border-[#e8710a]/35 bg-gradient-to-br from-[#fff7ed] via-[#ffedd5] to-white hover:border-[#e8710a]/55 hover:shadow-md",
    itemClass:
      "my-1 rounded-xl border-2 border-[#e8710a]/30 bg-gradient-to-r from-[#ffedd5] to-white py-3 pl-3 focus:bg-[#ffedd5] data-[state=checked]:border-[#e8710a] data-[state=checked]:bg-[#fff7ed] data-[state=checked]:ring-2 data-[state=checked]:ring-[#e8710a]/30",
    badgeClass: "bg-[#e8710a] text-white",
  },
  {
    value: "Prism",
    title: "Prism",
    subtitle: "State demo & submissions view",
    badge: "Priority",
    icon: Sparkles,
    cardClass:
      "border-[#138808]/35 bg-gradient-to-br from-[#ecfdf3] via-[#f0fdf4] to-white hover:border-[#138808]/55 hover:shadow-md",
    itemClass:
      "my-1 rounded-xl border-2 border-[#138808]/30 bg-gradient-to-r from-[#ecfdf3] to-white py-3 pl-3 focus:bg-[#ecfdf3] data-[state=checked]:border-[#138808] data-[state=checked]:bg-[#f0fdf4] data-[state=checked]:ring-2 data-[state=checked]:ring-[#138808]/30",
    badgeClass: "bg-[#138808] text-white",
  },
];

function PriorityRoleOption({ role }: { role: PriorityRole }) {
  const Icon = role.icon;
  return (
    <SelectItem value={role.value} className={cn(role.itemClass, "[&>span:first-child]:top-3")}>
      <div className="flex w-full items-center gap-3 pr-1">
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg shadow-sm",
            role.value === "DGP" && "bg-[#1e3a8a] text-white",
            role.value === "ADGP" && "bg-[#e8710a] text-white",
            role.value === "Prism" && "bg-[#138808] text-white",
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1 text-left">
          <p className="font-bold leading-tight text-primary">{role.title}</p>
          <p className="text-xs text-muted-foreground">{role.subtitle}</p>
        </div>
        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", role.badgeClass)}>
          {role.badge}
        </span>
      </div>
    </SelectItem>
  );
}

function PriorityRoleCard({
  role,
  selected,
  onSelect,
}: {
  role: PriorityRole;
  selected: boolean;
  onSelect: (value: string) => void;
}) {
  const Icon = role.icon;
  return (
    <button
      type="button"
      onClick={() => onSelect(role.value)}
      className={cn(
        "flex flex-col items-start gap-2 rounded-xl border-2 p-3 text-left transition-all",
        role.cardClass,
        selected && "ring-2 ring-offset-1 ring-primary/40 shadow-md",
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-lg shadow-sm",
          role.value === "DGP" && "bg-[#1e3a8a] text-white",
          role.value === "ADGP" && "bg-[#e8710a] text-white",
          role.value === "Prism" && "bg-[#138808] text-white",
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <p className="text-sm font-bold text-primary">{role.title}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{role.subtitle}</p>
      </div>
      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", role.badgeClass)}>
        {role.badge}
      </span>
    </button>
  );
}

const AuthPage = () => {
  const { user, loading: authLoading, isAdmin, roles, refreshAuth } = useAuth();
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const isPriorityUser = PRIORITY_ROLES.some((r) => r.value === username);

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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#274b93_0%,#132b5e_36%,#08173f_100%)]">
      <div className="gov-tricolor-top" />
      <div className="flex min-h-[calc(100vh-4px)] flex-col overflow-y-auto px-4 py-4 lg:px-6">
        <div className="container mx-auto shrink-0">
          <div className="mb-4 flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-center lg:justify-start lg:text-left">
            <img
              src={apLogo}
              alt="Government of Andhra Pradesh"
              className="h-14 w-14 shrink-0 rounded-full bg-white p-1 object-contain shadow-lg"
            />
            <div>
              <h1 className="text-xl font-bold tracking-wide text-white sm:text-2xl">
                Government of Andhra Pradesh
              </h1>
              <p className="text-sm font-medium leading-snug text-white/80 sm:text-base">
                Fatal Road Accident & Scientific Investigation Portal
              </p>
              <p className="mt-1 text-xs font-semibold tracking-wider text-[#f5a623] sm:text-sm">
                G.O.Ms.No.42 • Section 135, MV Act 1988
              </p>
            </div>
          </div>
        </div>

        <div className="container mx-auto flex flex-1 flex-col py-2">
          <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-2 lg:items-stretch">
            {/* Memo panel */}
            <Card className={cn(AUTH_PANEL, "hidden lg:flex")}>
              <div className={TRICOLOR_STRIPE} />
              <CardHeader className={PANEL_HEADER}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-xl font-bold text-primary">
                      <FileText className="h-5 w-5 text-secondary" />
                      Road Safety Memo
                    </CardTitle>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      View the official memo directly on the login page.
                    </p>
                  </div>
                  <a href={memoRoadSafetyPdf} download="memo_road_safety.pdf">
                    <Button type="button" variant="outline" className="shrink-0 border-primary/20 bg-white text-sm">
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </Button>
                  </a>
                </div>
              </CardHeader>
              <CardContent className="flex min-h-0 flex-1 flex-col bg-slate-100 p-4">
                <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-inner">
                  <iframe
                    src={`${memoRoadSafetyPdf}#view=FitH`}
                    title="Road Safety Memo"
                    className="h-full min-h-[420px] w-full flex-1"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Sign-in panel — same dimensions as memo */}
            <Card className={cn(AUTH_PANEL, "overflow-visible")}>
              <div className={TRICOLOR_STRIPE} />
              <CardHeader className={cn(PANEL_HEADER, "text-center lg:text-left")}>
                <div className="flex flex-col items-center gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex flex-col items-center lg:items-start">
                    <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <ShieldCheck className="h-6 w-6" />
                    </div>
                    <CardTitle className="text-xl font-bold text-primary sm:text-2xl">Sign In</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground sm:text-base">Access the DRSC Portal</p>
                  </div>
                  <div className="hidden items-center gap-1.5 rounded-full border border-primary/15 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary lg:flex">
                    <Eye className="h-3.5 w-3.5" />
                    State roles highlighted below
                  </div>
                </div>
              </CardHeader>

              <CardContent className="flex min-h-0 flex-1 flex-col p-4 sm:p-5">
                <form onSubmit={handleLogin} className="flex min-h-0 flex-1 flex-col gap-5">
                  <div className="space-y-2">
                    <Label htmlFor="username" className="text-sm font-semibold sm:text-base">
                      Select User *
                    </Label>
                    <Select value={username} onValueChange={setUsername}>
                      <SelectTrigger
                        id="username"
                        aria-label="Select user"
                        className={cn(
                          isPriorityUser &&
                            "border-2 border-primary/30 bg-gradient-to-r from-primary/5 to-white font-semibold text-primary shadow-sm",
                        )}
                      >
                        <SelectValue placeholder="Select District / Role" />
                      </SelectTrigger>
                      <SelectContent position="popper" side="bottom" align="start" collisionPadding={48}>
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
                            <SelectItem key={district} value={district} className="rounded-md">
                              {district}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
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
                      className="h-11 text-base"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="h-11 w-full bg-primary text-base font-semibold text-white shadow-md hover:bg-primary/90"
                    disabled={loading}
                  >
                    {loading ? "Please wait..." : "Sign In"}
                  </Button>

                  <div className="mt-auto rounded-xl border border-slate-200/90 bg-gradient-to-b from-slate-50 to-white p-4">
                    <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                      Quick select — state & priority logins
                    </p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      {PRIORITY_ROLES.map((role) => (
                        <PriorityRoleCard
                          key={role.value}
                          role={role}
                          selected={username === role.value}
                          onSelect={setUsername}
                        />
                      ))}
                    </div>
                    <p className="mt-3 text-center text-[11px] text-muted-foreground">
                      DGP & ADGP: statewide submissions · Prism: state viewer access
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed text-muted-foreground lg:hidden">
                    <div className="font-semibold text-primary">Road Safety Memo</div>
                    <p className="mt-1">Open or download the official memo from here.</p>
                    <div className="mt-3 flex gap-2">
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
