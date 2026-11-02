export const COURSES = Object.freeze([
  {
    id: "btech",
    name: "B.Tech",
    fullName: "Bachelor of Technology",
    level: "Undergraduate",
    durationYears: 4,
    maxSemesters: 8,
    specializations: [
      { id: "CSE", name: "Computer Science & Engineering" },
      { id: "IT", name: "Information Technology" },
      { id: "ECE", name: "Electronics & Communication Engineering" },
      { id: "EEE", name: "Electrical & Electronics Engineering" },
      { id: "MECH", name: "Mechanical Engineering" },
      { id: "CIVIL", name: "Civil Engineering" },
      { id: "CHEM", name: "Chemical Engineering" },
      { id: "AI_DS", name: "Artificial Intelligence & Data Science" },
      { id: "BIOTECH", name: "Biotechnology" },
    ],
  },
  {
    id: "bca",
    name: "BCA",
    fullName: "Bachelor of Computer Applications",
    level: "Undergraduate",
    durationYears: 3,
    maxSemesters: 6,
    specializations: [
      { id: "General", name: "General Computer Applications" },
      { id: "Data Science", name: "Data Science & Analytics" },
      { id: "Cloud Computing", name: "Cloud Computing & DevOps" },
      { id: "Web & Mobile", name: "Web & Mobile App Development" },
      { id: "Cybersecurity", name: "Cybersecurity & Ethical Hacking" },
    ],
  },
  {
    id: "bsc",
    name: "B.Sc",
    fullName: "Bachelor of Science",
    level: "Undergraduate",
    durationYears: 3,
    maxSemesters: 6,
    specializations: [
      { id: "Computer Science", name: "Computer Science" },
      { id: "Information Technology", name: "Information Technology" },
      { id: "Mathematics & Computing", name: "Mathematics & Computing" },
      { id: "Statistics & Data", name: "Statistics & Data Analytics" },
      { id: "Electronics", name: "Applied Electronics" },
    ],
  },
  {
    id: "bba",
    name: "BBA",
    fullName: "Bachelor of Business Administration",
    level: "Undergraduate",
    durationYears: 3,
    maxSemesters: 6,
    specializations: [
      { id: "Finance", name: "Financial Management" },
      { id: "Marketing", name: "Marketing Management" },
      { id: "HR", name: "Human Resource Management" },
      { id: "Business Analytics", name: "Business Analytics" },
      { id: "Operations", name: "Operations & Supply Chain" },
    ],
  },
  {
    id: "bcom",
    name: "B.Com",
    fullName: "Bachelor of Commerce",
    level: "Undergraduate",
    durationYears: 3,
    maxSemesters: 6,
    specializations: [
      { id: "Accounting & Finance", name: "Accounting & Finance" },
      { id: "Banking & Insurance", name: "Banking & Insurance" },
      { id: "Financial Markets", name: "Financial Markets" },
      { id: "Corporate Accounting", name: "Corporate Accounting & Taxation" },
    ],
  },
  {
    id: "mtech",
    name: "M.Tech",
    fullName: "Master of Technology",
    level: "Postgraduate",
    durationYears: 2,
    maxSemesters: 4,
    specializations: [
      { id: "CSE", name: "Computer Science & Engineering" },
      { id: "VLSI", name: "VLSI Design & Embedded Systems" },
      { id: "Power Systems", name: "Power Systems & Electrical Energy" },
      { id: "Structural", name: "Structural Engineering" },
      { id: "Thermal", name: "Thermal Engineering" },
      { id: "AI & Robotics", name: "Artificial Intelligence & Robotics" },
    ],
  },
  {
    id: "mca",
    name: "MCA",
    fullName: "Master of Computer Applications",
    level: "Postgraduate",
    durationYears: 2,
    maxSemesters: 4,
    specializations: [
      { id: "Software Engineering", name: "Software Engineering" },
      { id: "AI & Machine Learning", name: "AI & Machine Learning" },
      { id: "Cloud Technologies", name: "Cloud Technologies & Architecture" },
      { id: "Cyber Security", name: "Cyber Security & Information Assurance" },
      { id: "Full Stack Development", name: "Full Stack Web Development" },
    ],
  },
  {
    id: "mba",
    name: "MBA",
    fullName: "Master of Business Administration",
    level: "Postgraduate",
    durationYears: 2,
    maxSemesters: 4,
    specializations: [
      { id: "Finance", name: "Finance & Investment Banking" },
      { id: "Marketing", name: "Marketing & Brand Management" },
      { id: "HRM", name: "Human Resource Management" },
      { id: "Business Analytics", name: "Business Analytics & Data Science" },
      { id: "Operations & Supply Chain", name: "Operations & Supply Chain Management" },
      { id: "IT & Systems", name: "Information Technology Management" },
    ],
  },
  {
    id: "msc",
    name: "M.Sc",
    fullName: "Master of Science",
    level: "Postgraduate",
    durationYears: 2,
    maxSemesters: 4,
    specializations: [
      { id: "Computer Science", name: "Computer Science" },
      { id: "Data Science", name: "Data Science & Big Data" },
      { id: "Mathematics & Computing", name: "Mathematics & Computing" },
      { id: "Applied Statistics", name: "Applied Statistics & Informatics" },
    ],
  },
]);

export function getCourseById(courseIdOrName) {
  if (!courseIdOrName) return null;
  const target = String(courseIdOrName).trim().toLowerCase();
  return (
    COURSES.find(
      (c) =>
        c.id.toLowerCase() === target ||
        c.name.toLowerCase() === target ||
        c.fullName.toLowerCase() === target
    ) || null
  );
}

export function getMaxSemesters(courseIdOrName) {
  const course = getCourseById(courseIdOrName);
  return course ? course.maxSemesters : 8;
}

export function getSpecializations(courseIdOrName) {
  const course = getCourseById(courseIdOrName);
  return course ? course.specializations : [];
}
