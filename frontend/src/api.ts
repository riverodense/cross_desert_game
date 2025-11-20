import type { SolveRequest, SolveResponse, OptimalSolution } from "./types";

// Token management
const TOKEN_KEY = "controller_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function getHeaders(): HeadersInit {
  const headers: HeadersInit = {"Content-Type": "application/json"};
  const token = getToken();
  if (token) {
    headers["X-Controller-Token"] = token;
  }
  return headers;
}

// Access control API
export async function initAccess(): Promise<{master_token: string; initialized: boolean}> {
  const res = await fetch("/api/controller/access/init");
  if (!res.ok) throw new Error(`Init failed: ${res.status}`);
  return res.json();
}

export async function checkToken(token: string): Promise<{authorized: boolean; is_master: boolean}> {
  const res = await fetch("/api/controller/access/check", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({token})
  });
  if (!res.ok) throw new Error(`Check failed: ${res.status}`);
  return res.json();
}

export async function listTokens(): Promise<{master_token: string | null; tokens: string[]; lock: boolean; is_master: boolean}> {
  const res = await fetch("/api/controller/access/list", {
    method: "POST",
    headers: getHeaders(),
    body: "{}"
  });
  if (!res.ok) throw new Error(`List failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function addToken(newToken: string): Promise<{success: boolean; tokens: string[]}> {
  const res = await fetch("/api/controller/access/add", {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({new_token: newToken})
  });
  if (!res.ok) throw new Error(`Add failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function removeToken(tokenToRemove: string): Promise<{success: boolean; tokens: string[]}> {
  const res = await fetch("/api/controller/access/remove", {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({token_to_remove: tokenToRemove})
  });
  if (!res.ok) throw new Error(`Remove failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function setLock(lock: boolean): Promise<{success: boolean; lock: boolean}> {
  const res = await fetch("/api/controller/access/lock", {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({lock})
  });
  if (!res.ok) throw new Error(`Lock failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// Existing solve endpoint - now with auth
export async function solve(req: SolveRequest): Promise<SolveResponse>{
  const res = await fetch("/api/solve", {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(req)
  });
  if (!res.ok) throw new Error(`Solve failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function getSolution(): Promise<OptimalSolution | null>{
  try {
    const res = await fetch("/api/solution");
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
