import { createHmac, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/crypto";

// ─── Constants ──────────────────────────────────────────────────────

const GARMIN_DOMAIN = "garmin.com";
const CLIENT_ID = "GCM_ANDROID_DARK";
const SERVICE_URL = `https://mobile.integration.${GARMIN_DOMAIN}/gcm/android`;

const SIGN_IN_URL = `https://sso.${GARMIN_DOMAIN}/mobile/sso/en/sign-in`;
const LOGIN_URL = `https://sso.${GARMIN_DOMAIN}/mobile/api/login`;
const MFA_VERIFY_URL = `https://sso.${GARMIN_DOMAIN}/mobile/api/mfa/verifyCode`;
const OAUTH_PREAUTH_URL = `https://connectapi.${GARMIN_DOMAIN}/oauth-service/oauth/preauthorized`;
const OAUTH_EXCHANGE_URL = `https://connectapi.${GARMIN_DOMAIN}/oauth-service/oauth/exchange/user/2.0`;
const OAUTH_CONSUMER_URL =
  "https://thegarth.s3.amazonaws.com/oauth_consumer.json";
const SOCIAL_PROFILE_URL = `https://connectapi.${GARMIN_DOMAIN}/userprofile-service/socialProfile`;
const ACTIVITIES_URL = `https://connectapi.${GARMIN_DOMAIN}/activitylist-service/activities/search/activities`;
const DOWNLOAD_GPX_URL = `https://connectapi.${GARMIN_DOMAIN}/download-service/export/gpx/activity`;

const TOKEN_EXPIRY_BUFFER_SECONDS = 60;
export const GARMIN_SYNC_LIMIT = 100;

const LOGIN_PARAMS = new URLSearchParams({
  clientId: CLIENT_ID,
  locale: "en-US",
  service: SERVICE_URL,
});

// Browser-like headers for the SSO mobile endpoints (avoids Cloudflare blocks)
const SSO_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Dest": "document",
};

const ANDROID_UA = "com.garmin.android.apps.connectmobile";
const IOS_UA = "GCM-iOS-5.22.1.4";

// ─── Types ──────────────────────────────────────────────────────────

export interface GarminTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  expires_at?: number;
  scope?: string;
  token_type?: string;
}

interface OAuth1Creds {
  token: string;
  tokenSecret: string;
  mfaToken?: string;
}

export interface GarminActivity {
  activityId: number;
  activityName: string;
  startTimeLocal: string;
  startTimeGMT: string;
  activityType: { typeKey: string };
  distance: number; // meters
  duration: number; // seconds
  elapsedDuration: number;
  movingDuration: number;
  elevationGain?: number;
  elevationLoss?: number;
  averageHR?: number;
  maxHR?: number;
  calories?: number;
}

// Stored in encrypted blob during MFA challenge
interface MfaSessionState {
  cookies: Record<string, string>;
  mfaMethod: string;
}

// ─── Errors ──────────────────────────────────────────────────────────

export class GarminAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GarminAuthError";
  }
}

// ─── OAuth Consumer (fetched from S3 once per process) ───────────────

let oauthConsumer: { consumer_key: string; consumer_secret: string } | null =
  null;

async function getOAuthConsumer() {
  if (!oauthConsumer) {
    const res = await fetch(OAUTH_CONSUMER_URL, { cache: "no-store" });
    if (!res.ok) throw new GarminAuthError("Failed to fetch OAuth consumer credentials");
    oauthConsumer = await res.json();
  }
  return oauthConsumer!;
}

// ─── OAuth1 Signing ───────────────────────────────────────────────────

function pct(s: string): string {
  return encodeURIComponent(s)
    .replace(/!/g, "%21")
    .replace(/'/g, "%27")
    .replace(/\*/g, "%2A");
}

function buildOAuth1Header(
  method: string,
  url: string,
  consumerKey: string,
  consumerSecret: string,
  oauthToken?: string,
  oauthTokenSecret?: string,
  extraParams?: Record<string, string>
): string {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = randomBytes(16).toString("hex");

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: timestamp,
    oauth_version: "1.0",
    ...(oauthToken ? { oauth_token: oauthToken } : {}),
  };

  // Parse URL query params — they must be included in the base string
  const urlObj = new URL(url);
  const baseUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
  const queryParams: Record<string, string> = {};
  urlObj.searchParams.forEach((v, k) => {
    queryParams[k] = v;
  });

  // Merge all params for signing: oauth + query + body
  const allParams = { ...oauthParams, ...queryParams, ...(extraParams ?? {}) };
  const sortedParamStr = Object.keys(allParams)
    .sort()
    .map((k) => `${pct(k)}=${pct(allParams[k])}`)
    .join("&");

  const baseString = `${method.toUpperCase()}&${pct(baseUrl)}&${pct(sortedParamStr)}`;
  const signingKey = `${pct(consumerSecret)}&${pct(oauthTokenSecret ?? "")}`;
  const signature = createHmac("sha1", signingKey)
    .update(baseString)
    .digest("base64");

  const headerParts = { ...oauthParams, oauth_signature: signature };
  return (
    "OAuth " +
    Object.entries(headerParts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${pct(v)}"`)
      .join(", ")
  );
}

// ─── Cookie Helpers ──────────────────────────────────────────────────

function parseCookieHeaders(values: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const header of values) {
    const [nameValue] = header.split(";");
    const eq = nameValue.indexOf("=");
    if (eq !== -1) {
      out[nameValue.slice(0, eq).trim()] = nameValue.slice(eq + 1).trim();
    }
  }
  return out;
}

function extractResponseCookies(res: Response): Record<string, string> {
  const values =
    typeof res.headers.getSetCookie === "function"
      ? res.headers.getSetCookie()
      : [];
  return parseCookieHeaders(values);
}

function cookieHeader(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

function mergeCookies(
  base: Record<string, string>,
  patch: Record<string, string>
): Record<string, string> {
  return { ...base, ...patch };
}

// ─── Login Flow ───────────────────────────────────────────────────────

export type LoginResult =
  | {
      success: true;
      tokens: GarminTokens;
      oauth1: OAuth1Creds;
      garminUserId: string;
    }
  | { requiresMfa: true; sessionState: string };

export async function initiateLogin(
  email: string,
  password: string
): Promise<LoginResult> {
  // Step 1: GET sign-in page — establishes session cookies
  const signInRes = await fetch(
    `${SIGN_IN_URL}?clientId=${CLIENT_ID}`,
    {
      headers: { ...SSO_HEADERS, "Sec-Fetch-Site": "none" },
      cache: "no-store",
      redirect: "follow",
    }
  );

  let cookies = extractResponseCookies(signInRes);

  // Step 2: POST credentials as JSON to mobile API
  const loginRes = await fetch(`${LOGIN_URL}?${LOGIN_PARAMS.toString()}`, {
    method: "POST",
    headers: {
      ...SSO_HEADERS,
      "Content-Type": "application/json",
      Cookie: cookieHeader(cookies),
    },
    body: JSON.stringify({
      username: email,
      password,
      rememberMe: false,
      captchaToken: "",
    }),
    cache: "no-store",
  });

  cookies = mergeCookies(cookies, extractResponseCookies(loginRes));

  if (!loginRes.ok) {
    throw new GarminAuthError(
      `Login request failed: ${loginRes.status} — check your credentials`
    );
  }

  const loginData = await loginRes.json();
  const respType: string = loginData?.responseStatus?.type ?? "UNKNOWN";

  if (respType === "MFA_REQUIRED") {
    const mfaMethod: string =
      loginData?.customerMfaInfo?.mfaLastMethodUsed ?? "email";
    const state: MfaSessionState = { cookies, mfaMethod };
    return {
      requiresMfa: true,
      sessionState: encrypt(JSON.stringify(state)),
    };
  }

  if (respType !== "SUCCESSFUL") {
    const msg: string =
      loginData?.responseStatus?.message || "Login failed — check your credentials";
    throw new GarminAuthError(msg);
  }

  const ticket: string | undefined = loginData.serviceTicketId;
  if (!ticket) throw new GarminAuthError("No service ticket in login response");

  const { tokens, oauth1 } = await completeOAuthFlow(ticket);
  const garminUserId = await fetchGarminUserId(tokens.access_token);
  return { success: true, tokens, oauth1, garminUserId };
}

export async function completeMfaLogin(
  sessionState: string,
  mfaCode: string
): Promise<{ tokens: GarminTokens; oauth1: OAuth1Creds; garminUserId: string }> {
  const state: MfaSessionState = JSON.parse(decrypt(sessionState));

  const mfaRes = await fetch(`${MFA_VERIFY_URL}?${LOGIN_PARAMS.toString()}`, {
    method: "POST",
    headers: {
      ...SSO_HEADERS,
      "Content-Type": "application/json",
      Cookie: cookieHeader(state.cookies),
    },
    body: JSON.stringify({
      mfaMethod: state.mfaMethod,
      mfaVerificationCode: mfaCode.trim().replace(/\s+/g, ""),
      rememberMyBrowser: false,
      reconsentList: [],
      mfaSetup: false,
    }),
    cache: "no-store",
  });

  if (!mfaRes.ok) {
    throw new GarminAuthError(`MFA request failed: ${mfaRes.status}`);
  }

  const mfaData = await mfaRes.json();
  const respType: string = mfaData?.responseStatus?.type ?? "UNKNOWN";

  if (respType !== "SUCCESSFUL") {
    const msg: string =
      mfaData?.responseStatus?.message ||
      "MFA verification failed — the code may be incorrect or expired";
    throw new GarminAuthError(msg);
  }

  const ticket: string | undefined = mfaData.serviceTicketId;
  if (!ticket) throw new GarminAuthError("No service ticket after MFA verification");

  const { tokens, oauth1 } = await completeOAuthFlow(ticket);
  const garminUserId = await fetchGarminUserId(tokens.access_token);
  return { tokens, oauth1, garminUserId };
}

// ─── OAuth Token Flow ─────────────────────────────────────────────────

async function completeOAuthFlow(
  ticket: string
): Promise<{ tokens: GarminTokens; oauth1: OAuth1Creds }> {
  const oauth1 = await getOAuth1Token(ticket);
  const tokens = await exchangeOAuth1ForOAuth2(oauth1, true);
  return { tokens, oauth1 };
}

async function getOAuth1Token(ticket: string): Promise<OAuth1Creds> {
  const consumer = await getOAuthConsumer();

  const url =
    `${OAUTH_PREAUTH_URL}?ticket=${encodeURIComponent(ticket)}` +
    `&login-url=${encodeURIComponent(SERVICE_URL)}&accepts-mfa-tokens=true`;

  const authHeader = buildOAuth1Header(
    "GET",
    url,
    consumer.consumer_key,
    consumer.consumer_secret
  );

  const res = await fetch(url, {
    headers: {
      Authorization: authHeader,
      "User-Agent": ANDROID_UA,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new GarminAuthError(
      `OAuth1 preauth failed: ${res.status} — ${body.slice(0, 200)}`
    );
  }

  const text = await res.text();
  const params = new URLSearchParams(text);

  const token = params.get("oauth_token");
  const tokenSecret = params.get("oauth_token_secret");
  if (!token || !tokenSecret) {
    throw new GarminAuthError(
      `OAuth1 token missing from response: ${text.slice(0, 200)}`
    );
  }

  return {
    token,
    tokenSecret,
    mfaToken: params.get("mfa_token") ?? undefined,
  };
}

async function exchangeOAuth1ForOAuth2(
  oauth1: OAuth1Creds,
  login: boolean
): Promise<GarminTokens> {
  const consumer = await getOAuthConsumer();

  const bodyParams: Record<string, string> = {};
  if (login) bodyParams.audience = "GARMIN_CONNECT_MOBILE_ANDROID_DI";
  if (oauth1.mfaToken) bodyParams.mfa_token = oauth1.mfaToken;

  const authHeader = buildOAuth1Header(
    "POST",
    OAUTH_EXCHANGE_URL,
    consumer.consumer_key,
    consumer.consumer_secret,
    oauth1.token,
    oauth1.tokenSecret,
    bodyParams
  );

  const res = await fetch(OAUTH_EXCHANGE_URL, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "User-Agent": ANDROID_UA,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(bodyParams).toString(),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new GarminAuthError(
      `OAuth2 exchange failed: ${res.status} — ${body.slice(0, 200)}`
    );
  }

  return res.json();
}

// ─── Token Refresh ────────────────────────────────────────────────────
// Garmin refreshes OAuth2 tokens by re-exchanging the stored OAuth1 token,
// not via the standard OAuth2 refresh_token flow.

export async function getValidAccessToken(connection: {
  id: string;
  accessToken: string;
  refreshToken: string; // stores encrypted JSON of OAuth1Creds
  tokenExpiry: number;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (connection.tokenExpiry > now + TOKEN_EXPIRY_BUFFER_SECONDS) {
    return decrypt(connection.accessToken);
  }

  const oauth1: OAuth1Creds = JSON.parse(decrypt(connection.refreshToken));
  const tokens = await exchangeOAuth1ForOAuth2(oauth1, false);
  const newExpiry = Math.floor(Date.now() / 1000) + tokens.expires_in;

  await prisma.garminConnection.update({
    where: { id: connection.id },
    data: {
      accessToken: encrypt(tokens.access_token),
      tokenExpiry: newExpiry,
    },
  });

  return tokens.access_token;
}

// ─── User Profile ─────────────────────────────────────────────────────

async function fetchGarminUserId(accessToken: string): Promise<string> {
  try {
    const res = await fetch(SOCIAL_PROFILE_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": IOS_UA,
      },
      cache: "no-store",
    });
    if (!res.ok) return `garmin_${Date.now()}`;
    const data = await res.json();
    return data.userId?.toString() ?? data.userName ?? `garmin_${Date.now()}`;
  } catch {
    return `garmin_${Date.now()}`;
  }
}

// ─── Fetch Activities ─────────────────────────────────────────────────

export async function fetchActivities(
  accessToken: string,
  start: number = 0,
  limit: number = GARMIN_SYNC_LIMIT
): Promise<GarminActivity[]> {
  const params = new URLSearchParams({
    start: start.toString(),
    limit: limit.toString(),
  });

  const res = await fetch(`${ACTIVITIES_URL}?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": IOS_UA,
      NK: "NT",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Garmin fetch activities failed: ${res.status} — ${body.slice(0, 200)}`
    );
  }

  return res.json();
}

// ─── Download Activity GPX ────────────────────────────────────────────

export async function downloadActivityGpx(
  accessToken: string,
  activityId: number
): Promise<string> {
  const res = await fetch(`${DOWNLOAD_GPX_URL}/${activityId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": IOS_UA,
      NK: "NT",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Garmin GPX download failed: ${res.status} — ${body.slice(0, 200)}`
    );
  }

  return res.text();
}

// ─── Activity Type Helpers ─────────────────────────────────────────────

const RUNNING_TYPE_KEYS = new Set([
  "running",
  "trail_running",
  "treadmill_running",
  "indoor_running",
  "track_running",
  "street_running",
  "virtual_run",
]);

export function isRunningActivity(activity: GarminActivity): boolean {
  return RUNNING_TYPE_KEYS.has(activity.activityType.typeKey.toLowerCase());
}

export function mapGarminActivityType(
  typeKey: string
): "RUN" | "TRAIL_RUN" | "TREADMILL" {
  const key = typeKey.toLowerCase();
  if (key === "trail_running") return "TRAIL_RUN";
  if (key === "treadmill_running" || key === "indoor_running") return "TREADMILL";
  return "RUN";
}
