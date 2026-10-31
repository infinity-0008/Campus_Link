import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { env } from "../../config/env.js";
import { USER_ROLES, USER_STATUSES } from "../../config/constants.js";
import User from "../../models/User.js";
import StudentProfile from "../../models/StudentProfile.js";
import RecruiterProfile from "../../models/RecruiterProfile.js";
import { ApiError } from "../../utils/ApiError.js";
import { logger } from "../../utils/logger.js";

const BCRYPT_COST = 10;

function toPublicUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    lastLoginAt: user.lastLoginAt ?? null,
    createdAt: user.createdAt,
  };
}

function issueAccessToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), role: user.role },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN },
  );
}

function mapDuplicateEmail(error) {
  if (error?.code === 11000 && (error.keyPattern?.email || error.keyValue?.email)) {
    return new ApiError(409, "EMAIL_ALREADY_REGISTERED", "An account with this email address already exists.");
  }
  return error;
}

export async function registerAccount(input) {
  let createdUser;

  try {
    const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);
    createdUser = await User.create({
      name: input.name,
      email: input.email,
      passwordHash,
      role: input.role,
      status: input.role === USER_ROLES.RECRUITER ? USER_STATUSES.PENDING : USER_STATUSES.ACTIVE,
    });

    if (input.role === USER_ROLES.STUDENT) {
      await StudentProfile.create({ user: createdUser._id });
    } else if (input.role === USER_ROLES.RECRUITER) {
      await RecruiterProfile.create({
        user: createdUser._id,
        company: input.company,
        designation: input.designation,
        website: input.website,
      });
    }

    const token = issueAccessToken(createdUser);
    return { user: toPublicUser(createdUser), token };
  } catch (error) {
    // Keep user/profile creation consistent even when the second write fails.
    // Atlas supports transactions, but this compensating cleanup also works in
    // standalone local MongoDB development environments.
    if (createdUser?._id) {
      await Promise.all([
        StudentProfile.deleteOne({ user: createdUser._id }).catch(() => undefined),
        RecruiterProfile.deleteOne({ user: createdUser._id }).catch(() => undefined),
        User.deleteOne({ _id: createdUser._id }).catch((cleanupError) => {
          logger.error({ err: cleanupError, userId: createdUser._id.toString() }, "Failed to roll back incomplete registration.");
        }),
      ]);
    }
    throw mapDuplicateEmail(error);
  }
}

export async function loginAccount(input) {
  const user = await User.findOne({ email: input.email }).select("+passwordHash");
  if (!user) {
    throw new ApiError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
  }

  const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);
  if (!passwordMatches) {
    throw new ApiError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
  }

  if (user.status === USER_STATUSES.SUSPENDED) {
    throw new ApiError(403, "ACCOUNT_SUSPENDED", "This account has been suspended. Contact the placement administrator.");
  }

  if (input.role && input.role !== user.role) {
    throw new ApiError(403, "ROLE_MISMATCH", "The selected account type does not match this account.");
  }

  user.lastLoginAt = new Date();
  await user.save();

  return {
    user: toPublicUser(user),
    token: issueAccessToken(user),
  };
}

export function getCurrentAccount(user) {
  return toPublicUser(user);
}

export async function loadAccountFromToken(token) {
  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch {
    throw new ApiError(401, "INVALID_TOKEN", "The access token is invalid or expired.");
  }

  if (!payload || typeof payload !== "object" || typeof payload.sub !== "string") {
    throw new ApiError(401, "INVALID_TOKEN", "The access token payload is invalid.");
  }

  if (!mongoose.isValidObjectId(payload.sub)) {
    throw new ApiError(401, "INVALID_TOKEN", "The access token subject is invalid.");
  }

  const user = await User.findById(payload.sub);
  if (!user) {
    throw new ApiError(401, "ACCOUNT_NOT_FOUND", "The account associated with this token no longer exists.");
  }
  if (user.status === USER_STATUSES.SUSPENDED) {
    throw new ApiError(403, "ACCOUNT_SUSPENDED", "This account has been suspended.");
  }

  // Authorization uses the role loaded from MongoDB, not the role claim supplied
  // by the client or the value selected on the login screen.
  return user;
}
