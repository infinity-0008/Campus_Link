import AppShell from "@/components/layout/AppShell.jsx";
import { NAV_ITEMS } from "@/features/auth/navigation.js";
import { useAuth } from "@/features/auth/AuthContext.jsx";
export default function WorkspaceLayout(){ const {role}=useAuth(); return <AppShell navItems={NAV_ITEMS[role]||[]}/>; }
