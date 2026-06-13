// Segment rules: { op: 'AND'|'OR', conditions: Condition[] }
// Condition: { field, operator, value }

export type SegmentField =
  | "total_spend"
  | "clv"
  | "city"
  | "status"
  | "age"
  | "last_purchase_date"
  | "ordered_category"
  | "order_count";

export type SegmentOperator = ">" | "<" | ">=" | "<=" | "=" | "!=" | "contains";

export interface Condition {
  field: SegmentField;
  operator: SegmentOperator;
  value: string | number;
}

export interface SegmentRules {
  op: "AND" | "OR";
  conditions: Condition[];
}

export const FIELDS: { value: SegmentField; label: string; type: "number" | "string" | "date" | "enum"; options?: string[] }[] = [
  { value: "total_spend", label: "Total Spend (₹)", type: "number" },
  { value: "clv", label: "Customer Lifetime Value", type: "number" },
  { value: "age", label: "Age", type: "number" },
  { value: "city", label: "City", type: "string" },
  { value: "status", label: "Status", type: "enum", options: ["Active", "Inactive", "Churn Risk"] },
  { value: "last_purchase_date", label: "Last Purchase (days ago)", type: "number" },
  { value: "ordered_category", label: "Ordered Category", type: "enum", options: ["Apparel", "Beauty", "Electronics", "Home", "Footwear", "Grocery"] },
  { value: "order_count", label: "Min Order Count", type: "number" },
];

export const OPERATORS_BY_TYPE: Record<string, SegmentOperator[]> = {
  number: [">", "<", ">=", "<=", "=", "!="],
  string: ["=", "!=", "contains"],
  enum: ["=", "!="],
  date: [">", "<"],
};

// Evaluate a customer row against rules (used for preview)
type CustomerRow = {
  total_spend: number | string | null;
  clv: number | string | null;
  city: string | null;
  status: string | null;
  age: number | null;
  last_purchase_date: string | null;
  orders?: { category: string; payment_status: string }[] | null;
};

export function evaluateRules(rules: SegmentRules, c: CustomerRow): boolean {
  if (!rules.conditions.length) return true;
  const results = rules.conditions.map((cond) => evalCondition(cond, c));
  return rules.op === "AND" ? results.every(Boolean) : results.some(Boolean);
}

function evalCondition(cond: Condition, c: CustomerRow): boolean {
  let actual: number | string | null = null;
  if (cond.field === "last_purchase_date") {
    if (!c.last_purchase_date) return false;
    const days = Math.floor((Date.now() - new Date(c.last_purchase_date).getTime()) / 86400000);
    actual = days;
  } else if (cond.field === "total_spend" || cond.field === "clv") {
    actual = Number(c[cond.field] ?? 0);
  } else if (cond.field === "ordered_category") {
    const hasCategory = (c.orders ?? []).some(
      (o) => o.category === cond.value && o.payment_status === "Paid"
    );
    return cond.operator === "=" ? hasCategory : !hasCategory;
  } else if (cond.field === "order_count") {
    const count = (c.orders ?? []).filter((o) => o.payment_status === "Paid").length;
    actual = count;
  } else {
    actual = (c as Record<string, unknown>)[cond.field] as string | number | null;
  }
  const val = cond.value;
  switch (cond.operator) {
    case ">": return Number(actual) > Number(val);
    case "<": return Number(actual) < Number(val);
    case ">=": return Number(actual) >= Number(val);
    case "<=": return Number(actual) <= Number(val);
    case "=": return String(actual) === String(val);
    case "!=": return String(actual) !== String(val);
    case "contains": return String(actual ?? "").toLowerCase().includes(String(val).toLowerCase());
  }
}

export const emptyRules = (): SegmentRules => ({ op: "AND", conditions: [] });
