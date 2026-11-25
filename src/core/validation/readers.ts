import { issue, type Issue } from './issue'

export function childPath(path: string, key: string): string {
  return path === '' ? key : `${path}.${key}`
}

export function indexPath(path: string, index: number): string {
  return `${path}[${String(index)}]`
}

export function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Lee un objeto en modo estricto: toda clave fuera de `allowedKeys` es un problema.
 * Un campo mal escrito (`margen` en vez de `targetMargin`) nunca pasa en silencio.
 */
export function readRecord(
  issues: Issue[],
  path: string,
  value: unknown,
  allowedKeys: readonly string[],
): Readonly<Record<string, unknown>> | undefined {
  if (value === undefined) {
    issues.push(issue(path, 'REQUIRED', 'Campo requerido'))
    return undefined
  }
  if (!isRecord(value)) {
    issues.push(issue(path, 'TYPE', 'Debe ser un objeto'))
    return undefined
  }
  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) {
      issues.push(issue(childPath(path, key), 'UNKNOWN_KEY', `Campo no permitido: ${key}`))
    }
  }
  return value
}

export function readArray(
  issues: Issue[],
  path: string,
  value: unknown,
  limits: { readonly min: number; readonly max: number },
): readonly unknown[] | undefined {
  if (value === undefined) {
    issues.push(issue(path, 'REQUIRED', 'Campo requerido'))
    return undefined
  }
  if (!Array.isArray(value)) {
    issues.push(issue(path, 'TYPE', 'Debe ser una lista'))
    return undefined
  }
  const items: readonly unknown[] = value
  if (items.length < limits.min) {
    issues.push(issue(path, 'EMPTY', `Requiere al menos ${String(limits.min)} elemento(s)`))
    return undefined
  }
  if (items.length > limits.max) {
    issues.push(issue(path, 'TOO_MANY', `Máximo ${String(limits.max)} elemento(s)`))
    return undefined
  }
  return items
}

/** Devuelve el texto sin espacios en los extremos. Un texto vacío es problema salvo `allowEmpty`. */
export function readString(
  issues: Issue[],
  path: string,
  value: unknown,
  maxLength: number,
  allowEmpty = false,
): string | undefined {
  if (value === undefined) {
    issues.push(issue(path, 'REQUIRED', 'Campo requerido'))
    return undefined
  }
  if (typeof value !== 'string') {
    issues.push(issue(path, 'TYPE', 'Debe ser texto'))
    return undefined
  }
  const text = value.trim()
  if (text.length === 0 && !allowEmpty) {
    issues.push(issue(path, 'EMPTY', 'No puede estar vacío'))
    return undefined
  }
  if (text.length > maxLength) {
    issues.push(issue(path, 'TOO_LONG', `Máximo ${String(maxLength)} caracteres`))
    return undefined
  }
  return text
}

export function readPattern(
  issues: Issue[],
  path: string,
  value: unknown,
  pattern: RegExp,
  description: string,
): string | undefined {
  if (value === undefined) {
    issues.push(issue(path, 'REQUIRED', 'Campo requerido'))
    return undefined
  }
  if (typeof value !== 'string') {
    issues.push(issue(path, 'TYPE', 'Debe ser texto'))
    return undefined
  }
  if (!pattern.test(value)) {
    issues.push(issue(path, 'FORMAT', `Formato inválido (${description})`))
    return undefined
  }
  return value
}

export function readBoolean(issues: Issue[], path: string, value: unknown): boolean | undefined {
  if (value === undefined) {
    issues.push(issue(path, 'REQUIRED', 'Campo requerido'))
    return undefined
  }
  if (typeof value !== 'boolean') {
    issues.push(issue(path, 'TYPE', 'Debe ser verdadero o falso'))
    return undefined
  }
  return value
}

export function readEnum<T extends string>(
  issues: Issue[],
  path: string,
  value: unknown,
  allowed: Readonly<Record<string, T>>,
): T | undefined {
  if (value === undefined) {
    issues.push(issue(path, 'REQUIRED', 'Campo requerido'))
    return undefined
  }
  const options: readonly string[] = Object.values(allowed)
  if (typeof value !== 'string' || !options.includes(value)) {
    issues.push(issue(path, 'ENUM', `Valor inválido; permitidos: ${options.join(', ')}`))
    return undefined
  }
  return value as T
}
