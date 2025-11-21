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

// Solution API
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
    const res = await fetch("/api/solution", {
      headers: getHeaders()
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// Config API
export async function getConfig(): Promise<any> {
  const res = await fetch("/api/config/get");
  if (!res.ok) throw new Error(`Config failed: ${res.status}`);
  return res.json();
}

export async function updateConfig(data: any): Promise<any> {
  const res = await fetch("/api/config/update", {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error(`Update failed: ${res.status}`);
  return res.json();
}

// Adjacency API
export async function getAdjacency(): Promise<Record<number, number[]>> {
  const res = await fetch("/api/adjacency");
  if (!res.ok) throw new Error(`Adjacency failed: ${res.status}`);
  return res.json();
}
