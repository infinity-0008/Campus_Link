export const ROLES = { STUDENT: "student", RECRUITER: "recruiter", ADMIN: "admin" };
export const ROLE_LABELS = { student: "Student", recruiter: "Recruiter", admin: "Placement Admin" };
export const ROLE_HOME = { student: "/student/dashboard", recruiter: "/recruiter/dashboard", admin: "/admin/dashboard" };
export const getRoleHome = (role) => ROLE_HOME[role] ?? "/";
