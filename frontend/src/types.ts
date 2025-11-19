export type Weather = "Sunny" | "Hot" | "Storm";
export type CellType = "Desert" | "Village" | "Mine";

export interface SolveRequest {
  deadline: number;
  initial_cash: number;
  weight_limit_kg: number;
  start_node: number;
  end_node: number;
  prices: { water: number; food: number };
  mass: { water: number; food: number };
  refund_factor: number;
  base_income: number; // mining base daily income (￥)
  base_consumption: Record<Weather, { water: number; food: number }>;
  move_multiplier: number; // 移动消耗倍率
  mine_multiplier: number; // 挖矿消耗倍率 (total = base + (mine_multiplier-1)*base)
  allow_storm_mining: boolean;
  mines: number[];
  villages: number[];
  weather: Weather[];
}

export interface PlayerAction {
  day: number;
  buyW: number;
  buyF: number;
  mine: boolean;
}

export interface PlayerPlanPayload {
  nickname: string;
  path: number[];
  actions: PlayerAction[];
  start_buyW: number;
  start_buyF: number;
  params: SolveRequest;
}

export interface LeaderboardEntry {
  id: string;
  nickname: string;
  score: number; // ￥
  final_cash: number; // ￥
  valid: boolean;
  submitted_at: string;
}

export interface GameConfig {
  instructions: string;
  reveal_leaderboard: boolean;
  show_model_to_players: boolean;
  show_solution_to_players: boolean;
  labels: Record<number, CellType>;
  params_default: Partial<SolveRequest>;
  countdown_seconds: number;
  timer_started_at: number | null;
  timer_running: boolean;
  remaining_seconds?: number;
}

export interface SolveResponse {
  status: string;
  objective: number;
  final_cash: number;
  cash_D: number;
  refund: number;
  arrive_day: number;
  weight_peak: number;
  daily: Array<{
    day:number;
    weather:Weather;
    location:number;
    moved_from?:number;
    moved_to?:number;
    action:"MOVE"|"STAY"|"MINE";
    buyW:number;
    buyF:number;
    invW:number;
    invF:number;
    cash:number;
  }>;
  path:number[];
  purchases: {
    start: { water:number; food:number; cost:number; };
    villages: Array<{ day:number; node:number; water:number; food:number; cost:number; }>;
  };
}
