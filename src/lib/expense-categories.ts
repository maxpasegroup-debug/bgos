import { z } from "zod";

export const EXPENSE_CATEGORIES = [
  "Marketing",
  "Salary",
  "Travel",
  "Office",
  "Misc",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const expenseCategorySchema = z.enum(EXPENSE_CATEGORIES);

export const EXPENSE_CATEGORY_SET = new Set<string>(EXPENSE_CATEGORIES);
