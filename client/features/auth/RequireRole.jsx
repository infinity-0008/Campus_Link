import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext.jsx";
import AccessDenied from "@/pages/AccessDenied.jsx";
import { LoaderCircle } from "lucide-react";
export default function RequireRole({ allow }) {
  const { status, role } = useAuth(); const location = useLocation();
  if (status === "loading") return <div className="grid min-h-screen place-items-center bg-[#f5f5f4]"><LoaderCircle className="h-8 w-8 animate-spin text-brand-red"/></div>;
  if (status === "anonymous") return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!allow.includes(role)) return <AccessDenied />;
  return <Outlet />;
}
