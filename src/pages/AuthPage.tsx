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

const AuthPage = () => {
  const { user, loading: authLoading, isAdmin, refreshAuth } = useAuth();
  const navigate = useNavigate();
  const [isSignup, setIsSignup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [district, setDistrict] = useState("");
  const [designation, setDesignation] = useState("");

  // Redirect if already logged in
  if (!authLoading && user) {
    return <Navigate to={isAdmin ? "/admin" : "/dashboard"} replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await api.auth.login(email, password);
    if (error || !data) {
      toast.error(error || "Login failed");
    } else {
      setToken(data.token);
      await refreshAuth();
    }
    setLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !district) {
      toast.error("Please fill all required fields");
      return;
    }
    setLoading(true);
    const { data, error } = await api.auth.signup({
      email,
      password,
      full_name: fullName,
      district,
      designation: designation || undefined,
    });
    if (error || !data) {
      toast.error(error || "Signup failed");
    } else {
      setToken(data.token);
      toast.success("Account created successfully!");
      await refreshAuth();
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
              {isSignup ? "Create Account" : "Sign In"}
            </CardTitle>
            <p className="text-muted-foreground text-sm">
              {isSignup ? "Register as a District User" : "Access the DRSC Portal"}
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={isSignup ? handleSignup : handleLogin} className="space-y-4">
              {isSignup && (
                <>
                  <div>
                    <Label htmlFor="fullName">Full Name *</Label>
                    <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                  </div>
                  <div>
                    <Label htmlFor="district">District *</Label>
                    <Select value={district} onValueChange={setDistrict}>
                      <SelectTrigger><SelectValue placeholder="Select District" /></SelectTrigger>
                      <SelectContent>
                        {AP_DISTRICTS.map((d) => (
                          <SelectItem key={d} value={d}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="designation">Designation</Label>
                    <Input id="designation" value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="e.g., DSP, CI, SHO" />
                  </div>
                </>
              )}
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="password">Password *</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
              </div>
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-white font-semibold shadow-md" disabled={loading}>
                {loading ? "Please wait..." : isSignup ? "Create Account" : "Sign In"}
              </Button>
            </form>
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setIsSignup(!isSignup)}
                className="text-sm text-secondary font-medium hover:text-secondary/80 hover:underline"
              >
                {isSignup ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AuthPage;
