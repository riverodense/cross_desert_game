import React, { useState, useEffect } from "react";
import * as api from "../api";

export function AccessControlPanel() {
  const [masterToken, setMasterToken] = useState("");
  const [tokens, setTokens] = useState<string[]>([]);
  const [lock, setLock] = useState(false);
  const [newToken, setNewToken] = useState("");
  const [showMaster, setShowMaster] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadTokens();
  }, []);

  async function loadTokens() {
    try {
      const data = await api.listTokens();
      setMasterToken(data.master_token || "");
      setTokens(data.tokens || []);
      setLock(data.lock || false);
    } catch (err: any) {
      setMessage(`Failed to load tokens: ${err.message}`);
    }
  }

  async function handleAddToken() {
    if (!newToken.trim()) {
      setMessage("Token cannot be empty");
      return;
    }
    try {
      await api.addToken(newToken.trim());
      setMessage("Token added successfully");
      setNewToken("");
      await loadTokens();
    } catch (err: any) {
      setMessage(`Failed to add token: ${err.message}`);
    }
  }

  async function handleRemoveToken(token: string) {
    try {
      await api.removeToken(token);
      setMessage("Token removed successfully");
      await loadTokens();
    } catch (err: any) {
      setMessage(`Failed to remove token: ${err.message}`);
    }
  }

  async function handleToggleLock() {
    try {
      await api.setLock(!lock);
      setLock(!lock);
      setMessage(`Lock ${!lock ? "enabled" : "disabled"}`);
    } catch (err: any) {
      setMessage(`Failed to toggle lock: ${err.message}`);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setMessage("Copied to clipboard!");
  }

  return (
    <div style={{ padding: "20px", border: "1px solid #ccc", borderRadius: "5px", marginTop: "20px" }}>
      <h3>Access Control</h3>
      
      {message && (
        <div style={{ padding: "10px", background: "#e7f3ff", border: "1px solid #b3d9ff", borderRadius: "3px", marginBottom: "10px" }}>
          {message}
        </div>
      )}

      <div style={{ marginBottom: "20px" }}>
        <h4>Master Token</h4>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <input
            type={showMaster ? "text" : "password"}
            value={masterToken}
            readOnly
            style={{ flex: 1, padding: "5px", fontFamily: "monospace" }}
          />
          <button onClick={() => setShowMaster(!showMaster)}>
            {showMaster ? "Hide" : "Reveal"}
          </button>
          <button onClick={() => copyToClipboard(masterToken)}>
            Copy
          </button>
        </div>
        <p style={{ fontSize: "0.9em", color: "#666", marginTop: "5px" }}>
          Master token has full access and cannot be revoked.
        </p>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <h4>Emergency Lock</h4>
        <label style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <input
            type="checkbox"
            checked={lock}
            onChange={handleToggleLock}
          />
          <span>Lock controller access (only master token allowed)</span>
        </label>
        <p style={{ fontSize: "0.9em", color: "#666", marginTop: "5px" }}>
          When locked, all regular tokens are disabled. Only the master token can access controller functions.
        </p>
      </div>

      <div>
        <h4>Regular Tokens</h4>
        <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
          <input
            type="text"
            placeholder="Enter new token..."
            value={newToken}
            onChange={(e) => setNewToken(e.target.value)}
            style={{ flex: 1, padding: "5px" }}
          />
          <button onClick={handleAddToken}>Add Token</button>
        </div>

        {tokens.length === 0 ? (
          <p style={{ color: "#999", fontStyle: "italic" }}>No regular tokens added yet.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {tokens.map((token, idx) => (
              <li key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px", background: "#f5f5f5", marginBottom: "5px", borderRadius: "3px" }}>
                <code style={{ flex: 1 }}>{token}</code>
                <button onClick={() => handleRemoveToken(token)} style={{ marginLeft: "10px" }}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
