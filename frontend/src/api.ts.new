import type { SolveRequest, SolveResponse, OptimalSolution } from "./types";

export async function solve(req: SolveRequest): Promise<SolveResponse>{
  const res = await fetch("/api/solve", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
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
