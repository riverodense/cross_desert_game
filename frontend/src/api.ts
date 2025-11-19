import type { SolveRequest, SolveResponse, Config } from "./types";

export async function solve(req: SolveRequest): Promise<SolveResponse>{
  const res = await fetch("/api/solve", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify(req)
  });
  if (!res.ok) throw new Error(`Solve failed: ${res.status} ${await res.text()}`);
  return res.json();
}

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
}
