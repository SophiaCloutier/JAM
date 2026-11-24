export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
const messages: Record<string, string> = {
  INVALID_ACCOUNT: 'Use a .edu email and a password of 10–128 characters.',
  ACCOUNT_TAKEN: 'This email already has an account. Sign in instead.',
  INVALID_CREDENTIALS: 'Check your email and password.',
  UNKNOWN_SESSION: 'Your session ended. Sign in again.',
  INVITATION_UNAVAILABLE: 'This invitation changed or expired. Your inbox has been refreshed.',
  INVITATION_FORBIDDEN: 'You cannot respond to this invitation.',
  FORBIDDEN: 'You do not have permission for this action.',
};
export async function api<T = Record<string, unknown>>(path: string, body: object = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Could not connect. Check your connection and try again.', 0);
  }
  const data = await response.json();
  if (!response.ok || data.error) {
    const code = typeof data.error === 'string' ? data.error : (data.error?.code ?? data.code);
    throw new ApiError(
      messages[code] ?? data.detail ?? 'We could not complete that. Check your input and try again.',
      response.status,
    );
  }
  return data as T;
}
