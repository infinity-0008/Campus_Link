import { useCallback, useState } from "react";
import { Outlet, matchPath, useLocation, Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import Sidebar from "./Sidebar.jsx"; import Topbar from "./Topbar.jsx";
import { useAuth } from "@/features/auth/AuthContext.jsx"; import { ROLE_LABELS } from "@/features/auth/roles.js";
export default function AppShell({navItems}) {
 const {role,user}=useAuth(); const location=useLocation(); const [open,setOpen]=useState(false); const close=useCallback(()=>setOpen(false),[]);
 const active=navItems.find((item)=>matchPath({path:item.to,end:false},location.pathname)); const title=active?.label||ROLE_LABELS[role];
 return <div className="min-h-screen bg-[#f5f5f4] lg:flex"><Sidebar navItems={navItems} roleLabel={ROLE_LABELS[role]} open={open} onClose={close}/><div className="flex min-h-screen min-w-0 flex-1 flex-col"><Topbar title={title} onMenuClick={()=>setOpen(true)}/>{role==="recruiter"&&user?.status==="pending"&&<div className="mx-4 mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 sm:mx-7"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0"/><div className="text-xs leading-5"><strong>Recruiter approval pending.</strong> Your account needs placement-admin approval before you can create or publish jobs. You can review this status from your dashboard.</div></div>}<main className="w-full flex-1 px-4 py-6 sm:px-7 sm:py-8 xl:px-10"><div className="mx-auto w-full max-w-[1440px]"><Outlet/></div></main><footer className="border-t border-[#e9e9e8] bg-white px-6 py-4 text-center text-[10px] text-[#999ba0]">CampusLink · Placement and recruitment, connected.</footer></div></div>;
}
