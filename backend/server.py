from __future__ import annotations
from flask import Flask, request, jsonify
from flask_cors import CORS
from pathlib import Path
import json
import pulp
import time
import secrets
from functools import wraps

app = Flask(__name__)
CORS(app)

# Global storage for the last optimal solution
LAST_SOLUTION = None

ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "game_config.json"
SOLUTION_PATH = ROOT / "LAST_SOLUTION.json"

# Use UTF-8-SIG so a BOM at the start doesn't break JSON parsing
with open(ROOT / "adjacency.json", "r", encoding="utf-8-sig") as f:
    ADJ = json.load(f)
NEI = {int(k): v for k, v in ADJ.items()}

# Load LAST_SOLUTION from disk on startup
def load_solution():
    """Load last solution from disk"""
    global LAST_SOLUTION
    if SOLUTION_PATH.exists():
        try:
            with open(SOLUTION_PATH, "r", encoding="utf-8") as f:
                LAST_SOLUTION = json.load(f)
                print(f"Loaded previous solution generated at: {LAST_SOLUTION.get('generated_at', 'unknown')}")
        except Exception as e:
            print(f"Could not load previous solution: {e}")
            LAST_SOLUTION = None

def save_solution():
    """Save LAST_SOLUTION to disk"""
    if LAST_SOLUTION is not None:
        try:
            with open(SOLUTION_PATH, "w", encoding="utf-8") as f:
                json.dump(LAST_SOLUTION, f, indent=2)
        except Exception as e:
            print(f"Could not save solution: {e}")

# Configuration management
def load_config():
    """Load game configuration from JSON file."""
    if not CONFIG_PATH.exists():
        # Create default configuration
        config = {
            "controller_master_token": secrets.token_hex(16),
            "controller_tokens": [],
            "controller_lock": False,
            "show_solution_to_players": False
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
    if "show_solution_to_players" not in config:
        config["show_solution_to_players"] = False
    
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

# API Endpoints

@app.get("/api/config/get")
def api_get_config():
    """Get current game configuration (public parts)"""
    config = load_config()
    return jsonify({
        "show_solution_to_players": config.get("show_solution_to_players", False),
        "controller_lock": config.get("controller_lock", False)
    })

@app.post("/api/config/update")
@require_controller_auth(master_required=True)
def api_update_config():
    """Update game configuration (controller only)"""
    data = request.get_json(force=True)
    config = load_config()
    
    if "show_solution_to_players" in data:
        config["show_solution_to_players"] = bool(data["show_solution_to_players"])
    if "controller_lock" in data:
        config["controller_lock"] = bool(data["controller_lock"])
    
    save_config(config)
    return jsonify({"status": "ok", "config": config})

@app.get("/api/adjacency")
def api_adjacency():
    """Get adjacency map"""
    return jsonify(NEI)

@app.get("/api/solution")
def api_solution():
    """Get the last optimal solution with timestamp"""
    config = load_config()
    
    # Check if solution can be shown to players
    token = request.headers.get("X-Controller-Token")
    auth_result = check_controller_auth(token)
    
    if not auth_result["authorized"] and not config.get("show_solution_to_players", False):
        return jsonify({"error": "Solution not available"}), 403
    
    if LAST_SOLUTION is None:
        return jsonify({"error": "No solution available yet"}), 404
    
    return jsonify(LAST_SOLUTION)

@app.post("/api/solve")
@require_controller_auth()
def api_solve():
    global LAST_SOLUTION
    data = request.get_json(force=True)
    result = solve_milp(data)
    
    # If optimal solution found, store it with timestamp
    if result.get("status") == "Optimal":
        LAST_SOLUTION = {
            "status": "Optimal",
            "generated_at": time.strftime('%Y-%m-%d %H:%M:%S', time.localtime()),
            "objective": result["objective"],
            "final_cash": result["final_cash"],
            "arrive_day": result["arrive_day"],
            "path": result["path"],
            "daily": result["daily"],
            "purchases": result["purchases"]
        }
        result["generated_at"] = LAST_SOLUTION["generated_at"]
        save_solution()
    
    return jsonify(result)

def solve_milp(payload: dict):
    D = int(payload.get("deadline", 30))
    start = int(payload.get("start_node", 1))
    end = int(payload.get("end_node", 64))
    initial_cash = float(payload["initial_cash"]) 
    weight_limit = float(payload["weight_limit_kg"]) 
    prices = payload["prices"]; mass = payload["mass"]
    refund_factor = float(payload["refund_factor"])
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
        income = pulp.lpSum(mine[(d,i)] * 1000 for i in mines) if mines else 0
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

def build_general_latex(params: dict) -> str:
    """Build comprehensive MILP formulation LaTeX with dynamic weather."""
    D = params.get("deadline", 30)
    weather = params.get("weather", ["Sunny"] * 30)
    base_cons = params.get("base_consumption", {
        "Sunny": {"water": 5, "food": 7},
        "Hot": {"water": 8, "food": 6},
        "Storm": {"water": 10, "food": 10}
    })
    move_mult = params.get("move_multiplier", 2.0)
    mine_mult = params.get("mine_multiplier", 2.5)
    prices = params.get("prices", {"water": 5, "food": 10})
    mass = params.get("mass", {"water": 3, "food": 2})
    initial_cash = params.get("initial_cash", 10000)
    weight_limit = params.get("weight_limit_kg", 1200)
    refund_factor = params.get("refund_factor", 0.5)
    
    # Build weather string for display
    weather_str = ", ".join([f"d_{{{i+1}}}={w[:2]}" for i, w in enumerate(weather[:10])]) + ", \\ldots"
    
    latex = r"""\begin{align*}
\textbf{Variables:} \\
& x_{d,i} \in \{0,1\} \quad \forall d \in [0,D], i \in V \quad \text{(位置)} \\
& \text{stay}_{d,i} \in \{0,1\} \quad \forall d \in [1,D], i \in V \quad \text{(停留)} \\
& m_{d,i,j} \in \{0,1\} \quad \forall d \in [1,D], (i,j) \in E \quad \text{(移动, 非沙暴日)} \\
& \text{mine}_{d,i} \in \{0,1\} \quad \forall d \in [1,D], i \in M \quad \text{(挖矿)} \\
& \text{buyW}_0, \text{buyF}_0 \in \mathbb{Z}_+ \quad \text{(第0天购买)} \\
& \text{buyW}_{d,i}, \text{buyF}_{d,i} \in \mathbb{Z}_+ \quad \forall d \in [1,D], i \in V_{\text{vil}} \quad \text{(村庄购买)} \\
& \text{InvW}_d, \text{InvF}_d \in \mathbb{Z}_+ \quad \forall d \in [0,D] \quad \text{(库存)} \\
& \text{Cash}_d \in \mathbb{R}_+ \quad \forall d \in [0,D] \quad \text{(现金)} \\
\\
\textbf{Objective:} \\
& \max \quad \text{Cash}_D + """ + f"{refund_factor}" + r""" \times (""" + f"{prices['water']}" + r""" \cdot \text{InvW}_D + """ + f"{prices['food']}" + r""" \cdot \text{InvF}_D) \\
\\
\textbf{Constraints:} \\
& x_{0,1} = 1, \quad x_{0,i} = 0 \; \forall i \neq 1 \quad \text{(起点)} \\
& x_{D,64} = 1, \quad x_{d-1,64} \leq x_{d,64} \; \forall d \in [1,D] \quad \text{(终点)} \\
& \sum_{i \in V} x_{d,i} = 1 \quad \forall d \in [0,D] \quad \text{(唯一位置)} \\
\\
& \text{若第d天非沙暴:} \quad \text{stay}_{d,i} + \sum_{j \in N(i)} m_{d,i,j} = x_{d-1,i} \quad \forall i \in V \\
& \qquad\qquad\qquad x_{d,j} = \text{stay}_{d,j} + \sum_{i \in N(j)} m_{d,i,j} \quad \forall j \in V \\
& \text{若第d天沙暴:} \quad \text{stay}_{d,i} = x_{d-1,i} \quad \forall i \in V \\
\\
& \text{mine}_{d,i} \leq \text{stay}_{d,i} \quad \forall d \in [1,D], i \in M \\
& \text{mine}_{d,i} \leq 1 - \text{arrive}_{d,i}, \quad \text{arrive}_{d,i} \geq x_{d,i} - x_{d-1,i} \quad \text{(到达当日禁挖)} \\
\\
& \text{buyW}_{d,i}, \text{buyF}_{d,i} \leq BIG \cdot x_{d,i} \quad \forall d \in [1,D], i \in V_{\text{vil}} \\
\\
& \text{Cash}_0 = """ + f"{initial_cash}" + r""" - (""" + f"{prices['water']}" + r""" \cdot \text{buyW}_0 + """ + f"{prices['food']}" + r""" \cdot \text{buyF}_0) \\
& \text{InvW}_0 = \text{buyW}_0, \quad \text{InvF}_0 = \text{buyF}_0 \\
& """ + f"{mass['water']}" + r""" \cdot \text{InvW}_0 + """ + f"{mass['food']}" + r""" \cdot \text{InvF}_0 \leq """ + f"{weight_limit}" + r""" \\
\\
& \text{消耗公式 (第d天):} \\
& \quad \text{consW}_d = \sum_{i \in V} \text{stay}_{d,i} \cdot b^w_d + """ + f"{move_mult}" + r""" \cdot \sum_{(i,j) \in E} m_{d,i,j} \cdot b^w_d \\
& \qquad\qquad\qquad + """ + f"({mine_mult}-1)" + r""" \cdot \sum_{i \in M} \text{mine}_{d,i} \cdot b^w_d \\
& \quad \text{consF}_d = \sum_{i \in V} \text{stay}_{d,i} \cdot b^f_d + """ + f"{move_mult}" + r""" \cdot \sum_{(i,j) \in E} m_{d,i,j} \cdot b^f_d \\
& \qquad\qquad\qquad + """ + f"({mine_mult}-1)" + r""" \cdot \sum_{i \in M} \text{mine}_{d,i} \cdot b^f_d \\
& \quad \text{其中 } b^w_d, b^f_d \text{ 为第d天天气基础消耗 (""" + weather_str + r""")} \\
\\
& \text{InvW}_d = \text{InvW}_{d-1} + \sum_{i \in V_{\text{vil}}} \text{buyW}_{d,i} - \text{consW}_d \quad \forall d \in [1,D] \\
& \text{InvF}_d = \text{InvF}_{d-1} + \sum_{i \in V_{\text{vil}}} \text{buyF}_{d,i} - \text{consF}_d \quad \forall d \in [1,D] \\
& \text{InvW}_d, \text{InvF}_d \geq 0, \quad """ + f"{mass['water']}" + r""" \cdot \text{InvW}_d + """ + f"{mass['food']}" + r""" \cdot \text{InvF}_d \leq """ + f"{weight_limit}" + r""" \quad \forall d \in [1,D] \\
\\
& \text{Cash}_d = \text{Cash}_{d-1} - \sum_{i \in V_{\text{vil}}} (""" + f"{2*prices['water']}" + r""" \cdot \text{buyW}_{d,i} + """ + f"{2*prices['food']}" + r""" \cdot \text{buyF}_{d,i}) \\
& \qquad\qquad + \sum_{i \in M} 1000 \cdot \text{mine}_{d,i} \quad \forall d \in [1,D] \\
& \text{Cash}_d \geq 0 \quad \forall d \in [1,D] \quad \text{(不可透支)}
\end{align*}"""
    
    return latex

@app.get("/api/latex")
def api_latex():
    """Return MILP formulation as LaTeX, with optional weather parameter."""
    params = request.args.to_dict()
    if "weather" in params:
        import json as js
        params["weather"] = js.loads(params["weather"])
    if "base_consumption" in params:
        import json as js
        params["base_consumption"] = js.loads(params["base_consumption"])
    if "prices" in params:
        import json as js
        params["prices"] = js.loads(params["prices"])
    if "mass" in params:
        import json as js
        params["mass"] = js.loads(params["mass"])
    latex = build_general_latex(params)
    return jsonify({"latex": latex})


if __name__ == "__main__":
    # Load previous solution on startup
    load_solution()
    
    # Load or create config
    config = load_config()
    print(f"=== Desert Crossing Game Server ===")
    print(f"Controller Master Token: {config['controller_master_token']}")
    print(f"Server starting on http://0.0.0.0:8000")
    
    app.run(host="0.0.0.0", port=8000, debug=False)
