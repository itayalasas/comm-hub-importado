import { CronExpressionParser } from "npm:cron-parser@5.5.0";

function trimText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeCronExpression(value: unknown): string | null {
  const text = trimText(value);
  return text || null;
}

export function isValidCronExpression(expression: string, timezone = "UTC"): boolean {
  try {
    CronExpressionParser.parse(expression, {
      currentDate: new Date(),
      tz: timezone || "UTC",
    });
    return true;
  } catch {
    return false;
  }
}

export function getNextCronRunAt(
  expression: string,
  timezone = "UTC",
  currentDate = new Date(),
): string | null {
  try {
    const nextBaseDate = new Date(currentDate.getTime() + 1);
    const interval = CronExpressionParser.parse(expression, {
      currentDate: nextBaseDate,
      tz: timezone || "UTC",
    });
    return interval.next().toISOString();
  } catch {
    return null;
  }
}
