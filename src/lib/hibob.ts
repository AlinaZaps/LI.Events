import "server-only";

const HIBOB_BASE = "https://api.hibob.com";
const DEPT_CACHE_TTL_MS = 60 * 60 * 1000;

export type HibobDepartment = {
  id: string;
  name: string;
};

export type HibobEmployee = {
  id: string;
  displayName: string;
  email: string;
  department: string;
  title: string;
};

export class HibobConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HibobConfigError";
  }
}

export class HibobApiError extends Error {
  readonly status: number;
  readonly rawBody: string;

  constructor(message: string, status: number, rawBody: string) {
    super(message);
    this.name = "HibobApiError";
    this.status = status;
    this.rawBody = rawBody;
  }
}

let departmentCache: { at: number; data: HibobDepartment[] } | null = null;

function authHeader(): string {
  const id = process.env.HIBOB_SERVICE_USER_ID?.trim();
  const token = process.env.HIBOB_API_TOKEN?.trim();
  if (!id || !token) {
    throw new HibobConfigError(
      "HIBOB_SERVICE_USER_ID and HIBOB_API_TOKEN must be set (see .env.example).",
    );
  }
  return `Basic ${Buffer.from(`${id}:${token}`).toString("base64")}`;
}

async function hibobFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${HIBOB_BASE}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: authHeader(),
      ...init?.headers,
    },
    cache: "no-store",
  });
}

export async function listDepartments(): Promise<HibobDepartment[]> {
  const now = Date.now();
  if (departmentCache && now - departmentCache.at < DEPT_CACHE_TTL_MS) {
    return departmentCache.data;
  }

  const res = await hibobFetch("/v1/company/named-lists/department");
  const raw = await res.text();

  if (!res.ok) {
    console.error("[hibob] /department failed", { status: res.status, body: raw });
    throw new HibobApiError(`HiBob /department returned ${res.status}`, res.status, raw);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error("[hibob] /department non-JSON response", { body: raw });
    throw new HibobApiError("HiBob /department returned non-JSON", res.status, raw);
  }

  const flat = flattenDepartments(parsed);
  if (!flat) {
    console.error("[hibob] /department unexpected shape", { body: raw });
    throw new HibobApiError("Unexpected /department response shape", res.status, raw);
  }

  departmentCache = { at: now, data: flat };
  return flat;
}

export function clearDepartmentCache() {
  departmentCache = null;
}

function flattenDepartments(input: unknown): HibobDepartment[] | null {
  if (!input || typeof input !== "object") return null;
  const root = input as Record<string, unknown>;
  const values = Array.isArray(root.values) ? root.values : null;
  if (!values) return null;

  const out: HibobDepartment[] = [];
  const walk = (nodes: unknown[]) => {
    for (const node of nodes) {
      if (!node || typeof node !== "object") continue;
      const n = node as Record<string, unknown>;
      if (typeof n.id === "string" && typeof n.name === "string") {
        out.push({ id: n.id, name: n.name });
      }
      if (Array.isArray(n.children)) walk(n.children);
    }
  };
  walk(values);

  const byId = new Map<string, HibobDepartment>();
  for (const d of out) byId.set(d.id, d);
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export async function listEmployeesByDepartments(
  departmentNames: string[],
): Promise<HibobEmployee[]> {
  if (departmentNames.length === 0) return [];

  const body = {
    fields: [
      "/root/id",
      "/root/displayName",
      "/root/email",
      "/work/department",
      "/work/title",
    ],
    humanReadable: "REPLACE",
    showInactive: false,
  };

  const res = await hibobFetch("/v1/people/search", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const raw = await res.text();

  if (!res.ok) {
    console.error("[hibob] /people/search failed", {
      status: res.status,
      body: raw,
      requestedDepartments: departmentNames,
    });
    throw new HibobApiError(`HiBob /people/search returned ${res.status}`, res.status, raw);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error("[hibob] /people/search non-JSON response", { body: raw });
    throw new HibobApiError("HiBob /people/search returned non-JSON", res.status, raw);
  }

  const employees = normalizeEmployees(parsed);
  if (!employees) {
    console.error("[hibob] /people/search unexpected shape", { body: raw });
    throw new HibobApiError("Unexpected /people/search response shape", res.status, raw);
  }

  const hasAnyDepartment = employees.some((e) => e.department.length > 0);
  if (!hasAnyDepartment) {
    console.warn(
      "[hibob] /people/search returned no department values — service user may lack /work permission. Returning all employees with department=N/A.",
    );
    return employees.map((e) => ({ ...e, department: "N/A" }));
  }

  const wanted = new Set(departmentNames);
  return employees.filter((e) => wanted.has(e.department));
}

function normalizeEmployees(input: unknown): HibobEmployee[] | null {
  if (!input || typeof input !== "object") return null;
  const root = input as Record<string, unknown>;
  const arr = Array.isArray(root.employees) ? root.employees : null;
  if (!arr) return null;

  const out: HibobEmployee[] = [];
  for (const e of arr) {
    if (!e || typeof e !== "object") continue;
    const emp = e as Record<string, unknown>;
    const work = (emp.work && typeof emp.work === "object" ? emp.work : {}) as Record<
      string,
      unknown
    >;
    const id = typeof emp.id === "string" ? emp.id : "";
    if (!id) continue;
    const email =
      (typeof work.email === "string" && work.email) ||
      (typeof emp.email === "string" && emp.email) ||
      "";
    const title =
      (typeof work.title === "string" && work.title) ||
      (typeof emp.title === "string" && emp.title) ||
      "";
    out.push({
      id,
      displayName: typeof emp.displayName === "string" ? emp.displayName : "",
      email,
      department: typeof work.department === "string" ? work.department : "",
      title,
    });
  }
  return out;
}
