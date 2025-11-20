import React, { useState, useEffect } from "react";
import { getSolution } from "../api";
import type { OptimalSolution } from "../types";

interface PlayerPlanEvaluation {
  isValid: boolean;
  finalCash?: number;
  errorMessage?: string;
}

export const PlayerPanel: React.FC = () => {
  const [optimalSolution, setOptimalSolution] = useState<OptimalSolution | null>(null);
  const [playerEvaluation, setPlayerEvaluation] = useState<PlayerPlanEvaluation | null>(null);
  const [showSolution, setShowSolution] = useState(false);

  useEffect(() => {
    // Poll for optimal solution
    const fetchSolution = async () => {
      const solution = await getSolution();
      if (solution) {
        setOptimalSolution(solution);
      }
    };
    fetchSolution();
    const interval = setInterval(fetchSolution, 5000);
    return () => clearInterval(interval);
  }, []);

  // Mock evaluation function - in real implementation this would evaluate a player's plan
  const evaluatePlayerPlan = () => {
    // For demonstration, using mock data
    const mockPlayerFinalCash = 8500;
    setPlayerEvaluation({
      isValid: true,
      finalCash: mockPlayerFinalCash
    });
  };

  const renderComparison = () => {
    if (!optimalSolution || !playerEvaluation) return null;

    if (!playerEvaluation.isValid) {
      return (
        <div style={{marginTop: 12, padding: 12, background: '#ffebee', borderRadius: 8}}>
          <strong>计划无效:</strong> {playerEvaluation.errorMessage || "请检查您的计划"}
          {showSolution && optimalSolution && (
            <div style={{marginTop: 8}}>
              <strong>最优解最终现金:</strong> ￥{optimalSolution.final_cash.toFixed(2)}
            </div>
          )}
        </div>
      );
    }

    const playerCash = playerEvaluation.finalCash || 0;
    const optimalCash = optimalSolution.final_cash;
    const difference = optimalCash - playerCash;
    const percentage = ((difference / optimalCash) * 100).toFixed(2);

    return (
      <div style={{marginTop: 12, padding: 12, background: '#e3f2fd', borderRadius: 8}}>
        <div style={{fontSize: '14px', lineHeight: '1.8'}}>
          <strong>你的计划最终现金:</strong> ￥{playerCash.toFixed(2)} | 
          <strong> 最优:</strong> ￥{optimalCash.toFixed(2)} | 
          <strong> 差额:</strong> ￥{difference.toFixed(2)} | 
          <strong> 差距:</strong> {percentage}%
        </div>
      </div>
    );
  };

  return (
    <div className="card">
      <h2>玩家视图</h2>
      
      {optimalSolution && showSolution && (
        <div style={{marginTop: 12, padding: 12, background: '#f3e5f5', borderRadius: 8}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
            <strong>最优解生成时间:</strong>
            <span className="badge" style={{background: '#9c27b0'}}>
              {optimalSolution.generated_at}
            </span>
          </div>
        </div>
      )}

      <div className="flex" style={{marginTop: 12}}>
        <button 
          className="btn" 
          onClick={() => setShowSolution(!showSolution)}
          disabled={!optimalSolution}
        >
          {showSolution ? '隐藏最优解' : '显示最优解'}
        </button>
        {!optimalSolution && (
          <span style={{color: 'var(--warn)'}}>等待控制器生成最优解...</span>
        )}
      </div>

      {showSolution && optimalSolution && (
        <>
          <h3>最优解详情</h3>
          <div style={{padding: 12, background: '#f5f5f5', borderRadius: 8}}>
            <div><strong>目标值:</strong> {optimalSolution.objective?.toFixed(2) || 'N/A'}</div>
            <div><strong>最终现金:</strong> ￥{optimalSolution.final_cash.toFixed(2)}</div>
            <div><strong>到达日:</strong> 第 {optimalSolution.arrive_day} 天</div>
          </div>

          <div className="flex" style={{marginTop: 12}}>
            <button className="btn" onClick={evaluatePlayerPlan}>
              评估我的计划
            </button>
          </div>
        </>
      )}

      {renderComparison()}

      <div style={{marginTop: 16, padding: 12, background: '#fff3e0', borderRadius: 8, fontSize: '13px'}}>
        <strong>说明:</strong> 这是玩家界面的演示版本。在实际使用中，玩家可以输入自己的计划，
        系统会自动评估并与最优解进行比较。
      </div>
    </div>
  );
};
