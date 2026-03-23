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

const LOGIN_USERS = [
  ...AP_DISTRICTS.map((d) => ({ label: d, value: d })),
  { label: "DGP", value: "DGP" },
  { label: "ADGP", value: "ADGP" },
];

const AuthPage = () => {
  const { user, loading: authLoading, isAdmin, roles } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // Redirect if already logged in
  if (!authLoading && user) {
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
        <div className="container mx-auto flex items-center justify-center gap-3 mb-2">
          <img src={apLogo} alt="Government of Andhra Pradesh" className="h-16 w-16 rounded-full object-contain bg-white p-1 shadow-lg" />
          <div className="text-center">
            <h1 className="text-white text-2xl font-bold tracking-wide">
              Government of Andhra Pradesh
            </h1>
            <p className="text-white/70 text-sm font-medium">
              Fatal Road Accident &mdash; Scientific Investigation Portal
            </p>
            <p className="text-[#f5a623] text-xs mt-1 font-semibold tracking-wider">
              G.O.Ms.No.42 &bull; Section 135, MV Act 1988
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto flex items-center justify-center px-4 pb-16">
        <Card className="w-full max-w-md shadow-2xl border-0 rounded-xl overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-[#ff9933] via-white to-[#138808]" />
          <CardHeader className="text-center bg-gradient-to-b from-primary/5 to-transparent pb-4">
            <CardTitle className="text-primary text-xl font-bold">
              Sign In
            </CardTitle>
            <p className="text-muted-foreground text-sm">
              Access the DRSC Portal
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label htmlFor="username">Select User *</Label>
                <Select value={username} onValueChange={setUsername}>
                  <SelectTrigger><SelectValue placeholder="Select District / Role" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DGP" className="font-bold text-primary">DGP</SelectItem>
                    <SelectItem value="ADGP" className="font-bold text-primary">ADGP</SelectItem>
                    <SelectItem disabled value="---">── Districts ──</SelectItem>
                    {AP_DISTRICTS.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="password">Password *</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
              </div>
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-white font-semibold shadow-md" disabled={loading}>
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
