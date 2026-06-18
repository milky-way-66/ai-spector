export function getByPath(obj: Record<string, unknown>, dotPath: string): unknown {
  const parts = dotPath.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function setByPath(
  obj: Record<string, unknown>,
  dotPath: string,
  value: unknown,
): Record<string, unknown> {
  const parts = dotPath.split(".");
  const root = { ...obj };
  let current: Record<string, unknown> = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    const next = current[part];
    if (!next || typeof next !== "object") {
      current[part] = {};
    } else {
      current[part] = { ...(next as Record<string, unknown>) };
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]!] = value;
  return root;
}

export function renameByPath(
  obj: Record<string, unknown>,
  fromPath: string,
  toPath: string,
): Record<string, unknown> {
  const value = getByPath(obj, fromPath);
  if (value === undefined) {
    return obj;
  }
  const without = deleteByPath(obj, fromPath);
  return setByPath(without, toPath, value);
}

function deleteByPath(obj: Record<string, unknown>, dotPath: string): Record<string, unknown> {
  const parts = dotPath.split(".");
  const root = { ...obj };
  let current: Record<string, unknown> = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    const next = current[part];
    if (!next || typeof next !== "object") {
      return root;
    }
    current[part] = { ...(next as Record<string, unknown>) };
    current = current[part] as Record<string, unknown>;
  }
  delete current[parts[parts.length - 1]!];
  return root;
}
