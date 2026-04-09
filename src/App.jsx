import React, { useState, useEffect, useRef } from "react";

var TIERS = {
  low:  { label:"TIER 1", sub:"Low Attendance",    attendance:250, staffReps:0, staffCost:0, marketingPerEvent:0, consultantFee:0, color:"#ff2d7b", glow:"rgba(255,45,123,0.4)",  rgb:"255,45,123"  },
  mid:  { label:"TIER 2", sub:"Medium Attendance", attendance:500, staffReps:0, staffCost:0, marketingPerEvent:0, consultantFee:0, color:"#00f0ff", glow:"rgba(0,240,255,0.4)",  rgb:"0,240,255"  },
  high: { label:"TIER 3", sub:"High Attendance",   attendance:750, staffReps:0, staffCost:0, marketingPerEvent:0, consultantFee:0, color:"#b44aff", glow:"rgba(180,74,255,0.4)",  rgb:"180,74,255"  },
};

var SEASON_MARKETING_BUDGET = 500;

function calcTier(t, events, conversion, avgOrder, cogsPct) {
  var totalAttendance = t.attendance * events;
  var merchSales      = totalAttendance * (conversion / 100) * avgOrder;
  var cogs            = merchSales * (cogsPct / 100);
  var grossProfit     = merchSales - cogs;
  var staffing        = 0;
  var marketing       = SEASON_MARKETING_BUDGET / 3;
  var consultant      = 0;
  var totalExpenses   = staffing + marketing + consultant;
  var netProfit       = grossProfit - totalExpenses;
  var roi             = totalExpenses > 0 ? (netProfit / totalExpenses) * 100 : 0;
  return { totalAttendance:totalAttendance, merchSales:merchSales, cogs:cogs, grossProfit:grossProfit, staffing:staffing, marketing:marketing, consultant:consultant, totalExpenses:totalExpenses, netProfit:netProfit, roi:roi };
}

function fmt(n) {
  var abs = Math.abs(n);
  return (n < 0 ? "-" : "") + "$" + abs.toLocaleString("en-US", { maximumFractionDigits:0 });
}

function pct(n) {
  return (n >= 0 ? "+" : "") + n.toFixed(2) + "%";
}

function breakEvenConversion(t, events, avgOrder, cogsPct) {
  var totalExpenses = SEASON_MARKETING_BUDGET / 3;
  var unitMargin = t.attendance * events * avgOrder * (1 - cogsPct / 100);
  if (unitMargin <= 0) return null;
  return (totalExpenses / unitMargin) * 100;
}

function breakEvenAvgOrder(t, events, conversion, cogsPct) {
  var totalExpenses = SEASON_MARKETING_BUDGET / 3;
  var units = t.attendance * events * (conversion / 100) * (1 - cogsPct / 100);
  if (units <= 0) return null;
  return totalExpenses / units;
}

function generateAnalysis(calcs, events, conversion, avgOrder, cogsPct) {
  var mid = calcs.mid;
  var low = calcs.low;
  var high = calcs.high;
  var allNegative = low.netProfit < 0 && mid.netProfit < 0 && high.netProfit < 0;
  var anyPositive = low.netProfit >= 0 || mid.netProfit >= 0 || high.netProfit >= 0;
  var midPositive = mid.netProfit >= 0;
  var beCv  = breakEvenConversion(TIERS.mid, events, avgOrder, cogsPct);
  var beAov = breakEvenAvgOrder(TIERS.mid, events, conversion, cogsPct);
  var cvGap  = beCv  !== null ? (beCv  - conversion).toFixed(1) : null;
  var aovGap = beAov !== null ? (beAov - avgOrder).toFixed(0)   : null;

  var structural = "";
  if (allNegative) {
    structural = "With volunteer staff and no consultant, the only drag is $500 in seasonal marketing split across tiers. The model is underwater purely because revenue at " + conversion + "% conversion and $" + avgOrder + " AOV is not covering even that minimal overhead. Raise conversion or AOV — nothing else to cut.";
  } else if (anyPositive && !midPositive) {
    structural = "Tier 1 is the only underwater scenario. At 250 attendees per event the revenue pool is too shallow at " + conversion + "% conversion. Tier 2 and Tier 3 are profitable. Focus on driving attendance above 500.";
  } else {
    structural = "All tiers are profitable. With zero staffing cost and no consultant fee, the $500 seasonal marketing budget is the only fixed overhead. Gross margin at " + (100 - cogsPct) + "% is the entire game — protect it by keeping COGS controlled as volume scales.";
  }

  var lever = "";
  if (beCv !== null && cvGap !== null && parseFloat(cvGap) > 0) {
    lever = "Conversion rate. Break-even at Tier 2 requires only " + beCv.toFixed(1) + "% conversion given the stripped cost structure. At " + conversion + "% you are " + cvGap + "pp away. With $167 allocated per tier in marketing, every dollar needs to pull qualified buyers not just impressions.";
  } else if (aovGap !== null && parseFloat(aovGap) > 0) {
    lever = "Average order value. Break-even at Tier 2 sits at " + fmt(Math.ceil(parseFloat(beAov))) + " AOV. Bundle two SKUs and you clear it without touching conversion or attendance.";
  } else {
    lever = "Volume. The cost structure is clean enough that scaling events or attendance directly multiplies net profit with no additional fixed cost drag. Every extra event at current conversion drops almost entirely to the bottom line.";
  }

  var beLines = Object.entries(TIERS).map(function(entry) {
    var t = entry[1];
    var cv  = breakEvenConversion(t, events, avgOrder, cogsPct);
    var aov = breakEvenAvgOrder(t, events, conversion, cogsPct);
    return t.label + ": " + (cv !== null ? cv.toFixed(1) + "% conv" : "N/A") + " or " + (aov !== null ? "$" + Math.ceil(aov) + " AOV" : "N/A");
  }).join(" / ");

  var breakEvenBlock = "Break-even at " + events + " events with $500 total marketing: " + beLines + ". These thresholds are extremely low given the cost structure. Nearly any real sales activity clears them.";

  var angle = "";
  if (avgOrder <= 60) {
    angle = "Bundles. At $" + avgOrder + " AOV the margin per transaction is thin. A two-item bundle at $80-90 pushes AOV up 40-50% with zero additional overhead. One pricing decision, immediate bottom line impact.";
  } else if (conversion <= 10) {
    angle = "Pre-orders tied to event announcements pull committed buyers in before the event. No booth staffing needed to close them. With volunteers running the table, pre-order fulfillment is the highest-leverage activity per labor hour.";
  } else {
    angle = "With this cost structure, profit scales linearly with events. Adding 5 more events at current performance adds roughly " + fmt(Math.round(mid.netProfit / events * 5)) + " in net profit at Tier 2 attendance with zero incremental fixed cost.";
  }

  return [
    "STRUCTURAL PROBLEM\n" + structural,
    "FASTEST LEVER\n" + lever,
    "BREAK-EVEN THRESHOLDS\n" + breakEvenBlock,
    "IGNORED ANGLE\n" + angle,
  ].join("\n\n");
}

function Sparkbar(props) {
  var w = props.max > 0 ? Math.min(100, (Math.abs(props.value) / Math.abs(props.max)) * 100) : 0;
  return React.createElement("div", { style:{ background:"#10102a", height:5, borderRadius:3, overflow:"hidden", marginTop:5 } },
    React.createElement("div", { style:{ width:w+"%", height:"100%", background:props.color, boxShadow:"0 0 8px "+props.glow, borderRadius:3, transition:"width 0.5s ease" } })
  );
}

function StatRow(props) {
  var neg = props.value < 0;
  var c = neg ? "#ff003c" : props.color;
  var g = neg ? "rgba(255,0,60,0.3)" : props.glow;
  return React.createElement("div", { style:{ marginBottom:10 } },
    React.createElement("div", { style:{ display:"flex", justifyContent:"space-between", fontSize:11, letterSpacing:1, color:"#8888aa" } },
      React.createElement("span", null, props.label),
      React.createElement("span", { style:{ color:c, fontFamily:"monospace", fontSize:12 } }, fmt(props.value))
    ),
    React.createElement(Sparkbar, { value:props.value, max:props.max, color:c, glow:g })
  );
}

function TierCard(props) {
  var d = props.data;
  var c = props.calc;
  return React.createElement("div", {
    onClick: function() { props.onClick(props.tierKey); },
    style:{ cursor:"pointer", border:"1px solid "+(props.active?d.color:"#1a1a30"), borderRadius:2, padding:"18px 16px", background:props.active?"rgba("+d.rgb+",0.04)":"#0a0a16", boxShadow:props.active?"0 0 24px "+d.glow+", inset 0 0 30px rgba("+d.rgb+",0.02)":"none", transition:"all 0.3s ease", flex:1, minWidth:0 }
  },
    React.createElement("div", { style:{ fontSize:10, letterSpacing:3, color:d.color, fontWeight:700, marginBottom:2 } }, d.label),
    React.createElement("div", { style:{ fontSize:11, color:"#555570", marginBottom:14, letterSpacing:1 } }, d.sub),
    React.createElement("div", { style:{ fontSize:22, fontFamily:"monospace", color:c.roi>=0?d.color:"#ff003c", marginBottom:2, fontWeight:700 } }, pct(c.roi)),
    React.createElement("div", { style:{ fontSize:10, color:"#444460", letterSpacing:1 } }, "ROI"),
    React.createElement("div", { style:{ marginTop:14, borderTop:"1px solid #161630", paddingTop:12 } },
      React.createElement(StatRow, { label:"GROSS PROFIT",   value:c.grossProfit,   color:d.color, max:120000, glow:d.glow }),
      React.createElement(StatRow, { label:"MARKETING",      value:-c.marketing,    color:d.color, max:120000, glow:d.glow }),
      React.createElement(StatRow, { label:"NET PROFIT",     value:c.netProfit,     color:d.color, max:120000, glow:d.glow })
    )
  );
}

var ROWS = [
  { label:"TOTAL ATTENDANCE", key:"totalAttendance", isCount:true },
  { label:"MERCH REVENUE",    key:"merchSales"    },
  { label:"COGS",             key:"cogs"          },
  { label:"GROSS PROFIT",     key:"grossProfit"   },
  { label:"MARKETING",        key:"marketing"     },
  { label:"NET PROFIT",       key:"netProfit"     },
];

var LABEL_COLORS = ["#ff2d7b","#00f0ff","#b44aff","#ffee00"];

var CSS = [
  "@import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Bebas+Neue&display=swap');",
  "*,*::before,*::after{box-sizing:border-box;}",
  ".sl{-webkit-appearance:none;appearance:none;width:100%;height:2px;border-radius:1px;outline:none;background:#1a1a30;}",
  ".sl-low::-webkit-slider-thumb{-webkit-appearance:none;width:13px;height:13px;border-radius:50%;background:#ff2d7b;cursor:pointer;box-shadow:0 0 10px rgba(255,45,123,0.7);}",
  ".sl-mid::-webkit-slider-thumb{-webkit-appearance:none;width:13px;height:13px;border-radius:50%;background:#00f0ff;cursor:pointer;box-shadow:0 0 10px rgba(0,240,255,0.7);}",
  ".sl-high::-webkit-slider-thumb{-webkit-appearance:none;width:13px;height:13px;border-radius:50%;background:#b44aff;cursor:pointer;box-shadow:0 0 10px rgba(180,74,255,0.7);}",
  ".sl-low::-moz-range-thumb{width:13px;height:13px;border-radius:50%;background:#ff2d7b;cursor:pointer;border:none;}",
  ".sl-mid::-moz-range-thumb{width:13px;height:13px;border-radius:50%;background:#00f0ff;cursor:pointer;border:none;}",
  ".sl-high::-moz-range-thumb{width:13px;height:13px;border-radius:50%;background:#b44aff;cursor:pointer;border:none;}",
  ".blink{animation:blink 1.1s step-end infinite;}",
  "@keyframes blink{50%{opacity:0;}}",
  ".fadeUp{animation:fadeUp 0.35s ease both;}",
  "@keyframes fadeUp{from{opacity:0;transform:translateY(5px);}to{opacity:1;transform:translateY(0);}}",
  ".run-btn:hover:not(:disabled){background:rgba(255,255,255,0.04)!important;}",
  ".run-btn:disabled{cursor:wait;}",
  ".asec{margin-bottom:18px;}",
  ".albl{font-size:9px;letter-spacing:3px;margin-bottom:6px;}",
  ".abdy{font-size:12px;line-height:1.85;color:#8888aa;}",
].join(" ");

export default function App() {
  var s1 = useState(23);    var events     = s1[0]; var setEvents     = s1[1];
  var s2 = useState(10);    var conversion = s2[0]; var setConversion = s2[1];
  var s3 = useState(50);    var avgOrder   = s3[0]; var setAvgOrder   = s3[1];
  var s4 = useState(50);    var cogsPct    = s4[0]; var setCogsPct    = s4[1];
  var s5 = useState("mid"); var activeTier = s5[0]; var setActiveTier = s5[1];
  var s6 = useState("");    var analysis   = s6[0]; var setAnalysis   = s6[1];
  var s7 = useState(false); var running    = s7[0]; var setRunning    = s7[1];
  var s8 = useState(0);     var dotCount   = s8[0]; var setDotCount   = s8[1];
  var s9 = useState(0);     var fadeKey    = s9[0]; var setFadeKey    = s9[1];
  var dotRef = useRef(null);
  var calcs = {
    low:  calcTier(TIERS.low,  events, conversion, avgOrder, cogsPct),
    mid:  calcTier(TIERS.mid,  events, conversion, avgOrder, cogsPct),
    high: calcTier(TIERS.high, events, conversion, avgOrder, cogsPct),
  };
  var ac = calcs[activeTier];
  var at = TIERS[activeTier];
  useEffect(function() { setFadeKey(function(k){return k+1;}); }, [events,conversion,avgOrder,cogsPct,activeTier]);
  useEffect(function() {
    if (running) {
      dotRef.current = setInterval(function(){ setDotCount(function(d){return(d+1)%4;}); }, 380);
    } else {
      clearInterval(dotRef.current);
      setDotCount(0);
    }
    return function(){ clearInterval(dotRef.current); };
  }, [running]);
  function runAnalysis() {
    setRunning(true);
    setAnalysis("");
    setTimeout(function() {
      setAnalysis(generateAnalysis(calcs, events, conversion, avgOrder, cogsPct));
      setRunning(false);
    }, 600);
  }
  var dots = ""; for(var i=0;i<dotCount;i++){dots+=".";}
  var sliders = [
    { label:"EVENTS",          value:events,     set:setEvents,     min:5,  max:52,  step:1,   disp:events+" events" },
    { label:"CONVERSION RATE", value:conversion, set:setConversion, min:1,  max:30,  step:0.5, disp:conversion+"%"   },
    { label:"AVG ORDER VALUE", value:avgOrder,   set:setAvgOrder,   min:20, max:150, step:5,   disp:"$"+avgOrder     },
    { label:"COGS %",          value:cogsPct,    set:setCogsPct,    min:20, max:80,  step:5,   disp:cogsPct+"%"      },
  ];
  return React.createElement("div", { style:{ minHeight:"100vh", background:"#06060e", color:"#e8e8f8", fontFamily:"'Space Mono','Courier New',monospace", padding:"0 20px 32px", maxWidth:900, margin:"0 auto", position:"relative", overflow:"hidden" } },
    React.createElement("style", null, CSS),
    React.createElement("div", { style:{ height:2, background:"linear-gradient(90deg, #ff2d7b, #00f0ff 50%, #b44aff)", boxShadow:"0 0 20px rgba(0,240,255,0.2), 0 2px 10px rgba(180,74,255,0.15)", marginBottom:28 } }),
    React.createElement("div", { style:{ position:"absolute", top:0, left:0, right:0, bottom:0, background:"repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,20,0.015) 3px, rgba(0,0,20,0.015) 4px)", pointerEvents:"none", zIndex:10 } }),
    React.createElement("div", { style:{ marginBottom:32 } },
      React.createElement("div", { style:{ fontSize:10, letterSpacing:4, color:"#3a3a55", marginBottom:6 } }, "KBOCTANE / MERCH INTELLIGENCE"),
      React.createElement("div", { style:{ fontFamily:"'Bebas Neue',sans-serif", fontSize:44, letterSpacing:4, lineHeight:1, color:"#f0f0ff", textShadow:"0 0 30px rgba(0,240,255,0.2), 0 0 60px rgba(180,74,255,0.1)" } }, "ROI DASHBOARD"),
      React.createElement("div", { style:{ fontSize:9, color:"#2a2a44", marginTop:5, letterSpacing:3 } }, "SEASON PROJECTOR - LIVE COMPUTE"),
      React.createElement("div", { style:{ fontSize:9, color:"#444460", marginTop:4, letterSpacing:2 } }, "COST BASIS: $500 SEASON MARKETING / VOLUNTEER STAFF / NO CONSULTANT")
    ),
    React.createElement("div", { style:{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"18px 28px", background:"#0a0a16", border:"1px solid #1a1a30", padding:"20px 18px", borderRadius:2, marginBottom:24 } },
      sliders.map(function(s) {
        return React.createElement("div", { key:s.label },
          React.createElement("div", { style:{ display:"flex", justifyContent:"space-between", fontSize:10, letterSpacing:2, color:"#4a4a65", marginBottom:10 } },
            React.createElement("span", null, s.label),
            React.createElement("span", { style:{ color:"#8888aa", fontFamily:"monospace" } }, s.disp)
          ),
          React.createElement("input", { type:"range", min:s.min, max:s.max, step:s.step, value:s.value, onChange:function(e){s.set(Number(e.target.value));}, className:"sl sl-"+activeTier })
        );
      })
    ),
    React.createElement("div", { style:{ display:"flex", gap:10, marginBottom:24 } },
      Object.entries(TIERS).map(function(entry) {
        return React.createElement(TierCard, { key:entry[0], tierKey:entry[0], data:entry[1], calc:calcs[entry[0]], active:activeTier===entry[0], onClick:setActiveTier });
      })
    ),
    React.createElement("div", { key:"bd"+fadeKey, className:"fadeUp", style:{ border:"1px solid "+at.color+"22", background:"#08081a", padding:"20px 18px", marginBottom:20, borderRadius:2 } },
      React.createElement("div", { style:{ fontSize:10, letterSpacing:3, color:at.color, marginBottom:18 } }, at.label+" - FULL BREAKDOWN"),
      React.createElement("div", { style:{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"14px 12px" } },
        ROWS.map(function(row) {
          var raw = ac[row.key];
          var dv = row.isCount ? raw.toLocaleString("en-US") : fmt(raw);
          return React.createElement("div", { key:row.label, style:{ borderLeft:"2px solid "+at.color+"2a", paddingLeft:10 } },
            React.createElement("div", { style:{ fontSize:9, letterSpacing:2, color:"#383852", marginBottom:5 } }, row.label),
            React.createElement("div", { style:{ fontSize:13, fontFamily:"monospace", color:(!row.isCount&&raw<0)?"#ff003c":"#c0c0d8" } }, dv)
          );
        })
      )
    ),
    React.createElement("div", { style:{ border:"1px solid #14142a", background:"#070714", padding:"20px 18px", borderRadius:2 } },
      React.createElement("div", { style:{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 } },
        React.createElement("div", { style:{ fontSize:10, letterSpacing:3, color:"#333350" } }, "STRATEGIC ANALYSIS ENGINE"),
        React.createElement("button", {
          className:"run-btn", onClick:runAnalysis, disabled:running,
          style:{ background:"none", border:"1px solid "+(running?"#282840":at.color), color:running?"#333350":at.color, fontFamily:"'Space Mono',monospace", fontSize:10, letterSpacing:2, padding:"7px 16px", borderRadius:1, boxShadow:running?"none":"0 0 12px "+at.glow, transition:"all 0.2s ease" }
        }, running?"COMPUTING"+dots:"RUN ANALYSIS")
      ),
      running && React.createElement("div", { style:{ fontSize:12, letterSpacing:1, color:"#2e2e48" } }, "Interrogating the numbers..."),
      !running && analysis && React.createElement("div", { key:"a"+fadeKey, className:"fadeUp", style:{ borderTop:"1px solid #111128", paddingTop:16 } },
        analysis.split("\n\n").map(function(block, i) {
          var lines = block.split("\n");
          return React.createElement("div", { key:i, className:"asec" },
            React.createElement("div", { className:"albl", style:{ color:LABEL_COLORS[i]||"#555570" } }, lines[0]),
            React.createElement("div", { className:"abdy" }, lines.slice(1).join("\n"))
          );
        })
      ),
      !running && !analysis && React.createElement("div", { style:{ fontSize:11, color:"#1e1e38", letterSpacing:2 } }, "- AWAITING TRIGGER -")
    ),
    React.createElement("div", { style:{ marginTop:18, fontSize:9, color:"#1c1c36", letterSpacing:3, textAlign:"right" } }, "KBOCTANE MERCH INTELLIGENCE v3.0 / GHOST ARCHITECTURE SYSTEMS")
  );
}
