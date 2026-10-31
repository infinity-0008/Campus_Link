import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authApi } from "@/api/auth.api.js";
import { clearSession, getToken, setToken } from "./session.js";
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [token, setTokenState] = useState(getToken);
  const query = useQuery({ queryKey: ["auth", "me"], queryFn: authApi.me, enabled: Boolean(token), retry: false });
  const status = !token ? "anonymous" : query.isSuccess ? "authenticated" : query.isError ? "anonymous" : "loading";
  const signIn = useCallback(async (nextToken, user) => {
    setToken(nextToken); setTokenState(nextToken);
    if (user) queryClient.setQueryData(["auth", "me"], user);
    else await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
  }, [queryClient]);
  const signOut = useCallback(() => {
    clearSession(); setTokenState(null); queryClient.clear();
  }, [queryClient]);
  const value = useMemo(() => ({ status, user: status === "authenticated" ? query.data : null, role: query.data?.role ?? null, signIn, signOut }), [status, query.data, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() { const ctx = useContext(AuthContext); if (!ctx) throw new Error("useAuth must be used within AuthProvider"); return ctx; }
