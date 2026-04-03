import { useState } from "react";
import { Navigate } from "react-router-dom";
import { api, setToken } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AP_DISTRICTS } from "@/lib/constants";
import { toast } from "sonner";
import apLogo from "@/Andhra_Pradesh_logo.jpg";
import memoRoadSafetyPdf from "@/../memo_road_safety.pdf";
import { Download, FileText, ShieldCheck } from "lucide-react";

const DEMO_DISTRICTS = ["Prism"];
const STANDARD_DISTRICTS = AP_DISTRICTS.filter((district) => !DEMO_DISTRICTS.includes(district));

const AuthPage = () => {
  const { user, loading: authLoading, isAdmin, roles } = useAuth();
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  if (!authLoading && user) {
    if (roles.includes("prism")) return <Navigate to="/dashboard" replace />;
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
      setToken(data.token);
      window.location.reload();
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-full flex-1 overflow-hidden bg-[radial-gradient(circle_at_top_left,#274b93_0%,#132b5e_36%,#08173f_100%)]">
      <div className="gov-tricolor-top" />
      <div className="flex min-h-0 flex-1 flex-col px-4 py-4 lg:px-6">
        <div className="container mx-auto shrink-0">
          <div className="mb-4 flex items-center justify-center gap-3 text-center lg:justify-start lg:text-left">
            <img
              src={apLogo}
              alt="Government of Andhra Pradesh"
              className="h-14 w-14 rounded-full bg-white p-1 object-contain shadow-lg"
            />
            <div>
              <h1 className="text-xl font-bold tracking-wide text-white lg:text-2xl">
                Government of Andhra Pradesh
              </h1>
              <p className="text-sm font-medium text-white/75">
                Fatal Road Accident & Scientific Investigation Portal
              </p>
              <p className="mt-1 text-xs font-semibold tracking-wider text-[#f5a623]">
                G.O.Ms.No.42 • Section 135, MV Act 1988
              </p>
            </div>
          </div>
        </div>

        <div className="container mx-auto flex min-h-0 flex-1 items-stretch">
          <div className="grid min-h-0 w-full grid-cols-1 gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <Card className="hidden min-h-0 overflow-hidden border-0 bg-white/95 shadow-2xl lg:flex lg:flex-col">
              <div className="h-1.5 bg-gradient-to-r from-[#ff9933] via-white to-[#138808]" />
              <CardHeader className="shrink-0 border-b border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#eef4ff_100%)] pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-xl font-bold text-primary">
                      <FileText className="h-5 w-5 text-secondary" />
                      Road Safety Memo
                    </CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      View the official memo directly on the login page.
                    </p>
                  </div>
                  <a href={memoRoadSafetyPdf} download="memo_road_safety.pdf">
                    <Button type="button" variant="outline" className="border-primary/20 bg-white">
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </Button>
                  </a>
                </div>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 bg-slate-100 p-3">
                <div className="h-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-inner">
                  <iframe
                    src={`${memoRoadSafetyPdf}#view=FitH`}
                    title="Road Safety Memo"
                    className="h-full w-full"
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex min-h-0 items-center justify-center lg:justify-end">
              <Card className="w-full max-w-2xl overflow-hidden rounded-[24px] border-0 shadow-2xl">
                <div className="h-1.5 bg-gradient-to-r from-[#ff9933] via-white to-[#138808]" />
                <CardHeader className="bg-gradient-to-b from-primary/5 to-transparent pb-4 text-center">
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <ShieldCheck className="h-7 w-7" />
                  </div>
                  <CardTitle className="text-xl font-bold text-primary">Sign In</CardTitle>
                  <p className="text-sm text-muted-foreground">Access the DRSC Portal</p>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                      <Label htmlFor="username">Select User *</Label>
                      <Select value={username} onValueChange={setUsername}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select District / Role" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[320px]">
                          <SelectItem value="DGP" className="font-bold text-primary">DGP</SelectItem>
                          <SelectItem value="ADGP" className="font-bold text-primary">ADGP</SelectItem>
                          <SelectItem disabled value="__demo__">Demo District</SelectItem>
                          {DEMO_DISTRICTS.map((district) => (
                            <SelectItem key={district} value={district} className="font-semibold text-primary">
                              {district}
                            </SelectItem>
                          ))}
                          <SelectItem disabled value="__districts__">Districts</SelectItem>
                          {STANDARD_DISTRICTS.map((district) => (
                            <SelectItem key={district} value={district}>
                              {district}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="password">Password *</Label>
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full bg-primary font-semibold text-white shadow-md hover:bg-primary/90"
                      disabled={loading}
                    >
                      {loading ? "Please wait..." : "Sign In"}
                    </Button>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-muted-foreground lg:hidden">
                      <div className="font-semibold text-primary">Road Safety Memo</div>
                      <p className="mt-1">Open or download the official memo from here.</p>
                      <div className="mt-3 flex gap-2">
                        <a href={memoRoadSafetyPdf} target="_blank" rel="noreferrer">
                          <Button type="button" variant="outline" size="sm">View</Button>
                        </a>
                        <a href={memoRoadSafetyPdf} download="memo_road_safety.pdf">
                          <Button type="button" variant="outline" size="sm">Download</Button>
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
    </div>
  );
};

export default AuthPage;
