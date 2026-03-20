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
    <div className="min-h-screen bg-background">
      <div className="gov-saffron-stripe" />
      <div className="gov-banner px-4 py-6">
        <div className="container mx-auto flex items-center justify-center gap-3">
          <img src={apLogo} alt="Government of Andhra Pradesh" className="h-14 w-14 rounded-full object-contain bg-white p-0.5" />
          <div className="text-center">
            <h1 className="text-primary-foreground text-xl font-bold">
              Government of Andhra Pradesh
            </h1>
            <p className="text-primary-foreground/80 text-sm">
              Fatal Road Accident — Scientific Investigation Portal
            </p>
          </div>
        </div>
      </div>
      <div className="gov-saffron-stripe" />

      <div className="container mx-auto flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-primary text-xl">
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
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Please wait..." : isSignup ? "Create Account" : "Sign In"}
              </Button>
            </form>
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setIsSignup(!isSignup)}
                className="text-sm text-primary underline hover:opacity-80"
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
