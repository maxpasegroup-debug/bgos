import OpenAI from "openai";
import { getApiCache, setApiCache } from "@/lib/api-runtime-cache";
import { detectUnknownRoles, mapRoles, parseTeamInput, suggestMissingRoles, type NexaMappedMember } from "@/lib/nexa-intelligence";

const AI_MODEL = process.env.NEXA_AI_MODEL?.trim() || "gpt-4o-mini";
const CACHE_MS = 30_000;

function getClient(): OpenAI {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("OPENAI_API_KEY missing");
  return new OpenAI({ apiKey: key });
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    const s = trimmed.indexOf("[");
    const e = trimmed.lastIndexOf("]");
    if (s >= 0 && e > s) return JSON.parse(trimmed.slice(s, e + 1)) as unknown;
    throw new Error("AI JSON parse failed");
  }
}

function normalizeDepartment(v: string): "SALES" | "ADMIN" | "TECH" | "OTHER" {
  const u = v.trim().toUpperCase();
  if (u === "SALES" || u === "ADMIN" || u === "TECH") return u;
  return "OTHER";
}

function validateAiParse(raw: unknown): { name: string; roleRaw: string; department: "SALES" | "ADMIN" | "TECH" | "OTHER" }[] {
  if (!Array.isArray(raw)) return [];
  const out: { name: string; roleRaw: string; department: "SALES" | "ADMIN" | "TECH" | "OTHER" }[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name.trim() : "";
    const role = typeof o.role === "string" ? o.role.trim() : typeof o.roleRaw === "string" ? o.roleRaw.trim() : "";
    const department = normalizeDepartment(typeof o.department === "string" ? o.department : "OTHER");
    if (!name) continue;
    out.push({ name, roleRaw: role || "staff", department });
  }
  return out;
}

function fallbackMapped(text: string): NexaMappedMember[] {
  return mapRoles(parseTeamInput(text));
}

export async function parseTeamWithAI(text: string): Promise<NexaMappedMember[]> {
  const cacheKey = `nexa:ai:parse:${text.trim().toLowerCase()}`;
  const cached = getApiCache<NexaMappedMember[]>(cacheKey);
  if (cached) return cached;

  console.log("AI INPUT:", text);
  const client = getClient();
  const prompt = `You are an assistant that extracts employee data.

Input:
${text}

Return STRICT JSON:
[
  {
    "name": "string",
    "role": "string",
    "department": "SALES | ADMIN | TECH | OTHER"
  }
]

Rules:
- Normalize roles
- Infer department
- Fix spelling
- Do NOT add extra text`;

  const res = await client.chat.completions.create({
    model: AI_MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.1,
    max_tokens: 350,
  });
  const content = res.choices[0]?.message?.content ?? "";
  const parsed = validateAiParse(extractJson(content));
  if (parsed.length === 0) throw new Error("AI parse returned no valid entries");
  const mapped = parsed.map((r) => {
    const base = mapRoles([{ name: r.name, roleRaw: r.roleRaw }])[0]!;
    return { ...base, department: r.department };
  });
  console.log("AI OUTPUT:", mapped);
  setApiCache(cacheKey, mapped, CACHE_MS);
  return mapped;
}

async function simpleAiText(cacheKey: string, prompt: string): Promise<string> {
  const cached = getApiCache<string>(cacheKey);
  if (cached) return cached;
  const client = getClient();
  const res = await client.chat.completions.create({
    model: AI_MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
    max_tokens: 220,
  });
  const out = (res.choices[0]?.message?.content || "").trim();
  setApiCache(cacheKey, out, CACHE_MS);
  return out;
}

export async function generateOnboardingSummary(data: {
  company: { name: string; industry: string };
  team: NexaMappedMember[];
}): Promise<string> {
  const cacheKey = `nexa:ai:summary:${data.company.name}:${data.company.industry}:${data.team.length}`;
  const prompt = `Summarize this company setup in a clear business format.
Company: ${data.company.name} (${data.company.industry})
Team: ${JSON.stringify(data.team)}
Output:
- Total employees
- Departments breakdown
- Key roles
- Readiness summary`;
  return simpleAiText(cacheKey, prompt);
}

export async function generateTechContext(data: {
  company: { name: string; industry: string };
  unknownRoles: string[];
  team: NexaMappedMember[];
}): Promise<string> {
  const cacheKey = `nexa:ai:tech:${data.company.name}:${data.unknownRoles.join("|")}`;
  const prompt = `Generate a technical implementation brief.
Company: ${data.company.name} (${data.company.industry})
Unknown Roles: ${JSON.stringify(data.unknownRoles)}
Team: ${JSON.stringify(data.team)}
Output:
- Required dashboards
- Suggested features
- Data fields needed
- Implementation notes`;
  return simpleAiText(cacheKey, prompt);
}

export async function suggestOrgImprovements(data: {
  team: NexaMappedMember[];
}): Promise<string[]> {
  const cacheKey = `nexa:ai:suggest:${data.team.length}:${data.team.map((t) => t.roleRaw).join("|")}`;
  const prompt = `Analyze this team:
${JSON.stringify(data.team)}
Suggest:
- Missing roles
- Efficiency improvements
- Better structure
Keep it short.
Return bullet lines only.`;
  const txt = await simpleAiText(cacheKey, prompt);
  const lines = txt
    .split("\n")
    .map((l) => l.replace(/^[-*\d.)\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, 6);
  if (lines.length > 0) return lines;
  return suggestMissingRoles(data.team);
}

export function parseTeamHybrid(text: string): Promise<NexaMappedMember[]> {
  return parseTeamWithAI(text).catch(() => fallbackMapped(text));
}

export function unknownRolesFromTeam(team: NexaMappedMember[]): string[] {
  return detectUnknownRoles(team);
}
