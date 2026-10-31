import { z } from "zod";

const shortText = z.string().trim().max(500).default("");

export const extractResumeSchema = z.object({
  skills: z.array(z.string().trim().min(1).max(80)).max(100).default([]),
  projects: z.array(z.object({
    title: shortText,
    description: z.string().trim().max(3000).default(""),
    techStack: z.array(z.string().trim().min(1).max(80)).max(40).default([]),
  }).strict()).max(30).default([]),
  experience: z.array(z.object({
    company: shortText,
    role: shortText,
    description: z.string().trim().max(3000).default(""),
    startDate: z.string().trim().max(40).nullable().default(null),
    endDate: z.string().trim().max(40).nullable().default(null),
  }).strict()).max(30).default([]),
  education: z.array(z.object({
    institution: shortText,
    qualification: shortText,
    field: shortText,
    graduationYear: z.union([z.number().int().min(1900).max(2200), z.string().trim().max(20)]).nullable().default(null),
  }).strict()).max(15).default([]),
}).strict();
