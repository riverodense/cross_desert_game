import React from "react";
import type { Weather } from "../types";

const OPTIONS: Weather[] = ["Sunny","Hot","Storm"];

export const WeatherEditor: React.FC<{ weather: Weather[]; setWeather: (w:Weather[])=>void; }>=({ weather, setWeather })=>{
  function update(d:number, v:Weather){
    const copy = weather.slice(); copy[d-1] = v; setWeather(copy);
  }
  function fillPreset(){
    const preset: Weather[] = [
      "Hot","Hot","Sunny","Storm","Sunny","Hot","Storm","Sunny","Hot","Hot",
      "Storm","Hot","Sunny","Hot","Hot","Hot","Storm","Storm","Hot","Hot",
      "Sunny","Sunny","Hot","Sunny","Storm","Hot","Sunny","Sunny","Hot","Hot"
    ];
    setWeather(preset);
  }
  return (
    <div>
      <div className="flex">
        <button className="btn" onClick={fillPreset}>一键填充题目天气</button>
        <span className="badge hot">Hot</span>
        <span className="badge sunny">Sunny</span>
        <span className="badge storm">Storm</span>
      </div>
      <div style={{display:"grid", gridTemplateColumns:"repeat(5, 1fr)", gap:6, marginTop:8}}>
        {Array.from({length:30},(_,i)=>i+1).map(d=> (
          <div key={d} className="card" style={{padding:8}}>
            <div style={{marginBottom:4}}>Day {d}</div>
            <select value={weather[d-1]} onChange={e=>update(d, e.target.value as Weather)}>
              {OPTIONS.map(o=> <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
};
