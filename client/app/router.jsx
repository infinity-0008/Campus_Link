import { Navigate, createBrowserRouter } from "react-router-dom";
import PublicLayout from "@/layouts/PublicLayout.jsx";
import WorkspaceLayout from "@/layouts/WorkspaceLayout.jsx";
import RequireRole from "@/features/auth/RequireRole.jsx";
import Home from "@/pages/Home.jsx";
import NotFound from "@/pages/NotFound.jsx";
import { LoginPage, RegisterPage } from "@/pages/AuthPages.jsx";
import {
  StudentDashboard, StudentProfilePage, StudentResumePage, StudentJobsPage,
  StudentJobDetailPage, StudentApplicationsPage, StudentInterviewsPage, NotificationsPage,
} from "@/pages/StudentPages.jsx";
import {
  RecruiterDashboard, RecruiterJobsPage, RecruiterJobFormPage, RecruiterApplicantsPage,
  RecruiterInterviewsPage, RecruiterReportsPage,
} from "@/pages/RecruiterPages.jsx";
import {
  AdminDashboardPage, RecruiterApprovalsPage, AdminStudentsPage, AdminDrivesPage,
  AdminAuditLogsPage, AdminAnalyticsPage,
} from "@/pages/AdminPages.jsx";

const routesForRole = (role, children) => ({
  path: `/${role}`,
  element: <RequireRole allow={[role]} />,
  children: [
    { index: true, element: <Navigate to={`/${role}/dashboard`} replace /> },
    { element: <WorkspaceLayout />, children },
  ],
});

export const router = createBrowserRouter([
  { path: "/", element: <Home /> },
  {
    element: <PublicLayout />,
    children: [
      { path: "/login", element: <LoginPage /> },
      { path: "/register", element: <RegisterPage /> },
    ],
  },
  routesForRole("student", [
    { path: "dashboard", element: <StudentDashboard /> },
    { path: "profile", element: <StudentProfilePage /> },
    { path: "resume", element: <StudentResumePage /> },
    { path: "jobs", element: <StudentJobsPage /> },
    { path: "jobs/:id", element: <StudentJobDetailPage /> },
    { path: "applications", element: <StudentApplicationsPage /> },
    { path: "interviews", element: <StudentInterviewsPage /> },
    { path: "notifications", element: <NotificationsPage /> },
  ]),
  routesForRole("recruiter", [
    { path: "dashboard", element: <RecruiterDashboard /> },
    { path: "jobs", element: <RecruiterJobsPage /> },
    { path: "jobs/create", element: <RecruiterJobFormPage /> },
    { path: "jobs/:id/edit", element: <RecruiterJobFormPage /> },
    { path: "jobs/:id/applicants", element: <RecruiterApplicantsPage /> },
    { path: "interviews", element: <RecruiterInterviewsPage /> },
    { path: "reports", element: <RecruiterReportsPage /> },
    { path: "notifications", element: <NotificationsPage /> },
  ]),
  routesForRole("admin", [
    { path: "dashboard", element: <AdminDashboardPage /> },
    { path: "recruiters", element: <RecruiterApprovalsPage /> },
    { path: "students", element: <AdminStudentsPage /> },
    { path: "drives", element: <AdminDrivesPage /> },
    { path: "audit-logs", element: <AdminAuditLogsPage /> },
    { path: "analytics", element: <AdminAnalyticsPage /> },
    { path: "notifications", element: <NotificationsPage /> },
  ]),
  { path: "*", element: <NotFound /> },
]);
