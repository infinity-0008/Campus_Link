import { registerAccount, loginAccount, getCurrentAccount } from "./auth.service.js";

export async function register(request, response) {
  const result = await registerAccount(request.validated.body);
  return response.status(201).json({ success: true, data: result });
}

export async function login(request, response) {
  const result = await loginAccount(request.validated.body);
  return response.status(200).json({ success: true, data: result });
}

export function me(request, response) {
  return response.status(200).json({
    success: true,
    data: { user: getCurrentAccount(request.user) },
  });
}
