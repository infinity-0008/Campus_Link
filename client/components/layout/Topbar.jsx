import { Bell, LogOut, Menu, ChevronDown } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext.jsx";
import { ROLE_LABELS } from "@/features/auth/roles.js";
import { useQuery } from "@tanstack/react-query";
import { notificationsApi } from "@/api/notifications.api.js";
export default function Topbar({ title, onMenuClick }) {
  const { user, role, signOut } = useAuth(); const navigate=useNavigate(); const location=useLocation();
  const notifications = useQuery({ queryKey:["notifications","summary"], queryFn:()=>notificationsApi.list({page:1,limit:5,unreadOnly:"false"}), refetchInterval:30000, retry:false });
  const count = notifications.data?.data?.unreadCount ?? notifications.data?.unreadCount ?? 0;
  const name = user?.name || ROLE_LABELS[role] || "Account";
  const initials = name.split(" ").map((part)=>part[0]).join("").slice(0,2).toUpperCase();
  const logout=()=>{signOut();navigate("/login",{replace:true,state:{from:location.pathname}});};
  return <header className="sticky top-0 z-20 flex h-[76px] items-center gap-3 border-b border-[#e9e9e8] bg-white/95 px-4 backdrop-blur sm:px-7"><button onClick={onMenuClick} aria-label="Open navigation" aria-controls="app-sidebar" className="rounded-xl p-2 text-[#34353a] hover:bg-[#f2f2f1] lg:hidden"><Menu className="h-5 w-5"/></button><div className="min-w-0 flex-1"><p className="truncate text-[13px] font-semibold text-[#202126]">{title}</p><p className="hidden text-[11px] text-[#999ba0] sm:block">CampusLink / {ROLE_LABELS[role]}</p></div><Link to={`/${role}/notifications`} className="relative grid h-10 w-10 place-items-center rounded-xl border border-[#ececeb] text-[#5b5d63] hover:bg-[#f7f7f6]" aria-label="Notifications"><Bell className="h-[18px] w-[18px]"/>{count>0&&<span aria-label={`${count} unread notifications`} className="absolute -right-2 -top-2 grid min-h-5 min-w-5 place-items-center rounded-full border-2 border-white bg-brand-red px-1 text-[9px] font-extrabold leading-none text-white">{count>99?"99+":count}</span>}</Link><div className="flex items-center gap-2 border-l border-[#eee] pl-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#101114] text-[11px] font-bold text-white">{initials}</span><div className="hidden min-w-0 sm:block"><p className="max-w-36 truncate text-xs font-bold text-[#25262b]">{name}</p><p className="text-[10px] text-[#85878d]">{ROLE_LABELS[role]}</p></div><button onClick={logout} title="Sign out" aria-label="Sign out" className="ml-1 rounded-lg p-2 text-[#777a82] hover:bg-[#f2f2f1] hover:text-brand-red"><LogOut className="h-4 w-4"/></button><ChevronDown className="hidden h-3 w-3 text-[#b1b2b5] sm:block"/></div></header>;
}
