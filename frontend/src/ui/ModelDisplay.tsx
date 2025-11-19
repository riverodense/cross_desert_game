import React, { useState, useEffect } from "react";
import type { SolveRequest } from "../types";

interface ModelDisplayProps {
  params?: SolveRequest;
  showInstance?: boolean;
}

export const ModelDisplay: React.FC<ModelDisplayProps> = ({ params, showInstance = false }) => {
  const [activeTab, setActiveTab] = useState<"general" | "instance">("general");
  const [generalLatex, setGeneralLatex] = useState<string>("");
  const [instanceLatex, setInstanceLatex] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadGeneralModel();
  }, []);

  useEffect(() => {
    if (params && activeTab === "instance") {
      loadInstanceModel();
    }
  }, [params, activeTab]);

  const loadGeneralModel = async () => {
    try {
      const res = await fetch("/api/latex/general");
      const data = await res.json();
      setGeneralLatex(data.latex);
    } catch (err) {
      console.error("Failed to load general model:", err);
    }
  };

  const loadInstanceModel = async () => {
    if (!params) return;
    setLoading(true);
    try {
      const res = await fetch("/api/latex/instance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ params }),
      });
      const data = await res.json();
      setInstanceLatex(data.latex);
    } catch (err) {
      console.error("Failed to load instance model:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Trigger MathJax rendering when content changes
    if ((window as any).MathJax && (window as any).MathJax.typeset) {
      setTimeout(() => {
        (window as any).MathJax.typeset();
      }, 100);
    }
  }, [generalLatex, instanceLatex, activeTab]);

  return (
    <div className="card">
      <h2>MILP Model</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button
          className={`btn ${activeTab === "general" ? "primary" : ""}`}
          onClick={() => setActiveTab("general")}
        >
          General Model
        </button>
        {showInstance && params && (
          <button
            className={`btn ${activeTab === "instance" ? "primary" : ""}`}
            onClick={() => setActiveTab("instance")}
          >
            Instance Parameters
          </button>
        )}
      </div>

      {activeTab === "general" && (
        <div className="latex-content" style={{ maxHeight: "600px", overflowY: "auto" }}>
          {generalLatex ? (
            <div dangerouslySetInnerHTML={{ __html: `\\[${generalLatex}\\]` }} />
          ) : (
            <p>Loading model...</p>
          )}
        </div>
      )}

      {activeTab === "instance" && (
        <div className="latex-content" style={{ maxHeight: "600px", overflowY: "auto" }}>
          {loading ? (
            <p>Loading instance parameters...</p>
          ) : instanceLatex ? (
            <div dangerouslySetInnerHTML={{ __html: `\\[${instanceLatex}\\]` }} />
          ) : (
            <p>No instance data available</p>
          )}
        </div>
      )}
    </div>
  );
};
