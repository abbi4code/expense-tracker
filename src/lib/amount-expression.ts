// The number pad's tiny calculator: digits, one decimal point per number, "+" and "−".

export type Operator = "+" | "-";
const OPERATORS = ["+", "-"];

const isOperator = (char: string) => OPERATORS.includes(char);

/** Current (last) number being typed, e.g. "45.5" in "120+45.5". */
function lastNumber(expression: string): string {
  return expression.split(/[+-]/).pop() ?? "";
}

export function pressKey(expression: string, key: string, maxDecimals: number): string {
  if (key === "backspace") return expression.slice(0, -1);

  if (isOperator(key)) {
    if (!expression) return expression; // can't start with an operator
    const last = expression.slice(-1);
    if (isOperator(last)) return expression.slice(0, -1) + key; // swap operator
    if (last === ".") return expression.slice(0, -1) + key;
    return expression + key;
  }

  const current = lastNumber(expression);

  if (key === ".") {
    if (maxDecimals === 0 || current.includes(".")) return expression;
    return expression + (current === "" ? "0." : ".");
  }

  // Digits
  if (current.includes(".") && current.split(".")[1].length >= maxDecimals) return expression;
  if (current.replace(".", "").length >= 9) return expression; // keep amounts sane
  if (current === "0") return expression.slice(0, -1) + key; // no leading zeros
  return expression + key;
}

export function hasOperator(expression: string): boolean {
  return /\d[+-]\d/.test(expression);
}

/** Evaluates left to right. Returns 0 for empty/invalid input. */
export function evaluate(expression: string): number {
  const tokens = expression.match(/[+-]|\d*\.?\d*/g)?.filter(Boolean) ?? [];
  let total = 0;
  let sign = 1;
  for (const token of tokens) {
    if (token === "+") sign = 1;
    else if (token === "-") sign = -1;
    else {
      const value = Number.parseFloat(token);
      if (!Number.isNaN(value)) total += sign * value;
    }
  }
  return Math.round(total * 1e6) / 1e6;
}
