/**
 * Prototype router guard — allows direct deep links without login when bypass is on.
 * Import screen-map.json from the prototype workspace (path varies per project layout).
 */
export interface PrototypeScreenMapGuardSource {
  prototypeBypassAuth?: boolean;
}

export function shouldBypassPrototypeAuth(
  screenMap: PrototypeScreenMapGuardSource | undefined,
): boolean {
  return screenMap?.prototypeBypassAuth !== false;
}

export function createPrototypeAuthGuard(
  screenMap: PrototypeScreenMapGuardSource | undefined,
  isLoggedIn: () => boolean,
): (to: { meta: { requiresAuth?: boolean }; fullPath: string; name?: string | symbol }) =>
  | boolean
  | { name: string; query: { redirect: string } } {
  const bypass = shouldBypassPrototypeAuth(screenMap);
  return (to) => {
    if (bypass) {
      return true;
    }
    if (to.meta.requiresAuth && !isLoggedIn()) {
      return { name: "login", query: { redirect: to.fullPath } };
    }
    return true;
  };
}
