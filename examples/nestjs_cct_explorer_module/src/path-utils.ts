export const ALLOWED_PREFIXES = ['local_scripts', 'screenshots'] as const;

export interface ParseResult {
  devicePath: string;
}

export interface ParseError {
  error: string;
  code: number;
}

/**
 * 校验并解析虚拟路径：/{device}/local_scripts/xxx -> local_scripts/xxx
 */
export function parseVirtualPath(
  device: string,
  virtualPath: string,
): ParseResult | ParseError {
  const normalized = virtualPath.replace(/^\/+/, '').replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length < 2 || parts[0] !== device) {
    return {
      error: 'path 须为 /{device_name}/local_scripts/... 或 /{device_name}/screenshots/...',
      code: 400,
    };
  }
  const second = parts[1];
  if (!ALLOWED_PREFIXES.includes(second as (typeof ALLOWED_PREFIXES)[number])) {
    return { error: '仅允许 local_scripts 或 screenshots 目录', code: 400 };
  }
  const devicePath = parts.slice(1).join('/');
  return { devicePath };
}
