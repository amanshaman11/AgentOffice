/**
 * Backend base URL. Override locally by adding to `frontend/.env.local`:
 *   NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
 */
export const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

export const GEMINI_MODEL_LABEL =
  process.env.NEXT_PUBLIC_GEMINI_MODEL ?? "gemini-2.5-flash";
