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
  base_consumption: Record<Weather, { water: number; food: number }>;
  move_multiplier: number;
  mine_multiplier: number;
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
  score: number;
  final_cash: number;
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