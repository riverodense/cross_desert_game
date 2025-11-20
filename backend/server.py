from __future__ import annotations
from flask import Flask, request, jsonify
from flask_cors import CORS
from pathlib import Path
import json
import pulp
<<<<<<< HEAD
import time
import secrets
from functools import wraps
=======
from datetime import datetime
import random
>>>>>>> origin/copilot/implement-adjustable-consumption-model

app = Flask(__name__)
CORS(app)

# Global storage for the last optimal solution
LAST_SOLUTION = None

ROOT = Path(__file__).resolve().parents[1]
<<<<<<< HEAD
CONFIG_PATH = ROOT / "game_config.json"

# Use UTF-8-SIG so a BOM at the start doesn't break JSON parsing
with open(ROOT / "adjacency.json", "r", encoding="utf-8-sig") as f:
    ADJ = json.load(f)
NEI = {int(k): v for k, v in ADJ.items()}
=======

# Compute odd-r hex adjacency dynamically (8x8 grid, nodes 1-64)
def compute_adjacency():
    """Compute odd-r hex adjacency for 8x8 grid (nodes 1-64)"""
    NEI = {}
    for node in range(1, 65):
        row = (node - 1) // 8
        col = (node - 1) % 8
        neighbors = []
        
        # odd-r coordinate system adjacency
        if row % 2 == 0:  # even row
            # E, W, NE, NW, SE, SW
            offsets = [(0,1), (0,-1), (-1,0), (-1,-1), (1,0), (1,-1)]
        else:  # odd row
            offsets = [(0,1), (0,-1), (-1,1), (-1,0), (1,1), (1,0)]
        
        for dr, dc in offsets:
            nr, nc = row + dr, col + dc
            if 0 <= nr < 8 and 0 <= nc < 8:
                neighbor_node = nr * 8 + nc + 1
                neighbors.append(neighbor_node)
        
        NEI[node] = neighbors
    return NEI

NEI = compute_adjacency()

# Game configuration storage
GAME_CONFIG = {
    "instructions": "Desert Crossing Game - Maximize final cash by mining and trading",
    "reveal_leaderboard": True,
    "show_model_to_players": True,
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
            "Hot": {"water": 8, "food": 6},
            "Storm": {"water": 10, "food": 10}
        },
        "move_multiplier": 2.0,
        "mine_multiplier": 2.5,
        "allow_storm_mining": True,
        "weather": ["Sunny"] * 30
    },
    "countdown_seconds": 1800,
    "timer_started_at": None,
    "timer_running": False,
}

LEADERBOARD = []

@app.get("/api/config")
def api_get_config():
    """Get current game configuration"""
    config = GAME_CONFIG.copy()
    if config["timer_started_at"] and config["timer_running"]:
        elapsed = (datetime.now().timestamp() - config["timer_started_at"])
        remaining = max(0, config["countdown_seconds"] - int(elapsed))
        config["remaining_seconds"] = remaining
    return jsonify(config)

@app.post("/api/config")
def api_update_config():
    """Update game configuration"""
    data = request.get_json(force=True)
    for key in ["instructions", "reveal_leaderboard", "show_model_to_players", 
                "show_solution_to_players", "labels", "params_default", "countdown_seconds"]:
        if key in data:
            GAME_CONFIG[key] = data[key]
    return jsonify({"status": "ok", "config": GAME_CONFIG})

@app.post("/api/timer/start")
def api_start_timer():
    """Start countdown timer"""
    GAME_CONFIG["timer_started_at"] = datetime.now().timestamp()
    GAME_CONFIG["timer_running"] = True
    return jsonify({"status": "started", "started_at": GAME_CONFIG["timer_started_at"]})

@app.post("/api/timer/stop")
def api_stop_timer():
    """Stop countdown timer"""
    GAME_CONFIG["timer_running"] = False
    return jsonify({"status": "stopped"})

@app.post("/api/timer/reset")
def api_reset_timer():
    """Reset countdown timer"""
    GAME_CONFIG["timer_started_at"] = None
    GAME_CONFIG["timer_running"] = False
    return jsonify({"status": "reset"})

@app.get("/api/adjacency")
def api_adjacency():
    """Get hex adjacency map"""
    return jsonify(NEI)

@app.post("/api/weather/random")
def api_random_weather():
    """Generate random weather for 30 days"""
    weathers = ["Sunny", "Hot", "Storm"]
    # Weighted random: more Hot, less Storm
    weights = [0.3, 0.5, 0.2]
    random_weather = random.choices(weathers, weights=weights, k=30)
    return jsonify({"weather": random_weather})

@app.get("/api/latex/general")
def api_latex_general():
    """Get general MILP model in LaTeX"""
    latex = r"""
\begin{align*}
\text{maximize} \quad & \text{Cash}_D + \text{refund} \\
\text{subject to} \quad & x_{0,s} = 1, \quad x_{0,i} = 0 \quad \forall i \neq s \\
& \text{Cash}_0 = C_0 - (b^0_W \cdot p_W + b^0_F \cdot p_F) \\
& \text{Inv}_{W,0} = b^0_W, \quad \text{Inv}_{F,0} = b^0_F \\
& m_W \cdot \text{Inv}_{W,0} + m_F \cdot \text{Inv}_{F,0} \leq W_{\max} \\
\text{For each day } d \in \{1, \ldots, D\}: \\
& \text{stay}_{d,i} + \sum_{j \in N(i)} \text{move}_{d,i,j} = x_{d-1,i} \quad \forall i \quad (\text{if no storm}) \\
& x_{d,j} = \text{stay}_{d,j} + \sum_{i \in N(j)} \text{move}_{d,i,j} \quad \forall j \\
& \sum_{i} x_{d,i} = 1 \\
& \text{mine}_{d,i} \leq \text{stay}_{d,i} \quad \forall i \in \text{mines} \\
& \text{mine}_{d,i} \leq 1 - \text{arrive}_{d,i} \quad \forall i \in \text{mines} \\
& \text{Cons}_{W,d} = \sum_{\text{moves}} \alpha_m \cdot c_W^{\text{weather}[d]} + \sum_{\text{stays}} c_W^{\text{weather}[d]} + \sum_{\text{mines}} (\alpha_{mine}-1) \cdot c_W^{\text{weather}[d]} \\
& \text{Cons}_{F,d} = \sum_{\text{moves}} \alpha_m \cdot c_F^{\text{weather}[d]} + \sum_{\text{stays}} c_F^{\text{weather}[d]} + \sum_{\text{mines}} (\alpha_{mine}-1) \cdot c_F^{\text{weather}[d]} \\
& \text{Inv}_{W,d} = \text{Inv}_{W,d-1} + \sum_{i \in \text{villages}} b^d_{W,i} - \text{Cons}_{W,d} \\
& \text{Inv}_{F,d} = \text{Inv}_{F,d-1} + \sum_{i \in \text{villages}} b^d_{F,i} - \text{Cons}_{F,d} \\
& m_W \cdot \text{Inv}_{W,d} + m_F \cdot \text{Inv}_{F,d} \leq W_{\max} \\
& \text{Cash}_d = \text{Cash}_{d-1} - \sum_{i \in \text{villages}} (2p_W \cdot b^d_{W,i} + 2p_F \cdot b^d_{F,i}) + \sum_{i \in \text{mines}} I_{\text{base}} \cdot \text{mine}_{d,i} \\
& \text{Cash}_d \geq 0 \\
\text{Terminal conditions:} \\
& x_{D,e} = 1 \\
& x_{d-1,e} \leq x_{d,e} \quad \forall d \in \{1, \ldots, D\} \\
& \text{refund} = r \cdot (p_W \cdot \text{Inv}_{W,D} + p_F \cdot \text{Inv}_{F,D})
\end{align*}

\textbf{Parameter units:}
\begin{itemize}
\item $C_0$: Initial cash (¥)
\item $p_W, p_F$: Water, food price (¥/unit)
\item $m_W, m_F$: Water, food mass (kg/unit)
\item $W_{\max}$: Weight limit (kg)
\item $c_W^w, c_F^w$: Base consumption (Bottle, Unit) for weather $w$
\item $I_{\text{base}}$: Mining base income (¥/day)
\item $\alpha_m$: Move multiplier
\item $\alpha_{mine}$: Mine multiplier
\item $r$: Refund factor
\end{itemize}
"""
    return jsonify({"latex": latex})

@app.post("/api/latex/instance")
def api_latex_instance():
    """Get instantiated MILP model with specific parameters"""
    data = request.get_json(force=True)
    params = data.get("params", {})
    
    # Extract parameters with defaults
    D = params.get("deadline", 30)
    C0 = params.get("initial_cash", 10000)
    pW = params.get("prices", {}).get("water", 5)
    pF = params.get("prices", {}).get("food", 10)
    mW = params.get("mass", {}).get("water", 3)
    mF = params.get("mass", {}).get("food", 2)
    Wmax = params.get("weight_limit_kg", 1200)
    r = params.get("refund_factor", 0.5)
    I_base = params.get("base_income", 1000)
    base_cons = params.get("base_consumption", {})
    alpha_m = params.get("move_multiplier", 2.0)
    alpha_mine = params.get("mine_multiplier", 2.5)
    
    # Format consumption table
    cons_table = "\\begin{tabular}{|l|c|c|}\n\\hline\n"
    cons_table += "Weather & Water (Bottle) & Food (Unit) \\\\\n\\hline\n"
    for w in ["Sunny", "Hot", "Storm"]:
        cW = base_cons.get(w, {}).get("water", 0)
        cF = base_cons.get(w, {}).get("food", 0)
        cons_table += f"{w} & {cW} & {cF} \\\\\n"
    cons_table += "\\hline\n\\end{tabular}"
    
    latex = f"""
\\textbf{{Instance Parameters:}}
\\begin{{itemize}}
\\item Deadline $D = {D}$ days
\\item Initial cash $C_0 = {C0}$ ¥
\\item Weight limit $W_{{\\max}} = {Wmax}$ kg
\\item Water: price $p_W = {pW}$ ¥/Bottle, mass $m_W = {mW}$ kg/Bottle
\\item Food: price $p_F = {pF}$ ¥/Unit, mass $m_F = {mF}$ kg/Unit
\\item Refund factor $r = {r}$
\\item Mining base income $I_{{\\text{{base}}}} = {I_base}$ ¥/day
\\item Move multiplier $\\alpha_m = {alpha_m}$
\\item Mine multiplier $\\alpha_{{mine}} = {alpha_mine}$
\\end{{itemize}}

\\textbf{{Base Consumption per Day:}}

{cons_table}

\\textbf{{Village pricing:}} $2 \\times$ base price (water: {2*pW} ¥/Bottle, food: {2*pF} ¥/Unit)

\\textbf{{Refund at end:}} ${r} \\times$ base price per remaining unit
"""
    return jsonify({"latex": latex})
>>>>>>> origin/copilot/implement-adjustable-consumption-model

# Configuration management
def load_config():
    """Load game configuration from JSON file."""
    if not CONFIG_PATH.exists():
        # Create default configuration
        config = {
            "controller_master_token": secrets.token_hex(16),
            "controller_tokens": [],
            "controller_lock": False
        }
        save_config(config)
        return config
    
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        config = json.load(f)
    
    # Ensure master token exists
    if "controller_master_token" not in config or not config["controller_master_token"]:
        config["controller_master_token"] = secrets.token_hex(16)
        save_config(config)
    
    # Ensure other keys exist
    if "controller_tokens" not in config:
        config["controller_tokens"] = []
    if "controller_lock" not in config:
        config["controller_lock"] = False
    
    return config

def save_config(config):
    """Save game configuration to JSON file."""
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)

def check_controller_auth(token, master_required=False):
    """
    Check if a token is valid for controller access.
    
    Args:
        token: The token to check
        master_required: If True, only master token is accepted
        
    Returns:
        dict with keys: authorized (bool), is_master (bool)
    """
    if not token:
        return {"authorized": False, "is_master": False}
    
    config = load_config()
    master_token = config["controller_master_token"]
    is_master = (token == master_token)
    
    if master_required:
        return {"authorized": is_master, "is_master": is_master}
    
    # If lock is enabled, only master token works
    if config["controller_lock"]:
        return {"authorized": is_master, "is_master": is_master}
    
    # Check if token is in the list or is master
    authorized = is_master or (token in config["controller_tokens"])
    return {"authorized": authorized, "is_master": is_master}

def require_controller_auth(master_required=False):
    """Decorator to require controller authentication."""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Get token from header or JSON body
            token = request.headers.get("X-Controller-Token")
            if not token:
                data = request.get_json(silent=True)
                if data:
                    token = data.get("token")
            
            auth_result = check_controller_auth(token, master_required)
            if not auth_result["authorized"]:
                return jsonify({"error": "Unauthorized", "message": "Valid controller token required"}), 403
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator

# Access control endpoints
@app.get("/api/controller/access/init")
def api_controller_access_init():
    """Initialize config and return master token. Public endpoint for first-time setup."""
    config = load_config()
    return jsonify({
        "master_token": config["controller_master_token"],
        "initialized": True
    })

@app.post("/api/controller/access/check")
def api_controller_access_check():
    """Check if a token is valid."""
    data = request.get_json(force=True)
    token = data.get("token", "")
    result = check_controller_auth(token)
    return jsonify(result)

@app.post("/api/controller/access/list")
@require_controller_auth()
def api_controller_access_list():
    """List all tokens and lock status. Requires valid token."""
    config = load_config()
    token = request.headers.get("X-Controller-Token")
    if not token:
        data = request.get_json(silent=True)
        if data:
            token = data.get("token")
    
    auth_result = check_controller_auth(token)
    
    return jsonify({
        "master_token": config["controller_master_token"] if auth_result["is_master"] else None,
        "tokens": config["controller_tokens"],
        "lock": config["controller_lock"],
        "is_master": auth_result["is_master"]
    })

@app.post("/api/controller/access/add")
@require_controller_auth(master_required=True)
def api_controller_access_add():
    """Add a new token. Requires master token."""
    data = request.get_json(force=True)
    new_token = data.get("new_token", "").strip()
    
    if not new_token:
        return jsonify({"error": "Token required"}), 400
    
    config = load_config()
    
    # Don't add if it's the master token or already exists
    if new_token == config["controller_master_token"]:
        return jsonify({"error": "Cannot add master token to list"}), 400
    
    if new_token in config["controller_tokens"]:
        return jsonify({"error": "Token already exists"}), 400
    
    config["controller_tokens"].append(new_token)
    save_config(config)
    
    return jsonify({"success": True, "tokens": config["controller_tokens"]})

@app.post("/api/controller/access/remove")
@require_controller_auth(master_required=True)
def api_controller_access_remove():
    """Remove a token. Requires master token."""
    data = request.get_json(force=True)
    token_to_remove = data.get("token_to_remove", "")
    
    if not token_to_remove:
        return jsonify({"error": "Token required"}), 400
    
    config = load_config()
    
    if token_to_remove not in config["controller_tokens"]:
        return jsonify({"error": "Token not found"}), 404
    
    config["controller_tokens"].remove(token_to_remove)
    save_config(config)
    
    return jsonify({"success": True, "tokens": config["controller_tokens"]})

@app.post("/api/controller/access/lock")
@require_controller_auth(master_required=True)
def api_controller_access_lock():
    """Toggle lock mode. Requires master token."""
    data = request.get_json(force=True)
    lock = data.get("lock", False)
    
    config = load_config()
    config["controller_lock"] = bool(lock)
    save_config(config)
    
    return jsonify({"success": True, "lock": config["controller_lock"]})

@app.post("/api/solve")
@require_controller_auth()
def api_solve():
    global LAST_SOLUTION
    data = request.get_json(force=True)
    result = solve_milp(data)
    
    # If optimal solution found, store it with timestamp
    if result.get("status") == "Optimal":
        LAST_SOLUTION = {
            "generated_at": time.strftime('%Y-%m-%d %H:%M:%S', time.localtime()),
            "objective": result["objective"],
            "final_cash": result["final_cash"],
            "arrive_day": result["arrive_day"],
            "path": result["path"],
            "daily": result["daily"],
            "purchases": result["purchases"]
        }
        result["generated_at"] = LAST_SOLUTION["generated_at"]
    
    return jsonify(result)

<<<<<<< HEAD
@app.get("/api/solution")
def api_solution():
    """Get the last optimal solution with timestamp"""
    if LAST_SOLUTION is None:
        return jsonify({"error": "No optimal solution available yet"}), 404
    return jsonify(LAST_SOLUTION)
=======
@app.post("/api/evaluate")
def api_evaluate():
    """Evaluate a player's plan"""
    data = request.get_json(force=True)
    result = evaluate_player_plan(data)
    return jsonify(result)

@app.get("/api/leaderboard")
def api_get_leaderboard():
    """Get leaderboard"""
    return jsonify({"entries": LEADERBOARD})

@app.post("/api/leaderboard")
def api_submit_leaderboard():
    """Submit entry to leaderboard"""
    data = request.get_json(force=True)
    entry = {
        "id": str(len(LEADERBOARD) + 1),
        "nickname": data.get("nickname", "Anonymous"),
        "score": data.get("score", 0),
        "final_cash": data.get("final_cash", 0),
        "valid": data.get("valid", True),
        "submitted_at": datetime.now().isoformat(),
    }
    LEADERBOARD.append(entry)
    # Sort by score descending
    LEADERBOARD.sort(key=lambda x: x["score"], reverse=True)
    return jsonify({"status": "ok", "entry": entry})
>>>>>>> origin/copilot/implement-adjustable-consumption-model

def solve_milp(payload: dict):
    D = int(payload.get("deadline", 30))
    start = int(payload.get("start_node", 1))
    end = int(payload.get("end_node", 64))
    initial_cash = float(payload["initial_cash"]) 
    weight_limit = float(payload["weight_limit_kg"]) 
    prices = payload["prices"]; mass = payload["mass"]
    refund_factor = float(payload["refund_factor"])
    base_income = float(payload.get("base_income", 1000))
    base_cons = payload["base_consumption"]
    move_mult = float(payload["move_multiplier"])   # 2.0
    mine_mult = float(payload["mine_multiplier"])   # 2.5
    allow_storm_mining = bool(payload.get("allow_storm_mining", True))
    mines = list(map(int, payload.get("mines", [])))
    villages = list(map(int, payload.get("villages", [])))
    weather = payload["weather"]  # list of "Sunny"/"Hot"/"Storm"

    V = list(range(1, 65))
    prob = pulp.LpProblem("DesertCrossing", pulp.LpMaximize)

    x = pulp.LpVariable.dicts("x", (range(D+1), V), 0, 1, cat="Binary")
    stay = pulp.LpVariable.dicts("stay", (range(1, D+1), V), 0, 1, cat="Binary")

    m = {}
    for d in range(1, D+1):
        if weather[d-1] == "Storm":
            continue
        for i in V:
            for j in NEI[i]:
                m[(d,i,j)] = pulp.LpVariable(f"m_{d}_{i}_{j}", 0, 1, cat="Binary")

    mine = {}
    for d in range(1, D+1):
        for i in mines:
            mine[(d,i)] = pulp.LpVariable(f"mine_{d}_{i}", 0, 1, cat="Binary")

    buyW_start = pulp.LpVariable("buyW_start", 0, None, cat="Integer")
    buyF_start = pulp.LpVariable("buyF_start", 0, None, cat="Integer")
    buyW = {}; buyF = {}
    for d in range(1, D+1):
        for i in villages:
            buyW[(d,i)] = pulp.LpVariable(f"buyW_{d}_{i}", 0, None, cat="Integer")
            buyF[(d,i)] = pulp.LpVariable(f"buyF_{d}_{i}", 0, None, cat="Integer")

    InvW = pulp.LpVariable.dicts("InvW", range(D+1), 0, None, cat="Integer")
    InvF = pulp.LpVariable.dicts("InvF", range(D+1), 0, None, cat="Integer")
    Cash = pulp.LpVariable.dicts("Cash", range(D+1), 0, None)

    prob += x[0][start] == 1
    for i in V:
        if i != start: prob += x[0][i] == 0

    prob += Cash[0] == initial_cash - (buyW_start * prices["water"] + buyF_start * prices["food"])
    prob += InvW[0] == buyW_start
    prob += InvF[0] == buyF_start

    for d in range(1, D+1):
        w = weather[d-1]
        if w == "Storm":
            for i in V:
                prob += stay[d][i] == x[d-1][i]
        else:
            for i in V:
                moves_out = pulp.lpSum(m[(d,i,j)] for j in NEI[i])
                prob += stay[d][i] + moves_out == x[d-1][i]

        for j in V:
            if w == "Storm": moves_in = 0
            else: moves_in = pulp.lpSum(m[(d,i,j)] for i in NEI[j])
            prob += x[d][j] == stay[d][j] + moves_in
        prob += pulp.lpSum(x[d][i] for i in V) == 1

    prob += x[D][end] == 1
    for d in range(1, D+1):
        prob += x[d-1][end] <= x[d][end]

    for (d,i), var in mine.items():
        prob += var <= stay[d][i]
        arrive = pulp.LpVariable(f"arrive_{d}_{i}", 0, 1, cat="Binary")
        prob += arrive >= x[d][i] - x[d-1][i]
        prob += arrive <= x[d][i]
        prob += arrive <= 1 - x[d-1][i]
        prob += var <= 1 - arrive
        if (weather[d-1] == "Storm") and (not allow_storm_mining):
            prob += var == 0

    BIG = 10000
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
            moveW = pulp.lpSum(m[(d,i,j)] * (move_mult * bw) for i in V for j in NEI[i] if (d,i,j) in m)
            moveF = pulp.lpSum(m[(d,i,j)] * (move_mult * bf) for i in V for j in NEI[i] if (d,i,j) in m)
        stayW = pulp.lpSum(stay[d][i] * bw for i in V)
        stayF = pulp.lpSum(stay[d][i] * bf for i in V)
        mineExtraW = pulp.lpSum(mine[(d,i)] * ((mine_mult - 1.0) * bw) for i in mines) if mines else 0
        mineExtraF = pulp.lpSum(mine[(d,i)] * ((mine_mult - 1.0) * bf) for i in mines) if mines else 0
        consW[d] = moveW + stayW + mineExtraW
        consF[d] = moveF + stayF + mineExtraF

    prob += mass["water"] * InvW[0] + mass["food"] * InvF[0] <= weight_limit
    for d in range(1, D+1):
        addsW = pulp.lpSum(buyW[(d,i)] for i in villages) if villages else 0
        addsF = pulp.lpSum(buyF[(d,i)] for i in villages) if villages else 0
        prob += InvW[d] == InvW[d-1] + addsW - consW[d]
        prob += InvF[d] == InvF[d-1] + addsF - consF[d]
        prob += InvW[d] >= 0
        prob += InvF[d] >= 0
        prob += mass["water"] * InvW[d] + mass["food"] * InvF[d] <= weight_limit

    for d in range(1, D+1):
        buyCost = 0
        if villages:
            buyCost = pulp.lpSum(buyW[(d,i)] * (2 * prices["water"]) + buyF[(d,i)] * (2 * prices["food"]) for i in villages)
        income = pulp.lpSum(mine[(d,i)] * base_income for i in mines) if mines else 0
        prob += Cash[d] == Cash[d-1] - buyCost + income
        prob += Cash[d] >= 0

    refund = InvW[D] * (refund_factor * prices["water"]) + InvF[D] * (refund_factor * prices["food"])
    prob += Cash[D] + refund, "FinalCash"

    solver = pulp.PULP_CBC_CMD(msg=0, timeLimit=60)
    prob.solve(solver)

    status = pulp.LpStatus[prob.status]
    obj = pulp.value(prob.objective) if prob.status in (1,) else None

    arrive_day = None
    for d in range(1, D+1):
        if pulp.value(x[d][end]) > 0.5 and pulp.value(x[d-1][end]) < 0.5:
            arrive_day = d; break

    daily = []; path = []; weight_peak = 0.0; purchases_v = []
    start_cost = (pulp.value(buyW_start) or 0) * prices["water"] + (pulp.value(buyF_start) or 0) * prices["food"]

    for d in range(1, D+1):
        loc = None; prev = None
        for i in V:
            if (pulp.value(x[d][i]) or 0) > 0.5: loc = i; break
        for i in V:
            if (pulp.value(x[d-1][i]) or 0) > 0.5: prev = i; break
        action = "STAY"; moved_to = None; moved_from = None
        if weather[d-1] != "Storm":
            for i in V:
                for j in NEI[i]:
                    key = (d,i,j)
                    if key in m and (pulp.value(m[key]) or 0) > 0.5:
                        action = "MOVE"; moved_from = i; moved_to = j; break
                if action == "MOVE": break
        if action == "STAY":
            if (d, loc) in mine and (pulp.value(mine[(d,loc)]) or 0) > 0.5:
                action = "MINE"
        bw = sum(pulp.value(buyW[(d,i)]) or 0 for i in villages) if villages else 0
        bf = sum(pulp.value(buyF[(d,i)]) or 0 for i in villages) if villages else 0
        if bw>0 or bf>0:
            purchases_v.append({"day":d,"node":loc,"water":bw,"food":bf,
                                "cost": bw*(2*prices["water"]) + bf*(2*prices["food"])})
        invW = pulp.value(InvW[d]) or 0
        invF = pulp.value(InvF[d]) or 0
        cash = pulp.value(Cash[d]) or 0
        weight = mass["water"]*invW + mass["food"]*invF
        weight_peak = max(weight_peak, weight)
        daily.append({"day":d,"weather":weather[d-1],"location":loc,
                      "moved_from":moved_from,"moved_to":moved_to,
                      "action":action,"buyW":bw,"buyF":bf,
                      "invW":invW,"invF":invF,"cash":cash})
    path = [next(i for i in V if (pulp.value(x[d][i]) or 0) > 0.5) for d in range(0, D+1)]

    return {"status":status, "objective":obj,
            "final_cash": (pulp.value(Cash[D]) or 0) + (pulp.value(refund) or 0),
            "cash_D": pulp.value(Cash[D]) or 0, "refund": pulp.value(refund) or 0,
            "arrive_day": arrive_day, "weight_peak": weight_peak,
            "daily": daily, "path": path,
            "purchases": {"start": {"water": pulp.value(buyW_start) or 0,
                                    "food": pulp.value(buyF_start) or 0,
                                    "cost": start_cost},
                           "villages": purchases_v} }

def evaluate_player_plan(payload: dict):
    """Evaluate a player's submitted plan and return detailed violations"""
    params = payload["params"]
    path = payload["path"]
    actions = payload["actions"]
    start_buyW = payload["start_buyW"]
    start_buyF = payload["start_buyF"]
    
    D = params["deadline"]
    initial_cash = params["initial_cash"]
    weight_limit = params["weight_limit_kg"]
    prices = params["prices"]
    mass = params["mass"]
    refund_factor = params["refund_factor"]
    base_income = params.get("base_income", 1000)
    base_cons = params["base_consumption"]
    move_mult = params["move_multiplier"]
    mine_mult = params["mine_multiplier"]
    weather = params["weather"]
    mines = set(params.get("mines", []))
    villages = set(params.get("villages", []))
    
    # Track state
    invW = start_buyW
    invF = start_buyF
    cash = initial_cash - (start_buyW * prices["water"] + start_buyF * prices["food"])
    
    violations = []
    daily_state = []
    
    # Check initial weight
    init_weight = mass["water"] * invW + mass["food"] * invF
    if init_weight > weight_limit:
        violations.append(f"Day 0: Initial weight {init_weight:.1f} kg exceeds limit {weight_limit} kg")
    
    if cash < 0:
        violations.append(f"Day 0: Insufficient initial cash (needed {start_buyW * prices['water'] + start_buyF * prices['food']}¥, had {initial_cash}¥)")
    
    daily_state.append({
        "day": 0,
        "location": path[0] if len(path) > 0 else None,
        "invW": invW,
        "invF": invF,
        "cash": cash,
        "weight": init_weight,
        "violations": []
    })
    
    # Simulate each day
    for d in range(1, D + 1):
        day_violations = []
        prev_loc = path[d-1] if d-1 < len(path) else None
        curr_loc = path[d] if d < len(path) else None
        w = weather[d-1]
        
        # Find action for this day
        action = next((a for a in actions if a["day"] == d), {"buyW": 0, "buyF": 0, "mine": False})
        
        # Check movement
        moved = prev_loc != curr_loc
        if moved and w == "Storm":
            day_violations.append(f"Illegal movement during storm")
        if moved and prev_loc and curr_loc and curr_loc not in NEI.get(prev_loc, []):
            day_violations.append(f"Invalid move from {prev_loc} to {curr_loc} (not adjacent)")
        
        # Check mining constraints
        if action.get("mine", False):
            if curr_loc not in mines:
                day_violations.append(f"Cannot mine at non-mine location {curr_loc}")
            if moved:
                day_violations.append(f"Cannot mine on arrival day")
        
        # Check village purchases
        buyW = action.get("buyW", 0)
        buyF = action.get("buyF", 0)
        if (buyW > 0 or buyF > 0) and curr_loc not in villages:
            day_violations.append(f"Cannot purchase at non-village location {curr_loc}")
        
        # Calculate consumption
        bw = base_cons[w]["water"]
        bf = base_cons[w]["food"]
        if moved:
            consW = move_mult * bw
            consF = move_mult * bf
        else:
            consW = bw
            consF = bf
        
        if action.get("mine", False):
            consW += (mine_mult - 1.0) * bw
            consF += (mine_mult - 1.0) * bf
        
        # Update inventory
        invW += buyW - consW
        invF += buyF - consF
        
        # Check inventory non-negative
        if invW < 0:
            day_violations.append(f"Water shortage: {invW:.1f} Bottles")
        if invF < 0:
            day_violations.append(f"Food shortage: {invF:.1f} Units")
        
        # Check weight limit
        weight = mass["water"] * max(0, invW) + mass["food"] * max(0, invF)
        if weight > weight_limit:
            day_violations.append(f"Weight {weight:.1f} kg exceeds limit {weight_limit} kg")
        
        # Update cash
        purchase_cost = buyW * (2 * prices["water"]) + buyF * (2 * prices["food"])
        mining_income = base_income if action.get("mine", False) else 0
        cash = cash - purchase_cost + mining_income
        
        if cash < 0:
            day_violations.append(f"Cash deficit: {cash:.1f}¥")
        
        violations.extend([f"Day {d}: {v}" for v in day_violations])
        daily_state.append({
            "day": d,
            "location": curr_loc,
            "weather": w,
            "action": "MINE" if action.get("mine", False) else ("MOVE" if moved else "STAY"),
            "buyW": buyW,
            "buyF": buyF,
            "consW": consW,
            "consF": consF,
            "invW": invW,
            "invF": invF,
            "cash": cash,
            "weight": weight,
            "violations": day_violations
        })
    
    # Check terminal condition
    end_node = params.get("end_node", 64)
    if path[-1] != end_node:
        violations.append(f"Did not reach end node {end_node} (ended at {path[-1]})")
    
    # Calculate final score
    refund = refund_factor * (prices["water"] * max(0, invW) + prices["food"] * max(0, invF))
    final_cash = max(0, cash) + refund
    
    return {
        "valid": len(violations) == 0,
        "violations": violations,
        "daily_state": daily_state,
        "final_cash": final_cash,
        "cash_before_refund": cash,
        "refund": refund,
        "score": final_cash if len(violations) == 0 else 0
    }

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=False)
