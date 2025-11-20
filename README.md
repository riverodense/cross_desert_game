# Desert Crossing 交互建模与求解器

本项目实现：
- 交互式六边形地图（64格，起点=1，终点=64）
- 自定义标注：矿山、村庄、沙漠
- 自定义 30 天天气（晴朗/高温/沙暴）
- 按题意进行 MILP 建模并求解最优策略（最大化最终资金）
- **NEW**: Token-based access control for controller endpoints
- **NEW**: Persistent solution storage with timestamps
- **NEW**: Player panel with optimal solution comparison and analytics
- **NEW**: Configuration persistence across server restarts

规则要点（已内置）：
- 时间单位=天；截止日=30；必须在截止或之前到达终点，且到达后不再离开
- 资源：水(3kg/箱, 5元/箱)；食物(2kg/箱, 10元/箱)；负重≤1200kg
- 基础消耗（停留日）：
  - 晴朗：水5，食7
  - 高温：水8，食6
  - 沙暴：水10，食10
- 行走消耗=2×基础消耗；沙暴日禁止移动
- 挖矿：矿山停留可挖矿，收益=1000元/天；挖矿消耗=2.5×基础消耗；到达矿山当日不可挖；沙暴日允许挖矿
- 采购：第0天在起点一次性按基准价购买；村庄以2倍基准价随时购买；终点退款=0.5×基准价
- 资金不可透支（任一天现金≥0）

## 运行

### 安装依赖
1) 后端：`pip install flask flask-cors pulp`
2) 前端：`npm install`

### 启动服务
1) 后端：`python backend/server.py` (默认端口 8000)
2) 前端：`npm run dev` (默认端口 5173)
3) 浏览器访问 http://localhost:5173

### 生产构建
```bash
npm run build  # 输出到 dist/ 目录
```

## 功能说明

### 地图设置 (Map Setup)
- 点击地图格：沙漠→村庄→矿山→沙漠（Shift=村庄，Alt/Option=矿山）
- 右侧面板编辑 30 天天气
- 点击"求解"查看最优日程、路径与资金/库存曲线

### 控制器管理 (Controller Access Management)

首次启动时，系统会自动生成一个主令牌(Master Token)并保存到 `game_config.json`。

**访问控制功能：**
- **主令牌 (Master Token)**: 拥有完整控制权限，不可撤销
- **常规令牌 (Regular Tokens)**: 可由主令牌添加/删除，用于分发给其他控制器
- **紧急锁 (Emergency Lock)**: 启用后只有主令牌可访问，所有常规令牌被暂停

**受保护的端点：**
- `POST /api/solve` - 求解MILP（需要任意有效令牌）
- `POST /api/config/update` - 更新配置（需要任意有效令牌）
- `POST /api/controller/access/add` - 添加令牌（仅限主令牌）
- `POST /api/controller/access/remove` - 删除令牌（仅限主令牌）
- `POST /api/controller/access/lock` - 切换紧急锁（仅限主令牌）

**使用方法：**
1. 启动后端服务器，在控制台或通过 `POST /api/controller/access/init` 获取主令牌
2. 在前端"控制器管理"标签页输入主令牌或添加常规令牌
3. 令牌会保存在浏览器 localStorage 中，用于后续 API 调用

### 玩家视图 (Player View)

**最优解分享功能：**
- 管理员可通过 `show_solution_to_players` 配置控制是否向玩家公开最优解
- 玩家可通过 `GET /api/solution` 查看最优解（需要开启分享）
- 未开启时返回 403 Forbidden

**对比分析功能：**
- 查看最优解的每日行动、路径、采购计划
- 与玩家自己的解决方案进行对比
- 差异图表：现金、水、食物的累积差异
- 挖矿对比表：对比最优解和玩家解的挖矿天数
- CSV导出：18列详细对比数据，包含天气、位置、行动、资源、现金等

### 配置持久化

系统会自动将配置保存到以下文件：
- `game_config.json` - 包含访问控制令牌、配置选项
- `LAST_SOLUTION.json` - 最近一次的最优解（含生成时间戳）

这些文件会在服务器重启后自动加载，确保配置和解决方案不丢失。

**注意**: 这两个文件包含敏感信息（令牌、解决方案），已添加到 `.gitignore`，不应提交到版本控制。

## API 端点

### 公开端点
- `GET /api/config` - 获取配置（不含主令牌）
- `GET /api/adjacency` - 获取地图邻接关系
- `GET /api/solution` - 获取最优解（需开启 show_solution_to_players）
- `POST /api/controller/access/init` - 获取主令牌（用于初始化）
- `POST /api/controller/access/check` - 验证令牌有效性

### 控制器端点（需要 X-Controller-Token 头）
- `POST /api/solve` - 求解MILP问题
- `POST /api/config/update` - 更新配置
- `POST /api/controller/access/list` - 列出所有令牌
- `POST /api/controller/access/add` - 添加常规令牌（仅主令牌）
- `POST /api/controller/access/remove` - 删除常规令牌（仅主令牌）
- `POST /api/controller/access/lock` - 切换紧急锁（仅主令牌）

## 技术栈
- 前端: Vite + React + TypeScript
- 后端: Flask + PuLP (CBC solver)
- 优化: Mixed Integer Linear Programming (MILP)

## 项目结构
```
cross_desert_game/
├── backend/
│   └── server.py           # Flask API server with access control
├── frontend/
│   ├── src/
│   │   ├── ui/
│   │   │   ├── App.tsx                 # Main application with tabs
│   │   │   ├── HexGrid.tsx             # Hexagonal grid component
│   │   │   ├── WeatherEditor.tsx       # Weather configuration
│   │   │   ├── AccessControlPanel.tsx  # Token management UI
│   │   │   └── PlayerPanel.tsx         # Solution comparison & analytics
│   │   ├── api.ts          # API client with token management
│   │   ├── types.ts        # TypeScript type definitions
│   │   └── main.tsx        # Application entry point
│   └── index.html
├── adjacency.json          # Hex grid adjacency data
├── game_config.json        # Configuration (auto-generated, gitignored)
├── LAST_SOLUTION.json      # Last optimal solution (gitignored)
├── package.json
├── vite.config.ts
└── README.md
```

## 开发说明

### 添加新的控制器功能
1. 在 `backend/server.py` 中添加端点
2. 使用 `@require_controller_auth()` 装饰器保护端点
3. 对于需要主令牌的操作，使用 `@require_controller_auth(master_required=True)`

### 自定义配置
编辑 `game_config.json` 可修改：
- `show_solution_to_players`: 是否向玩家公开最优解
- `controller_lock`: 紧急锁状态
- `controller_tokens`: 常规令牌列表
- `controller_master_token`: 主令牌（首次启动自动生成）

### 故障排除
- **"Missing X-Controller-Token header"**: 需要在请求头中包含有效的控制器令牌
- **"Solution not revealed to players"**: 需要管理员开启 `show_solution_to_players` 配置
- **"Controller locked"**: 紧急锁已启用，只有主令牌可访问
