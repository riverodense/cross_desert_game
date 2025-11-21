// Centralized API with optional controller auth header
export type HttpMethod = "GET" | "POST";

const API_BASE = ""; // same-origin

function controllerToken(): string | null {
  try {
    return localStorage.getItem("controller_token");
  } catch {
    return null;
  }
}

async function req(path: string, method: HttpMethod = "GET", body?: any, withControllerAuth: boolean = false) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (withControllerAuth) {
    const token = controllerToken();
    if (token) headers["X-Controller-Token"] = token;
  }
  const resp = await fetch(API_BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`HTTP ${resp.status}: ${text || resp.statusText}`);
  }
  return resp.json();
}

// Backend endpoints
export const getAdjacency = () => req("/api/adjacency", "GET");
export const getConfig = () => req("/api/config/get", "GET");
export const updateConfig = (payload: any) => req("/api/config/update", "POST", payload, true);

export const startTimer = (seconds: number) => req("/api/timer/start", "POST", { seconds }, true);
export const pauseTimer = () => req("/api/timer/pause", "POST", undefined, true);
export const resetTimer = (seconds: number) => req("/api/timer/reset", "POST", { seconds }, true);

export const getModel = (payload: any) => req("/api/model", "POST", payload);
export const solve = (payload: any) => req("/api/solve", "POST", payload, true);

export const fetchLeaderboard = () => req("/api/leaderboard", "GET");
export const startSession = () => req("/api/play/start", "POST");
export const evaluatePlan = (payload: any) => req("/api/play/evaluate", "POST", payload);
export const submitPlan = (payload: any) => req("/api/play/submit", "POST", payload);

// Access control API
export const controllerCheck = () => req("/api/controller/access/check", "POST", {}, true);
export const controllerList = () => req("/api/controller/access/list", "POST", {}, true);
export const controllerAdd = (token: string) => req("/api/controller/access/add", "POST", { token }, true);
export const controllerRemove = (token: string) => req("/api/controller/access/remove", "POST", { token }, true);
export const controllerSetLock = (lock: boolean) => req("/api/controller/access/lock", "POST", { lock }, true);