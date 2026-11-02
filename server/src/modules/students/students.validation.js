import { z } from "zod";
import { getMaxSemesters } from "../../config/courses.js";

const nullableText = (maximum) => z.string().trim().max(maximum).nullable().optional();
const projectSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(5000).default(""),
  techStack: z.array(z.string().trim().min(1).max(80)).max(40).default([]),
}).strict();
const experienceSchema = z.object({
  company: z.string().trim().min(1).max(160),
  role: z.string().trim().min(1).max(160),
  description: z.string().trim().max(5000).default(""),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
}).strict().refine((entry) => !entry.startDate || !entry.endDate || entry.endDate >= entry.startDate, {
  message: "endDate must be on or after startDate.",
  path: ["endDate"],
});

export const updateStudentProfileSchema = z.object({
  body: z.object({
    rollNo: nullableText(40),
    course: nullableText(80),
    specialization: nullableText(120),
    branch: nullableText(80),
    cgpa: z.number().min(0).max(10).nullable().optional(),
    cgpaSemester: z.number().int().min(1).max(12).nullable().optional(),
    gradYear: z.number().int().min(1900).max(2200).nullable().optional(),
    backlogs: z.number().int().min(0).optional(),
    phone: nullableText(30),
    skills: z.array(z.string().trim().min(1).max(80)).max(100).optional(),
    projects: z.array(projectSchema).max(50).optional(),
    experience: z.array(experienceSchema).max(50).optional(),
  }).strict()
    .refine((body) => Object.keys(body).length > 0, {
      message: "Provide at least one profile field to update.",
    })
    .refine(
      (body) => {
        if (body.cgpaSemester && body.course) {
          const max = getMaxSemesters(body.course);
          return body.cgpaSemester <= max;
        }
        return true;
      },
      {
        message: "Evaluated semester exceeds the maximum semesters allowed for the selected course.",
        path: ["cgpaSemester"],
      }
    ),
});
