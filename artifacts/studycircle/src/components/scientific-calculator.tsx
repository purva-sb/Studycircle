import { useState, useCallback } from "react";
import { X } from "lucide-react";

interface Props { onClose: () => void }

type Mode = "deg" | "rad";

export function ScientificCalculator({ onClose }: Props) {
  const [display, setDisplay] = useState("0");
  const [expr, setExpr] = useState("");
  const [memory, setMemory] = useState(0);
  const [mode, setMode] = useState<Mode>("deg");
  const [justCalc, setJustCalc] = useState(false);

  const toRad = (v: number) => mode === "deg" ? (v * Math.PI) / 180 : v;
  const fromRad = (v: number) => mode === "deg" ? (v * 180) / Math.PI : v;

  const press = useCallback((val: string) => {
    setDisplay((prev) => {
      if (justCalc && /[\d.]/.test(val)) { setJustCalc(false); setExpr(""); return val; }
      setJustCalc(false);
      if (prev === "0" && /[\d]/.test(val) && val !== ".") return val;
      if (val === "." && prev.includes(".")) return prev;
      return prev + val;
    });
  }, [justCalc]);

  const applyOp = (op: string) => {
    const cur = parseFloat(display);
    setExpr(display + " " + op + " ");
    setDisplay("0");
    setJustCalc(false);
    return cur;
  };

  const calculate = () => {
    try {
      // Parse simple expression: number op number
      const full = expr + display;
      const match = full.match(/^(-?[\d.]+)\s*([\+\-\*\/\%])\s*(-?[\d.]+)$/);
      if (!match) return;
      const [, a, op, b] = match;
      const av = parseFloat(a), bv = parseFloat(b);
      let result = 0;
      if (op === "+") result = av + bv;
      else if (op === "-") result = av - bv;
      else if (op === "*") result = av * bv;
      else if (op === "/") result = bv !== 0 ? av / bv : NaN;
      else if (op === "%") result = av % bv;
      const str = isNaN(result) ? "Error" : parseFloat(result.toPrecision(12)).toString();
      setDisplay(str); setExpr(""); setJustCalc(true);
    } catch { setDisplay("Error"); }
  };

  const sciFunc = (fn: string) => {
    const v = parseFloat(display);
    let result: number;
    switch (fn) {
      case "sin":   result = Math.sin(toRad(v)); break;
      case "cos":   result = Math.cos(toRad(v)); break;
      case "tan":   result = Math.tan(toRad(v)); break;
      case "asin":  result = fromRad(Math.asin(v)); break;
      case "acos":  result = fromRad(Math.acos(v)); break;
      case "atan":  result = fromRad(Math.atan(v)); break;
      case "sinh":  result = Math.sinh(v); break;
      case "cosh":  result = Math.cosh(v); break;
      case "tanh":  result = Math.tanh(v); break;
      case "log":   result = Math.log10(v); break;
      case "ln":    result = Math.log(v); break;
      case "sqrt":  result = Math.sqrt(v); break;
      case "cbrt":  result = Math.cbrt(v); break;
      case "x2":    result = v * v; break;
      case "x3":    result = v * v * v; break;
      case "inv":   result = 1 / v; break;
      case "abs":   result = Math.abs(v); break;
      case "fact":  result = factorial(v); break;
      case "exp":   result = Math.exp(v); break;
      case "10x":   result = Math.pow(10, v); break;
      case "neg":   result = -v; break;
      default: return;
    }
    setDisplay(isNaN(result) ? "Error" : parseFloat(result.toPrecision(12)).toString());
    setJustCalc(true);
  };

  const clear = () => { setDisplay("0"); setExpr(""); setJustCalc(false); };
  const backspace = () => setDisplay((p) => p.length > 1 ? p.slice(0, -1) : "0");

  const btn = (label: string, onClick: () => void, cls = "") => (
    <button key={label} onClick={onClick}
      className={`h-9 rounded text-xs font-semibold border border-gray-300 hover:opacity-80 active:scale-95 transition-all ${cls}`}>
      {label}
    </button>
  );

  return (
    <div className="fixed bottom-20 right-4 z-[60] w-80 bg-gray-100 border border-gray-400 rounded shadow-2xl select-none"
      style={{ colorScheme: "light" }}>
      {/* Title bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-200 border-b border-gray-400 rounded-t">
        <span className="text-xs font-bold text-gray-700">Scientific Calculator</span>
        <button onClick={onClose} className="text-gray-600 hover:text-black"><X className="w-4 h-4" /></button>
      </div>

      {/* Display */}
      <div className="mx-2 mt-2 mb-1 space-y-0.5">
        <div className="h-5 text-right text-xs text-gray-500 px-2 bg-white border border-gray-300 rounded truncate">{expr || " "}</div>
        <div className="h-10 text-right text-xl font-mono font-bold px-2 bg-white border border-gray-300 rounded flex items-center justify-end overflow-hidden">
          {display.length > 14 ? parseFloat(display).toExponential(6) : display}
        </div>
      </div>

      {/* Deg/Rad */}
      <div className="px-2 pb-1 flex items-center gap-2 text-xs text-gray-600">
        {(["deg", "rad"] as Mode[]).map((m) => (
          <label key={m} className="flex items-center gap-1 cursor-pointer">
            <input type="radio" checked={mode === m} onChange={() => setMode(m)} className="accent-blue-600" />
            {m.toUpperCase()}
          </label>
        ))}
      </div>

      <div className="px-2 pb-2 space-y-1">
        {/* Memory row */}
        <div className="grid grid-cols-5 gap-1">
          {btn("MC", () => setMemory(0), "bg-gray-200 text-gray-700")}
          {btn("MR", () => { setDisplay(memory.toString()); setJustCalc(true); }, "bg-gray-200 text-gray-700")}
          {btn("MS", () => setMemory(parseFloat(display)), "bg-gray-200 text-gray-700")}
          {btn("M+", () => setMemory((m) => m + parseFloat(display)), "bg-gray-200 text-gray-700")}
          {btn("M−", () => setMemory((m) => m - parseFloat(display)), "bg-gray-200 text-gray-700")}
        </div>

        {/* Sci row 1 */}
        <div className="grid grid-cols-5 gap-1">
          {btn("sinh", () => sciFunc("sinh"), "bg-white")}
          {btn("cosh", () => sciFunc("cosh"), "bg-white")}
          {btn("tanh", () => sciFunc("tanh"), "bg-white")}
          {btn("Exp", () => sciFunc("exp"), "bg-white")}
          {btn("(", () => press("("), "bg-white")}
        </div>

        {/* Sci row 2 */}
        <div className="grid grid-cols-5 gap-1">
          {btn("sin⁻¹", () => sciFunc("asin"), "bg-white")}
          {btn("cos⁻¹", () => sciFunc("acos"), "bg-white")}
          {btn("tan⁻¹", () => sciFunc("atan"), "bg-white")}
          {btn("ln", () => sciFunc("ln"), "bg-white")}
          {btn("log", () => sciFunc("log"), "bg-white")}
        </div>

        {/* Sci row 3 */}
        <div className="grid grid-cols-5 gap-1">
          {btn("π", () => { setDisplay(Math.PI.toString()); setJustCalc(true); }, "bg-white")}
          {btn("e", () => { setDisplay(Math.E.toString()); setJustCalc(true); }, "bg-white")}
          {btn("n!", () => sciFunc("fact"), "bg-white")}
          {btn("√x", () => sciFunc("sqrt"), "bg-white")}
          {btn("∛x", () => sciFunc("cbrt"), "bg-white")}
        </div>

        {/* Sci row 4 */}
        <div className="grid grid-cols-5 gap-1">
          {btn("sin", () => sciFunc("sin"), "bg-white")}
          {btn("cos", () => sciFunc("cos"), "bg-white")}
          {btn("tan", () => sciFunc("tan"), "bg-white")}
          {btn("xʸ", () => applyOp("^"), "bg-white")}
          {btn("x²", () => sciFunc("x2"), "bg-white")}
        </div>

        <div className="border-t border-gray-300 my-1" />

        {/* Number pad + ops */}
        <div className="grid grid-cols-5 gap-1">
          {/* col 1-4: back, C, +/-, / */}
          {btn("⌫", backspace, "bg-red-400 text-white")}
          {btn("C", clear, "bg-red-500 text-white")}
          {btn("+/−", () => sciFunc("neg"), "bg-red-400 text-white")}
          {btn("√", () => sciFunc("sqrt"), "bg-gray-200")}
          {btn("÷", () => applyOp("/"), "bg-gray-200 font-bold")}

          {btn("7", () => press("7"), "bg-white")}
          {btn("8", () => press("8"), "bg-white")}
          {btn("9", () => press("9"), "bg-white")}
          {btn("%", () => applyOp("%"), "bg-gray-200")}
          {btn("×", () => applyOp("*"), "bg-gray-200 font-bold")}

          {btn("4", () => press("4"), "bg-white")}
          {btn("5", () => press("5"), "bg-white")}
          {btn("6", () => press("6"), "bg-white")}
          {btn("1/x", () => sciFunc("inv"), "bg-gray-200")}
          {btn("−", () => applyOp("-"), "bg-gray-200 font-bold")}

          {btn("1", () => press("1"), "bg-white")}
          {btn("2", () => press("2"), "bg-white")}
          {btn("3", () => press("3"), "bg-white")}
          {btn("|x|", () => sciFunc("abs"), "bg-gray-200")}
          {/* = spans 2 rows — use a regular button with extra height */}
          <button onClick={calculate}
            className="row-span-2 h-[76px] rounded text-sm font-bold bg-green-500 text-white border border-green-600 hover:opacity-90 active:scale-95"
            style={{ gridRow: "span 2" }}>
            =
          </button>

          {btn("0", () => press("0"), "bg-white col-span-2")}
          {btn(".", () => press("."), "bg-white")}
          {btn("+", () => applyOp("+"), "bg-gray-200 font-bold")}
        </div>
      </div>
    </div>
  );
}

function factorial(n: number): number {
  if (!Number.isInteger(n) || n < 0) return NaN;
  if (n <= 1) return 1;
  if (n > 170) return Infinity;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}
