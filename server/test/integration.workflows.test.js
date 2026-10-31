import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import request from "supertest";
import app from "../src/app.js";
import { User, StudentProfile, RecruiterProfile, Job, Application, Interview, Notification, AuditLog } from "../src/models/index.js";
import { shutdownWorkerPools } from "../src/workers/pool.js";

const testMongoUri = process.env.CAMPUSLINK_TEST_MONGODB_URI;
const integration = describe.skipIf(!testMongoUri);

function assertDedicatedTestDatabase(uri) {
  const match = String(uri).match(/\/([^/?]+)(?:\?|$)/);
  const databaseName = match?.[1] ?? "";
  if (!databaseName.toLowerCase().includes("test")) {
    throw new Error("CAMPUSLINK_TEST_MONGODB_URI must target a database whose name contains 'test'; this suite deletes test collections.");
  }
}

async function clearTestCollections() {
  await Promise.all([
    Application.deleteMany({}),
    Interview.deleteMany({}),
    Notification.deleteMany({}),
    AuditLog.deleteMany({}),
    Job.deleteMany({}),
    StudentProfile.deleteMany({}),
    RecruiterProfile.deleteMany({}),
    User.deleteMany({}),
  ]);
}

async function register(role, email, extra = {}) {
  const response = await request(app).post("/api/auth/register").send({
    name: `${role} integration user`,
    email,
    password: "integration-password-123",
    role,
    ...extra,
  });
  expect(response.status).toBe(201);
  return response.body.data;
}

async function activateRecruiter(recruiterId) {
  await User.updateOne({ _id: recruiterId }, { $set: { status: "active" } });
}

integration("Phase 9 Supertest integration — auth, RBAC, application and transitions", () => {
  beforeAll(async () => {
    assertDedicatedTestDatabase(testMongoUri);
    await mongoose.connect(testMongoUri, { serverSelectionTimeoutMS: 10000 });
  });

  beforeEach(async () => {
    await clearTestCollections();
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    await shutdownWorkerPools();
  });

  it("registers student and recruiter, issues tokens, and enforces student-only access", async () => {
    const student = await register("student", "student.one@example.com");
    const recruiter = await register("recruiter", "recruiter.one@example.com", {
      company: "Integration Labs",
      designation: "Campus Recruiter",
      website: "https://example.com",
    });

    expect(student.user.role).toBe("student");
    expect(student.user.status).toBe("active");
    expect(recruiter.user.role).toBe("recruiter");
    expect(recruiter.user.status).toBe("pending");
    expect(await StudentProfile.exists({ user: student.user.id })).toBeTruthy();
    expect(await RecruiterProfile.exists({ user: recruiter.user.id })).toBeTruthy();

    const me = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${student.token}`);
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe("student.one@example.com");

    const ownProfile = await request(app)
      .get("/api/students/me")
      .set("Authorization", `Bearer ${student.token}`);
    expect(ownProfile.status).toBe(200);

    const wrongRole = await request(app)
      .get("/api/students/me")
      .set("Authorization", `Bearer ${recruiter.token}`);
    expect(wrongRole.status).toBe(403);
  });

  it("applies once, blocks duplicate and cross-owner reads, and enforces status transitions", async () => {
    const student = await register("student", "candidate@example.com");
    const recruiter = await register("recruiter", "owner@example.com", { company: "Owner Co", designation: "Recruiter" });
    const otherRecruiter = await register("recruiter", "other@example.com", { company: "Other Co", designation: "Recruiter" });
    await activateRecruiter(recruiter.user.id);
    await activateRecruiter(otherRecruiter.user.id);

    await StudentProfile.updateOne({ user: student.user.id }, {
      $set: {
        rollNo: "TEST0001",
        branch: "CSE",
        cgpa: 8.1,
        gradYear: 2026,
        backlogs: 0,
        skills: ["JavaScript", "React", "Node.js", "MongoDB"],
        projects: [{ title: "Integration API", description: "Built a REST API using Node.js, Express and MongoDB.", techStack: ["Node.js", "Express", "MongoDB"] }],
        "resume.parseStatus": "none",
      },
    });

    const job = await Job.create({
      recruiter: recruiter.user.id,
      company: "Owner Co",
      title: "Integration Software Engineer",
      description: "Build a JavaScript and Node.js application with React, MongoDB and REST APIs.",
      location: "Remote, India",
      type: "full_time",
      requiredSkills: ["JavaScript", "Node.js", "React", "MongoDB"],
      eligibility: { branches: ["CSE"], minCgpa: 7, gradYear: 2026, maxBacklogs: 0 },
      status: "open",
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    const ineligibleJob = await Job.create({
      recruiter: recruiter.user.id,
      company: "Owner Co",
      title: "ECE-only Integration Role",
      description: "An integration-test role restricted to Electronics students.",
      location: "Remote, India",
      type: "full_time",
      requiredSkills: ["C++"],
      eligibility: { branches: ["ECE"], minCgpa: 6, gradYear: 2026, maxBacklogs: 2 },
      status: "open",
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    const ineligibleAttempt = await request(app)
      .post(`/api/jobs/${ineligibleJob._id}/apply`)
      .set("Authorization", `Bearer ${student.token}`)
      .send({});
    expect(ineligibleAttempt.status).toBe(422);
    expect(ineligibleAttempt.body.error.code).toBe("APPLICATION_INELIGIBLE");
    expect(ineligibleAttempt.body.error.details.failures).toHaveLength(1);

    const applied = await request(app)
      .post(`/api/jobs/${job._id}/apply`)
      .set("Authorization", `Bearer ${student.token}`)
      .send({});
    expect(applied.status).toBe(201);
    const applicationId = applied.body.data.application._id;
    expect(applied.body.data.application.status).toBe("applied");

    const duplicate = await request(app)
      .post(`/api/jobs/${job._id}/apply`)
      .set("Authorization", `Bearer ${student.token}`)
      .send({});
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("DUPLICATE_APPLICATION");

    const ownerList = await request(app)
      .get(`/api/jobs/${job._id}/applications`)
      .set("Authorization", `Bearer ${recruiter.token}`);
    expect(ownerList.status).toBe(200);
    expect(ownerList.body.data).toHaveLength(1);

    const crossOwner = await request(app)
      .get(`/api/jobs/${job._id}/applications`)
      .set("Authorization", `Bearer ${otherRecruiter.token}`);
    expect(crossOwner.status).toBe(403);

    const shortlisted = await request(app)
      .patch(`/api/applications/${applicationId}/status`)
      .set("Authorization", `Bearer ${recruiter.token}`)
      .send({ status: "shortlisted", note: "Integration test shortlist." });
    expect(shortlisted.status).toBe(200);
    expect(shortlisted.body.data.application.status).toBe("shortlisted");

    const invalidTransition = await request(app)
      .patch(`/api/applications/${applicationId}/status`)
      .set("Authorization", `Bearer ${recruiter.token}`)
      .send({ status: "selected", note: "This must be rejected from shortlisted." });
    expect(invalidTransition.status).toBe(409);
    expect(invalidTransition.body.error.code).toBe("INVALID_APPLICATION_STATUS_TRANSITION");

    const saved = await Application.findById(applicationId).lean();
    expect(saved.status).toBe("shortlisted");
    expect(saved.statusHistory.map((item) => item.to)).toEqual(["applied", "shortlisted"]);
  });
});
