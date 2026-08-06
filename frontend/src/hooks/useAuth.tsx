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
  roles: string[];
  profile: { full_name: string; district: string; designation: string | null } | null;
  lastLoginAt: string | null;
  signOut: () => void;
  refreshAuth: () => Promise<void>;
  setLastLoginAt: (value: string | null) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAdmin: false,
  roles: [],
  profile: null,
  lastLoginAt: null,
  signOut: () => {},
  refreshAuth: async () => {},
  setLastLoginAt: () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [roles, setRoles] = useState<string[]>([]);
  const [profile, setProfile] = useState<AuthContextType["profile"]>(null);
  const [lastLoginAt, setLastLoginAt] = useState<string | null>(null);

  const loadUser = useCallback(async () => {
    const { data, error } = await api.auth.me();
    if (error || !data) {
      clearToken();
      setUser(null);
      setIsAdmin(false);
      setRoles([]);
      setProfile(null);
      setLastLoginAt(null);
    } else {
      setUser(data.user);
      setIsAdmin(data.isAdmin);
      setRoles(data.roles || []);
      setProfile(data.profile);
      setLastLoginAt(data.lastLoginAt ?? null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const signOut = () => {
    void api.auth.logout();
    clearToken();
    setUser(null);
    setIsAdmin(false);
    setRoles([]);
    setProfile(null);
    setLastLoginAt(null);
    navigate("/auth");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAdmin,
        roles,
        profile,
        lastLoginAt,
        signOut,
        refreshAuth: loadUser,
        setLastLoginAt,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
