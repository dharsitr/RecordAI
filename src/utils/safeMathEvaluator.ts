import { evaluate } from 'mathjs';

export interface MathEvalResult {
  success: boolean;
  result: string | null;
  error: string | null;
}

/**
 * Safely evaluates a mathematical expression using mathjs sandboxed evaluator.
 * NEVER uses eval() or Function constructor.
 *
 * @param expression Math expression string e.g. "avg(Volume) * 2.5 + sqrt(Mass)"
 * @param scope Variable inputs scope object e.g. { Volume: [10, 20, 30], Mass: 50.4 }
 */
export function safeEvaluateFormula(
  expression: string,
  scope: Record<string, any> = {}
): MathEvalResult {
  if (!expression || expression.trim() === '') {
    return { success: true, result: '', error: null };
  }

  try {
    // Clone scope and add custom helper functions
    const evalScope: Record<string, any> = { ...scope };

    // Helper: avg() for array averages
    evalScope.avg = function (...args: any[]) {
      const flattened = args.flat(Infinity).map((n) => Number(n)).filter((n) => !isNaN(n));
      if (flattened.length === 0) return 0;
      const sum = flattened.reduce((acc, curr) => acc + curr, 0);
      return sum / flattened.length;
    };

    // Helper: sum() for array totals
    evalScope.sum = function (...args: any[]) {
      const flattened = args.flat(Infinity).map((n) => Number(n)).filter((n) => !isNaN(n));
      return flattened.reduce((acc, curr) => acc + curr, 0);
    };

    // Execute sandboxed mathjs evaluation
    const rawResult = evaluate(expression, evalScope);

    if (rawResult === undefined || rawResult === null) {
      return { success: true, result: 'null', error: null };
    }

    // Format output string
    let formatted: string;
    if (typeof rawResult === 'number') {
      if (isNaN(rawResult)) {
        return { success: false, result: null, error: 'Expression resulted in NaN (Not a Number)' };
      }
      if (!isFinite(rawResult)) {
        return { success: false, result: null, error: 'Division by zero or infinite result' };
      }
      formatted = Number.isInteger(rawResult)
        ? rawResult.toString()
        : Number(rawResult.toFixed(4)).toString();
    } else if (Array.isArray(rawResult)) {
      formatted = JSON.stringify(rawResult);
    } else if (typeof rawResult === 'object') {
      formatted = JSON.stringify(rawResult);
    } else {
      formatted = String(rawResult);
    }

    return {
      success: true,
      result: formatted,
      error: null,
    };
  } catch (err: any) {
    let msg = err?.message || 'Syntax error in mathematical expression';
    if (msg.includes('Undefined symbol')) {
      const sym = msg.split('Undefined symbol')[1]?.trim();
      msg = `Undefined variable or missing column reference: ${sym || ''}`;
    }
    return {
      success: false,
      result: null,
      error: msg,
    };
  }
}
