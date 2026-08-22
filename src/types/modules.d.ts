declare module 'mathjs' {
  export function evaluate(expr: string | string[], scope?: Record<string, any>): any;
  export function parse(expr: string): any;
  export function compile(expr: string): any;
}

declare module 'recharts' {
  export const ResponsiveContainer: any;
  export const LineChart: any;
  export const Line: any;
  export const BarChart: any;
  export const Bar: any;
  export const ScatterChart: any;
  export const Scatter: any;
  export const XAxis: any;
  export const YAxis: any;
  export const CartesianGrid: any;
  export const Tooltip: any;
  export const Legend: any;
}
