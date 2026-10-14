/**
 * Microsoft → Xbox Live → XSTS → Minecraft token chain. Pure HTTP (no Electron) so it can be tested with stubs.
 * The interactive login window lives in `msa-window.ts`.
 *
 * NOTE: a new Azure app ID must be approved by Mojang before api.minecraftservices.com accepts its tokens.
 * Configure it with LIFEA_MSA_CLIENT_ID (baked in at build time by CI, or set at runtime).
 */
import { createHash, randomBytes } from 'node:crypto';
import { getJson, HttpError, postJson, request } from '../core/http';
import { BUILD_MSA_CLIENT_ID } from '../core/build-info';

export const MSA = {
  authorize: 'https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize',
  token: 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token',
  redirect: 'https://login.microsoftonline.com/common/oauth2/nativeclient',
  scope: 'XboxLive.signin offline_access',
};

export function msaClientId(): string {
  return process.env.LIFEA_MSA_CLIENT_ID || BUILD_MSA_CLIENT_ID;
}

export function pkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(48).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

export function authorizeUrl(clientId: string, challenge: string, state: string): string {
  const u = new URL(MSA.authorize);
  u.search = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: MSA.redirect,
    scope: MSA.scope,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
    state,
  }).toString();
  return u.toString();
}

export interface MsaTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

async function tokenRequest(params: Record<string, string>): Promise<MsaTokens> {
  const res = await request(MSA.token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams(params).toString(),
  });
  const j = (await res.json()) as { access_token: string; refresh_token: string; expires_in: number };
  return { accessToken: j.access_token, refreshToken: j.refresh_token, expiresAt: Date.now() + j.expires_in * 1000 };
}

export function exchangeCode(clientId: string, code: string, verifier: string): Promise<MsaTokens> {
  return tokenRequest({ client_id: clientId, grant_type: 'authorization_code', code, redirect_uri: MSA.redirect, code_verifier: verifier, scope: MSA.scope });
}

export function refreshMsa(clientId: string, refreshToken: string): Promise<MsaTokens> {
  return tokenRequest({ client_id: clientId, grant_type: 'refresh_token', refresh_token: refreshToken, scope: MSA.scope });
}

const XERR: Record<string, string> = {
  '2148916233': 'This Microsoft account has no Xbox profile. Sign in once at xbox.com, then try again.',
  '2148916235': 'Xbox Live is not available in your country.',
  '2148916236': 'This account needs adult verification on xbox.com (South Korea).',
  '2148916237': 'This account needs adult verification on xbox.com (South Korea).',
  '2148916238': 'This is a child account. An adult must add it to a Microsoft family first.',
};

export interface MinecraftSession {
  accessToken: string;
  expiresAt: number;
  uuid: string;
  username: string;
  skinUrl?: string;
  skinVariant?: 'classic' | 'slim';
  capeUrl?: string;
}

interface McProfile {
  id: string;
  name: string;
  skins?: { url: string; variant: string; state: string }[];
  capes?: { url: string; state: string }[];
}

export function dashUuid(id: string): string {
  const h = id.replace(/-/g, '');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function profileToSession(token: { accessToken: string; expiresAt: number }, p: McProfile): MinecraftSession {
  const skin = p.skins?.find((s) => s.state === 'ACTIVE') ?? p.skins?.[0];
  const cape = p.capes?.find((c) => c.state === 'ACTIVE');
  return {
    accessToken: token.accessToken,
    expiresAt: token.expiresAt,
    uuid: dashUuid(p.id),
    username: p.name,
    skinUrl: skin?.url,
    skinVariant: skin?.variant?.toLowerCase() === 'slim' ? 'slim' : 'classic',
    capeUrl: cape?.url,
  };
}

export async function minecraftLogin(msaAccessToken: string): Promise<MinecraftSession> {
  const xbl = await postJson<{ Token: string; DisplayClaims: { xui: { uhs: string }[] } }>('https://user.auth.xboxlive.com/user/authenticate', {
    Properties: { AuthMethod: 'RPS', SiteName: 'user.auth.xboxlive.com', RpsTicket: `d=${msaAccessToken}` },
    RelyingParty: 'http://auth.xboxlive.com',
    TokenType: 'JWT',
  });
  let xsts: { Token: string; DisplayClaims: { xui: { uhs: string }[] } };
  try {
    xsts = await postJson('https://xsts.auth.xboxlive.com/xsts/authorize', {
      Properties: { SandboxId: 'RETAIL', UserTokens: [xbl.Token] },
      RelyingParty: 'rp://api.minecraftservices.com/',
      TokenType: 'JWT',
    });
  } catch (e) {
    if (e instanceof HttpError && e.status === 401) {
      const code = e.body.match(/"XErr"\s*:\s*(\d+)/)?.[1];
      throw new Error(code && XERR[code] ? XERR[code] : 'Xbox Live refused this account.');
    }
    throw e;
  }
  const uhs = xsts.DisplayClaims.xui[0].uhs;
  let mc: { access_token: string; expires_in: number };
  try {
    mc = await postJson('https://api.minecraftservices.com/authentication/login_with_xbox', { identityToken: `XBL3.0 x=${uhs};${xsts.Token}` });
  } catch (e) {
    if (e instanceof HttpError && (e.status === 403 || e.status === 401)) {
      throw new Error('Minecraft services rejected this launcher. Its Azure app ID has not been approved by Mojang yet — use an offline account until it is.');
    }
    throw e;
  }
  const token = { accessToken: mc.access_token, expiresAt: Date.now() + mc.expires_in * 1000 };
  const auth = { Authorization: `Bearer ${token.accessToken}` };
  const ent = await getJson<{ items: { name: string }[] }>('https://api.minecraftservices.com/entitlements/mcstore', { headers: auth });
  if (!ent.items?.length) throw new Error('This Microsoft account does not own Minecraft: Java Edition.');
  try {
    const profile = await getJson<McProfile>('https://api.minecraftservices.com/minecraft/profile', { headers: auth });
    return profileToSession(token, profile);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) throw new Error('This account owns Minecraft but has no profile yet. Open the official launcher once to pick a name.');
    throw e;
  }
}

export async function uploadSkin(accessToken: string, png: Buffer, variant: 'classic' | 'slim'): Promise<McProfile> {
  const form = new FormData();
  form.append('variant', variant);
  form.append('file', new Blob([new Uint8Array(png)], { type: 'image/png' }), 'skin.png');
  const res = await request('https://api.minecraftservices.com/minecraft/profile/skins', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });
  return (await res.json()) as McProfile;
}
