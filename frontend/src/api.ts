import type { SolveRequest, SolveResponse, OptimalSolution } from "./types";

// Token management
export function getToken(): string | null {
  return localStorage.getItem("controller_token");
}

export function setToken(token: string) {
  localStorage.setItem("controller_token", token);
}

export function clearToken() {
  localStorage.removeItem("controller_token");
}

function getHeaders(includeToken: boolean = false): HeadersInit {
  const headers: HeadersInit = {"Content-Type": "application/json"};
  if (includeToken) {
    const token = getToken();
    if (token) {
      headers["X-Controller-Token"] = token;
    }
  }
  return headers;
}

export async function solve(req: SolveRequest): Promise<SolveResponse>{
  const res = await fetch("/api/solve", {
    method: "POST",
    headers: getHeaders(true),
    body: JSON.stringify(req)
  });
  if (!res.ok) throw new Error(`Solve failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function getSolution(): Promise<OptimalSolution> {
  const res = await fetch("/api/solution");
  if (!res.ok) {
    if (res.status === 403) {
      throw new Error("Solution not revealed to players");
    }
    throw new Error(`Failed to get solution: ${res.status}`);
  }
  return res.json();
}

export async function getConfig() {
  const res = await fetch("/api/config");
  if (!res.ok) throw new Error(`Failed to get config: ${res.status}`);
  return res.json();
}

export async function updateConfig(data: any) {
  const res = await fetch("/api/config/update", {
    method: "POST",
    headers: getHeaders(true),
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(`Failed to update config: ${res.status}`);
  return res.json();
}

export async function getAdjacency() {
  const res = await fetch("/api/adjacency");
  if (!res.ok) throw new Error(`Failed to get adjacency: ${res.status}`);
  return res.json();
}

// Access control API
export async function initAccess() {
  const res = await fetch("/api/controller/access/init", {
    method: "POST",
    headers: {"Content-Type": "application/json"}
  });
  if (!res.ok) throw new Error(`Failed to init access: ${res.status}`);
  return res.json();
}

export async function checkToken(token: string) {
  const res = await fetch("/api/controller/access/check", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({token})
  });
  if (!res.ok) throw new Error(`Failed to check token: ${res.status}`);
  return res.json();
}

export async function listTokens() {
  const res = await fetch("/api/controller/access/list", {
    method: "POST",
    headers: getHeaders(true)
  });
  if (!res.ok) throw new Error(`Failed to list tokens: ${res.status}`);
  return res.json();
}

export async function addToken(token: string) {
  const res = await fetch("/api/controller/access/add", {
    method: "POST",
    headers: getHeaders(true),
    body: JSON.stringify({token})
  });
  if (!res.ok) throw new Error(`Failed to add token: ${res.status}`);
  return res.json();
}

export async function removeToken(token: string) {
  const res = await fetch("/api/controller/access/remove", {
    method: "POST",
    headers: getHeaders(true),
    body: JSON.stringify({token})
  });
  if (!res.ok) throw new Error(`Failed to remove token: ${res.status}`);
  return res.json();
}

export async function setLock(lock: boolean) {
  const res = await fetch("/api/controller/access/lock", {
    method: "POST",
    headers: getHeaders(true),
    body: JSON.stringify({lock})
  });
  if (!res.ok) throw new Error(`Failed to set lock: ${res.status}`);
  return res.json();
}
