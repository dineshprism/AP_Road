import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
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

const DEMO_DISTRICTS = ["Prism"];
const STANDARD_DISTRICTS = AP_DISTRICTS.filter((district) => !DEMO_DISTRICTS.includes(district));

const AuthPage = () => {
  const { user, loading: authLoading, isAdmin, roles } = useAuth();
  const navigate = useNavigate();
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
    <div className="min-h-screen bg-gradient-to-br from-[#0b1e53] via-[#132b5e] to-[#1a3a7a]">
      <div className="gov-tricolor-top" />
      <div className="px-4 py-8">
        <div className="container mx-auto mb-2 flex items-center justify-center gap-3">
          <img
            src={apLogo}
            alt="Government of Andhra Pradesh"
            className="h-16 w-16 rounded-full bg-white p-1 object-contain shadow-lg"
          />
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-wide text-white">
              Government of Andhra Pradesh
            </h1>
            <p className="text-sm font-medium text-white/70">
              Fatal Road Accident & Scientific Investigation Portal
            </p>
            <p className="mt-1 text-xs font-semibold tracking-wider text-[#f5a623]">
              G.O.Ms.No.42 • Section 135, MV Act 1988
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto flex items-center justify-center px-4 pb-16">
        <Card className="w-full max-w-md overflow-hidden rounded-xl border-0 shadow-2xl">
          <div className="h-1.5 bg-gradient-to-r from-[#ff9933] via-white to-[#138808]" />
          <CardHeader className="bg-gradient-to-b from-primary/5 to-transparent pb-4 text-center">
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
                  <SelectContent>
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
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AuthPage;
