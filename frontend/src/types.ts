export type Weather = "Sunny" | "Hot" | "Storm";
export type CellType = "Desert" | "Village" | "Mine";

export interface DayWeather { day:number; weather:Weather; }

export interface SolveRequest {
  deadline: number;
  initial_cash: number;
  weight_limit_kg: number;
  start_node: number;
  end_node: number;
  prices: { water:number; food:number; };
  mass: { water:number; food:number; };
  refund_factor: number;
  base_consumption: Record<Weather, { water:number; food:number }>;
  move_multiplier: number;
  mine_multiplier: number;
  allow_storm_mining: boolean;
  mines: number[];
  villages: number[];
  weather: Weather[];
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
    mine?:boolean;
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
  generated_at?: string;
}

export interface OptimalSolution {
  status: string;
  objective: number;
  final_cash: number;
  arrive_day: number;
  path: number[];
  daily: Array<{
    day:number;
    weather:Weather;
    location:number;
    action:"MOVE"|"STAY"|"MINE";
    mine:boolean;
    buyW:number;
    buyF:number;
    invW:number;
    invF:number;
    cash:number;
  }>;
  purchases: {
    start: { water:number; food:number; cost:number; };
    villages: Array<{ day:number; node:number; water:number; food:number; cost:number; }>;
  };
  generated_at: string;
}
