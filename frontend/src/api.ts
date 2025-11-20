import type { SolveRequest, SolveResponse, OptimalSolution } from "./types";

const BASE = "";

// Helper to get controller token from localStorage
export function getToken(): string | null {
  return localStorage.getItem("controller_token");
}

export function setToken(token: string) {
  localStorage.setItem("controller_token", token);
}

export function clearToken() {
  localStorage.removeItem("controller_token");
}

// Helper to add auth header
function authHeaders(token?: string): HeadersInit {
  const headers: HeadersInit = {"Content-Type": "application/json"};
  const authToken = token || getToken();
  if (authToken) {
    headers["X-Controller-Token"] = authToken;
  }
  return headers;
}

export async function solve(req: SolveRequest): Promise<SolveResponse>{
  const res = await fetch(`${BASE}/api/solve`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(req)
  });
  if (!res.ok) throw new Error(`Solve failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function getSolution(): Promise<OptimalSolution> {
  const res = await fetch(`${BASE}/api/solution`);
  if (!res.ok) {
    if (res.status === 403 || res.status === 404) {
      throw new Error("Solution not available");
    }
    throw new Error(`Get solution failed: ${res.status}`);
  }
  return res.json();
}

export async function getConfig(): Promise<{show_solution_to_players: boolean}> {
  const res = await fetch(`${BASE}/api/config/get`);
  if (!res.ok) throw new Error(`Get config failed: ${res.status}`);
  return res.json();
}

export async function updateConfig(updates: {show_solution_to_players?: boolean}): Promise<void> {
  const res = await fetch(`${BASE}/api/config/update`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(updates)
  });
  if (!res.ok) throw new Error(`Update config failed: ${res.status}`);
}

export async function getAdjacency(): Promise<Record<number, number[]>> {
  const res = await fetch(`${BASE}/api/adjacency`);
  if (!res.ok) throw new Error(`Get adjacency failed: ${res.status}`);
  return res.json();
}

// Access control endpoints
export async function initController(): Promise<{master_token: string; message: string}> {
  const res = await fetch(`${BASE}/api/controller/access/init`, {
    method: "POST",
    headers: {"Content-Type": "application/json"}
  });
  if (!res.ok) throw new Error(`Init failed: ${res.status}`);
  return res.json();
}

export async function checkToken(token: string): Promise<{authorized: boolean; master: boolean; locked: boolean}> {
  const res = await fetch(`${BASE}/api/controller/access/check`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({token})
  });
  if (!res.ok) throw new Error(`Check token failed: ${res.status}`);
  return res.json();
}

export async function listTokens(): Promise<{master_token: string; tokens: string[]; lock: boolean}> {
  const res = await fetch(`${BASE}/api/controller/access/list`, {
    method: "POST",
    headers: authHeaders()
  });
  if (!res.ok) throw new Error(`List tokens failed: ${res.status}`);
  return res.json();
}

export async function addToken(newToken?: string): Promise<{success: boolean; token: string}> {
  const res = await fetch(`${BASE}/api/controller/access/add`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({new_token: newToken})
  });
  if (!res.ok) throw new Error(`Add token failed: ${res.status}`);
  return res.json();
}

export async function removeToken(tokenToRemove: string): Promise<{success: boolean}> {
  const res = await fetch(`${BASE}/api/controller/access/remove`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({token_to_remove: tokenToRemove})
  });
  if (!res.ok) throw new Error(`Remove token failed: ${res.status}`);
  return res.json();
}

export async function setLock(lock: boolean): Promise<{success: boolean; locked: boolean}> {
  const res = await fetch(`${BASE}/api/controller/access/lock`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({lock})
  });
  if (!res.ok) throw new Error(`Set lock failed: ${res.status}`);
  return res.json();
}
