import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api, clearToken } from "@/lib/api";

export interface AppUser {
  id: string;
  email: string;
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  isAdmin: boolean;
  profile: { full_name: string; district: string; designation: string | null } | null;
  signOut: () => void;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAdmin: false,
  profile: null,
  signOut: () => {},
  refreshAuth: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [profile, setProfile] = useState<AuthContextType["profile"]>(null);

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem("auth_token");
    if (!token) {
      setUser(null);
      setIsAdmin(false);
      setProfile(null);
      setLoading(false);
      return;
    }

    const { data, error } = await api.auth.me();
    if (error || !data) {
      clearToken();
      setUser(null);
      setIsAdmin(false);
      setProfile(null);
    } else {
      setUser(data.user);
      setIsAdmin(data.isAdmin);
      setProfile(data.profile);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const signOut = () => {
    clearToken();
    setUser(null);
    setIsAdmin(false);
    setProfile(null);
    navigate("/auth");
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, profile, signOut, refreshAuth: loadUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
