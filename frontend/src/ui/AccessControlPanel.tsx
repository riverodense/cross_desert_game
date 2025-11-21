import React, { useState, useEffect } from "react";
import { listTokens, addToken, removeToken, setLock } from "../api";

interface AccessControlPanelProps {
  onAuthLost?: () => void;
}

export const AccessControlPanel: React.FC<AccessControlPanelProps> = ({ onAuthLost }) => {
  const [masterToken, setMasterToken] = useState<string | null>(null);
  const [tokens, setTokens] = useState<string[]>([]);
  const [locked, setLocked] = useState(false);
  const [isMaster, setIsMaster] = useState(false);
  const [showMaster, setShowMaster] = useState(false);
  const [newTokenInput, setNewTokenInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = async () => {
    try {
      setError("");
      const data = await listTokens();
      setMasterToken(data.master_token);
      setTokens(data.tokens);
      setLocked(data.lock);
      setIsMaster(data.is_master);
      setLoading(false);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
      if (err.message.includes("403") || err.message.includes("Unauthorized")) {
        onAuthLost?.();
      }
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddToken = async () => {
    if (!newTokenInput.trim()) {
      setError("Token cannot be empty");
      return;
    }
    try {
      setError("");
      await addToken(newTokenInput.trim());
      setNewTokenInput("");
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRemoveToken = async (token: string) => {
    try {
      setError("");
      await removeToken(token);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleToggleLock = async () => {
    try {
      setError("");
      await setLock(!locked);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Copied to clipboard!");
  };

  if (loading) {
    return <div className="card"><p>Loading access control...</p></div>;
  }

  return (
    <div className="card">
      <h2>访问控制</h2>
      
      {error && <div style={{color: "var(--bad)", marginBottom: 8}}>{error}</div>}
      
      {isMaster && masterToken && (
        <div style={{marginBottom: 16}}>
          <h3>主令牌 (Master Token)</h3>
          <div className="flex" style={{gap: 8}}>
            <input
              type={showMaster ? "text" : "password"}
              value={masterToken}
              readOnly
              style={{flex: 1, fontFamily: "monospace"}}
            />
            <button className="btn" onClick={() => setShowMaster(!showMaster)}>
              {showMaster ? "隐藏" : "显示"}
            </button>
            <button className="btn" onClick={() => copyToClipboard(masterToken)}>
              复制
            </button>
          </div>
          <p style={{fontSize: "0.9em", color: "#666"}}>
            主令牌拥有所有权限，请妥善保管。
          </p>
        </div>
      )}

      <div style={{marginBottom: 16}}>
        <h3>锁定模式</h3>
        <div className="flex" style={{gap: 8, alignItems: "center"}}>
          <label>
            <input
              type="checkbox"
              checked={locked}
              onChange={handleToggleLock}
              disabled={!isMaster}
            />
            {" "}启用紧急锁定
          </label>
        </div>
        <p style={{fontSize: "0.9em", color: "#666"}}>
          启用后，只有主令牌可以访问控制器界面。
        </p>
      </div>

      {isMaster && (
        <div style={{marginBottom: 16}}>
          <h3>令牌管理</h3>
          <div className="flex" style={{gap: 8, marginBottom: 8}}>
            <input
              type="text"
              placeholder="输入新令牌"
              value={newTokenInput}
              onChange={(e) => setNewTokenInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleAddToken()}
              style={{flex: 1}}
            />
            <button className="btn" onClick={handleAddToken}>
              添加令牌
            </button>
          </div>
          
          <div>
            <strong>已授权令牌 ({tokens.length})</strong>
            {tokens.length === 0 ? (
              <p style={{color: "#666"}}>暂无令牌</p>
            ) : (
              <ul style={{listStyle: "none", padding: 0}}>
                {tokens.map((token, idx) => (
                  <li key={idx} style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px",
                    marginBottom: "4px",
                    backgroundColor: "#f5f5f5",
                    borderRadius: "4px"
                  }}>
                    <code style={{fontFamily: "monospace", fontSize: "0.9em"}}>{token}</code>
                    <button
                      className="btn"
                      onClick={() => handleRemoveToken(token)}
                      style={{padding: "4px 8px", fontSize: "0.9em"}}
                    >
                      撤销
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
