import type { SolveRequest, SolveResponse, Config, SolutionResponse, LatexResponse } from "./types";

export async function solve(req: SolveRequest): Promise<SolveResponse>{
  const res = await fetch("/api/solve", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify(req)
  });
  if (!res.ok) throw new Error(`Solve failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function getConfig(): Promise<Config>{
  const res = await fetch("/api/config");
  if (!res.ok) throw new Error(`Get config failed: ${res.status}`);
  return res.json();
}

export async function updateConfig(config: Partial<Config>): Promise<Config>{
  const res = await fetch("/api/config", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify(config)
  });
  if (!res.ok) throw new Error(`Update config failed: ${res.status}`);
  return res.json();
}

export async function getSolution(): Promise<SolutionResponse>{
  const res = await fetch("/api/solution");
  if (!res.ok) throw new Error(`Get solution failed: ${res.status}`);
  return res.json();
}

export async function getLatex(params?: Record<string, any>): Promise<LatexResponse>{
  const query = params ? "?" + new URLSearchParams(
    Object.entries(params).reduce((acc, [k, v]) => {
      acc[k] = typeof v === "object" ? JSON.stringify(v) : String(v);
      return acc;
    }, {} as Record<string, string>)
  ).toString() : "";
  const res = await fetch("/api/latex" + query);
  if (!res.ok) throw new Error(`Get latex failed: ${res.status}`);
  return res.json();
}
