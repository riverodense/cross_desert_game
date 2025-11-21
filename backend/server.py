from __future__ import annotations
from flask import Flask, request, jsonify
from flask_cors import CORS
from pathlib import Path
import json, pulp, traceback, uuid, threading, time, secrets
from typing import List, Dict, Any

app = Flask(__name__)
CORS(app)

ROOT = Path(__file__).resolve().parents[1]
LEADERBOARD_PATH = ROOT / "leaderboard.json"
CONFIG_PATH = ROOT / "game_config.json"

def ensure_file(path: Path, default: str):
    if not path.exists():
        path.write_text(default, encoding="utf-8")

ensure_file(LEADERBOARD_PATH, "[]")

DEFAULT_CONFIG = {
    "instructions": "欢迎来到沙漠穿越比赛！主持人尚未更新说明。",
    "reveal_leaderboard": False,
    "show_model_to_players": False,
    "show_solution_to_players": False,
    "labels": {},
    "params_default": {
        "deadline": 30,
        "initial_cash": 10000,
        "weight_limit_kg": 1200,
        "start_node": 1,
        "end_node": 64,
        "prices": {"water": 5, "food": 10},
        "mass": {"water": 3, "food": 2},
        "refund_factor": 0.5,
        "base_income": 1000,
        "base_consumption": {
            "Sunny": {"water": 5, "food": 7},
            "Hot":   {"water": 8, "food": 6},
            "Storm": {"water": 10,"food":10}
        },
        "move_multiplier": 2.0,
        "mine_multiplier": 3.0,
        "allow_storm_mining": True,
        "weather": ["Sunny"] * 30
    },
    "countdown_seconds": 0,
    "timer_started_at": None,
    "timer_running": False,
    # Controller Access Control
    "controller_tokens": [],
    "controller_master_token": None,
    "controller_lock": False
}
ensure_file(CONFIG_PATH, json.dumps(DEFAULT_CONFIG, ensure_ascii=False, indent=2))

# --------- Build odd-r 8x8 adjacency ----------
def build_hex_adjacency(cols: int = 8, rows: int = 8) -> Dict[int, List[int]]:
    def in_bounds(rr: int, cc: int) -> bool:
        return 0 <= rr < rows and 0 <= cc < cols
    adj: Dict[int, List[int]] = {}
    for r in range(rows):
        for c in range(cols):
            id_ = r * cols + c + 1
            if r % 2 == 0:
                deltas = [(-1,-1), (-1,0), (0,-1), (0,1), (1,-1), (1,0)]
            else:
                deltas = [(-1,0), (-1,1), (0,-1), (0,1), (1,0), (1,1)]
            neighbors = []
            for dr, dc in deltas:
                rr, cc = r + dr, c + dc
                if in_bounds(rr, cc):
                    neighbors.append(rr * cols + cc + 1)
            adj[id_] = neighbors
    return adj

ADJ: Dict[int, List[int]] = build_hex_adjacency()

leaderboard_lock = threading.Lock()
config_lock = threading.Lock()
sessions_lock = threading.Lock()
active_sessions: Dict[str, Dict[str, Any]] = {}

def load_config() -> Dict[str, Any]:
    with config_lock:
        try:
            cfg = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        except:
            cfg = DEFAULT_CONFIG
        if not cfg.get("controller_master_token"):
            cfg["controller_master_token"] = secrets.token_hex(16)
            CONFIG_PATH.write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding="utf-8")
            print("\n[ACCESS] Generated controller master token:", cfg["controller_master_token"], "\n")
        return cfg

def save_config(cfg: Dict[str, Any]):
    with config_lock:
        CONFIG_PATH.write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding="utf-8")

def compute_remaining(cfg: Dict[str, Any]) -> int:
    if not cfg.get("timer_running") or not cfg.get("timer_started_at"):
        return int(cfg.get("countdown_seconds", 0))
    elapsed = time.time() - cfg["timer_started_at"]
    remain = int(cfg["countdown_seconds"] - elapsed)
    if remain < 0:
        remain = 0
        cfg["timer_running"] = False
        cfg["countdown_seconds"] = 0
        cfg["timer_started_at"] = None
        save_config(cfg)
    return remain

# ---------- Controller auth helpers ----------
from flask import Response
def get_request_token() -> str | None:
    token = request.headers.get("X-Controller-Token")
    if not token:
        data = request.get_json(silent=True) or {}
        token = data.get("token")
    return token

def check_controller_auth(master_required: bool = False) -> tuple[bool, bool]:
    cfg = load_config()
    token = get_request_token()
    if not token:
        return False, False
    is_master = token == cfg.get("controller_master_token")
    if master_required:
        return is_master, is_master
    if cfg.get("controller_lock", False):
        return is_master, is_master
    ok = is_master or token in (cfg.get("controller_tokens") or [])
    return ok, is_master

def require_controller(master_required: bool = False):
    ok, is_master = check_controller_auth(master_required=master_required)
    if not ok:
        return False, is_master, jsonify({"error":"FORBIDDEN","reason":"controller token invalid or locked"}), 403
    return True, is_master, None, None

# ---------------- LaTeX model ----------------
def build_general_latex() -> str:
    return r"""
\[
\textbf{MILP Formulation (Single Player Desert Crossing)}
\]
\[
\begin{aligned}
\text{Sets: } & D=\{1,\dots,T\},\ V=\{1,\dots,64\},\ E=\{(i,j)\mid j\in \mathrm{Adj}[i]\},\ M\subseteq V,\ G\subseteq V
\end{aligned}
\]
\[
\textbf{Objective: } \max\ \mathrm{Cash}_T + \mathrm{refund\_factor}\big(\mathrm{InvW}_T\mathrm{price}_w+\mathrm{InvF}_T\mathrm{price}_f\big)
\]
""".strip()

def build_instantiated_latex(p: Dict[str, Any]) -> str:
    bc = p.get("base_consumption", {})
    fmt = lambda w,r: bc.get(w, {}).get(r, "?")
    mines_str = ",".join(map(str, p.get("mines", [])))
    villages_str = ",".join(map(str, p.get("villages", [])))
    weather_str = ",".join(p.get("weather", []))
    return r"""
\[
\textbf{Instance}
\]
\[
\begin{aligned}
\mathrm{start}&=%s,\ \mathrm{end}=%s,\ T=%s \\
M&=\{%s\},\ G=\{%s\},\ \mathrm{Weather}=[%s] \\
\mathrm{base\_income}&=%s,\ \alpha_{\mathrm{move}}=%s,\ \alpha_{\mathrm{mine}}=%s \\
\mathrm{price}_w&=%s,\ \mathrm{price}_f=%s,\ \mathrm{refund\_factor}=%s \\
\mathrm{mass}_w&=%s,\ \mathrm{mass}_f=%s,\ \mathrm{W\_limit}=%s,\ \mathrm{initial\_cash}=%s
\end{aligned}
\]
\[
\text{Base Consumption Table: }
\begin{array}{c|ccc}
 & \text{Sunny} & \text{Hot} & \text{Storm} \\
\hline
\text{Water} & %s & %s & %s \\
\text{Food}  & %s & %s & %s
\end{array}
\]
""" % (
        p.get("start_node",1), p.get("end_node",64), p.get("deadline",30),
        mines_str, villages_str, weather_str,
        p.get("base_income"),
        p.get("move_multiplier"), p.get("mine_multiplier"),
        p.get("prices",{}).get("water"), p.get("prices",{}).get("food"),
        p.get("refund_factor"),
        p.get("mass",{}).get("water"), p.get("mass",{}).get("food"),
        p.get("weight_limit_kg"), p.get("initial_cash"),
        fmt("Sunny","water"), fmt("Hot","water"), fmt("Storm","water"),
        fmt("Sunny","food"),  fmt("Hot","food"),  fmt("Storm","food"),
    )

# ---------------- Solver ----------------
def solve_milp(payload: Dict[str, Any]) -> Dict[str, Any]:
    D = int(payload.get("deadline", 30))
    start = int(payload.get("start_node", 1))
    end = int(payload.get("end_node", 64))
    initial_cash = float(payload["initial_cash"])
    weight_limit = float(payload["weight_limit_kg"])
    prices = payload["prices"]; mass = payload["mass"]
    refund_factor = float(payload["refund_factor"])
    base_cons = payload["base_consumption"]
    base_income = float(payload.get("base_income", 1000))
    move_mult = float(payload["move_multiplier"])
    mine_mult = float(payload["mine_multiplier"])
    allow_storm_mining = bool(payload.get("allow_storm_mining", True))
    mines = list(map(int, payload.get("mines", [])))
    villages = list(map(int, payload.get("villages", [])))
    weather = payload["weather"]

    V = sorted(ADJ.keys())
    prob = pulp.LpProblem("DesertCrossing", pulp.LpMaximize)
    x = pulp.LpVariable.dicts("x", (range(D+1), V), 0, 1, cat="Binary")
    stay = pulp.LpVariable.dicts("stay", (range(1, D+1), V), 0, 1, cat="Binary")

    m = {}
    for d in range(1, D+1):
        if weather[d-1] == "Storm": continue
        for i in V:
            for j in ADJ[i]:
                m[(d,i,j)] = pulp.LpVariable(f"m_{d}_{i}_{j}", 0, 1, cat="Binary")

    mine_var = {}
    for d in range(1, D+1):
        for i in mines:
            mine_var[(d,i)] = pulp.LpVariable(f"mine_{d}_{i}", 0, 1, cat="Binary")

    buyW_start = pulp.LpVariable("buyW_start", 0, None, cat="Integer")
    buyF_start = pulp.LpVariable("buyF_start", 0, None, cat="Integer")
    buyW = {}; buyF = {}
    for d in range(1, D+1):
        for i in villages:
            buyW[(d,i)] = pulp.LpVariable(f"buyW_{d}_{i}", 0, None, cat="Integer")
            buyF[(d,i)] = pulp.LpVariable(f"buyF_{d}_{i}", 0, None, cat="Integer")

    InvW = pulp.LpVariable.dicts("InvW", range(D+1), 0, None)
    InvF = pulp.LpVariable.dicts("InvF", range(D+1), 0, None)
    Cash = pulp.LpVariable.dicts("Cash", range(D+1), 0, None)

    prob += x[0][start] == 1
    for i in V:
        if i != start: prob += x[0][i] == 0

    prob += Cash[0] == initial_cash - (buyW_start * prices["water"] + buyF_start * prices["food"])
    prob += InvW[0] == buyW_start
    prob += InvF[0] == buyF_start
    prob += mass["water"] * InvW[0] + mass["food"] * InvF[0] <= weight_limit

    for d in range(1, D+1):
        w = weather[d-1]
        if w == "Storm":
            for i in V: prob += stay[d][i] == x[d-1][i]
        else:
            for i in V:
                out_moves = pulp.lpSum(m[(d,i,j)] for j in ADJ[i] if (d,i,j) in m)
                prob += stay[d][i] + out_moves == x[d-1][i]
        for j in V:
            in_moves = 0 if w == "Storm" else pulp.lpSum(m[(d,i,j)] for i in ADJ[j] if (d,i,j) in m)
            prob += x[d][j] == stay[d][j] + in_moves
        prob += pulp.lpSum(x[d][i] for i in V) == 1

    prob += x[D][end] == 1
    for d in range(1, D+1):
        prob += x[d-1][end] <= x[d][end]

    for (d,i), var in mine_var.items():
        prob += var <= stay[d][i]
        arrive = pulp.LpVariable(f"arrive_{d}_{i}", 0, 1, cat="Binary")
        prob += arrive >= x[d][i] - x[d-1][i]
        prob += arrive <= x[d][i]
        prob += arrive <= 1 - x[d-1][i]
        prob += var <= 1 - arrive
        if weather[d-1] == "Storm" and not allow_storm_mining:
            prob += var == 0

    BIG = 10_000
    for d in range(1, D+1):
        for i in villages:
            if (d,i) in buyW:
                prob += buyW[(d,i)] <= BIG * x[d][i]
                prob += buyF[(d,i)] <= BIG * x[d][i]

    consW = {}; consF = {}
    for d in range(1, D+1):
        w = weather[d-1]
        bw = base_cons[w]["water"]; bf = base_cons[w]["food"]
        if w == "Storm":
            moveW = 0; moveF = 0
        else:
            moveW = pulp.lpSum(m[(d,i,j)] * (move_mult*bw) for (d2,i,j) in m if d2==d)
            moveF = pulp.lpSum(m[(d,i,j)] * (move_mult*bf) for (d2,i,j) in m if d2==d)
        stayW = pulp.lpSum(stay[d][i]*bw for i in V)
        stayF = pulp.lpSum(stay[d][i]*bf for i in V)
        mineExtraW = pulp.lpSum(mine_var[(d,i)] * ((mine_mult-1.0)*bw) for i in mines) if mines else 0
        mineExtraF = pulp.lpSum(mine_var[(d,i)] * ((mine_mult-1.0)*bf) for i in mines) if mines else 0
        consW[d] = moveW + stayW + mineExtraW
        consF[d] = moveF + stayF + mineExtraF

    for d in range(1, D+1):
        addsW = pulp.lpSum(buyW[(d,i)] for i in villages) if villages else 0
        addsF = pulp.lpSum(buyF[(d,i)] for i in villages) if villages else 0
        prob += InvW[d] == InvW[d-1] + addsW - consW[d]
        prob += InvF[d] == InvF[d-1] + addsF - consF[d]
        prob += InvW[d] >= 0
        prob += InvF[d] >= 0
        prob += mass["water"]*InvW[d] + mass["food"]*InvF[d] <= weight_limit

    for d in range(1, D+1):
        buyCost = 0
        if villages:
            buyCost = pulp.lpSum(
                buyW[(d,i)]*(2*prices["water"]) + buyF[(d,i)]*(2*prices["food"])
                for i in villages
            )
        income = pulp.lpSum(mine_var[(d,i)] * base_income for i in mines) if mines else 0
        prob += Cash[d] == Cash[d-1] - buyCost + income
        prob += Cash[d] >= 0

    refund = InvW[D]*(refund_factor*prices["water"]) + InvF[D]*(refund_factor*prices["food"])
    prob += Cash[D] + refund

    solver = pulp.PULP_CBC_CMD(msg=0, timeLimit=60)
    prob.solve(solver)

    status = pulp.LpStatus.get(prob.status, "Unknown")
    obj = pulp.value(prob.objective) if prob.status == 1 else None
    arrive_day = None
    if prob.status == 1:
        for d in range(1, D+1):
            if pulp.value(x[d][end]) > 0.5 and pulp.value(x[d-1][end]) < 0.5:
                arrive_day = d; break

    daily=[]; path=[]; weight_peak=0.0; purchases_v=[]
    start_cost=(pulp.value(buyW_start) or 0)*prices["water"] + (pulp.value(buyF_start) or 0)*prices["food"]

    if prob.status == 1:
        for d in range(1, D+1):
            loc=None
            for i in V:
                if (pulp.value(x[d][i]) or 0)>0.5:
                    loc=i; break
            action="STAY"; moved_from=None; moved_to=None
            if weather[d-1]!="Storm":
                for i in V:
                    for j in ADJ[i]:
                        key=(d,i,j)
                        if key in m and (pulp.value(m[key]) or 0)>0.5:
                            action="MOVE"; moved_from=i; moved_to=j; break
                    if action=="MOVE": break
            if action=="STAY" and loc in mines and (d,loc) in mine_var and (pulp.value(mine_var[(d,loc)]) or 0)>0.5:
                action="MINE"
            bw=sum(pulp.value(buyW[(d,i)]) or 0 for i in villages) if villages else 0
            bf=sum(pulp.value(buyF[(d,i)]) or 0 for i in villages) if villages else 0
            if bw>0 or bf>0:
                purchases_v.append({"day":d,"node":loc,"water":bw,"food":bf,
                                    "cost": bw*(2*prices["water"]) + bf*(2*prices["food"])})
            invw=pulp.value(InvW[d]) or 0
            invf=pulp.value(InvF[d]) or 0
            cashd=pulp.value(Cash[d]) or 0
            wt=mass["water"]*invw + mass["food"]*invf
            weight_peak=max(weight_peak, wt)
            daily.append({
                "day":d,"weather":weather[d-1],"location":loc,"action":action,
                "moved_from":moved_from,"moved_to":moved_to,"buyW":bw,"buyF":bf,
                "invW":invw,"invF":invf,"cash":cashd
            })
        for d in range(0, D+1):
            loc=None
            for i in V:
                if (pulp.value(x[d][i]) or 0)>0.5:
                    loc=i; break
            path.append(loc if loc is not None else -1)

    final_cash=(pulp.value(Cash[D]) or 0)+(pulp.value(refund) or 0)

    return {
        "status": status,
        "objective": obj,
        "final_cash": final_cash,
        "cash_D": pulp.value(Cash[D]) or 0,
        "refund": pulp.value(refund) or 0,
        "arrive_day": arrive_day,
        "weight_peak": weight_peak,
        "daily": daily,
        "path": path,
        "purchases": {
            "start": {
                "water": pulp.value(buyW_start) or 0,
                "food": pulp.value(buyF_start) or 0,
                "cost": start_cost
            },
            "villages": purchases_v
        }
    }

# ---------- evaluate ----------
def evaluate_player_plan(data: Dict[str, Any]) -> Dict[str, Any]:
    params=data["params"]
    T=params["deadline"]; start=params["start_node"]; end=params["end_node"]
    weather=params["weather"]; move_mult=params["move_multiplier"]; mine_mult=params["mine_multiplier"]
    allow_storm_mining=params["allow_storm_mining"]; prices=params["prices"]; mass=params["mass"]
    refund_factor=params["refund_factor"]; W_limit=params["weight_limit_kg"]; initial_cash=params["initial_cash"]
    base_income=params.get("base_income",1000)
    mines=set(params.get("mines", [])); villages=set(params.get("villages", []))
    path=data["path"]
    if len(path)==T: path=[start]+path
    if len(path)!=T+1: return {"valid": False,"reason":"path length mismatch"}
    actions_map={a["day"]:a for a in data["actions"]}
    curW=0; curF=0; curCash=initial_cash
    start_buyW=data.get("start_buyW",0); start_buyF=data.get("start_buyF",0)
    curCash -= start_buyW*prices["water"]+start_buyF*prices["food"]
    curW += start_buyW; curF += start_buyF
    if curCash < -1e-9: return {"valid":False,"reason":"negative cash at start"}
    if path[0]!=start: return {"valid":False,"reason":"path[0] != start"}
    invW_list=[]; invF_list=[]; cash_list=[]
    mine_income_total=0; purchase_cost_total=start_buyW*prices["water"]+start_buyF*prices["food"]
    for d in range(1,T+1):
        prev=path[d-1]; cur=path[d]
        if cur!=prev and cur not in ADJ.get(prev, []):
            return {"valid":False,"reason":f"illegal move day {d} {prev}->{cur}"}
        w=weather[d-1]
        baseW=params["base_consumption"][w]["water"]; baseF=params["base_consumption"][w]["food"]
        act=actions_map.get(d, {"buyW":0,"buyF":0,"mine":False})
        buyW_d=int(act.get("buyW",0)); buyF_d=int(act.get("buyF",0)); mine_flag=bool(act.get("mine",False))
        if (buyW_d>0 or buyF_d>0) and cur not in villages:
            return {"valid":False,"reason":f"purchase outside village day {d}"}
        if mine_flag:
            if cur not in mines: return {"valid":False,"reason":f"mine outside mine day {d}"}
            if w=="Storm" and not allow_storm_mining: return {"valid":False,"reason":f"storm mining forbidden day {d}"}
            if prev!=cur: return {"valid":False,"reason":f"mine on arrival day {d}"}
        moved=(cur!=prev) and w!="Storm"
        consW=baseW; consF=baseF
        if moved: consW += move_mult*baseW; consF += move_mult*baseF
        if mine_flag: consW += (mine_mult-1.0)*baseW; consF += (mine_mult-1.0)*baseF
        costW=buyW_d*(2*prices["water"]) if buyW_d>0 else 0
        costF=buyF_d*(2*prices["food"]) if buyF_d>0 else 0
        curCash -= (costW+costF); purchase_cost_total += (costW+costF)
        curW += buyW_d; curF += buyF_d
        if mine_flag: curCash += base_income; mine_income_total += base_income
        curW -= consW; curF -= consF
        if curW < -1e-8 or curF < -1e-8 or curCash < -1e-8: return {"valid":False,"reason":f"negative inventory/cash day {d}"}
        if mass["water"]*curW + mass["food"]*curF > W_limit + 1e-8: return {"valid":False,"reason":f"weight limit exceeded day {d}"}
        invW_list.append(curW); invF_list.append(curF); cash_list.append(curCash)
    if path[-1]!=end: return {"valid":False,"reason":"did not reach end"}
    refund=refund_factor*(curW*prices["water"] + curF*prices["food"])
    final_cash=curCash+refund
    score=final_cash
    return {
        "valid":True,
        "final_cash":final_cash,
        "score":score,
        "refund":refund,
        "mine_income":mine_income_total,
        "purchase_cost":purchase_cost_total,
        "trajectory":{"path":path,"invW":invW_list,"invF":invF_list,"cash":cash_list}
    }

# ---------------- Routes ----------------
@app.post("/api/solve")
def api_solve():
    ok, _, resp, code = require_controller(False)
    if not ok: return resp, code
    try:
        data=request.get_json(force=True)
        res=solve_milp(data)
        return jsonify(res)
    except Exception as ex:
        traceback.print_exc()
        return jsonify({"status":"ERROR","message":str(ex)}),500

@app.post("/api/model")
def api_model():
    try:
        payload=request.get_json(force=True)
    except:
        payload={}
    return jsonify({
        "latex_general": build_general_latex(),
        "latex_instantiated": build_instantiated_latex(payload)
    })

@app.get("/api/config/get")
def api_config_get():
    cfg=load_config()
    remaining=compute_remaining(cfg)
    pub_cfg = {k: v for k, v in cfg.items() if not k.startswith("controller_")}
    return jsonify({**pub_cfg,"remaining_seconds":remaining})

@app.post("/api/config/update")
def api_config_update():
    ok, _, resp, code = require_controller(False)
    if not ok: return resp, code
    data=request.get_json(force=True)
    cfg=load_config()
    for k in ["instructions","reveal_leaderboard","show_model_to_players","show_solution_to_players"]:
        if k in data: cfg[k]=data[k]
    if "labels" in data and isinstance(data["labels"], dict):
        cfg["labels"]={int(k):v for k,v in data["labels"].items()}
    if "params_default" in data and isinstance(data["params_default"], dict):
        pd=cfg.get("params_default",{})
        pd.update(data["params_default"])
        cfg["params_default"]=pd
    save_config(cfg)
    remaining=compute_remaining(cfg)
    pub_cfg = {k: v for k, v in cfg.items() if not k.startswith("controller_")}
    return jsonify({"updated":True,"config":{**pub_cfg,"remaining_seconds":remaining}})

@app.post("/api/timer/start")
def api_timer_start():
    ok, _, resp, code = require_controller(False)
    if not ok: return resp, code
    data=request.get_json(force=True)
    seconds=int(data.get("seconds",0))
    cfg=load_config()
    cfg["countdown_seconds"]=seconds
    cfg["timer_started_at"]=time.time()
    cfg["timer_running"]=True
    save_config(cfg)
    remaining=compute_remaining(cfg)
    return jsonify({"started":True,"remaining_seconds":remaining})

@app.post("/api/timer/pause")
def api_timer_pause():
    ok, _, resp, code = require_controller(False)
    if not ok: return resp, code
    cfg=load_config()
    remain=compute_remaining(cfg)
    cfg["countdown_seconds"]=remain
    cfg["timer_running"]=False
    cfg["timer_started_at"]=None
    save_config(cfg)
    return jsonify({"paused":True,"remaining_seconds":remain})

@app.post("/api/timer/reset")
def api_timer_reset():
    ok, _, resp, code = require_controller(False)
    if not ok: return resp, code
    data=request.get_json(force=True)
    seconds=int(data.get("seconds",0))
    cfg=load_config()
    cfg["countdown_seconds"]=seconds
    cfg["timer_running"]=False
    cfg["timer_started_at"]=None
    save_config(cfg)
    return jsonify({"reset":True,"remaining_seconds":seconds})

@app.get("/api/adjacency")
def api_adjacency():
    return jsonify({"adjacency": ADJ})

@app.post("/api/play/start")
def api_play_start():
    sid=str(uuid.uuid4())
    with sessions_lock:
        active_sessions[sid]={"created_at":time.time()}
    return jsonify({"session_id":sid})

@app.post("/api/play/evaluate")
def api_play_evaluate():
    data=request.get_json(force=True)
    res=evaluate_player_plan(data)
    return jsonify(res)

@app.post("/api/play/submit")
def api_play_submit():
    data=request.get_json(force=True)
    nickname=data.get("nickname","Player")
    eval_res=evaluate_player_plan(data)
    if not eval_res.get("valid",False):
        return jsonify({"submitted":False,"reason":eval_res.get("reason"),"valid":False})
    board=json.loads(LEADERBOARD_PATH.read_text(encoding="utf-8"))
    board.append({
        "id":str(uuid.uuid4()),
        "nickname":nickname,
        "score":eval_res["score"],
        "final_cash":eval_res["final_cash"],
        "valid":True,
        "submitted_at": time.strftime("%Y-%m-%d %H:%M:%S",time.localtime())
    })
    board.sort(key=lambda x:x["score"], reverse=True)
    LEADERBOARD_PATH.write_text(json.dumps(board, ensure_ascii=False, indent=2), encoding="utf-8")
    return jsonify({"submitted":True,"evaluation":eval_res,"leaderboard_size":len(board)})

@app.get("/api/leaderboard")
def api_leaderboard():
    board=json.loads(LEADERBOARD_PATH.read_text(encoding="utf-8"))
    board.sort(key=lambda x:x["score"], reverse=True)
    return jsonify({"leaderboard":board})

# ---- Access control endpoints ----
@app.post("/api/controller/access/check")
def api_controller_check():
    ok, is_master = check_controller_auth(master_required=False)
    return jsonify({"authorized": ok, "master": is_master})

@app.post("/api/controller/access/list")
def api_controller_list():
    ok, is_master, resp, code = require_controller(master_required=True)
    if not ok: return resp, code
    cfg = load_config()
    return jsonify({
        "lock": cfg.get("controller_lock", False),
        "tokens": cfg.get("controller_tokens", []),
        "master_token": cfg.get("controller_master_token")
    })

@app.post("/api/controller/access/add")
def api_controller_add():
    ok, is_master, resp, code = require_controller(master_required=True)
    if not ok: return resp, code
    data = request.get_json(force=True)
    token = data.get("token")
    if not token or not isinstance(token, str) or len(token) < 6:
        return jsonify({"error":"BAD_REQUEST","reason":"token string (>=6) required"}), 400
    cfg = load_config()
    tokens = cfg.get("controller_tokens", [])
    if token not in tokens:
        tokens.append(token)
    cfg["controller_tokens"] = tokens
    save_config(cfg)
    return jsonify({"added": True, "count": len(tokens)})

@app.post("/api/controller/access/remove")
def api_controller_remove():
    ok, is_master, resp, code = require_controller(master_required=True)
    if not ok: return resp, code
    data = request.get_json(force=True)
    token = data.get("token")
    cfg = load_config()
    tokens = cfg.get("controller_tokens", [])
    if token in tokens:
        tokens.remove(token)
        cfg["controller_tokens"] = tokens
        save_config(cfg)
        return jsonify({"removed": True, "count": len(tokens)})
    return jsonify({"removed": False, "reason": "not found"}), 404

@app.post("/api/controller/access/lock")
def api_controller_lock():
    ok, is_master, resp, code = require_controller(master_required=True)
    if not ok: return resp, code
    data = request.get_json(force=True)
    lock = bool(data.get("lock", False))
    cfg = load_config()
    cfg["controller_lock"] = lock
    save_config(cfg)
    return jsonify({"lock": lock})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=False)