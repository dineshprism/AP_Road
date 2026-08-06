import crypto from "crypto";

interface CaptchaEntry {
  answerHash: string;
  expiresAt: number;
}

const CAPTCHA_TTL_MS = 5 * 60 * 1000;
const store = new Map<string, CaptchaEntry>();

function hashAnswer(captchaId: string, answer: string): string {
  return crypto.createHash("sha256").update(`${captchaId}:${answer.trim()}`).digest("hex");
}

function purgeExpiredCaptchas() {
  const now = Date.now();
  for (const [id, entry] of store) {
    if (entry.expiresAt <= now) {
      store.delete(id);
    }
  }
}

export function createCaptchaChallenge(): { captchaId: string; svg: string } {
  purgeExpiredCaptchas();

  const a = Math.floor(Math.random() * 9) + 1;
  const b = Math.floor(Math.random() * 9) + 1;
  const useAddition = Math.random() > 0.5;
  const left = useAddition ? a : Math.max(a, b);
  const right = useAddition ? b : Math.min(a, b);
  const operator = useAddition ? "+" : "-";
  const answer = useAddition ? left + right : left - right;

  const captchaId = crypto.randomUUID();
  store.set(captchaId, {
    answerHash: hashAnswer(captchaId, String(answer)),
    expiresAt: Date.now() + CAPTCHA_TTL_MS,
  });

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="52" viewBox="0 0 180 52" role="img" aria-label="CAPTCHA challenge">
  <rect width="180" height="52" fill="#f1f5f9" rx="6"/>
  <line x1="12" y1="40" x2="168" y2="8" stroke="#cbd5e1" stroke-width="1"/>
  <line x1="20" y1="10" x2="160" y2="42" stroke="#e2e8f0" stroke-width="1"/>
  <text x="90" y="32" text-anchor="middle" font-family="ui-monospace, monospace" font-size="22" font-weight="700" fill="#1e3a8a">${left} ${operator} ${right} = ?</text>
</svg>`;

  return { captchaId, svg };
}

export function verifyCaptchaAnswer(captchaId: string, answer: string): boolean {
  if (!captchaId || typeof answer !== "string" || !answer.trim()) {
    return false;
  }

  const entry = store.get(captchaId);
  store.delete(captchaId);

  if (!entry || Date.now() > entry.expiresAt) {
    return false;
  }

  return entry.answerHash === hashAnswer(captchaId, answer.trim());
}
