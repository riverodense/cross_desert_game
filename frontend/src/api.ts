<<<<<<< HEAD
import type { SolveRequest, SolveResponse, OptimalSolution } from "./types";
=======
import type { SolveRequest, SolveResponse, Config } from "./types";
>>>>>>> origin/copilot/implement-polish-updates-gameplay

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

<<<<<<< HEAD
export async function getSolution(): Promise<OptimalSolution | null>{
  try {
    const res = await fetch("/api/solution");
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
=======
export async function getAdjacency(): Promise<Record<number, number[]>>{
  const res = await fetch("/api/adjacency");
  if (!res.ok) throw new Error(`Get adjacency failed: ${res.status}`);
  const data = await res.json();
  // Convert string keys to numbers
  const adj: Record<number, number[]> = {};
  for (const [k, v] of Object.entries(data)) {
    adj[parseInt(k)] = v as number[];
  }
  return adj;
}

export async function getConfig(): Promise<Config>{
  const res = await fetch("/api/config/get");
  if (!res.ok) throw new Error(`Get config failed: ${res.status}`);
  return res.json();
}

export async function updateConfig(updates: Partial<Config>): Promise<Config>{
  const res = await fetch("/api/config/update", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify(updates)
  });
  if (!res.ok) throw new Error(`Update config failed: ${res.status}`);
  const data = await res.json();
  return data.config;
>>>>>>> origin/copilot/implement-polish-updates-gameplay
}
