import { BriefcaseBusiness, CalendarDays, ChartNoAxesCombined, ClipboardList, FileText, LayoutDashboard, ScrollText, Search, ShieldCheck, UserRound, Users, Building2, Bell } from "lucide-react";
import { ROLES } from "./roles.js";
export const NAV_ITEMS = {
  [ROLES.STUDENT]: [
    { label: "Overview", to: "/student/dashboard", icon: LayoutDashboard },
    { label: "My Profile", to: "/student/profile", icon: UserRound },
    { label: "Resume", to: "/student/resume", icon: FileText },
    { label: "Discover Jobs", to: "/student/jobs", icon: Search },
    { label: "My Applications", to: "/student/applications", icon: ClipboardList },
    { label: "Interviews", to: "/student/interviews", icon: CalendarDays },
    { label: "Notifications", to: "/student/notifications", icon: Bell },
  ],
  [ROLES.RECRUITER]: [
    { label: "Overview", to: "/recruiter/dashboard", icon: LayoutDashboard },
    { label: "Jobs", to: "/recruiter/jobs", icon: BriefcaseBusiness },
    { label: "Interviews", to: "/recruiter/interviews", icon: CalendarDays },
    { label: "Reports", to: "/recruiter/reports", icon: ChartNoAxesCombined },
    { label: "Notifications", to: "/recruiter/notifications", icon: Bell },
  ],
  [ROLES.ADMIN]: [
    { label: "Overview", to: "/admin/dashboard", icon: LayoutDashboard },
    { label: "Recruiter Approvals", to: "/admin/recruiters", icon: ShieldCheck },
    { label: "Students", to: "/admin/students", icon: Users },
    { label: "Drives", to: "/admin/drives", icon: Building2 },
    { label: "Audit Logs", to: "/admin/audit-logs", icon: ScrollText },
    { label: "Analytics", to: "/admin/analytics", icon: ChartNoAxesCombined },
    { label: "Notifications", to: "/admin/notifications", icon: Bell },
  ],
};
