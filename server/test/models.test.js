import { describe, expect, it } from "vitest";
import mongoose from "mongoose";
import User from "../src/models/User.js";
import StudentProfile from "../src/models/StudentProfile.js";
import RecruiterProfile from "../src/models/RecruiterProfile.js";
import Job from "../src/models/Job.js";
import Application from "../src/models/Application.js";
import Interview from "../src/models/Interview.js";
import Notification from "../src/models/Notification.js";
import AuditLog from "../src/models/AuditLog.js";

describe("CampusLink Mongoose models", () => {
  it("registers all eight required models", () => {
    expect([User, StudentProfile, RecruiterProfile, Job, Application, Interview, Notification, AuditLog])
      .toHaveLength(8);
    expect(mongoose.modelNames()).toEqual(expect.arrayContaining([
      "User", "StudentProfile", "RecruiterProfile", "Job", "Application",
      "Interview", "Notification", "AuditLog",
    ]));
  });

  it("requires a valid role and never selects passwordHash by default", () => {
    expect(User.schema.path("passwordHash").options.select).toBe(false);
    expect(User.schema.path("role").enumValues).toEqual(["student", "recruiter", "admin"]);
  });

  it("validates CGPA and integer backlog boundaries", async () => {
    const profile = new StudentProfile({
      user: new mongoose.Types.ObjectId(),
      cgpa: 10.5,
      backlogs: 1.5,
    });
    const error = profile.validateSync();
    expect(error).toBeTruthy();
    expect(error.errors.cgpa).toBeTruthy();
    expect(error.errors.backlogs).toBeTruthy();
  });

  it("enforces the application job/student unique compound index", () => {
    const indexes = Application.schema.indexes();
    expect(indexes.some(([fields, options]) => (
      fields.job === 1 && fields.student === 1 && options.unique === true
    ))).toBe(true);
  });

  it("keeps embedding documents excluded from normal selection", () => {
    expect(StudentProfile.schema.path("embeddings").options.select).toBe(false);
    expect(Job.schema.path("embeddings").options.select).toBe(false);
  });
});
