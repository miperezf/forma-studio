// GENERADO por scripts/build-beta-bridge.mjs desde src/ — no editar a mano.
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// src/modules/calculation/contracts/constants.ts
var MAX_PLATES = 64;
var MAX_FILAMENTS_PER_PLATE = 8;
var MAX_SERVICES = 64;
var MAX_EXTRA_COSTS = 64;
var MAX_AUXILIARY_COSTS = 64;
var MAX_DISCOUNT_TIERS = 32;
var MAX_OVERRIDES = 32;
var MAX_CATALOG_ENTRIES = 256;
var MAX_LABEL_LENGTH = 120;
var MAX_REASON_LENGTH = 500;
var MAX_FAILURE_RATE = 0.95;
var MAX_ROUNDING_STEP = 1e6;
var SUPPORTED_CURRENCY = "CLP";
var CALCULATION_VERSION_PATTERN = /^v[1-9][0-9]*$/;
var FLOAT_TOLERANCE = 1e-9;

// src/modules/calculation/contracts/enums.ts
var CostBehavior = {
  PER_UNIT: "PER_UNIT",
  PER_PLATE: "PER_PLATE",
  PER_BATCH: "PER_BATCH",
  ONE_OFF: "ONE_OFF",
  /** Variante de PER_UNIT: unidades × (partes por unidad − 1). */
  PER_EXTRA_PART: "PER_EXTRA_PART"
};
var CostComponent = {
  MATERIAL: "MATERIAL",
  ELECTRICITY: "ELECTRICITY",
  WEAR: "WEAR",
  SUPERVISION: "SUPERVISION",
  SETUP: "SETUP",
  ASSEMBLY: "ASSEMBLY",
  POSTPROCESS: "POSTPROCESS",
  PACKAGING: "PACKAGING",
  SHIPPING: "SHIPPING",
  DESIGN: "DESIGN",
  AUXILIARY: "AUXILIARY",
  /** Generado por el modelo de fallas; no se puede declarar en entradas. */
  FAILURE: "FAILURE",
  OTHER: "OTHER"
};
var Recovery = {
  IN_PRICE: "IN_PRICE",
  SEPARATE_LINE: "SEPARATE_LINE",
  ABSORBED: "ABSORBED"
};
var TaxRegime = {
  VAT_REGISTERED: "VAT_REGISTERED",
  NOT_REGISTERED: "NOT_REGISTERED"
};
var CustomerPriceMode = {
  NET: "NET",
  GROSS: "GROSS"
};
var CommissionBase = {
  NET: "NET",
  GROSS: "GROSS"
};
var CalculationMode = {
  QUOTE: "QUOTE",
  TEST: "TEST"
};
var PricingMode = {
  TARGET_MARGIN: "TARGET_MARGIN",
  FIXED_PRICE: "FIXED_PRICE"
};
var BelowMinPolicyId = {
  WARN: "WARN",
  CAP: "CAP",
  BLOCK: "BLOCK"
};
var PlateSource = {
  MANUAL: "MANUAL",
  TEST: "TEST",
  SLICER_IMPORT: "SLICER_IMPORT"
};
var RoundingMode = {
  NONE: "NONE",
  STEP: "STEP"
};
var RoundingDirection = {
  UP: "UP",
  NEAREST: "NEAREST",
  DOWN: "DOWN"
};
var RoundingTarget = {
  NET: "NET",
  GROSS: "GROSS"
};
var FailureModelId = {
  GEOMETRIC_RETRY: "GEOMETRIC_RETRY"
};
var FailureRateSource = {
  QUOTE_OVERRIDE: "QUOTE_OVERRIDE",
  MATERIAL_OVERRIDE: "MATERIAL_OVERRIDE",
  MACHINE_OVERRIDE: "MACHINE_OVERRIDE",
  PROFILE: "PROFILE"
};
var LaborKind = {
  SUPERVISION: "SUPERVISION",
  PREPARATION: "PREPARATION",
  ASSEMBLY: "ASSEMBLY",
  POSTPROCESS: "POSTPROCESS"
};
var ChannelKind = {
  DIRECT: "DIRECT",
  INSTAGRAM: "INSTAGRAM",
  WEB: "WEB",
  MARKETPLACE: "MARKETPLACE",
  OTHER: "OTHER"
};
var ServiceKind = {
  ASSEMBLY: "ASSEMBLY",
  STANDARD: "STANDARD"
};
var DiscountOverrideMode = {
  NONE: "NONE",
  MANUAL: "MANUAL"
};
var FailureOverrideMode = {
  RATE: "RATE",
  DISABLED: "DISABLED"
};
var OverrideKind = {
  TARGET_MARGIN: "TARGET_MARGIN",
  MIN_MARGIN: "MIN_MARGIN",
  DISCOUNT: "DISCOUNT",
  FAILURE_RATE: "FAILURE_RATE",
  ROUNDING: "ROUNDING",
  ITEM_RECOVERY: "ITEM_RECOVERY",
  FIXED_UNIT_PRICE: "FIXED_UNIT_PRICE",
  FIXED_LINE_PRICE: "FIXED_LINE_PRICE"
};
var LineKind = {
  MAIN: "MAIN",
  SEPARATE_LINE: "SEPARATE_LINE"
};
var FlagCode = {
  BELOW_TARGET: "BELOW_TARGET",
  BELOW_MIN: "BELOW_MIN",
  /** El margen real (descontando costos ABSORBED) queda bajo el mínimo aunque el comercial lo cumpla. Advertencia. */
  REAL_MARGIN_BELOW_MIN: "REAL_MARGIN_BELOW_MIN",
  BLOCKED: "BLOCKED",
  DISCOUNT_CAPPED: "DISCOUNT_CAPPED",
  NEGATIVE_UTILITY: "NEGATIVE_UTILITY",
  OVERRIDE_APPLIED: "OVERRIDE_APPLIED",
  PRICING_POOL_EMPTY: "PRICING_POOL_EMPTY",
  ASSEMBLY_WITHOUT_EXTRA_PARTS: "ASSEMBLY_WITHOUT_EXTRA_PARTS",
  UNKNOWN_OVERRIDE_TARGET: "UNKNOWN_OVERRIDE_TARGET",
  /** v2: la última placa incompleta se valoró como placa completa (estimación conservadora, sin datos de Bambu Studio). */
  LAST_PLATE_ESTIMATED: "LAST_PLATE_ESTIMATED"
};
var FlagSeverity = {
  INFO: "INFO",
  WARNING: "WARNING",
  /** Impide emitir la cotización al cliente (política BLOCK). */
  BLOCKING: "BLOCKING"
};

// src/core/result/result.ts
function ok(value) {
  return { ok: true, value };
}
function err(error) {
  return { ok: false, error };
}
var InvariantViolation = class extends Error {
  constructor(invariant, detail) {
    super(`${invariant}: ${detail}`);
    __publicField(this, "invariant");
    this.name = "InvariantViolation";
    this.invariant = invariant;
  }
};

// src/core/money/constants.ts
var ROUNDING_EPSILON = 1e-9;
var HALF = 0.5;
var MAX_QUANTITY = 1e6;

// src/core/validation/constants.ts
var ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/;
var ITEM_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;

// src/core/validation/issue.ts
function issue(path, code, message) {
  return { path, code, message };
}
function take(issues, result) {
  if (result.ok) return result.value;
  issues.push(result.error);
  return void 0;
}
function takeMany(issues, result) {
  if (result.ok) return result.value;
  issues.push(...result.error);
  return void 0;
}

// src/core/validation/readers.ts
function childPath(path, key) {
  return path === "" ? key : `${path}.${key}`;
}
function indexPath(path, index) {
  return `${path}[${String(index)}]`;
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function readRecord(issues, path, value, allowedKeys2) {
  if (value === void 0) {
    issues.push(issue(path, "REQUIRED", "Campo requerido"));
    return void 0;
  }
  if (!isRecord(value)) {
    issues.push(issue(path, "TYPE", "Debe ser un objeto"));
    return void 0;
  }
  for (const key of Object.keys(value)) {
    if (!allowedKeys2.includes(key)) {
      issues.push(issue(childPath(path, key), "UNKNOWN_KEY", `Campo no permitido: ${key}`));
    }
  }
  return value;
}
function readArray(issues, path, value, limits) {
  if (value === void 0) {
    issues.push(issue(path, "REQUIRED", "Campo requerido"));
    return void 0;
  }
  if (!Array.isArray(value)) {
    issues.push(issue(path, "TYPE", "Debe ser una lista"));
    return void 0;
  }
  const items = value;
  if (items.length < limits.min) {
    issues.push(issue(path, "EMPTY", `Requiere al menos ${String(limits.min)} elemento(s)`));
    return void 0;
  }
  if (items.length > limits.max) {
    issues.push(issue(path, "TOO_MANY", `M\xE1ximo ${String(limits.max)} elemento(s)`));
    return void 0;
  }
  return items;
}
function readString(issues, path, value, maxLength, allowEmpty = false) {
  if (value === void 0) {
    issues.push(issue(path, "REQUIRED", "Campo requerido"));
    return void 0;
  }
  if (typeof value !== "string") {
    issues.push(issue(path, "TYPE", "Debe ser texto"));
    return void 0;
  }
  const text2 = value.trim();
  if (text2.length === 0 && !allowEmpty) {
    issues.push(issue(path, "EMPTY", "No puede estar vac\xEDo"));
    return void 0;
  }
  if (text2.length > maxLength) {
    issues.push(issue(path, "TOO_LONG", `M\xE1ximo ${String(maxLength)} caracteres`));
    return void 0;
  }
  return text2;
}
function readPattern(issues, path, value, pattern, description) {
  if (value === void 0) {
    issues.push(issue(path, "REQUIRED", "Campo requerido"));
    return void 0;
  }
  if (typeof value !== "string") {
    issues.push(issue(path, "TYPE", "Debe ser texto"));
    return void 0;
  }
  if (!pattern.test(value)) {
    issues.push(issue(path, "FORMAT", `Formato inv\xE1lido (${description})`));
    return void 0;
  }
  return value;
}
function readBoolean(issues, path, value) {
  if (value === void 0) {
    issues.push(issue(path, "REQUIRED", "Campo requerido"));
    return void 0;
  }
  if (typeof value !== "boolean") {
    issues.push(issue(path, "TYPE", "Debe ser verdadero o falso"));
    return void 0;
  }
  return value;
}
function readEnum(issues, path, value, allowed) {
  if (value === void 0) {
    issues.push(issue(path, "REQUIRED", "Campo requerido"));
    return void 0;
  }
  const options = Object.values(allowed);
  if (typeof value !== "string" || !options.includes(value)) {
    issues.push(issue(path, "ENUM", `Valor inv\xE1lido; permitidos: ${options.join(", ")}`));
    return void 0;
  }
  return value;
}

// src/core/money/parse-number.ts
function parseFiniteNumber(value, path, bound = "NON_NEGATIVE") {
  if (value === void 0) return err(issue(path, "REQUIRED", "Campo requerido"));
  if (typeof value !== "number") return err(issue(path, "TYPE", "Debe ser un n\xFAmero"));
  if (!Number.isFinite(value)) return err(issue(path, "NOT_FINITE", "Debe ser un n\xFAmero finito"));
  const invalid = bound === "POSITIVE" ? value <= 0 : value < 0;
  if (invalid) {
    return err(
      issue(path, "RANGE", bound === "POSITIVE" ? "Debe ser mayor que 0" : "No puede ser negativo")
    );
  }
  return ok(value === 0 ? 0 : value);
}
function parseSafeInteger(value, path, bound = "NON_NEGATIVE") {
  const parsed = parseFiniteNumber(value, path, bound);
  if (!parsed.ok) return parsed;
  if (!Number.isSafeInteger(parsed.value)) {
    return err(issue(path, "NOT_INTEGER", "Debe ser un entero"));
  }
  return parsed;
}

// src/core/money/clp.ts
var ZERO_CLP = 0;
function roundHalfAwayFromZero(value) {
  const sign = value < 0 ? -1 : 1;
  const rounded = sign * Math.floor(Math.abs(value) + HALF + ROUNDING_EPSILON);
  return rounded === 0 ? 0 : rounded;
}
function roundToClp(value) {
  if (!Number.isFinite(value)) {
    throw new InvariantViolation("clp.finite", `valor no finito: ${String(value)}`);
  }
  const rounded = roundHalfAwayFromZero(value);
  if (!Number.isSafeInteger(rounded)) {
    throw new InvariantViolation("clp.safe-integer", `fuera de rango seguro: ${String(rounded)}`);
  }
  return rounded;
}
function parseClp(value, path, bound = "NON_NEGATIVE") {
  const parsed = parseSafeInteger(value, path, bound);
  if (!parsed.ok) return parsed;
  return ok(parsed.value);
}
function isClp(value) {
  return typeof value === "number" && Number.isSafeInteger(value);
}
function checked(value, op) {
  if (!Number.isSafeInteger(value)) {
    throw new InvariantViolation("clp.safe-integer", `${op} produjo ${String(value)}`);
  }
  return value === 0 ? 0 : value;
}
function addClp(a, b) {
  return checked(a + b, "addClp");
}
function sumClp(values) {
  return values.reduce((acc, value) => addClp(acc, value), ZERO_CLP);
}
function multiplyClp(a, factor) {
  if (!Number.isSafeInteger(factor)) {
    throw new InvariantViolation("clp.factor", `el factor debe ser entero: ${String(factor)}`);
  }
  return checked(a * factor, "multiplyClp");
}

// src/core/money/fraction.ts
function parseFraction(value, path, upper = "INCLUSIVE") {
  const parsed = parseFiniteNumber(value, path, "NON_NEGATIVE");
  if (!parsed.ok) return parsed;
  const exceeds = upper === "EXCLUSIVE" ? parsed.value >= 1 : parsed.value > 1;
  if (exceeds) {
    const range = upper === "EXCLUSIVE" ? "[0, 1)" : "[0, 1]";
    return err(issue(path, "RANGE", `Debe estar en ${range} (\xBFse ingres\xF3 un porcentaje?)`));
  }
  return ok(parsed.value);
}

// src/core/money/tax-basis.ts
var TaxBasis = {
  NET: "NET",
  GROSS: "GROSS"
};

// src/core/money/units.ts
function parseHours(value, path, bound) {
  const parsed = parseFiniteNumber(value, path, bound);
  return parsed.ok ? ok(parsed.value) : parsed;
}
function parseMinutes(value, path, bound) {
  const parsed = parseFiniteNumber(value, path, bound);
  return parsed.ok ? ok(parsed.value) : parsed;
}
function parseGrams(value, path, bound) {
  const parsed = parseFiniteNumber(value, path, bound);
  return parsed.ok ? ok(parsed.value) : parsed;
}
function parseWatts(value, path, bound) {
  const parsed = parseFiniteNumber(value, path, bound);
  return parsed.ok ? ok(parsed.value) : parsed;
}
function parseRatio(value, path, bound) {
  const parsed = parseFiniteNumber(value, path, bound);
  return parsed.ok ? ok(parsed.value) : parsed;
}
function parseMoneyAmount(value, path, bound) {
  const parsed = parseFiniteNumber(value, path, bound);
  return parsed.ok ? ok(parsed.value) : parsed;
}
function parseQuantity(value, path) {
  const parsed = parseSafeInteger(value, path, "POSITIVE");
  if (!parsed.ok) return parsed;
  if (parsed.value > MAX_QUANTITY) {
    return err(issue(path, "RANGE", `M\xE1ximo ${String(MAX_QUANTITY)}`));
  }
  return ok(parsed.value);
}

// src/core/money/taxed-amount.ts
function parseTaxedAmount(value, path) {
  const issues = [];
  const record = readRecord(issues, path, value, ["amount", "basis", "vatRecoverable"]);
  if (record === void 0) return err(issues);
  const amount = take(issues, parseMoneyAmount(record.amount, childPath(path, "amount")));
  const basis = readEnum(issues, childPath(path, "basis"), record.basis, TaxBasis);
  const vatRecoverable = readBoolean(issues, childPath(path, "vatRecoverable"), record.vatRecoverable);
  if (amount === void 0 || basis === void 0 || vatRecoverable === void 0) return err(issues);
  return ok({ amount, basis, vatRecoverable });
}

// src/modules/calculation/contracts/invariants.ts
function expectedPooledAmount(item, quantity) {
  const { recovery, amortization } = item.recoveryConfig;
  if (recovery === Recovery.ABSORBED) return roundToClp(0);
  if (recovery === Recovery.SEPARATE_LINE) return item.amount;
  if (amortization === void 0) return item.amount;
  const share = quantity / amortization.overUnits;
  if (share >= 1) return item.amount;
  return roundToClp(item.rawAmount * share);
}
function checkCostItemInvariants(item, quantity, path) {
  const issues = [];
  const at = (field) => `${path}.${field}`;
  if (!Number.isFinite(item.rawAmount) || item.rawAmount < 0) {
    issues.push(issue(at("rawAmount"), "RANGE", "rawAmount debe ser finito y no negativo"));
    return issues;
  }
  const { quantity: basisQuantity, unitCost, multiplier } = item.basis;
  if (![basisQuantity, unitCost, multiplier].every((v) => Number.isFinite(v) && v >= 0)) {
    issues.push(issue(at("basis"), "RANGE", "basis.quantity, unitCost y multiplier deben ser finitos y no negativos"));
  } else if (!closeTo(item.rawAmount, basisQuantity * unitCost * multiplier)) {
    issues.push(issue(at("basis"), "INCONSISTENT", "rawAmount debe ser quantity \xD7 unitCost \xD7 multiplier"));
  }
  if (!isClp(item.vatRecoverable) || item.vatRecoverable < 0) {
    issues.push(issue(at("vatRecoverable"), "RANGE", "vatRecoverable debe ser un entero CLP no negativo"));
  }
  if (item.component === CostComponent.WEAR && item.vatRecoverable !== 0) {
    issues.push(
      issue(at("vatRecoverable"), "INCONSISTENT", "El desgaste no reconoce cr\xE9dito fiscal: el IVA de la m\xE1quina se recuper\xF3 en su compra")
    );
  }
  if (item.amount !== roundToClp(item.rawAmount)) {
    issues.push(issue(at("amount"), "INCONSISTENT", "amount debe ser el redondeo a CLP de rawAmount"));
  }
  if (item.pooledAmount < 0 || item.pooledAmount > item.amount) {
    issues.push(issue(at("pooledAmount"), "RANGE", "pooledAmount debe estar entre 0 y amount"));
  }
  if (item.pooledAmount !== expectedPooledAmount(item, quantity)) {
    issues.push(
      issue(at("pooledAmount"), "INCONSISTENT", "pooledAmount no corresponde a recoveryConfig, amount y cantidad")
    );
  }
  const { recovery, amortization } = item.recoveryConfig;
  if (amortization !== void 0 && (recovery !== Recovery.IN_PRICE || item.behavior !== CostBehavior.ONE_OFF)) {
    issues.push(
      issue(at("recoveryConfig.amortization"), "INCONSISTENT", "La amortizaci\xF3n solo aplica a ONE_OFF con IN_PRICE")
    );
  }
  if (item.component === CostComponent.FAILURE !== (item.derivedFrom !== void 0)) {
    issues.push(
      issue(at("derivedFrom"), "INCONSISTENT", "Los \xEDtems FAILURE deben indicar derivedFrom, y solo ellos")
    );
  }
  return issues;
}
function sumOf(values) {
  return sumClp([...values]);
}
function closeTo(a, b) {
  return Math.abs(a - b) <= FLOAT_TOLERANCE * Math.max(1, Math.abs(a), Math.abs(b));
}
function checkCostBreakdownInvariants(breakdown, quantity) {
  const issues = [];
  const seen = /* @__PURE__ */ new Set();
  breakdown.items.forEach((item, index) => {
    const path = `items[${String(index)}]`;
    if (seen.has(item.code)) {
      issues.push(issue(`${path}.code`, "DUPLICATE", `\xCDtem repetido (doble conteo): ${item.code}`));
    }
    seen.add(item.code);
    issues.push(...checkCostItemInvariants(item, quantity, path));
  });
  const items = breakdown.items;
  const totalAmount = sumOf(items.map((item) => item.amount));
  const pool = sumOf(items.map((item) => item.pooledAmount));
  const absorbed = sumOf(
    items.filter((item) => item.recoveryConfig.recovery === Recovery.ABSORBED).map((item) => item.amount)
  );
  const deferred = sumOf(
    items.filter((item) => item.recoveryConfig.amortization !== void 0).map((item) => roundToClp(item.amount - item.pooledAmount))
  );
  if (breakdown.pricingPool !== pool) {
    issues.push(issue("pricingPool", "INCONSISTENT", "pricingPool debe ser la suma de pooledAmount"));
  }
  if (breakdown.absorbedCost !== absorbed) {
    issues.push(issue("absorbedCost", "INCONSISTENT", "absorbedCost debe ser la suma de amount de los ABSORBED"));
  }
  if (breakdown.deferredCost !== deferred) {
    issues.push(issue("deferredCost", "INCONSISTENT", "deferredCost debe ser la suma de (amount \u2212 pooledAmount) amortizado"));
  }
  if (totalAmount !== sumOf([breakdown.pricingPool, breakdown.absorbedCost, breakdown.deferredCost])) {
    issues.push(
      issue("totals", "INCONSISTENT", "\u03A3 amount debe ser pricingPool + absorbedCost + deferredCost")
    );
  }
  const byBehavior = sumOf(Object.values(breakdown.totals.byBehavior));
  if (byBehavior !== totalAmount) {
    issues.push(issue("totals.byBehavior", "INCONSISTENT", "byBehavior debe sumar \u03A3 amount"));
  }
  const byComponent = sumOf(Object.values(breakdown.totals.byComponent).filter((v) => v !== void 0));
  if (byComponent !== totalAmount) {
    issues.push(issue("totals.byComponent", "INCONSISTENT", "byComponent debe sumar \u03A3 amount"));
  }
  for (const recovery of Object.values(Recovery)) {
    const expected = sumOf(items.filter((item) => item.recoveryConfig.recovery === recovery).map((item) => item.amount));
    if (breakdown.totals.byRecovery[recovery] !== expected) {
      issues.push(issue(`totals.byRecovery.${recovery}`, "INCONSISTENT", "No coincide con la suma de \xEDtems de esa recuperaci\xF3n"));
    }
  }
  const recoverable = sumOf(items.map((item) => item.vatRecoverable));
  if (breakdown.recoverableVat !== recoverable) {
    issues.push(issue("recoverableVat", "INCONSISTENT", "recoverableVat debe ser la suma de vatRecoverable"));
  }
  const seenPlates = /* @__PURE__ */ new Set();
  let globalEntries = 0;
  breakdown.failureRates.forEach((entry, index) => {
    const path = `failureRates[${String(index)}]`;
    if (!(Number.isFinite(entry.rate) && entry.rate >= 0 && entry.rate < 1)) {
      issues.push(issue(`${path}.rate`, "RANGE", "La tasa de falla debe estar en [0, 1)"));
    }
    if (!(Number.isFinite(entry.costFraction) && entry.costFraction >= 0 && entry.costFraction <= 1)) {
      issues.push(issue(`${path}.costFraction`, "RANGE", "costFraction debe estar en [0, 1]"));
    }
    if (entry.scope === "GLOBAL") {
      globalEntries += 1;
    } else if (entry.plateId === void 0 || seenPlates.has(entry.plateId)) {
      issues.push(issue(`${path}.plateId`, "DUPLICATE", "Cada placa tiene una \xFAnica tasa resuelta"));
    } else {
      seenPlates.add(entry.plateId);
    }
    if (!entry.applied && items.some((item) => item.component === CostComponent.FAILURE)) {
      issues.push(issue(`${path}.applied`, "INCONSISTENT", "Con las fallas inactivas no puede haber \xEDtems FAILURE"));
    }
  });
  if (globalEntries > 1) {
    issues.push(issue("failureRates", "DUPLICATE", "Solo puede haber una tasa GLOBAL"));
  }
  if (!closeTo(breakdown.unitCost, breakdown.pricingPool / quantity)) {
    issues.push(issue("unitCost", "INCONSISTENT", "unitCost debe ser pricingPool / cantidad"));
  }
  return issues;
}
function checkPricingInvariants(pricing, breakdown) {
  const issues = [];
  const add = (path, message) => issues.push(issue(path, "INCONSISTENT", message));
  if (pricing.lines[0]?.kind !== LineKind.MAIN || pricing.lines.filter((l) => l.kind === LineKind.MAIN).length !== 1) {
    add("lines", "Debe haber exactamente una l\xEDnea MAIN y ser la primera");
  }
  const owner = /* @__PURE__ */ new Map();
  pricing.lines.forEach((line, index) => {
    const path = `lines[${String(index)}]`;
    if (line.netLineTotal + line.vatLineTotal !== line.grossLineTotal) add(path, "neto + IVA debe ser bruto en la l\xEDnea");
    if (line.customerLineTotal !== line.customerUnitPrice * line.quantity) {
      add(path, "customerLineTotal debe ser customerUnitPrice \xD7 quantity");
    }
    const expectedCustomer = pricing.customerPriceMode === CustomerPriceMode.GROSS ? line.grossLineTotal : line.netLineTotal;
    if (line.customerLineTotal !== expectedCustomer) add(path, "customerLineTotal debe coincidir con el modo de precio del cliente");
    for (const code of line.sourceItemCodes) {
      const previous = owner.get(code);
      if (previous !== void 0) add(path, `El \xEDtem ${code} est\xE1 en dos l\xEDneas (${previous} y ${line.code}): doble conteo`);
      owner.set(code, line.code);
    }
    if (line.kind === LineKind.SEPARATE_LINE) {
      const root = breakdown.items.find((candidate) => candidate.code === line.code);
      if (root === void 0 || root.component === CostComponent.FAILURE) {
        add(path, "Una l\xEDnea separada debe corresponder a un \xEDtem de costo origen, nunca a una falla");
      }
      for (const code of line.sourceItemCodes) {
        const member = breakdown.items.find((candidate) => candidate.code === code);
        if (member?.derivedFrom !== void 0 && !line.sourceItemCodes.includes(member.derivedFrom)) {
          add(path, `La falla ${code} debe agruparse con su origen ${member.derivedFrom}`);
        }
      }
    }
  });
  const sum = (pick) => pricing.lines.reduce((total, line) => total + pick(line), 0);
  if (sum((l) => l.netLineTotal) !== pricing.netTotal) add("netTotal", "Las l\xEDneas deben sumar el neto del documento");
  if (sum((l) => l.vatLineTotal) !== pricing.vatTotal) add("vatTotal", "Las l\xEDneas deben sumar el IVA del documento");
  if (sum((l) => l.grossLineTotal) !== pricing.grossTotal) add("grossTotal", "Las l\xEDneas deben sumar el bruto del documento");
  if (pricing.netTotal + pricing.vatTotal !== pricing.grossTotal) add("grossTotal", "neto + IVA debe ser bruto");
  if (sum((l) => l.costBasis) !== breakdown.pricingPool) add("lines", "El costo de las l\xEDneas debe sumar exactamente el pool de costos");
  if (pricing.absorbedCost !== breakdown.absorbedCost) add("absorbedCost", "Debe coincidir con el costo absorbido del desglose");
  const pool = breakdown.pricingPool;
  if (pricing.commercialUtility !== pricing.netTotal - pricing.commission - pool) {
    add("commercialUtility", "commercialUtility debe ser netTotal \u2212 commission \u2212 pricingPool (sin IVA)");
  }
  if (pricing.realUtility !== pricing.commercialUtility - pricing.absorbedCost) {
    add("realUtility", "realUtility debe ser commercialUtility \u2212 absorbedCost");
  }
  const ratioMatches = (actual, numerator, denominator) => denominator > 0 ? actual !== null && closeTo(actual, numerator / denominator) : actual === null;
  if (!ratioMatches(pricing.commercialMargin, pricing.commercialUtility, pricing.netTotal)) {
    add("commercialMargin", "commercialMargin debe ser commercialUtility / netTotal (null si netTotal \u2264 0)");
  }
  if (!ratioMatches(pricing.commercialMarkup, pricing.commercialUtility, pool)) {
    add("commercialMarkup", "commercialMarkup debe ser commercialUtility / pricingPool (null si pool \u2264 0)");
  }
  if (!ratioMatches(pricing.realMargin, pricing.realUtility, pricing.netTotal)) {
    add("realMargin", "realMargin debe ser realUtility / netTotal (null si netTotal \u2264 0)");
  }
  if (!ratioMatches(pricing.realMarkup, pricing.realUtility, pool + pricing.absorbedCost)) {
    add("realMarkup", "realMarkup debe ser realUtility / (pricingPool + absorbedCost) (null si es 0)");
  }
  for (const [path, value] of [
    ["netTotal", pricing.netTotal],
    ["grossTotal", pricing.grossTotal],
    ["customerUnitPrice", pricing.customerUnitPrice]
  ]) {
    if (!Number.isSafeInteger(value) || value < 0) add(path, "Todo precio emitido debe ser un entero CLP finito y no negativo");
  }
  if (!(pricing.discount.applied >= 0 && pricing.discount.applied < 1)) {
    issues.push(issue("discount.applied", "RANGE", "El descuento aplicado debe estar en [0, 1)"));
  }
  if (!(pricing.breakEvenNetTotal <= pricing.floorNetTotal && pricing.breakEvenNetTotal <= pricing.targetNetTotal)) {
    add("targetNetTotal", "El precio de equilibrio debe ser \u2264 piso (margen m\xEDnimo) y \u2264 objetivo");
  }
  return issues;
}

// src/modules/calculation/contracts/version.ts
var CALCULATION_V1 = "v1";
var CALCULATION_V2 = "v2";
function parseCalculationVersion(value, path) {
  if (value === void 0) return err(issue(path, "REQUIRED", "Campo requerido"));
  if (typeof value !== "string") return err(issue(path, "TYPE", "Debe ser texto"));
  if (!CALCULATION_VERSION_PATTERN.test(value)) {
    return err(issue(path, "FORMAT", "Formato esperado: v1, v2, ..."));
  }
  return ok(value);
}

// src/modules/calculation/contracts/validate/consistency.ts
function checkCatalogKeys(issues, path, catalog) {
  for (const [key, entry] of Object.entries(catalog)) {
    if (entry.ref.id !== key) {
      issues.push(issue(`${path}.${key}`, "INCONSISTENT", "La clave no coincide con ref.id"));
    }
  }
}
function checkRequestConsistency(request) {
  const issues = [];
  const { input, params, overrides } = request;
  checkCatalogKeys(issues, "params.materials", params.materials);
  checkCatalogKeys(issues, "params.machines", params.machines);
  checkCatalogKeys(issues, "params.services", params.services);
  if (input.channelId !== params.channel.ref.id) {
    issues.push(issue("input.channelId", "INCONSISTENT", "No coincide con el canal del snapshot (params.channel.ref.id)"));
  }
  input.plates.forEach((plate, plateIndex) => {
    const platePath = indexPath("input.plates", plateIndex);
    if (params.machines[plate.machineId] === void 0) {
      issues.push(issue(`${platePath}.machineId`, "UNKNOWN_REFERENCE", `M\xE1quina inexistente en el snapshot: ${plate.machineId}`));
    }
    if (plate.lastRun !== void 0) {
      const lastPath = `${platePath}.lastRun`;
      if (request.calculationVersion === CALCULATION_V1) {
        issues.push(issue(lastPath, "INCONSISTENT", "La \xFAltima placa con datos propios requiere calculationVersion v2 o superior"));
      }
      const remainder = input.quantity * plate.partsPerUnit % plate.partsPerPlate;
      if (remainder === 0) {
        issues.push(issue(lastPath, "INCONSISTENT", "No hay placa incompleta: todas las placas van llenas"));
      } else if (plate.lastRun.parts !== remainder) {
        issues.push(issue(`${lastPath}.parts`, "INCONSISTENT", `La \xFAltima placa debe tener ${String(remainder)} pieza(s)`));
      }
      plate.lastRun.filaments.forEach((filament, filamentIndex) => {
        if (params.materials[filament.materialId] === void 0) {
          issues.push(issue(`${indexPath(`${lastPath}.filaments`, filamentIndex)}.materialId`, "UNKNOWN_REFERENCE", `Material inexistente en el snapshot: ${filament.materialId}`));
        } else if (!plate.filaments.some((full) => full.materialId === filament.materialId)) {
          issues.push(issue(`${indexPath(`${lastPath}.filaments`, filamentIndex)}.materialId`, "INCONSISTENT", "La \xFAltima placa solo puede usar filamentos de la placa completa"));
        }
      });
    }
    plate.filaments.forEach((filament, filamentIndex) => {
      if (params.materials[filament.materialId] === void 0) {
        issues.push(
          issue(
            `${indexPath(`${platePath}.filaments`, filamentIndex)}.materialId`,
            "UNKNOWN_REFERENCE",
            `Material inexistente en el snapshot: ${filament.materialId}`
          )
        );
      }
    });
  });
  input.services.forEach((service, index) => {
    if (params.services[service.serviceId] === void 0) {
      issues.push(
        issue(
          `${indexPath("input.services", index)}.serviceId`,
          "UNKNOWN_REFERENCE",
          `Servicio inexistente en el snapshot: ${service.serviceId}`
        )
      );
    }
  });
  const activeAssemblies = input.services.filter(
    (service) => service.active && params.services[service.serviceId]?.kind === ServiceKind.ASSEMBLY
  );
  if (activeAssemblies.length > 1) {
    issues.push(
      issue("input.services", "INCONSISTENT", "Solo un servicio de ensamblaje puede estar activo (se cobra una sola vez)")
    );
  }
  const auxiliaryCodes = new Set(params.costProfile.auxiliaryCosts.map((spec) => spec.code));
  input.extraCosts.forEach((spec, index) => {
    if (auxiliaryCodes.has(spec.code)) {
      issues.push(
        issue(
          `${indexPath("input.extraCosts", index)}.code`,
          "DUPLICATE",
          `Colisiona con un costo auxiliar del perfil: ${spec.code}`
        )
      );
    }
  });
  if (request.mode === CalculationMode.TEST && overrides.length > 0) {
    issues.push(issue("overrides", "INCONSISTENT", "El modo TEST no admite overrides (no calcula precio)"));
  }
  return issues;
}

// src/modules/calculation/contracts/validate/cost-spec.ts
function readRecoveryConfig(issues, path, value, behavior) {
  const record = readRecord(issues, path, value, ["recovery", "amortization"]);
  if (record === void 0) return void 0;
  const recovery = readEnum(issues, childPath(path, "recovery"), record.recovery, Recovery);
  if (record.amortization === void 0) {
    return recovery === void 0 ? void 0 : { recovery };
  }
  const amortizationPath = childPath(path, "amortization");
  const amortizationRecord = readRecord(issues, amortizationPath, record.amortization, ["overUnits"]);
  const overUnits = amortizationRecord === void 0 ? void 0 : take(issues, parseQuantity(amortizationRecord.overUnits, childPath(amortizationPath, "overUnits")));
  if (recovery !== void 0 && recovery !== Recovery.IN_PRICE) {
    issues.push(issue(amortizationPath, "INCONSISTENT", "La amortizaci\xF3n solo aplica con recovery IN_PRICE"));
  }
  if (behavior !== void 0 && behavior !== CostBehavior.ONE_OFF) {
    issues.push(issue(amortizationPath, "INCONSISTENT", "La amortizaci\xF3n solo aplica a costos ONE_OFF"));
  }
  if (recovery === void 0 || overUnits === void 0) return void 0;
  return { recovery, amortization: { overUnits } };
}
function readCostSpec(issues, path, value) {
  const record = readRecord(issues, path, value, [
    "code",
    "label",
    "component",
    "behavior",
    "amount",
    "recoveryConfig"
  ]);
  if (record === void 0) return void 0;
  const code = readPattern(
    issues,
    childPath(path, "code"),
    record.code,
    ITEM_CODE_PATTERN,
    "letras, n\xFAmeros, _ . : -"
  );
  const label = readString(issues, childPath(path, "label"), record.label, MAX_LABEL_LENGTH);
  const component = readEnum(issues, childPath(path, "component"), record.component, CostComponent);
  const behavior = readEnum(issues, childPath(path, "behavior"), record.behavior, CostBehavior);
  const amount = takeMany(issues, parseTaxedAmount(record.amount, childPath(path, "amount")));
  const recoveryConfig = readRecoveryConfig(
    issues,
    childPath(path, "recoveryConfig"),
    record.recoveryConfig,
    behavior
  );
  if (component === CostComponent.FAILURE) {
    issues.push(
      issue(childPath(path, "component"), "INCONSISTENT", "FAILURE lo genera el modelo de fallas; no se declara")
    );
  }
  if (code === void 0 || label === void 0 || component === void 0 || behavior === void 0 || amount === void 0 || recoveryConfig === void 0) {
    return void 0;
  }
  return { code, label, component, behavior, amount, recoveryConfig };
}
function checkUniqueCodes(issues, path, specs) {
  const seen = /* @__PURE__ */ new Set();
  specs.forEach((spec, index) => {
    if (seen.has(spec.code)) {
      issues.push(issue(`${path}[${String(index)}].code`, "DUPLICATE", `C\xF3digo repetido: ${spec.code}`));
    }
    seen.add(spec.code);
  });
}

// src/core/versioning/revision.ts
function parseRevision(value, path) {
  const parsed = parseSafeInteger(value, path, "POSITIVE");
  return parsed.ok ? ok(parsed.value) : parsed;
}

// src/core/versioning/entity-ref.ts
function parseEntityRef(value, path) {
  const issues = [];
  const record = readRecord(issues, path, value, ["id", "revision"]);
  if (record === void 0) return err(issues);
  const id2 = readPattern(issues, childPath(path, "id"), record.id, ID_PATTERN, "letras, n\xFAmeros, _ . -");
  const revision2 = take(issues, parseRevision(record.revision, childPath(path, "revision")));
  if (id2 === void 0 || revision2 === void 0) return err(issues);
  return ok({ id: id2, revision: revision2 });
}

// src/core/versioning/constants.ts
var ISO_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z$/;
var MONTHS_PER_YEAR = 12;
var HOURS_PER_DAY = 24;
var MINUTES_PER_HOUR = 60;
var SECONDS_PER_MINUTE = 60;
var MILLIS_DIGITS = 3;
var DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
var FEBRUARY_INDEX = 1;
var LEAP_DAY_COUNT = 29;
var LEAP_EVERY = 4;
var NOT_LEAP_EVERY = 100;
var LEAP_AGAIN_EVERY = 400;

// src/core/versioning/iso-date-time.ts
function isLeapYear(year) {
  if (year % LEAP_AGAIN_EVERY === 0) return true;
  if (year % NOT_LEAP_EVERY === 0) return false;
  return year % LEAP_EVERY === 0;
}
function daysInMonth(year, month) {
  if (month - 1 === FEBRUARY_INDEX && isLeapYear(year)) return LEAP_DAY_COUNT;
  return DAYS_IN_MONTH[month - 1] ?? 0;
}
function parseIsoDateTime(value, path) {
  if (value === void 0) return err(issue(path, "REQUIRED", "Campo requerido"));
  if (typeof value !== "string") return err(issue(path, "TYPE", "Debe ser texto"));
  const match = ISO_DATE_TIME_PATTERN.exec(value);
  if (match === null) {
    return err(issue(path, "FORMAT", "Formato esperado: AAAA-MM-DDTHH:mm:ss[.sss]Z (UTC)"));
  }
  const [, y, mo, d, h, mi, s, fraction2] = match;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  const hour = Number(h);
  const minute = Number(mi);
  const second = Number(s);
  const valid = month >= 1 && month <= MONTHS_PER_YEAR && day >= 1 && day <= daysInMonth(year, month) && hour < HOURS_PER_DAY && minute < MINUTES_PER_HOUR && second < SECONDS_PER_MINUTE;
  if (!valid) return err(issue(path, "RANGE", "Fecha u hora inexistente"));
  const millis = (fraction2 ?? "").padEnd(MILLIS_DIGITS, "0");
  return ok(`${y}-${mo}-${d}T${h}:${mi}:${s}.${millis}Z`);
}

// src/modules/calculation/contracts/validate/parameters.ts
var Currency = { CLP: SUPPORTED_CURRENCY };
function readRef(issues, path, value) {
  return takeMany(issues, parseEntityRef(value, path));
}
function readTaxed(issues, path, value) {
  return takeMany(issues, parseTaxedAmount(value, path));
}
function readFailureRate(issues, path, value) {
  const rate = take(issues, parseFraction(value, path, "EXCLUSIVE"));
  if (rate !== void 0 && rate > MAX_FAILURE_RATE) {
    issues.push(issue(path, "RANGE", `La tasa de falla no puede superar ${String(MAX_FAILURE_RATE)}`));
    return void 0;
  }
  return rate;
}
function readRoundingStrategy(issues, path, value) {
  if (!isRecord(value)) {
    issues.push(issue(path, value === void 0 ? "REQUIRED" : "TYPE", "Debe ser un objeto"));
    return void 0;
  }
  const mode = readEnum(issues, childPath(path, "mode"), value.mode, RoundingMode);
  if (mode === void 0) return void 0;
  if (mode === RoundingMode.NONE) {
    return readRecord(issues, path, value, ["mode"]) === void 0 ? void 0 : { mode: RoundingMode.NONE };
  }
  const record = readRecord(issues, path, value, ["mode", "step", "direction", "target"]);
  if (record === void 0) return void 0;
  const step = take(issues, parseClp(record.step, childPath(path, "step"), "POSITIVE"));
  if (step !== void 0 && step > MAX_ROUNDING_STEP) {
    issues.push(issue(childPath(path, "step"), "RANGE", `M\xE1ximo ${String(MAX_ROUNDING_STEP)}`));
  }
  const direction = readEnum(issues, childPath(path, "direction"), record.direction, RoundingDirection);
  const target = readEnum(issues, childPath(path, "target"), record.target, RoundingTarget);
  if (step === void 0 || direction === void 0 || target === void 0) return void 0;
  return { mode: RoundingMode.STEP, step, direction, target };
}
function readDiscountTiers(issues, path, value) {
  const raw = readArray(issues, path, value, { min: 0, max: MAX_DISCOUNT_TIERS });
  if (raw === void 0) return void 0;
  const tiers = [];
  let complete = true;
  raw.forEach((item, index) => {
    const tierPath = indexPath(path, index);
    const record = readRecord(issues, tierPath, item, ["minQty", "maxQty", "discount"]);
    if (record === void 0) {
      complete = false;
      return;
    }
    const minQty = take(issues, parseQuantity(record.minQty, childPath(tierPath, "minQty")));
    const maxQty = record.maxQty === null ? null : take(issues, parseQuantity(record.maxQty, childPath(tierPath, "maxQty")));
    const discount = take(issues, parseFraction(record.discount, childPath(tierPath, "discount"), "EXCLUSIVE"));
    if (minQty === void 0 || maxQty === void 0 || discount === void 0) {
      complete = false;
      return;
    }
    tiers.push({ minQty, maxQty, discount });
  });
  if (!complete) return void 0;
  tiers.forEach((tier, index) => {
    const tierPath = indexPath(path, index);
    if (tier.maxQty !== null && tier.maxQty < tier.minQty) {
      issues.push(issue(childPath(tierPath, "maxQty"), "RANGE", "maxQty no puede ser menor que minQty"));
    }
    const previous = tiers[index - 1];
    if (index === 0) {
      if (tier.minQty !== 1) issues.push(issue(childPath(tierPath, "minQty"), "INCONSISTENT", "El primer tramo debe comenzar en 1"));
    } else if (previous !== void 0) {
      if (previous.maxQty === null) {
        issues.push(issue(childPath(tierPath, "minQty"), "INCONSISTENT", "Solo el \xFAltimo tramo puede ser abierto"));
      } else if (tier.minQty !== previous.maxQty + 1) {
        issues.push(issue(childPath(tierPath, "minQty"), "INCONSISTENT", "Los tramos deben ser contiguos, sin huecos ni solapes"));
      }
    }
    if (index === tiers.length - 1 && tier.maxQty !== null) {
      issues.push(issue(childPath(tierPath, "maxQty"), "INCONSISTENT", "El \xFAltimo tramo debe ser abierto (maxQty null)"));
    }
  });
  return tiers;
}
function readFailureParams(issues, path, value) {
  const record = readRecord(issues, path, value, ["modelId", "rate", "costFraction", "affectedComponents"]);
  if (record === void 0) return void 0;
  const modelId = readEnum(issues, childPath(path, "modelId"), record.modelId, FailureModelId);
  const rate = readFailureRate(issues, childPath(path, "rate"), record.rate);
  const costFraction = take(issues, parseFraction(record.costFraction, childPath(path, "costFraction")));
  const componentsPath = childPath(path, "affectedComponents");
  const rawComponents = readArray(issues, componentsPath, record.affectedComponents, {
    min: 0,
    max: Object.keys(CostComponent).length
  });
  const affectedComponents = [];
  rawComponents?.forEach((raw, index) => {
    const component = readEnum(issues, indexPath(componentsPath, index), raw, CostComponent);
    if (component === void 0) return;
    if (component === CostComponent.FAILURE) {
      issues.push(issue(indexPath(componentsPath, index), "INCONSISTENT", "FAILURE no puede estar afectado por fallas"));
    }
    if (affectedComponents.includes(component)) {
      issues.push(issue(indexPath(componentsPath, index), "DUPLICATE", `Componente repetido: ${component}`));
    }
    affectedComponents.push(component);
  });
  if (modelId === void 0 || rate === void 0 || costFraction === void 0 || rawComponents === void 0 || affectedComponents.length !== rawComponents.length) {
    return void 0;
  }
  return { modelId, rate, costFraction, affectedComponents };
}
function readCostProfile(issues, path, value) {
  const record = readRecord(issues, path, value, [
    "ref",
    "labor",
    "supervision",
    "preparation",
    "energy",
    "materialWaste",
    "failure",
    "auxiliaryCosts"
  ]);
  if (record === void 0) return void 0;
  const ref = readRef(issues, childPath(path, "ref"), record.ref);
  const laborPath = childPath(path, "labor");
  const labor = readRecord(issues, laborPath, record.labor, ["ratePerHour", "rateByKind"]);
  const ratePerHour = labor === void 0 ? void 0 : take(issues, parseMoneyAmount(labor.ratePerHour, childPath(laborPath, "ratePerHour")));
  let rateByKind;
  if (labor !== void 0 && labor.rateByKind !== void 0) {
    const kindsPath = childPath(laborPath, "rateByKind");
    const kinds = readRecord(issues, kindsPath, labor.rateByKind, Object.values(LaborKind));
    if (kinds !== void 0) {
      rateByKind = {};
      for (const kind of Object.values(LaborKind)) {
        if (kinds[kind] === void 0) continue;
        const rate = take(issues, parseMoneyAmount(kinds[kind], childPath(kindsPath, kind)));
        if (rate !== void 0) rateByKind[kind] = rate;
      }
    }
  }
  const supervisionPath = childPath(path, "supervision");
  const supervision = readRecord(issues, supervisionPath, record.supervision, ["hoursPerPrintHour"]);
  const hoursPerPrintHour = supervision === void 0 ? void 0 : take(issues, parseRatio(supervision.hoursPerPrintHour, childPath(supervisionPath, "hoursPerPrintHour")));
  const preparationPath = childPath(path, "preparation");
  const preparation = readRecord(issues, preparationPath, record.preparation, [
    "jobSetupMinutes",
    "plateChangeoverMinutes"
  ]);
  const jobSetupMinutes = preparation === void 0 ? void 0 : take(issues, parseMinutes(preparation.jobSetupMinutes, childPath(preparationPath, "jobSetupMinutes")));
  const plateChangeoverMinutes = preparation === void 0 ? void 0 : take(
    issues,
    parseMinutes(preparation.plateChangeoverMinutes, childPath(preparationPath, "plateChangeoverMinutes"))
  );
  const energyPath = childPath(path, "energy");
  const energy = readRecord(issues, energyPath, record.energy, ["kwhPrice"]);
  const kwhPrice = energy === void 0 ? void 0 : readTaxed(issues, childPath(energyPath, "kwhPrice"), energy.kwhPrice);
  const wastePath = childPath(path, "materialWaste");
  const waste = readRecord(issues, wastePath, record.materialWaste, ["fraction"]);
  const wasteFraction = waste === void 0 ? void 0 : take(issues, parseFraction(waste.fraction, childPath(wastePath, "fraction"), "EXCLUSIVE"));
  const failure = readFailureParams(issues, childPath(path, "failure"), record.failure);
  const auxPath = childPath(path, "auxiliaryCosts");
  const rawAux = readArray(issues, auxPath, record.auxiliaryCosts, { min: 0, max: MAX_AUXILIARY_COSTS });
  const auxiliaryCosts = [];
  rawAux?.forEach((raw, index) => {
    const spec = readCostSpec(issues, indexPath(auxPath, index), raw);
    if (spec !== void 0) auxiliaryCosts.push(spec);
  });
  checkUniqueCodes(issues, auxPath, auxiliaryCosts);
  if (ref === void 0 || ratePerHour === void 0 || labor !== void 0 && labor.rateByKind !== void 0 && rateByKind === void 0 || hoursPerPrintHour === void 0 || jobSetupMinutes === void 0 || plateChangeoverMinutes === void 0 || kwhPrice === void 0 || wasteFraction === void 0 || failure === void 0 || rawAux === void 0 || auxiliaryCosts.length !== rawAux.length) {
    return void 0;
  }
  return {
    ref,
    labor: { ratePerHour, ...rateByKind === void 0 ? {} : { rateByKind } },
    supervision: { hoursPerPrintHour },
    preparation: { jobSetupMinutes, plateChangeoverMinutes },
    energy: { kwhPrice },
    materialWaste: { fraction: wasteFraction },
    failure,
    auxiliaryCosts
  };
}
function readPricingProfile(issues, path, value) {
  const record = readRecord(issues, path, value, [
    "ref",
    "targetMargin",
    "minMargin",
    "onBelowMin",
    "discountTiers",
    "rounding"
  ]);
  if (record === void 0) return void 0;
  const ref = readRef(issues, childPath(path, "ref"), record.ref);
  const targetMargin = take(issues, parseFraction(record.targetMargin, childPath(path, "targetMargin"), "EXCLUSIVE"));
  const minMargin = take(issues, parseFraction(record.minMargin, childPath(path, "minMargin"), "EXCLUSIVE"));
  if (targetMargin !== void 0 && minMargin !== void 0 && minMargin > targetMargin) {
    issues.push(issue(childPath(path, "minMargin"), "INCONSISTENT", "El margen m\xEDnimo no puede superar al objetivo"));
  }
  const onBelowMin = readEnum(issues, childPath(path, "onBelowMin"), record.onBelowMin, BelowMinPolicyId);
  const discountTiers = readDiscountTiers(issues, childPath(path, "discountTiers"), record.discountTiers);
  const rounding = readRoundingStrategy(issues, childPath(path, "rounding"), record.rounding);
  if (ref === void 0 || targetMargin === void 0 || minMargin === void 0 || onBelowMin === void 0 || discountTiers === void 0 || rounding === void 0) {
    return void 0;
  }
  return { ref, targetMargin, minMargin, onBelowMin, discountTiers, rounding };
}
function readTaxProfile(issues, path, value) {
  const record = readRecord(issues, path, value, [
    "ref",
    "regime",
    "vatRate",
    "purchaseVatRate",
    "customerPriceMode"
  ]);
  if (record === void 0) return void 0;
  const ref = readRef(issues, childPath(path, "ref"), record.ref);
  const regime = readEnum(issues, childPath(path, "regime"), record.regime, TaxRegime);
  const vatRate = take(issues, parseFraction(record.vatRate, childPath(path, "vatRate"), "EXCLUSIVE"));
  const purchaseVatRate = take(
    issues,
    parseFraction(record.purchaseVatRate, childPath(path, "purchaseVatRate"), "EXCLUSIVE")
  );
  if (regime === TaxRegime.NOT_REGISTERED && vatRate !== void 0 && vatRate !== 0) {
    issues.push(issue(childPath(path, "vatRate"), "INCONSISTENT", "Con r\xE9gimen NOT_REGISTERED la tasa de IVA debe ser 0"));
  }
  const customerPriceMode = readEnum(
    issues,
    childPath(path, "customerPriceMode"),
    record.customerPriceMode,
    CustomerPriceMode
  );
  if (ref === void 0 || regime === void 0 || vatRate === void 0 || purchaseVatRate === void 0 || customerPriceMode === void 0) {
    return void 0;
  }
  return { ref, regime, vatRate, purchaseVatRate, customerPriceMode };
}
function readChannel(issues, path, value) {
  const record = readRecord(issues, path, value, [
    "ref",
    "name",
    "kind",
    "commission",
    "fixedFee",
    "commissionBase",
    "commissionTax"
  ]);
  if (record === void 0) return void 0;
  const ref = readRef(issues, childPath(path, "ref"), record.ref);
  const name = readString(issues, childPath(path, "name"), record.name, MAX_LABEL_LENGTH);
  const kind = readEnum(issues, childPath(path, "kind"), record.kind, ChannelKind);
  const commission = take(issues, parseFraction(record.commission, childPath(path, "commission"), "EXCLUSIVE"));
  const fixedFee = readTaxed(issues, childPath(path, "fixedFee"), record.fixedFee);
  const commissionBase = readEnum(issues, childPath(path, "commissionBase"), record.commissionBase, CommissionBase);
  const taxPath = childPath(path, "commissionTax");
  const tax = readRecord(issues, taxPath, record.commissionTax, ["vatCharged", "vatRecoverable"]);
  const vatCharged = tax === void 0 ? void 0 : readBoolean(issues, childPath(taxPath, "vatCharged"), tax.vatCharged);
  const vatRecoverable = tax === void 0 ? void 0 : readBoolean(issues, childPath(taxPath, "vatRecoverable"), tax.vatRecoverable);
  if (ref === void 0 || name === void 0 || kind === void 0 || commission === void 0 || fixedFee === void 0 || commissionBase === void 0 || vatCharged === void 0 || vatRecoverable === void 0) {
    return void 0;
  }
  return { ref, name, kind, commission, fixedFee, commissionBase, commissionTax: { vatCharged, vatRecoverable } };
}
function readMaterial(issues, path, value) {
  const record = readRecord(issues, path, value, [
    "ref",
    "name",
    "brand",
    "spool",
    "wasteFractionOverride",
    "failureRateOverride"
  ]);
  if (record === void 0) return void 0;
  const ref = readRef(issues, childPath(path, "ref"), record.ref);
  const name = readString(issues, childPath(path, "name"), record.name, MAX_LABEL_LENGTH);
  const brand = readString(issues, childPath(path, "brand"), record.brand, MAX_LABEL_LENGTH, true);
  const spoolPath = childPath(path, "spool");
  const spool = readRecord(issues, spoolPath, record.spool, ["price", "netGrams"]);
  const price = spool === void 0 ? void 0 : readTaxed(issues, childPath(spoolPath, "price"), spool.price);
  const netGrams = spool === void 0 ? void 0 : take(issues, parseGrams(spool.netGrams, childPath(spoolPath, "netGrams"), "POSITIVE"));
  const wasteFractionOverride = record.wasteFractionOverride === void 0 ? void 0 : take(
    issues,
    parseFraction(record.wasteFractionOverride, childPath(path, "wasteFractionOverride"), "EXCLUSIVE")
  );
  const failureRateOverride = record.failureRateOverride === void 0 ? void 0 : readFailureRate(issues, childPath(path, "failureRateOverride"), record.failureRateOverride);
  if (ref === void 0 || name === void 0 || brand === void 0 || price === void 0 || netGrams === void 0 || record.wasteFractionOverride !== void 0 && wasteFractionOverride === void 0 || record.failureRateOverride !== void 0 && failureRateOverride === void 0) {
    return void 0;
  }
  return {
    ref,
    name,
    brand,
    spool: { price, netGrams },
    ...wasteFractionOverride === void 0 ? {} : { wasteFractionOverride },
    ...failureRateOverride === void 0 ? {} : { failureRateOverride }
  };
}
function readMachine(issues, path, value) {
  const record = readRecord(issues, path, value, [
    "ref",
    "name",
    "avgPowerW",
    "electricityPerHourOverride",
    "purchasePrice",
    "residualValue",
    "lifetimeHours",
    "maintenanceReservePerHour",
    "wearPerHourOverride",
    "supervisionRatioOverride",
    "failureRateOverride"
  ]);
  if (record === void 0) return void 0;
  const ref = readRef(issues, childPath(path, "ref"), record.ref);
  const name = readString(issues, childPath(path, "name"), record.name, MAX_LABEL_LENGTH);
  const present = (key) => record[key] !== void 0;
  const avgPowerW = present("avgPowerW") ? take(issues, parseWatts(record.avgPowerW, childPath(path, "avgPowerW"))) : void 0;
  const electricityPerHourOverride = present("electricityPerHourOverride") ? readTaxed(issues, childPath(path, "electricityPerHourOverride"), record.electricityPerHourOverride) : void 0;
  const purchasePrice = present("purchasePrice") ? readTaxed(issues, childPath(path, "purchasePrice"), record.purchasePrice) : void 0;
  const residualValue = present("residualValue") ? readTaxed(issues, childPath(path, "residualValue"), record.residualValue) : void 0;
  const lifetimeHours = present("lifetimeHours") ? take(issues, parseHours(record.lifetimeHours, childPath(path, "lifetimeHours"), "POSITIVE")) : void 0;
  const maintenanceReservePerHour = present("maintenanceReservePerHour") ? take(issues, parseMoneyAmount(record.maintenanceReservePerHour, childPath(path, "maintenanceReservePerHour"))) : void 0;
  const wearPerHourOverride = present("wearPerHourOverride") ? take(issues, parseMoneyAmount(record.wearPerHourOverride, childPath(path, "wearPerHourOverride"))) : void 0;
  const supervisionRatioOverride = present("supervisionRatioOverride") ? take(issues, parseRatio(record.supervisionRatioOverride, childPath(path, "supervisionRatioOverride"))) : void 0;
  const failureRateOverride = present("failureRateOverride") ? readFailureRate(issues, childPath(path, "failureRateOverride"), record.failureRateOverride) : void 0;
  if (!present("avgPowerW") && !present("electricityPerHourOverride")) {
    issues.push(issue(childPath(path, "avgPowerW"), "REQUIRED", "Requiere avgPowerW o electricityPerHourOverride"));
  }
  if (!present("wearPerHourOverride") && !(present("purchasePrice") && present("lifetimeHours"))) {
    issues.push(
      issue(childPath(path, "wearPerHourOverride"), "REQUIRED", "Requiere wearPerHourOverride o purchasePrice + lifetimeHours")
    );
  }
  const optionalFailed = present("avgPowerW") && avgPowerW === void 0 || present("electricityPerHourOverride") && electricityPerHourOverride === void 0 || present("purchasePrice") && purchasePrice === void 0 || present("residualValue") && residualValue === void 0 || present("lifetimeHours") && lifetimeHours === void 0 || present("maintenanceReservePerHour") && maintenanceReservePerHour === void 0 || present("wearPerHourOverride") && wearPerHourOverride === void 0 || present("supervisionRatioOverride") && supervisionRatioOverride === void 0 || present("failureRateOverride") && failureRateOverride === void 0;
  if (ref === void 0 || name === void 0 || optionalFailed) return void 0;
  return {
    ref,
    name,
    ...avgPowerW === void 0 ? {} : { avgPowerW },
    ...electricityPerHourOverride === void 0 ? {} : { electricityPerHourOverride },
    ...purchasePrice === void 0 ? {} : { purchasePrice },
    ...residualValue === void 0 ? {} : { residualValue },
    ...lifetimeHours === void 0 ? {} : { lifetimeHours },
    ...maintenanceReservePerHour === void 0 ? {} : { maintenanceReservePerHour },
    ...wearPerHourOverride === void 0 ? {} : { wearPerHourOverride },
    ...supervisionRatioOverride === void 0 ? {} : { supervisionRatioOverride },
    ...failureRateOverride === void 0 ? {} : { failureRateOverride }
  };
}
function readService(issues, path, value) {
  const record = readRecord(issues, path, value, [
    "ref",
    "name",
    "kind",
    "behavior",
    "component",
    "supplyCost",
    "laborMinutes",
    "laborKind",
    "laborRateOverride",
    "defaultRecovery"
  ]);
  if (record === void 0) return void 0;
  const ref = readRef(issues, childPath(path, "ref"), record.ref);
  const name = readString(issues, childPath(path, "name"), record.name, MAX_LABEL_LENGTH);
  const kind = readEnum(issues, childPath(path, "kind"), record.kind, ServiceKind);
  const behavior = readEnum(issues, childPath(path, "behavior"), record.behavior, CostBehavior);
  if (kind === ServiceKind.ASSEMBLY && behavior !== void 0 && behavior !== CostBehavior.PER_EXTRA_PART) {
    issues.push(issue(childPath(path, "behavior"), "INCONSISTENT", "El ensamblaje debe ser PER_EXTRA_PART"));
  }
  const component = readEnum(issues, childPath(path, "component"), record.component, CostComponent);
  if (component === CostComponent.FAILURE) {
    issues.push(issue(childPath(path, "component"), "INCONSISTENT", "FAILURE lo genera el modelo de fallas"));
  }
  const supplyCost = readTaxed(issues, childPath(path, "supplyCost"), record.supplyCost);
  const laborMinutes = take(issues, parseMinutes(record.laborMinutes, childPath(path, "laborMinutes")));
  const laborKind = readEnum(issues, childPath(path, "laborKind"), record.laborKind, LaborKind);
  const laborRateOverride = record.laborRateOverride === void 0 ? void 0 : take(issues, parseMoneyAmount(record.laborRateOverride, childPath(path, "laborRateOverride")));
  const defaultRecovery = readRecoveryConfig(issues, childPath(path, "defaultRecovery"), record.defaultRecovery, behavior);
  if (ref === void 0 || name === void 0 || kind === void 0 || behavior === void 0 || component === void 0 || supplyCost === void 0 || laborMinutes === void 0 || laborKind === void 0 || record.laborRateOverride !== void 0 && laborRateOverride === void 0 || defaultRecovery === void 0) {
    return void 0;
  }
  return {
    ref,
    name,
    kind,
    behavior,
    component,
    supplyCost,
    laborMinutes,
    laborKind,
    ...laborRateOverride === void 0 ? {} : { laborRateOverride },
    defaultRecovery
  };
}
function readCatalog(issues, path, value, readItem, minEntries) {
  if (value === void 0) {
    issues.push(issue(path, "REQUIRED", "Campo requerido"));
    return void 0;
  }
  if (!isRecord(value)) {
    issues.push(issue(path, "TYPE", "Debe ser un objeto indexado por id"));
    return void 0;
  }
  const keys = Object.keys(value);
  if (keys.length < minEntries) {
    issues.push(issue(path, "EMPTY", `Requiere al menos ${String(minEntries)} elemento(s)`));
    return void 0;
  }
  if (keys.length > MAX_CATALOG_ENTRIES) {
    issues.push(issue(path, "TOO_MANY", `M\xE1ximo ${String(MAX_CATALOG_ENTRIES)} elementos`));
    return void 0;
  }
  const result = {};
  let complete = true;
  for (const key of keys) {
    const item = readItem(issues, childPath(path, key), value[key]);
    if (item === void 0) {
      complete = false;
      continue;
    }
    if (item.ref.id !== key) {
      issues.push(issue(childPath(path, key), "INCONSISTENT", "La clave no coincide con ref.id"));
      complete = false;
      continue;
    }
    result[key] = item;
  }
  return complete ? result : void 0;
}
function readParameterSnapshot(issues, path, value) {
  const record = readRecord(issues, path, value, [
    "costProfile",
    "pricingProfile",
    "taxProfile",
    "channel",
    "materials",
    "machines",
    "services",
    "resolvedAt",
    "currency"
  ]);
  if (record === void 0) return void 0;
  const costProfile = readCostProfile(issues, childPath(path, "costProfile"), record.costProfile);
  const pricingProfile = readPricingProfile(issues, childPath(path, "pricingProfile"), record.pricingProfile);
  const taxProfile = readTaxProfile(issues, childPath(path, "taxProfile"), record.taxProfile);
  const channel = readChannel(issues, childPath(path, "channel"), record.channel);
  const materials = readCatalog(issues, childPath(path, "materials"), record.materials, readMaterial, 1);
  const machines = readCatalog(issues, childPath(path, "machines"), record.machines, readMachine, 1);
  const services = readCatalog(issues, childPath(path, "services"), record.services, readService, 0);
  const resolvedAt = take(issues, parseIsoDateTime(record.resolvedAt, childPath(path, "resolvedAt")));
  const currency = readEnum(issues, childPath(path, "currency"), record.currency, Currency);
  if (costProfile === void 0 || pricingProfile === void 0 || taxProfile === void 0 || channel === void 0 || materials === void 0 || machines === void 0 || services === void 0 || resolvedAt === void 0 || currency === void 0) {
    return void 0;
  }
  return { costProfile, pricingProfile, taxProfile, channel, materials, machines, services, resolvedAt, currency };
}

// src/modules/calculation/contracts/validate/overrides.ts
var BASE_KEYS = ["kind", "value", "reason"];
function allowedKeys(kind) {
  return kind === OverrideKind.ITEM_RECOVERY || kind === OverrideKind.FIXED_LINE_PRICE ? [...BASE_KEYS, "itemCode"] : BASE_KEYS;
}
function readItemCode(issues, path, value) {
  return readPattern(issues, childPath(path, "itemCode"), value, ITEM_CODE_PATTERN, "letras, n\xFAmeros, _ . : -");
}
function readOverride(issues, path, value) {
  if (!isRecord(value)) {
    issues.push(issue(path, value === void 0 ? "REQUIRED" : "TYPE", "Debe ser un objeto"));
    return void 0;
  }
  const kind = readEnum(issues, childPath(path, "kind"), value.kind, OverrideKind);
  if (kind === void 0) return void 0;
  const record = readRecord(issues, path, value, allowedKeys(kind));
  if (record === void 0) return void 0;
  const reason = readString(issues, childPath(path, "reason"), record.reason, MAX_REASON_LENGTH);
  const valuePath = childPath(path, "value");
  switch (kind) {
    case OverrideKind.TARGET_MARGIN:
    case OverrideKind.MIN_MARGIN: {
      const margin = take(issues, parseFraction(record.value, valuePath, "EXCLUSIVE"));
      return reason === void 0 || margin === void 0 ? void 0 : { kind, value: margin, reason };
    }
    case OverrideKind.DISCOUNT: {
      const body = readRecord(issues, valuePath, record.value, ["mode", "pct"]);
      if (body === void 0) return void 0;
      const mode = readEnum(issues, childPath(valuePath, "mode"), body.mode, DiscountOverrideMode);
      if (mode === DiscountOverrideMode.NONE) {
        if (body.pct !== void 0) {
          issues.push(issue(childPath(valuePath, "pct"), "INCONSISTENT", "pct no aplica con mode NONE"));
          return void 0;
        }
        return reason === void 0 ? void 0 : { kind, value: { mode }, reason };
      }
      if (mode === DiscountOverrideMode.MANUAL) {
        const pct = take(issues, parseFraction(body.pct, childPath(valuePath, "pct"), "EXCLUSIVE"));
        return reason === void 0 || pct === void 0 ? void 0 : { kind, value: { mode, pct }, reason };
      }
      return void 0;
    }
    case OverrideKind.FAILURE_RATE: {
      const body = readRecord(issues, valuePath, record.value, ["mode", "rate"]);
      if (body === void 0) return void 0;
      const mode = readEnum(issues, childPath(valuePath, "mode"), body.mode, FailureOverrideMode);
      if (mode === FailureOverrideMode.DISABLED) {
        if (body.rate !== void 0) {
          issues.push(issue(childPath(valuePath, "rate"), "INCONSISTENT", "rate no aplica con mode DISABLED"));
          return void 0;
        }
        return reason === void 0 ? void 0 : { kind, value: { mode }, reason };
      }
      if (mode === FailureOverrideMode.RATE) {
        const rate = readFailureRate(issues, childPath(valuePath, "rate"), body.rate);
        return reason === void 0 || rate === void 0 ? void 0 : { kind, value: { mode, rate }, reason };
      }
      return void 0;
    }
    case OverrideKind.ROUNDING: {
      const rounding = readRoundingStrategy(issues, valuePath, record.value);
      return reason === void 0 || rounding === void 0 ? void 0 : { kind, value: rounding, reason };
    }
    case OverrideKind.ITEM_RECOVERY: {
      const itemCode = readItemCode(issues, path, record.itemCode);
      const recovery = readRecoveryConfig(issues, valuePath, record.value, void 0);
      return reason === void 0 || itemCode === void 0 || recovery === void 0 ? void 0 : { kind, itemCode, value: recovery, reason };
    }
    case OverrideKind.FIXED_UNIT_PRICE: {
      const body = readRecord(issues, valuePath, record.value, ["customerUnitPrice"]);
      const price = body === void 0 ? void 0 : take(issues, parseClp(body.customerUnitPrice, childPath(valuePath, "customerUnitPrice"), "POSITIVE"));
      return reason === void 0 || price === void 0 ? void 0 : { kind, value: { customerUnitPrice: price }, reason };
    }
    case OverrideKind.FIXED_LINE_PRICE: {
      const itemCode = readItemCode(issues, path, record.itemCode);
      const body = readRecord(issues, valuePath, record.value, ["customerPrice"]);
      const price = body === void 0 ? void 0 : take(issues, parseClp(body.customerPrice, childPath(valuePath, "customerPrice"), "POSITIVE"));
      return reason === void 0 || itemCode === void 0 || price === void 0 ? void 0 : { kind, itemCode, value: { customerPrice: price }, reason };
    }
  }
}
function readOverrides(issues, path, value) {
  const raw = readArray(issues, path, value, { min: 0, max: MAX_OVERRIDES });
  if (raw === void 0) return void 0;
  const entries = [];
  raw.forEach((item, index) => {
    const entry = readOverride(issues, indexPath(path, index), item);
    if (entry !== void 0) entries.push(entry);
  });
  const seen = /* @__PURE__ */ new Set();
  entries.forEach((entry, index) => {
    const key = "itemCode" in entry ? `${entry.kind}:${entry.itemCode}` : entry.kind;
    if (seen.has(key)) {
      issues.push(issue(indexPath(path, index), "DUPLICATE", `Override repetido: ${key}`));
    }
    seen.add(key);
  });
  return entries.length === raw.length ? entries : void 0;
}

// src/modules/calculation/contracts/validate/quote-input.ts
var ID_HINT = "letras, n\xFAmeros, _ . -";
function readFilament(issues, path, value) {
  const record = readRecord(issues, path, value, ["materialId", "grams"]);
  if (record === void 0) return void 0;
  const materialId = readPattern(issues, childPath(path, "materialId"), record.materialId, ID_PATTERN, ID_HINT);
  const grams = take(issues, parseGrams(record.grams, childPath(path, "grams"), "POSITIVE"));
  if (materialId === void 0 || grams === void 0) return void 0;
  return { materialId, grams };
}
function readFilamentList(issues, path, value) {
  const raw = readArray(issues, path, value, { min: 1, max: MAX_FILAMENTS_PER_PLATE });
  const list = [];
  raw?.forEach((entry, index) => {
    const filament = readFilament(issues, indexPath(path, index), entry);
    if (filament !== void 0) list.push(filament);
  });
  const seen = /* @__PURE__ */ new Set();
  list.forEach((filament, index) => {
    if (seen.has(filament.materialId)) {
      issues.push(issue(`${indexPath(path, index)}.materialId`, "DUPLICATE", "Material repetido en la placa; sume los gramos"));
    }
    seen.add(filament.materialId);
  });
  return { list, complete: raw !== void 0 && list.length === raw.length };
}
function readLastRun(issues, path, value) {
  const record = readRecord(issues, path, value, ["parts", "filaments", "printHours"]);
  if (record === void 0) return void 0;
  const parts = take(issues, parseQuantity(record.parts, childPath(path, "parts")));
  const filaments = readFilamentList(issues, childPath(path, "filaments"), record.filaments);
  const printHours = take(issues, parseHours(record.printHours, childPath(path, "printHours"), "POSITIVE"));
  if (parts === void 0 || !filaments.complete || printHours === void 0) return void 0;
  return { parts, filaments: filaments.list, printHours };
}
function readPlate(issues, path, value) {
  const record = readRecord(issues, path, value, [
    "id",
    "label",
    "filaments",
    "machineId",
    "printHours",
    "partsPerPlate",
    "partsPerUnit",
    "weightIncludesWaste",
    "source",
    "sourceTestId",
    "lastRun"
  ]);
  if (record === void 0) return void 0;
  const id2 = readPattern(issues, childPath(path, "id"), record.id, ID_PATTERN, ID_HINT);
  const label = readString(issues, childPath(path, "label"), record.label, MAX_LABEL_LENGTH);
  const filamentsPath = childPath(path, "filaments");
  const rawFilaments = readArray(issues, filamentsPath, record.filaments, {
    min: 1,
    max: MAX_FILAMENTS_PER_PLATE
  });
  const filaments = [];
  rawFilaments?.forEach((raw, index) => {
    const filament = readFilament(issues, indexPath(filamentsPath, index), raw);
    if (filament !== void 0) filaments.push(filament);
  });
  const seenMaterials = /* @__PURE__ */ new Set();
  filaments.forEach((filament, index) => {
    if (seenMaterials.has(filament.materialId)) {
      issues.push(
        issue(`${indexPath(filamentsPath, index)}.materialId`, "DUPLICATE", "Material repetido en la placa; sume los gramos")
      );
    }
    seenMaterials.add(filament.materialId);
  });
  const machineId = readPattern(issues, childPath(path, "machineId"), record.machineId, ID_PATTERN, ID_HINT);
  const printHours = take(issues, parseHours(record.printHours, childPath(path, "printHours"), "POSITIVE"));
  const partsPerPlate = take(issues, parseQuantity(record.partsPerPlate, childPath(path, "partsPerPlate")));
  const partsPerUnit = take(issues, parseQuantity(record.partsPerUnit, childPath(path, "partsPerUnit")));
  const weightIncludesWaste = readBoolean(
    issues,
    childPath(path, "weightIncludesWaste"),
    record.weightIncludesWaste
  );
  const source = readEnum(issues, childPath(path, "source"), record.source, PlateSource);
  const sourceTestId = record.sourceTestId === void 0 ? void 0 : readPattern(issues, childPath(path, "sourceTestId"), record.sourceTestId, ID_PATTERN, ID_HINT);
  const lastRun = record.lastRun === void 0 ? void 0 : readLastRun(issues, childPath(path, "lastRun"), record.lastRun);
  if (source === PlateSource.TEST && record.sourceTestId === void 0) {
    issues.push(issue(childPath(path, "sourceTestId"), "REQUIRED", "Requerido cuando source es TEST"));
  }
  if (id2 === void 0 || label === void 0 || rawFilaments === void 0 || filaments.length !== rawFilaments.length || machineId === void 0 || printHours === void 0 || partsPerPlate === void 0 || partsPerUnit === void 0 || weightIncludesWaste === void 0 || source === void 0 || record.sourceTestId !== void 0 && sourceTestId === void 0 || record.lastRun !== void 0 && lastRun === void 0) {
    return void 0;
  }
  return {
    id: id2,
    label,
    filaments,
    machineId,
    printHours,
    partsPerPlate,
    partsPerUnit,
    weightIncludesWaste,
    source,
    ...sourceTestId === void 0 ? {} : { sourceTestId },
    ...lastRun === void 0 ? {} : { lastRun }
  };
}
function readService2(issues, path, value) {
  const record = readRecord(issues, path, value, ["serviceId", "active", "laborMinutes"]);
  if (record === void 0) return void 0;
  const serviceId = readPattern(issues, childPath(path, "serviceId"), record.serviceId, ID_PATTERN, ID_HINT);
  const active = readBoolean(issues, childPath(path, "active"), record.active);
  const laborMinutes = record.laborMinutes === void 0 ? void 0 : take(issues, parseMinutes(record.laborMinutes, childPath(path, "laborMinutes")));
  if (serviceId === void 0 || active === void 0) return void 0;
  if (record.laborMinutes !== void 0 && laborMinutes === void 0) return void 0;
  return { serviceId, active, ...laborMinutes === void 0 ? {} : { laborMinutes } };
}
function readQuoteInput(issues, path, value) {
  const record = readRecord(issues, path, value, [
    "quantity",
    "batches",
    "plates",
    "services",
    "extraCosts",
    "channelId"
  ]);
  if (record === void 0) return void 0;
  const quantity = take(issues, parseQuantity(record.quantity, childPath(path, "quantity")));
  const batches = take(issues, parseQuantity(record.batches, childPath(path, "batches")));
  const platesPath = childPath(path, "plates");
  const rawPlates = readArray(issues, platesPath, record.plates, { min: 1, max: MAX_PLATES });
  const plates = [];
  rawPlates?.forEach((raw, index) => {
    const plate = readPlate(issues, indexPath(platesPath, index), raw);
    if (plate !== void 0) plates.push(plate);
  });
  const seenPlates = /* @__PURE__ */ new Set();
  plates.forEach((plate, index) => {
    if (seenPlates.has(plate.id)) {
      issues.push(issue(`${indexPath(platesPath, index)}.id`, "DUPLICATE", `Placa repetida: ${plate.id}`));
    }
    seenPlates.add(plate.id);
  });
  const servicesPath = childPath(path, "services");
  const rawServices = readArray(issues, servicesPath, record.services, { min: 0, max: MAX_SERVICES });
  const services = [];
  rawServices?.forEach((raw, index) => {
    const service = readService2(issues, indexPath(servicesPath, index), raw);
    if (service !== void 0) services.push(service);
  });
  const seenServices = /* @__PURE__ */ new Set();
  services.forEach((service, index) => {
    if (seenServices.has(service.serviceId)) {
      issues.push(
        issue(`${indexPath(servicesPath, index)}.serviceId`, "DUPLICATE", `Servicio repetido: ${service.serviceId}`)
      );
    }
    seenServices.add(service.serviceId);
  });
  const extraPath = childPath(path, "extraCosts");
  const rawExtras = readArray(issues, extraPath, record.extraCosts, { min: 0, max: MAX_EXTRA_COSTS });
  const extraCosts = [];
  rawExtras?.forEach((raw, index) => {
    const spec = readCostSpec(issues, indexPath(extraPath, index), raw);
    if (spec !== void 0) extraCosts.push(spec);
  });
  checkUniqueCodes(issues, extraPath, extraCosts);
  const channelId = readPattern(issues, childPath(path, "channelId"), record.channelId, ID_PATTERN, ID_HINT);
  if (quantity === void 0 || batches === void 0 || rawPlates === void 0 || plates.length !== rawPlates.length || rawServices === void 0 || services.length !== rawServices.length || rawExtras === void 0 || extraCosts.length !== rawExtras.length || channelId === void 0) {
    return void 0;
  }
  return { quantity, batches, plates, services, extraCosts, channelId };
}

// src/modules/calculation/contracts/validate/request.ts
function validateCalculationRequest(raw) {
  const issues = [];
  const record = readRecord(issues, "", raw, ["calculationVersion", "mode", "input", "params", "overrides"]);
  if (record === void 0) return err(issues);
  const calculationVersion = take(issues, parseCalculationVersion(record.calculationVersion, "calculationVersion"));
  const mode = readEnum(issues, "mode", record.mode, CalculationMode);
  const input = readQuoteInput(issues, "input", record.input);
  const params = readParameterSnapshot(issues, "params", record.params);
  const overrides = readOverrides(issues, "overrides", record.overrides);
  if (issues.length > 0 || calculationVersion === void 0 || mode === void 0 || input === void 0 || params === void 0 || overrides === void 0) {
    return err(issues);
  }
  const request = { calculationVersion, mode, input, params, overrides };
  const crossIssues = checkRequestConsistency(request);
  return crossIssues.length > 0 ? err(crossIssues) : ok(request);
}

// src/modules/calculation/v1/common/errors.ts
function invalidInput(path, code, message) {
  return { code: "INVALID_INPUT", issues: [issue(path, code, message)] };
}
function inconsistentSnapshot(detail) {
  return { code: "INCONSISTENT_SNAPSHOT", detail };
}
function missingParameter(path) {
  return { code: "MISSING_PARAMETER", path };
}
function fromTaxError(error) {
  return inconsistentSnapshot(`tax.${error.code}:${error.field}: ${error.detail}`);
}

// src/modules/calculation/v1/cost/failure.ts
var GEOMETRIC_RETRY = {
  id: FailureModelId.GEOMETRIC_RETRY,
  // p / (1 − p) no está definida en p = 1 (y diverge cerca de 1): el dominio es [0, 1).
  acceptsRate: (rate) => Number.isFinite(rate) && rate >= 0 && rate < 1,
  extraCostFactor: (rate, costFraction) => {
    if (!GEOMETRIC_RETRY.acceptsRate(rate)) {
      throw new InvariantViolation("failure.geometric-retry.rate", `tasa fuera de [0, 1): ${String(rate)}`);
    }
    return rate / (1 - rate) * costFraction;
  }
};
var FAILURE_MODELS = {
  [FailureModelId.GEOMETRIC_RETRY]: GEOMETRIC_RETRY
};
function resolveFailureRate(context, plateId) {
  const { params, overrides, input } = context;
  for (const override of overrides) {
    if (override.kind === OverrideKind.FAILURE_RATE && override.value.mode === FailureOverrideMode.RATE) {
      return { rate: override.value.rate, source: FailureRateSource.QUOTE_OVERRIDE, sourceId: "quote" };
    }
  }
  const plate = plateId === void 0 ? void 0 : input.plates.find((candidate) => candidate.id === plateId);
  if (plate !== void 0) {
    let best;
    for (const filament of plate.filaments) {
      const rate = params.materials[filament.materialId]?.failureRateOverride;
      if (rate !== void 0 && (best === void 0 || rate > best.rate)) {
        best = { rate, source: FailureRateSource.MATERIAL_OVERRIDE, sourceId: filament.materialId };
      }
    }
    if (best !== void 0) return best;
    const machineRate = params.machines[plate.machineId]?.failureRateOverride;
    if (machineRate !== void 0) {
      return { rate: machineRate, source: FailureRateSource.MACHINE_OVERRIDE, sourceId: plate.machineId };
    }
  }
  return { rate: params.costProfile.failure.rate, source: FailureRateSource.PROFILE, sourceId: params.costProfile.ref.id };
}
function failureRateFor(context, plateId) {
  return resolveFailureRate(context, plateId).rate;
}
function failuresDisabled(context) {
  return context.mode === CalculationMode.TEST || context.overrides.some(
    (override) => override.kind === OverrideKind.FAILURE_RATE && override.value.mode === FailureOverrideMode.DISABLED
  );
}
function applyFailures(drafts, context) {
  if (failuresDisabled(context)) return ok(drafts);
  const { modelId, costFraction, affectedComponents } = context.params.costProfile.failure;
  const model = FAILURE_MODELS[modelId];
  if (model === void 0) return err(inconsistentSnapshot(`modelo de fallas desconocido: ${String(modelId)}`));
  const failures = [];
  for (const parent of drafts) {
    if (!affectedComponents.includes(parent.component)) continue;
    const rate = failureRateFor(context, parent.plateId);
    if (!model.acceptsRate(rate)) {
      return err(inconsistentSnapshot(`el modelo ${model.id} no admite la tasa de falla ${String(rate)} (dominio [0, 1))`));
    }
    const factor = model.extraCostFactor(rate, costFraction);
    if (factor === 0) continue;
    failures.push({
      code: `failure:${parent.code}`,
      label: `Fallas: ${parent.label}`,
      component: "FAILURE",
      behavior: parent.behavior,
      basis: { quantity: parent.rawAmount, unit: "CLP", unitCost: factor, multiplier: 1 },
      rawAmount: parent.rawAmount * factor,
      vatRecoverableRaw: parent.vatRecoverableRaw * factor,
      recoveryConfig: parent.recoveryConfig,
      derivedFrom: parent.code,
      ...parent.plateId === void 0 ? {} : { plateId: parent.plateId }
    });
  }
  return ok([...drafts, ...failures]);
}
function describeFailureRates(context) {
  const { modelId, costFraction } = context.params.costProfile.failure;
  const isTest = context.mode === CalculationMode.TEST;
  const disabled = context.overrides.some(
    (override) => override.kind === OverrideKind.FAILURE_RATE && override.value.mode === FailureOverrideMode.DISABLED
  );
  const entry = (plateId) => {
    const resolved = resolveFailureRate(context, plateId);
    const base = {
      scope: plateId === void 0 ? "GLOBAL" : "PLATE",
      modelId,
      costFraction,
      ...plateId === void 0 ? {} : { plateId }
    };
    if (disabled) {
      return { ...base, rate: 0, source: FailureRateSource.QUOTE_OVERRIDE, sourceId: "quote", applied: false, inactiveReason: "OVERRIDE_DISABLED" };
    }
    return {
      ...base,
      rate: resolved.rate,
      source: resolved.source,
      sourceId: resolved.sourceId,
      applied: !isTest,
      ...isTest ? { inactiveReason: "TEST_MODE" } : {}
    };
  };
  return [...context.input.plates.map((plate) => entry(plate.id)), entry(void 0)];
}

// src/modules/calculation/v1/cost/finalize.ts
function finalizeItem(draft, quantities) {
  const amount = roundToClp(draft.rawAmount);
  const pooledAmount = expectedPooledAmount(
    { amount, rawAmount: draft.rawAmount, recoveryConfig: draft.recoveryConfig },
    quantities.units
  );
  return {
    code: draft.code,
    label: draft.label,
    component: draft.component,
    behavior: draft.behavior,
    basis: draft.basis,
    rawAmount: draft.rawAmount,
    amount,
    recoveryConfig: draft.recoveryConfig,
    pooledAmount,
    vatRecoverable: roundToClp(draft.vatRecoverableRaw),
    ...draft.plateId === void 0 ? {} : { plateId: draft.plateId },
    ...draft.derivedFrom === void 0 ? {} : { derivedFrom: draft.derivedFrom }
  };
}
function totalsOf(items) {
  const sumWhere = (predicate) => sumClp(items.filter(predicate).map((item) => item.amount));
  const byComponent = {};
  for (const item of items) {
    byComponent[item.component] = sumClp([byComponent[item.component] ?? roundToClp(0), item.amount]);
  }
  return {
    byBehavior: {
      [CostBehavior.PER_UNIT]: sumWhere((i) => i.behavior === CostBehavior.PER_UNIT),
      [CostBehavior.PER_PLATE]: sumWhere((i) => i.behavior === CostBehavior.PER_PLATE),
      [CostBehavior.PER_BATCH]: sumWhere((i) => i.behavior === CostBehavior.PER_BATCH),
      [CostBehavior.ONE_OFF]: sumWhere((i) => i.behavior === CostBehavior.ONE_OFF),
      [CostBehavior.PER_EXTRA_PART]: sumWhere((i) => i.behavior === CostBehavior.PER_EXTRA_PART)
    },
    byComponent,
    byRecovery: {
      [Recovery.IN_PRICE]: sumWhere((i) => i.recoveryConfig.recovery === Recovery.IN_PRICE),
      [Recovery.SEPARATE_LINE]: sumWhere((i) => i.recoveryConfig.recovery === Recovery.SEPARATE_LINE),
      [Recovery.ABSORBED]: sumWhere((i) => i.recoveryConfig.recovery === Recovery.ABSORBED)
    }
  };
}
function buildBreakdown(items, quantities, failureRates) {
  const pricingPool = sumClp(items.map((item) => item.pooledAmount));
  const absorbedCost = sumClp(
    items.filter((item) => item.recoveryConfig.recovery === Recovery.ABSORBED).map((item) => item.amount)
  );
  const deferredCost = sumClp(
    items.filter((item) => item.recoveryConfig.amortization !== void 0).map((item) => roundToClp(item.amount - item.pooledAmount))
  );
  return {
    items,
    platesRequired: quantities.plates.map((plate) => ({ plateId: plate.plateId, platesRequired: plate.platesRequired })),
    totals: totalsOf(items),
    pricingPool,
    absorbedCost,
    deferredCost,
    recoverableVat: sumClp(items.map((item) => item.vatRecoverable)),
    failureRates,
    unitCost: pricingPool / quantities.units
  };
}

// src/modules/calculation/v1/cost/draft.ts
function makeDraft(spec) {
  return {
    code: spec.code,
    label: spec.label,
    component: spec.component,
    behavior: spec.behavior,
    basis: { quantity: spec.quantity, unit: spec.unit, unitCost: spec.unitCost, multiplier: spec.multiplier },
    rawAmount: spec.quantity * spec.unitCost * spec.multiplier,
    vatRecoverableRaw: spec.quantity * spec.vatPerUnit * spec.multiplier,
    recoveryConfig: spec.recoveryConfig,
    ...spec.plateId === void 0 ? {} : { plateId: spec.plateId }
  };
}

// src/modules/calculation/v1/cost/constants.ts
var MINUTES_PER_HOUR2 = 60;
var WATTS_PER_KILOWATT = 1e3;
var MAX_PLATES_REQUIRED = 1e6;

// src/modules/calculation/v1/cost/quantities.ts
function ceilDiv(a, b) {
  let q = Math.trunc(a / b);
  while (q * b > a) q -= 1;
  while ((q + 1) * b <= a) q += 1;
  return q * b < a ? q + 1 : q;
}
function resolveQuantities(input) {
  const units = input.quantity;
  const plates = [];
  let totalPlates = 0;
  let partsPerUnitTotal = 0;
  for (const [index, plate] of input.plates.entries()) {
    const path = `input.plates[${String(index)}]`;
    const requiredParts = units * plate.partsPerUnit;
    if (!Number.isSafeInteger(requiredParts)) {
      return err(invalidInput(`${path}.partsPerUnit`, "RANGE", "N \xD7 partsPerUnit excede el rango entero seguro"));
    }
    const required2 = ceilDiv(requiredParts, plate.partsPerPlate);
    if (required2 > MAX_PLATES_REQUIRED) {
      return err(invalidInput(path, "RANGE", `Placas requeridas fuera de rango (m\xE1ximo ${String(MAX_PLATES_REQUIRED)})`));
    }
    const platesRequired = parseQuantity(required2, path);
    if (!platesRequired.ok) return err({ code: "INVALID_INPUT", issues: [platesRequired.error] });
    const producedParts = platesRequired.value * plate.partsPerPlate;
    plates.push({
      plateId: plate.id,
      requiredParts,
      partsPerPlate: plate.partsPerPlate,
      platesRequired: platesRequired.value,
      producedParts,
      surplusParts: producedParts - requiredParts
    });
    totalPlates += platesRequired.value;
    partsPerUnitTotal += plate.partsPerUnit;
  }
  const extraPartsPerUnit = Math.max(0, partsPerUnitTotal - 1);
  const extraParts = units * extraPartsPerUnit;
  if (!Number.isSafeInteger(extraParts) || !Number.isSafeInteger(totalPlates)) {
    return err(invalidInput("input", "RANGE", "Las cantidades derivadas exceden el rango entero seguro"));
  }
  return ok({
    units,
    batches: input.batches,
    plates,
    totalPlates,
    partsPerUnitTotal,
    extraPartsPerUnit,
    extraParts
  });
}
function quantityFor(behavior, quantities, plateId) {
  switch (behavior) {
    case CostBehavior.PER_UNIT:
      return quantities.units;
    case CostBehavior.PER_PLATE: {
      if (plateId === void 0) return quantities.totalPlates;
      const plate = quantities.plates.find((candidate) => candidate.plateId === plateId);
      if (plate === void 0) throw new InvariantViolation("cost.quantities", `placa desconocida: ${plateId}`);
      return plate.platesRequired;
    }
    case CostBehavior.PER_BATCH:
      return quantities.batches;
    case CostBehavior.ONE_OFF:
      return 1;
    case CostBehavior.PER_EXTRA_PART:
      return quantities.extraParts;
    default: {
      const unreachable = behavior;
      throw new InvariantViolation("cost.quantities", `comportamiento no manejado: ${String(unreachable)}`);
    }
  }
}

// src/modules/calculation/v1/tax/errors.ts
function taxError(code, field, detail) {
  return { code, field, detail };
}

// src/modules/calculation/v1/tax/rates.ts
function isRate(value) {
  return Number.isFinite(value) && value >= 0 && value < 1;
}
function purchaseVatRateOf(tax) {
  if (!isRate(tax.purchaseVatRate)) {
    return err(taxError("INVALID_RATE", "purchaseVatRate", "Debe ser finita y estar en [0, 1)"));
  }
  return ok(tax.purchaseVatRate);
}
function salesVatRateOf(tax) {
  if (!isRate(tax.vatRate)) {
    return err(taxError("INVALID_RATE", "vatRate", "Debe ser finita y estar en [0, 1)"));
  }
  if (tax.regime === TaxRegime.NOT_REGISTERED) {
    if (tax.vatRate !== 0) {
      return err(taxError("INVALID_COMBINATION", "vatRate", "Con r\xE9gimen NOT_REGISTERED la tasa de venta debe ser 0"));
    }
    return ok(0);
  }
  return ok(tax.vatRate);
}
function canRecoverVat(tax) {
  return tax.regime === TaxRegime.VAT_REGISTERED;
}
function isVatEffectivelyRecoverable(tax, flag) {
  return canRecoverVat(tax) && flag;
}

// src/modules/calculation/v1/tax/cost-normalization.ts
function invalidAmount(detail) {
  return taxError("INVALID_AMOUNT", "amount", detail);
}
function decomposePurchase(amount, tax) {
  const value = amount.amount;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return err(invalidAmount("Debe ser un n\xFAmero finito no negativo"));
  }
  if (amount.basis !== TaxBasis.NET && amount.basis !== TaxBasis.GROSS) {
    return err(taxError("INVALID_COMBINATION", "basis", "La base debe ser NET o GROSS"));
  }
  const rate = purchaseVatRateOf(tax);
  if (!rate.ok) return rate;
  const netBase = amount.basis === TaxBasis.NET ? value : value / (1 + rate.value);
  const vatPaid = amount.basis === TaxBasis.NET ? value * rate.value : value - netBase;
  const recoverable = isVatEffectivelyRecoverable(tax, amount.vatRecoverable);
  const vatRecoverable = recoverable ? vatPaid : 0;
  const vatAsCost = vatPaid - vatRecoverable;
  return ok({
    netBase,
    vatPaid,
    vatRecoverable,
    vatAsCost,
    economicCost: netBase + vatAsCost,
    cashPaid: amount.basis === TaxBasis.GROSS ? value : netBase + vatPaid,
    recoverabilityOverriddenByRegime: amount.vatRecoverable && !recoverable
  });
}

// src/modules/calculation/v1/tax/commission.ts
function commissionVatFactor(treatment, tax) {
  const rate = purchaseVatRateOf(tax);
  if (!rate.ok) return rate;
  if (!treatment.vatCharged) return ok(1);
  return ok(isVatEffectivelyRecoverable(tax, treatment.vatRecoverable) ? 1 : 1 + rate.value);
}
function effectiveCommissionRate(channel, tax) {
  if (!isRate(channel.commission)) {
    return err(taxError("INVALID_RATE", "commission", "Debe ser finita y estar en [0, 1)"));
  }
  const sales = salesVatRateOf(tax);
  if (!sales.ok) return sales;
  const factor = commissionVatFactor(channel.commissionTax, tax);
  if (!factor.ok) return factor;
  const baseFactor = channel.commissionBase === CommissionBase.GROSS ? 1 + sales.value : 1;
  return ok(channel.commission * baseFactor * factor.value);
}
function decomposeCommission(feeNet, treatment, tax) {
  if (!Number.isFinite(feeNet) || feeNet < 0) {
    return err(taxError("INVALID_AMOUNT", "feeNet", "Debe ser un n\xFAmero finito no negativo"));
  }
  const rate = purchaseVatRateOf(tax);
  if (!rate.ok) return rate;
  const vatCharged = treatment.vatCharged ? feeNet * rate.value : 0;
  const recoverable = treatment.vatCharged && isVatEffectivelyRecoverable(tax, treatment.vatRecoverable);
  const vatRecoverable = recoverable ? vatCharged : 0;
  const vatAsCost = vatCharged - vatRecoverable;
  return ok({
    feeNet,
    vatCharged,
    vatRecoverable,
    vatAsCost,
    economicFee: feeNet + vatAsCost,
    recoverabilityOverriddenByRegime: treatment.vatCharged && treatment.vatRecoverable && !recoverable
  });
}
function economicFixedFee(channel, tax) {
  return decomposePurchase(channel.fixedFee, tax);
}

// src/modules/calculation/v1/tax/constants.ts
var HALF2 = 0.5;
var SPLIT_TOLERANCE = 1e-9;

// src/modules/calculation/v1/tax/sale-split.ts
function checkSplitInvariant(split, rate) {
  const { net, vat, gross } = split;
  if (!isClp(net) || !isClp(vat) || !isClp(gross)) return "net, vat y gross deben ser enteros seguros";
  if (net < 0 || vat < 0 || gross < 0) return "net, vat y gross no pueden ser negativos";
  if (net + vat !== gross) return "net + vat debe ser igual a gross";
  if (vat > gross) return "vat no puede superar gross";
  if (Math.abs(vat - net * rate) > (1 + rate) * HALF2 + SPLIT_TOLERANCE) {
    return "vat se aparta del IVA exacto m\xE1s de lo que permite el redondeo";
  }
  return void 0;
}
function finalize(split, rate) {
  const violation = checkSplitInvariant(split, rate);
  if (violation !== void 0) throw new InvariantViolation("tax.split", violation);
  return ok(split);
}
function checkInputs(value, rate, field) {
  if (!isClp(value) || value < 0) {
    return taxError("INVALID_AMOUNT", field, "Debe ser un entero CLP no negativo");
  }
  if (!isRate(rate)) return taxError("INVALID_RATE", "rate", "Debe ser finita y estar en [0, 1)");
  return void 0;
}
function splitFromNet(net, rate) {
  const problem = checkInputs(net, rate, "net");
  if (problem !== void 0) return err(problem);
  const vat = roundToClp(net * rate);
  return finalize({ net, vat, gross: roundToClp(net + vat) }, rate);
}
function splitFromGross(gross, rate) {
  const problem = checkInputs(gross, rate, "gross");
  if (problem !== void 0) return err(problem);
  const net = roundToClp(gross / (1 + rate));
  return finalize({ net, vat: roundToClp(gross - net), gross }, rate);
}

// src/modules/calculation/v1/tax/ledger.ts
function buildTaxLedger(input, saleRate) {
  const violation = checkSplitInvariant(input.sale, saleRate);
  if (violation !== void 0) {
    return err(taxError("INVALID_COMBINATION", "sale", violation));
  }
  for (const [field, value] of [
    ["economicCost", input.economicCost],
    ["commission", input.commission],
    ["purchaseVatRecoverable", input.purchaseVatRecoverable],
    ["commissionVatRecoverable", input.commissionVatRecoverable]
  ]) {
    if (!isClp(value) || value < 0) {
      return err(taxError("INVALID_AMOUNT", field, "Debe ser un entero CLP no negativo"));
    }
  }
  const recoverableVat = roundToClp(input.purchaseVatRecoverable + input.commissionVatRecoverable);
  return ok({
    netRevenue: input.sale.net,
    saleVat: input.sale.vat,
    grossRevenue: input.sale.gross,
    economicCost: input.economicCost,
    commission: input.commission,
    purchaseVatRecoverable: input.purchaseVatRecoverable,
    commissionVatRecoverable: input.commissionVatRecoverable,
    recoverableVat,
    vatPayable: roundToClp(input.sale.vat - recoverableVat),
    utility: roundToClp(input.sale.net - input.commission - input.economicCost)
  });
}
function checkLedgerInvariants(ledger) {
  const problems = [];
  if (ledger.netRevenue + ledger.saleVat !== ledger.grossRevenue) {
    problems.push("netRevenue + saleVat debe ser grossRevenue");
  }
  if (ledger.utility !== ledger.netRevenue - ledger.commission - ledger.economicCost) {
    problems.push("utility debe ser netRevenue \u2212 commission \u2212 economicCost (sin IVA)");
  }
  if (ledger.recoverableVat !== ledger.purchaseVatRecoverable + ledger.commissionVatRecoverable) {
    problems.push("recoverableVat debe ser purchaseVatRecoverable + commissionVatRecoverable");
  }
  if (ledger.vatPayable !== ledger.saleVat - ledger.recoverableVat) {
    problems.push("vatPayable debe ser saleVat \u2212 recoverableVat");
  }
  return problems;
}

// src/modules/calculation/v1/cost/purchases.ts
function purchase(amount, tax) {
  const decomposition = decomposePurchase(amount, tax);
  return decomposition.ok ? decomposition : err(fromTaxError(decomposition.error));
}
function laborRate(profile, kind, override) {
  return override ?? profile.labor.rateByKind?.[kind] ?? profile.labor.ratePerHour;
}
function required(value, path) {
  return value === void 0 ? err(missingParameter(path)) : ok(value);
}

// src/modules/calculation/v1/cost/generators/additional.ts
function fromSpecs(context, specs, prefix) {
  const drafts = [];
  for (const spec of specs) {
    const amount = purchase(spec.amount, context.params.taxProfile);
    if (!amount.ok) return err(amount.error);
    drafts.push(
      makeDraft({
        code: `${prefix}:${spec.code}`,
        label: spec.label,
        component: spec.component,
        behavior: spec.behavior,
        quantity: 1,
        unit: "u",
        unitCost: amount.value.economicCost,
        multiplier: quantityFor(spec.behavior, context.quantities),
        vatPerUnit: amount.value.vatRecoverable,
        recoveryConfig: spec.recoveryConfig
      })
    );
  }
  return ok(drafts);
}
var auxiliaryGenerator = (context) => fromSpecs(context, context.params.costProfile.auxiliaryCosts, "aux");
var extraCostsGenerator = (context) => fromSpecs(context, context.input.extraCosts, "extra");

// src/modules/calculation/v1/cost/generators/electricity.ts
var electricityGenerator = (context) => {
  const { input, params, quantities } = context;
  const drafts = [];
  for (const plate of input.plates) {
    const machine = required(params.machines[plate.machineId], `params.machines.${plate.machineId}`);
    if (!machine.ok) return err(machine.error);
    let perHour;
    let vatPerHour;
    if (machine.value.electricityPerHourOverride !== void 0) {
      const hourly = purchase(machine.value.electricityPerHourOverride, params.taxProfile);
      if (!hourly.ok) return err(hourly.error);
      perHour = hourly.value.economicCost;
      vatPerHour = hourly.value.vatRecoverable;
    } else if (machine.value.avgPowerW !== void 0) {
      const kwh = purchase(params.costProfile.energy.kwhPrice, params.taxProfile);
      if (!kwh.ok) return err(kwh.error);
      const kilowatts = machine.value.avgPowerW / WATTS_PER_KILOWATT;
      perHour = kilowatts * kwh.value.economicCost;
      vatPerHour = kilowatts * kwh.value.vatRecoverable;
    } else {
      return err(missingParameter(`params.machines.${plate.machineId}.avgPowerW`));
    }
    drafts.push(
      makeDraft({
        code: `electricity:${plate.id}`,
        label: `Electricidad (${plate.label})`,
        component: CostComponent.ELECTRICITY,
        behavior: CostBehavior.PER_PLATE,
        quantity: plate.printHours,
        unit: "h",
        unitCost: perHour,
        multiplier: quantityFor(CostBehavior.PER_PLATE, quantities, plate.id),
        vatPerUnit: vatPerHour,
        recoveryConfig: { recovery: "IN_PRICE" },
        plateId: plate.id
      })
    );
  }
  return ok(drafts);
};

// src/modules/calculation/v1/cost/generators/material.ts
var materialGenerator = (context) => {
  const { input, params, quantities } = context;
  const drafts = [];
  for (const plate of input.plates) {
    for (const filament of plate.filaments) {
      const material = required(params.materials[filament.materialId], `params.materials.${filament.materialId}`);
      if (!material.ok) return err(material.error);
      const spool = purchase(material.value.spool.price, params.taxProfile);
      if (!spool.ok) return err(spool.error);
      const waste = plate.weightIncludesWaste ? 0 : material.value.wasteFractionOverride ?? params.costProfile.materialWaste.fraction;
      const netGrams = material.value.spool.netGrams;
      drafts.push(
        makeDraft({
          code: `material:${plate.id}:${material.value.ref.id}`,
          label: `Material ${material.value.name} (${plate.label})`,
          component: CostComponent.MATERIAL,
          behavior: CostBehavior.PER_PLATE,
          quantity: filament.grams * (1 + waste),
          unit: "g",
          unitCost: spool.value.economicCost / netGrams,
          multiplier: quantityFor(CostBehavior.PER_PLATE, quantities, plate.id),
          vatPerUnit: spool.value.vatRecoverable / netGrams,
          recoveryConfig: { recovery: "IN_PRICE" },
          plateId: plate.id
        })
      );
    }
  }
  return ok(drafts);
};

// src/modules/calculation/v1/cost/generators/services.ts
var servicesGenerator = (context) => {
  const { input, params, quantities } = context;
  const drafts = [];
  for (const selection of input.services) {
    if (!selection.active) continue;
    const service = required(params.services[selection.serviceId], `params.services.${selection.serviceId}`);
    if (!service.ok) return err(service.error);
    const supply = purchase(service.value.supplyCost, params.taxProfile);
    if (!supply.ok) return err(supply.error);
    const minutes = selection.laborMinutes ?? service.value.laborMinutes;
    const labor = minutes / MINUTES_PER_HOUR2 * laborRate(params.costProfile, service.value.laborKind, service.value.laborRateOverride);
    drafts.push(
      makeDraft({
        code: `service:${service.value.ref.id}`,
        label: service.value.name,
        component: service.value.component,
        behavior: service.value.behavior,
        quantity: 1,
        unit: "u",
        unitCost: supply.value.economicCost + labor,
        multiplier: quantityFor(service.value.behavior, quantities),
        vatPerUnit: supply.value.vatRecoverable,
        recoveryConfig: service.value.defaultRecovery
      })
    );
  }
  return ok(drafts);
};

// src/modules/calculation/v1/cost/generators/setup.ts
var setupGenerator = (context) => {
  const { params, quantities } = context;
  const { jobSetupMinutes, plateChangeoverMinutes } = params.costProfile.preparation;
  const rate = laborRate(params.costProfile, LaborKind.PREPARATION);
  return ok([
    makeDraft({
      code: "setup:job",
      label: "Preparaci\xF3n del trabajo",
      component: CostComponent.SETUP,
      behavior: CostBehavior.PER_BATCH,
      quantity: jobSetupMinutes / MINUTES_PER_HOUR2,
      unit: "h MO",
      unitCost: rate,
      multiplier: quantityFor(CostBehavior.PER_BATCH, quantities),
      vatPerUnit: 0,
      recoveryConfig: { recovery: "IN_PRICE" }
    }),
    makeDraft({
      code: "setup:changeover",
      label: "Cambio de placa",
      component: CostComponent.SETUP,
      behavior: CostBehavior.PER_PLATE,
      quantity: plateChangeoverMinutes / MINUTES_PER_HOUR2,
      unit: "h MO",
      unitCost: rate,
      multiplier: quantityFor(CostBehavior.PER_PLATE, quantities),
      vatPerUnit: 0,
      recoveryConfig: { recovery: "IN_PRICE" }
    })
  ]);
};

// src/modules/calculation/v1/cost/generators/supervision.ts
var supervisionGenerator = (context) => {
  const { input, params, quantities } = context;
  const drafts = [];
  for (const plate of input.plates) {
    const machine = required(params.machines[plate.machineId], `params.machines.${plate.machineId}`);
    if (!machine.ok) return err(machine.error);
    const ratio = machine.value.supervisionRatioOverride ?? params.costProfile.supervision.hoursPerPrintHour;
    drafts.push(
      makeDraft({
        code: `supervision:${plate.id}`,
        label: `Supervisi\xF3n (${plate.label})`,
        component: CostComponent.SUPERVISION,
        behavior: CostBehavior.PER_PLATE,
        quantity: plate.printHours * ratio,
        unit: "h MO",
        unitCost: laborRate(params.costProfile, LaborKind.SUPERVISION),
        multiplier: quantityFor(CostBehavior.PER_PLATE, quantities, plate.id),
        vatPerUnit: 0,
        recoveryConfig: { recovery: "IN_PRICE" },
        plateId: plate.id
      })
    );
  }
  return ok(drafts);
};

// src/modules/calculation/v1/cost/generators/wear.ts
function wearPerHour(machine, tax) {
  if (machine.wearPerHourOverride !== void 0) return ok(machine.wearPerHourOverride);
  const path = `params.machines.${machine.ref.id}`;
  if (machine.purchasePrice === void 0) return err(missingParameter(`${path}.purchasePrice`));
  if (machine.lifetimeHours === void 0) return err(missingParameter(`${path}.lifetimeHours`));
  const bought = purchase(machine.purchasePrice, tax);
  if (!bought.ok) return err(bought.error);
  let residualCost = 0;
  if (machine.residualValue !== void 0) {
    const residual = purchase(machine.residualValue, tax);
    if (!residual.ok) return err(residual.error);
    residualCost = residual.value.economicCost;
  }
  if (residualCost > bought.value.economicCost) {
    return err(inconsistentSnapshot(`${path}.residualValue supera al precio de compra`));
  }
  const lifetime = machine.lifetimeHours;
  const reserve = machine.maintenanceReservePerHour ?? 0;
  return ok((bought.value.economicCost - residualCost) / lifetime + reserve);
}
var wearGenerator = (context) => {
  const { input, params, quantities } = context;
  const drafts = [];
  for (const plate of input.plates) {
    const machine = required(params.machines[plate.machineId], `params.machines.${plate.machineId}`);
    if (!machine.ok) return err(machine.error);
    const perHour = wearPerHour(machine.value, params.taxProfile);
    if (!perHour.ok) return err(perHour.error);
    drafts.push(
      makeDraft({
        code: `wear:${plate.id}`,
        label: `Desgaste (${plate.label})`,
        component: CostComponent.WEAR,
        behavior: CostBehavior.PER_PLATE,
        quantity: plate.printHours,
        unit: "h",
        unitCost: perHour.value,
        multiplier: quantityFor(CostBehavior.PER_PLATE, quantities, plate.id),
        vatPerUnit: 0,
        recoveryConfig: { recovery: "IN_PRICE" },
        plateId: plate.id
      })
    );
  }
  return ok(drafts);
};

// src/modules/calculation/v1/cost/generators/index.ts
var COST_GENERATORS = [
  materialGenerator,
  electricityGenerator,
  wearGenerator,
  supervisionGenerator,
  setupGenerator,
  servicesGenerator,
  auxiliaryGenerator,
  extraCostsGenerator
];

// src/modules/calculation/v1/cost/recovery-overrides.ts
function applyItemRecoveryOverrides(drafts, overrides, matched) {
  const byCode = /* @__PURE__ */ new Map();
  overrides.forEach((override, index) => {
    if (override.kind === OverrideKind.ITEM_RECOVERY) byCode.set(override.itemCode, { override, index });
  });
  if (byCode.size === 0) return ok(drafts);
  const result = [];
  for (const draft of drafts) {
    const found = byCode.get(draft.code);
    if (found === void 0) {
      result.push(draft);
      continue;
    }
    matched.add(draft.code);
    if (found.override.value.amortization !== void 0 && draft.behavior !== CostBehavior.ONE_OFF) {
      return err({
        code: "INVALID_INPUT",
        issues: [
          issue(
            `overrides[${String(found.index)}].value.amortization`,
            "INCONSISTENT",
            `La amortizaci\xF3n solo aplica a \xEDtems ONE_OFF; ${draft.code} es ${draft.behavior}`
          )
        ]
      });
    }
    result.push({ ...draft, recoveryConfig: found.override.value });
  }
  return ok(result);
}
function unmatchedRecoveryOverrides(overrides, matched) {
  const unmatched = [];
  overrides.forEach((override, index) => {
    if (override.kind === OverrideKind.ITEM_RECOVERY && !matched.has(override.itemCode)) {
      unmatched.push({ itemCode: override.itemCode, index });
    }
  });
  return unmatched;
}

// src/modules/calculation/v1/cost/engine.ts
function flagsFor(context, unmatched) {
  const flags = [];
  const { input, params, quantities } = context;
  input.services.forEach((selection, index) => {
    if (!selection.active) return;
    const service = params.services[selection.serviceId];
    if (service?.kind === ServiceKind.ASSEMBLY && quantities.extraParts === 0) {
      flags.push({
        code: FlagCode.ASSEMBLY_WITHOUT_EXTRA_PARTS,
        // Informativa: el ítem queda en 0 y la cotización sigue siendo válida.
        severity: FlagSeverity.INFO,
        path: `input.services[${String(index)}]`
      });
    }
  });
  for (const item of unmatched) {
    flags.push({
      code: FlagCode.UNKNOWN_OVERRIDE_TARGET,
      severity: FlagSeverity.WARNING,
      path: `overrides[${String(item.index)}]`
    });
  }
  return flags;
}
function run(request, generators, resolve) {
  const quantities = resolve(request.input);
  if (!quantities.ok) return quantities;
  const context = {
    mode: request.mode,
    input: request.input,
    params: request.params,
    overrides: request.overrides,
    quantities: quantities.value
  };
  let drafts = [];
  for (const generate of generators) {
    const generated = generate(context);
    if (!generated.ok) return generated;
    drafts = [...drafts, ...generated.value];
  }
  for (const draft of drafts) {
    if (!Number.isFinite(draft.rawAmount) || draft.rawAmount < 0 || !Number.isFinite(draft.vatRecoverableRaw)) {
      return err(inconsistentSnapshot(`el \xEDtem ${draft.code} no tiene un monto finito y no negativo`));
    }
  }
  const failureRates = describeFailureRates(context);
  const model = FAILURE_MODELS[request.params.costProfile.failure.modelId];
  if (model === void 0) {
    return err(inconsistentSnapshot(`modelo de fallas desconocido: ${String(request.params.costProfile.failure.modelId)}`));
  }
  for (const entry of failureRates) {
    if (!model.acceptsRate(entry.rate)) {
      return err(inconsistentSnapshot(`el modelo ${model.id} no admite la tasa de falla ${String(entry.rate)} (dominio [0, 1))`));
    }
  }
  const matched = /* @__PURE__ */ new Set();
  const recovered = applyItemRecoveryOverrides(drafts, context.overrides, matched);
  if (!recovered.ok) return recovered;
  const withFailures = applyFailures(recovered.value, context);
  if (!withFailures.ok) return withFailures;
  const baseCount = recovered.value.length;
  const failureDrafts = applyItemRecoveryOverrides(withFailures.value.slice(baseCount), context.overrides, matched);
  if (!failureDrafts.ok) return failureDrafts;
  const finalDrafts = [...withFailures.value.slice(0, baseCount), ...failureDrafts.value];
  const items = finalDrafts.map((draft) => finalizeItem(draft, quantities.value));
  const breakdown = buildBreakdown(items, quantities.value, failureRates);
  const violations = checkCostBreakdownInvariants(breakdown, quantities.value.units);
  if (violations.length > 0) {
    throw new InvariantViolation("cost.breakdown", violations.map((v) => `${v.path}:${v.code}`).join(", "));
  }
  return ok({
    breakdown,
    quantities: quantities.value,
    flags: flagsFor(context, unmatchedRecoveryOverrides(context.overrides, matched))
  });
}
function calculateCost(request, options = {}) {
  try {
    return run(request, options.generators ?? COST_GENERATORS, options.resolveQuantities ?? resolveQuantities);
  } catch (error) {
    if (error instanceof InvariantViolation) return err({ code: "INTERNAL_INVARIANT", invariant: error.invariant });
    throw error;
  }
}

// src/modules/calculation/v2/cost.ts
var LAST_RUN_SUFFIX = ".last";
function runsOf(input) {
  return input.plates.map((plate, index) => {
    const requiredParts = input.quantity * plate.partsPerUnit;
    const fullPlates = Math.floor(requiredParts / plate.partsPerPlate);
    return { plate, index, requiredParts, fullPlates, remainder: requiredParts - fullPlates * plate.partsPerPlate };
  });
}
function splitLastRuns(input, base, runs) {
  const plates = [];
  const quantities = [];
  for (const run3 of runs) {
    const { plate } = run3;
    const original = base.plates[run3.index];
    if (original === void 0) continue;
    if (plate.lastRun === void 0) {
      plates.push(plate);
      quantities.push(original);
      continue;
    }
    if (run3.fullPlates > 0) {
      plates.push(plate);
      quantities.push({
        plateId: plate.id,
        requiredParts: run3.fullPlates * plate.partsPerPlate,
        partsPerPlate: plate.partsPerPlate,
        platesRequired: run3.fullPlates,
        producedParts: run3.fullPlates * plate.partsPerPlate,
        surplusParts: 0
      });
    }
    const lastId = `${plate.id}${LAST_RUN_SUFFIX}`;
    const { lastRun, ...rest } = plate;
    plates.push({ ...rest, id: lastId, label: `${plate.label} \xB7 \xFAltima placa`, filaments: lastRun.filaments, printHours: lastRun.printHours, partsPerPlate: lastRun.parts });
    quantities.push({ plateId: lastId, requiredParts: lastRun.parts, partsPerPlate: lastRun.parts, platesRequired: 1, producedParts: lastRun.parts, surplusParts: 0 });
  }
  const totalPlates = quantities.reduce((sum, plate) => sum + plate.platesRequired, 0);
  return { input: { ...input, plates }, quantities: { ...base, plates: quantities, totalPlates } };
}
function calculateCostV2(request) {
  const base = resolveQuantities(request.input);
  if (!base.ok) return base;
  const runs = runsOf(request.input);
  const sliced = runs.some((run3) => run3.plate.lastRun !== void 0);
  let cost;
  if (!sliced) {
    cost = calculateCost(request);
  } else {
    const split = splitLastRuns(request.input, base.value, runs);
    cost = calculateCost({ ...request, input: split.input }, { resolveQuantities: () => ok(split.quantities) });
  }
  if (!cost.ok) return cost;
  const platesRequired = runs.map((run3) => {
    const physical = base.value.plates[run3.index]?.platesRequired ?? run3.fullPlates + (run3.remainder > 0 ? 1 : 0);
    return {
      plateId: run3.plate.id,
      platesRequired: physical,
      fullPlates: run3.fullPlates,
      remainderParts: run3.remainder,
      ...run3.remainder === 0 ? {} : {
        lastRun: run3.plate.lastRun === void 0 ? { source: "ESTIMATED_FULL_PLATE", parts: run3.remainder } : { source: "SLICED", parts: run3.remainder, lastRunPlateId: `${run3.plate.id}${LAST_RUN_SUFFIX}` }
      }
    };
  });
  const flags = runs.filter((run3) => run3.remainder > 0 && run3.plate.lastRun === void 0).map((run3) => ({ code: FlagCode.LAST_PLATE_ESTIMATED, severity: FlagSeverity.WARNING, path: `input.plates[${String(run3.index)}].lastRun` }));
  if (platesRequired.length === 0) return err({ code: "INTERNAL_INVARIANT", invariant: "v2.plates" });
  return ok({
    breakdown: { ...cost.value.breakdown, platesRequired },
    quantities: base.value,
    flags: [...cost.value.flags, ...flags]
  });
}

// src/modules/calculation/v1/pricing/allocation.ts
function allocateInteger(total, weights) {
  if (!Number.isSafeInteger(total) || total < 0 || weights.some((w) => !Number.isSafeInteger(w) || w < 0)) {
    throw new InvariantViolation("pricing.allocation", "total y pesos deben ser enteros seguros no negativos");
  }
  const sumWeights = weights.reduce((acc, w) => acc + BigInt(w), 0n);
  if (sumWeights === 0n) {
    if (total !== 0) throw new InvariantViolation("pricing.allocation", "no hay pesos para repartir un total distinto de 0");
    return weights.map(() => 0);
  }
  const bigTotal = BigInt(total);
  const parts = weights.map((w) => ({ base: bigTotal * BigInt(w) / sumWeights, rest: bigTotal * BigInt(w) % sumWeights }));
  let leftover = bigTotal - parts.reduce((acc, part) => acc + part.base, 0n);
  const order = parts.map((part, index) => ({ index, rest: part.rest })).sort((a, b) => a.rest === b.rest ? a.index - b.index : a.rest > b.rest ? -1 : 1);
  const result = parts.map((part) => part.base);
  for (const { index } of order) {
    if (leftover === 0n) break;
    result[index] = (result[index] ?? 0n) + 1n;
    leftover -= 1n;
  }
  return result.map((value) => Number(value));
}
function allocateProportional(total, weights) {
  const sum = weights.reduce((acc, w) => acc + w, 0);
  if (weights.length === 0) return [];
  if (sum === 0) return weights.map((_, index) => index === 0 ? total : 0);
  return weights.map((w) => total * w / sum);
}

// src/modules/calculation/v1/pricing/discounts.ts
function resolveVolumeDiscount(quantity, tiers) {
  for (const tier of tiers) {
    if (quantity >= tier.minQty && (tier.maxQty === null || quantity <= tier.maxQty)) return tier.discount;
  }
  return 0;
}

// src/modules/calculation/v1/pricing/constants.ts
var MARGIN_TOLERANCE = 1e-12;
var STEP_TOLERANCE = 1e-9;
var MAX_SEARCH_DOUBLINGS = 60;
var SEARCH_GROWTH_FACTOR = 2;
var BISECTION_DIVISOR = 2;
var MIN_MARGIN_DENOMINATOR = 1e-9;

// src/modules/calculation/v1/pricing/lines.ts
var MAIN_LINE_CODE = "main";
function groupCostLines(items) {
  const mainCodes = [];
  const mainPooled = [];
  const lines = /* @__PURE__ */ new Map();
  for (const item of items) {
    const recovery = item.recoveryConfig.recovery;
    if (recovery === Recovery.ABSORBED) continue;
    if (recovery === Recovery.IN_PRICE) {
      mainCodes.push(item.code);
      mainPooled.push(item.pooledAmount);
      continue;
    }
    const rootCode = item.derivedFrom ?? item.code;
    const root = item.derivedFrom === void 0 ? item : items.find((candidate) => candidate.code === rootCode);
    if (root === void 0 || root.recoveryConfig.recovery !== Recovery.SEPARATE_LINE) {
      return err({
        code: "INVALID_INPUT",
        issues: [
          issue(
            `breakdown.items.${item.code}`,
            "INCONSISTENT",
            "Un \xEDtem de falla SEPARATE_LINE requiere que su origen tambi\xE9n sea SEPARATE_LINE: una falla no genera l\xEDnea propia"
          )
        ]
      });
    }
    const line = lines.get(rootCode) ?? { label: root.label, pooled: [], codes: [] };
    line.pooled.push(item.pooledAmount);
    line.codes.push(item.code);
    lines.set(rootCode, line);
  }
  return ok({
    main: { code: MAIN_LINE_CODE, label: "Principal", cost: sumClp(mainPooled), itemCodes: mainCodes },
    separate: [...lines.entries()].map(([code, line]) => ({
      code,
      label: line.label,
      cost: sumClp(line.pooled),
      itemCodes: line.codes
    }))
  });
}
var ZERO = roundToClp(0);

// src/modules/calculation/v1/pricing/unwrap.ts
function unwrap(result, where) {
  if (result.ok) return result.value;
  throw new InvariantViolation(`pricing.${where}`, JSON.stringify(result.error));
}

// src/modules/calculation/v1/pricing/outcome.ts
function oneUnit() {
  return unwrap(parseQuantity(1, "quantity"), "one-unit");
}
function evaluateOutcome(context, specs) {
  const { params, salesRate, breakdown } = context;
  const mode = params.taxProfile.customerPriceMode;
  const totals = specs.map((spec) => multiplyClp(spec.customerUnitPrice, spec.quantity));
  const customerTotal = sumClp(totals);
  const split = mode === CustomerPriceMode.GROSS ? unwrap(splitFromGross(customerTotal, salesRate), "sale-split") : unwrap(splitFromNet(customerTotal, salesRate), "sale-split");
  let nets;
  let vats;
  if (mode === CustomerPriceMode.GROSS) {
    nets = allocateInteger(split.net, totals);
    vats = totals.map((total, index) => total - (nets[index] ?? 0));
  } else {
    vats = allocateInteger(split.vat, totals);
    nets = totals.map((total) => total);
  }
  const lines = specs.map((spec, index) => {
    const net = roundToClp(nets[index] ?? 0);
    const vat = roundToClp(vats[index] ?? 0);
    return {
      code: spec.code,
      kind: spec.kind,
      quantity: spec.quantity,
      customerUnitPrice: spec.customerUnitPrice,
      customerLineTotal: totals[index] ?? roundToClp(0),
      netLineTotal: net,
      vatLineTotal: vat,
      grossLineTotal: roundToClp(net + vat),
      costBasis: spec.costBasis,
      sourceItemCodes: spec.sourceItemCodes
    };
  });
  const channel = params.channel;
  const base = channel.commissionBase === CommissionBase.GROSS ? split.gross : split.net;
  const percentage = unwrap(decomposeCommission(channel.commission * base, channel.commissionTax, params.taxProfile), "commission");
  const fixed = unwrap(economicFixedFee(channel, params.taxProfile), "fixed-fee");
  const commission = roundToClp(percentage.economicFee + fixed.economicCost);
  const commissionVatRecoverable = roundToClp(percentage.vatRecoverable + fixed.vatRecoverable);
  const ledger = unwrap(
    buildTaxLedger(
      {
        sale: split,
        economicCost: breakdown.pricingPool,
        commission,
        purchaseVatRecoverable: breakdown.recoverableVat,
        commissionVatRecoverable
      },
      salesRate
    ),
    "ledger"
  );
  return {
    lines,
    split,
    commission,
    ledger,
    margin: split.net > 0 ? ledger.utility / split.net : null,
    policyMargin: split.net > 0 ? ledger.utility / split.net : Number.NEGATIVE_INFINITY
  };
}

// src/modules/calculation/v1/pricing/parameters.ts
function resolvePricingParameters(params, overrides) {
  const profile = params.pricingProfile;
  let targetMargin = profile.targetMargin;
  let minMargin = profile.minMargin;
  let rounding = profile.rounding;
  let discount = { kind: "TIER" };
  let fixedUnitPrice;
  const fixedLinePrices = {};
  for (const override of overrides) {
    switch (override.kind) {
      case OverrideKind.TARGET_MARGIN:
        targetMargin = override.value;
        break;
      case OverrideKind.MIN_MARGIN:
        minMargin = override.value;
        break;
      case OverrideKind.ROUNDING:
        rounding = override.value;
        break;
      case OverrideKind.DISCOUNT:
        discount = override.value.mode === DiscountOverrideMode.NONE ? { kind: "NONE" } : { kind: "MANUAL", pct: override.value.pct };
        break;
      case OverrideKind.FIXED_UNIT_PRICE:
        fixedUnitPrice = override.value.customerUnitPrice;
        break;
      case OverrideKind.FIXED_LINE_PRICE:
        fixedLinePrices[override.itemCode] = override.value.customerPrice;
        break;
      case OverrideKind.FAILURE_RATE:
      case OverrideKind.ITEM_RECOVERY:
        break;
    }
  }
  return {
    targetMargin,
    minMargin,
    policy: profile.onBelowMin,
    tiers: profile.discountTiers,
    rounding,
    discount,
    fixedLinePrices,
    ...fixedUnitPrice === void 0 ? {} : { fixedUnitPrice }
  };
}

// src/modules/calculation/v1/pricing/rounding.ts
function gridStep(strategy) {
  return strategy.mode === RoundingMode.STEP ? strategy.step : 1;
}
function roundToGrid(value, strategy) {
  if (!Number.isFinite(value) || value < 0) {
    throw new InvariantViolation("pricing.rounding", `valor fuera de dominio: ${String(value)}`);
  }
  if (strategy.mode === RoundingMode.NONE) return roundToClp(value);
  const quotient = value / strategy.step;
  const nearest = roundHalfAwayFromZero(quotient);
  const onGrid = Math.abs(quotient - nearest) <= STEP_TOLERANCE * Math.max(1, Math.abs(quotient));
  let steps = nearest;
  if (!onGrid) {
    if (strategy.direction === RoundingDirection.UP) steps = Math.ceil(quotient);
    else if (strategy.direction === RoundingDirection.DOWN) steps = Math.floor(quotient);
  }
  return roundToClp(steps * strategy.step);
}

// src/modules/calculation/v1/pricing/price-grid.ts
function gridDomain(domain) {
  if (domain.rounding.mode === RoundingMode.STEP) return domain.rounding.target;
  return domain.mode === CustomerPriceMode.GROSS ? RoundingTarget.GROSS : RoundingTarget.NET;
}
function netToGridValue(net, domain) {
  return gridDomain(domain) === RoundingTarget.NET ? net : net * (1 + domain.salesRate);
}
function gridToCustomer(grid, domain) {
  const target = gridDomain(domain);
  if (target === RoundingTarget.NET && domain.mode === CustomerPriceMode.GROSS) {
    return unwrap(splitFromNet(grid, domain.salesRate), "grid-to-customer").gross;
  }
  if (target === RoundingTarget.GROSS && domain.mode === CustomerPriceMode.NET) {
    return unwrap(splitFromGross(grid, domain.salesRate), "grid-to-customer").net;
  }
  return grid;
}
function customerToNet(customer, domain) {
  return domain.mode === CustomerPriceMode.GROSS ? customer / (1 + domain.salesRate) : customer;
}
function priceFromNet(net, domain) {
  const grid = roundToGrid(Math.max(0, net === 0 ? 0 : netToGridValue(net, domain)), domain.rounding);
  return { grid, customer: gridToCustomer(grid, domain) };
}
var ZERO_PRICE = roundToClp(0);

// src/modules/calculation/v1/pricing/engine.ts
function minGridMeetingMargin(start, step, marginAt, minMargin) {
  const inRange = (steps) => Number.isSafeInteger(Math.round(start + steps * step));
  const meets = (steps) => marginAt(roundToClp(start + steps * step)) >= minMargin - MARGIN_TOLERANCE;
  let failing = 0;
  let passing = 1;
  let doublings = 0;
  for (; ; ) {
    if (!inRange(passing)) return { failure: "PRICE_OUT_OF_RANGE" };
    if (meets(passing)) break;
    failing = passing;
    passing *= SEARCH_GROWTH_FACTOR;
    doublings += 1;
    if (doublings > MAX_SEARCH_DOUBLINGS) return { failure: "SEARCH_EXHAUSTED" };
  }
  while (passing - failing > 1) {
    const middle = failing + Math.floor((passing - failing) / BISECTION_DIVISOR);
    if (meets(middle)) passing = middle;
    else failing = middle;
  }
  return { grid: roundToClp(start + passing * step) };
}
function fraction(value, where) {
  return unwrap(parseFraction(value, where, "EXCLUSIVE"), where);
}
function run2(request, cost) {
  if (request.mode !== CalculationMode.QUOTE) {
    return err(invalidInput("mode", "INCONSISTENT", "El modo TEST no calcula precio"));
  }
  const { params, overrides } = request;
  const tax = params.taxProfile;
  const breakdown = cost.breakdown;
  const units = cost.quantities.units;
  const sales = salesVatRateOf(tax);
  if (!sales.ok) return err(fromTaxError(sales.error));
  const salesRate = sales.value;
  const effective = resolvePricingParameters(params, overrides);
  const commissionRate = effectiveCommissionRate(params.channel, tax);
  if (!commissionRate.ok) return err(fromTaxError(commissionRate.error));
  const fixedFee = economicFixedFee(params.channel, tax);
  if (!fixedFee.ok) return err(fromTaxError(fixedFee.error));
  const cEff = commissionRate.value;
  const fee = fixedFee.value.economicCost;
  for (const margin2 of [effective.targetMargin, effective.minMargin]) {
    const denominator = 1 - cEff - margin2;
    if (!(denominator > MIN_MARGIN_DENOMINATOR)) {
      const reason = denominator < -MIN_MARGIN_DENOMINATOR ? "EXCEEDS_LIMIT" : "AT_LIMIT";
      return err({ code: "INFEASIBLE_MARGIN", effectiveCommission: cEff, margin: margin2, reason });
    }
  }
  const grouped = groupCostLines(breakdown.items);
  if (!grouped.ok) return grouped;
  const pool = breakdown.pricingPool;
  const lineCosts = grouped.value.main.cost + grouped.value.separate.reduce((sum, line) => sum + line.cost, 0);
  if (lineCosts !== pool) throw new InvariantViolation("pricing.lines", "el costo de las l\xEDneas no suma el pool");
  const targetNet = (pool + fee) / (1 - cEff - effective.targetMargin);
  const floorNet = (pool + fee) / (1 - cEff - effective.minMargin);
  const breakEvenNet = (pool + fee) / (1 - cEff);
  if (![targetNet, floorNet, breakEvenNet].every((value) => Number.isFinite(value) && Number.isSafeInteger(Math.ceil(value)))) {
    return err({ code: "NO_FEASIBLE_PRICE", minMargin: effective.minMargin, reason: "PRICE_OUT_OF_RANGE" });
  }
  const domain = { rounding: effective.rounding, mode: tax.customerPriceMode, salesRate };
  const context = { params, salesRate, breakdown };
  const one = oneUnit();
  const mainFixed = effective.fixedUnitPrice;
  const separate = grouped.value.separate.filter((line) => line.cost > 0 || effective.fixedLinePrices[line.code] !== void 0);
  const fixedLine = (line) => effective.fixedLinePrices[line.code];
  let fixedNet = 0;
  if (mainFixed !== void 0) fixedNet += customerToNet(mainFixed * units, domain);
  for (const line of separate) {
    const price = fixedLine(line);
    if (price !== void 0) fixedNet += customerToNet(price, domain);
  }
  const targetLines = [];
  if (mainFixed === void 0) targetLines.push({ key: MAIN_LINE_CODE, cost: grouped.value.main.cost });
  for (const line of separate) if (fixedLine(line) === void 0) targetLines.push({ key: line.code, cost: line.cost });
  const revenueForTargetLines = Math.max(0, targetNet - fixedNet);
  const shares = allocateProportional(revenueForTargetLines, targetLines.map((line) => line.cost));
  const netShare = new Map(targetLines.map((line, index) => [line.key, shares[index] ?? 0]));
  const separatePrice = (line) => fixedLine(line) ?? priceFromNet(netShare.get(line.code) ?? 0, domain).customer;
  const separateSpecs = separate.map((line) => ({
    code: line.code,
    kind: LineKind.SEPARATE_LINE,
    quantity: one,
    customerUnitPrice: separatePrice(line),
    costBasis: line.cost,
    sourceItemCodes: line.itemCodes
  }));
  const specsWith = (mainUnitPrice2) => [
    {
      code: MAIN_LINE_CODE,
      kind: LineKind.MAIN,
      quantity: units,
      customerUnitPrice: mainUnitPrice2,
      costBasis: grouped.value.main.cost,
      sourceItemCodes: grouped.value.main.itemCodes
    },
    ...separateSpecs
  ];
  const evaluate = (mainUnitPrice2) => evaluateOutcome(context, specsWith(mainUnitPrice2));
  let mainUnitPrice;
  let appliedDiscount = 0;
  let cappedFrom;
  if (mainFixed !== void 0) {
    mainUnitPrice = mainFixed;
  } else {
    const listNetUnit = (netShare.get(MAIN_LINE_CODE) ?? 0) / units;
    const tierDiscount = effective.discount.kind === "NONE" ? 0 : effective.discount.kind === "MANUAL" ? effective.discount.pct ?? 0 : resolveVolumeDiscount(units, effective.tiers);
    const first = priceFromNet(listNetUnit * (1 - tierDiscount), domain);
    mainUnitPrice = first.customer;
    appliedDiscount = tierDiscount;
    if (effective.policy === BelowMinPolicyId.CAP && evaluate(first.customer).policyMargin < effective.minMargin - MARGIN_TOLERANCE) {
      const search = minGridMeetingMargin(
        first.grid,
        gridStep(effective.rounding),
        (value) => evaluate(gridToCustomer(value, domain)).policyMargin,
        effective.minMargin
      );
      if ("failure" in search) {
        return err({ code: "NO_FEASIBLE_PRICE", minMargin: effective.minMargin, reason: search.failure });
      }
      mainUnitPrice = gridToCustomer(search.grid, domain);
      const effectiveDiscount = listNetUnit > 0 ? 1 - customerToNet(mainUnitPrice, domain) / listNetUnit : 0;
      appliedDiscount = Math.min(tierDiscount, Math.max(0, effectiveDiscount));
      if (appliedDiscount < tierDiscount - MARGIN_TOLERANCE) cappedFrom = tierDiscount;
    }
  }
  const outcome = evaluate(mainUnitPrice);
  const utility = outcome.ledger.utility;
  const margin = outcome.policyMargin;
  const realUtility = roundToClp(utility - breakdown.absorbedCost);
  const net = outcome.split.net;
  const realMargin = net > 0 ? realUtility / net : null;
  const flags = [];
  const unknownInCost = new Set(
    cost.flags.filter((flag) => flag.code === FlagCode.UNKNOWN_OVERRIDE_TARGET).map((flag) => flag.path)
  );
  const separateCodes = new Set(grouped.value.separate.map((line) => line.code));
  overrides.forEach((override, index) => {
    const path = `overrides[${String(index)}]`;
    if (unknownInCost.has(path)) return;
    const unknown = override.kind === OverrideKind.FIXED_LINE_PRICE && !separateCodes.has(override.itemCode);
    flags.push({
      code: unknown ? FlagCode.UNKNOWN_OVERRIDE_TARGET : FlagCode.OVERRIDE_APPLIED,
      severity: unknown ? FlagSeverity.WARNING : FlagSeverity.INFO,
      path
    });
  });
  if (pool === 0 && mainFixed === void 0 && separate.every((line) => fixedLine(line) === void 0)) {
    flags.push({ code: FlagCode.PRICING_POOL_EMPTY, severity: FlagSeverity.WARNING, path: "breakdown.pricingPool" });
  }
  if (cappedFrom !== void 0) {
    flags.push({ code: FlagCode.DISCOUNT_CAPPED, severity: FlagSeverity.INFO, path: "pricing.discount" });
  }
  if (margin < effective.targetMargin - MARGIN_TOLERANCE) {
    flags.push({ code: FlagCode.BELOW_TARGET, severity: FlagSeverity.INFO, path: "pricing.realMargin" });
  }
  if (margin < effective.minMargin - MARGIN_TOLERANCE) {
    flags.push({ code: FlagCode.BELOW_MIN, severity: FlagSeverity.WARNING, path: "pricing.commercialMargin" });
    if (effective.policy !== BelowMinPolicyId.WARN) {
      flags.push({ code: FlagCode.BLOCKED, severity: FlagSeverity.BLOCKING, path: "pricing.commercialMargin" });
    }
  } else if (realMargin !== null && realMargin < effective.minMargin - MARGIN_TOLERANCE) {
    flags.push({ code: FlagCode.REAL_MARGIN_BELOW_MIN, severity: FlagSeverity.WARNING, path: "pricing.realMargin" });
  }
  if (utility < 0) {
    flags.push({ code: FlagCode.NEGATIVE_UTILITY, severity: FlagSeverity.WARNING, path: "pricing.commercialUtility" });
  }
  const pricing = {
    mode: mainFixed === void 0 ? PricingMode.TARGET_MARGIN : PricingMode.FIXED_PRICE,
    customerPriceMode: tax.customerPriceMode,
    targetNetTotal: roundToClp(targetNet),
    lines: outcome.lines,
    discount: {
      applied: fraction(appliedDiscount, "discount.applied"),
      ...cappedFrom === void 0 ? {} : { cappedFrom: fraction(cappedFrom, "discount.cappedFrom") }
    },
    customerUnitPrice: mainUnitPrice,
    netTotal: outcome.split.net,
    vatTotal: outcome.split.vat,
    grossTotal: outcome.split.gross,
    commission: outcome.commission,
    commercialUtility: outcome.ledger.utility,
    commercialMargin: outcome.margin,
    commercialMarkup: pool > 0 ? utility / pool : null,
    absorbedCost: breakdown.absorbedCost,
    realUtility,
    realMargin,
    realMarkup: pool + breakdown.absorbedCost > 0 ? realUtility / (pool + breakdown.absorbedCost) : null,
    floorNetTotal: roundToClp(floorNet),
    breakEvenNetTotal: roundToClp(breakEvenNet)
  };
  const violations = [
    ...checkPricingInvariants(pricing, breakdown).map((v) => `${v.path}:${v.code}`),
    ...checkLedgerInvariants(outcome.ledger)
  ];
  if (violations.length > 0) throw new InvariantViolation("pricing.result", violations.join(", "));
  return ok({ pricing, flags });
}
function calculatePricing(request, cost) {
  try {
    return run2(request, cost);
  } catch (error) {
    if (error instanceof InvariantViolation) return err({ code: "INTERNAL_INVARIANT", invariant: error.invariant });
    throw error;
  }
}

// src/modules/calculation/calculator.ts
function engineWith(version, cost) {
  return {
    version,
    calculate(request) {
      const costs = cost(request);
      if (!costs.ok) return costs;
      const base = {
        calculationVersion: request.calculationVersion,
        breakdown: costs.value.breakdown,
        appliedOverrides: request.overrides
      };
      if (request.mode === CalculationMode.TEST) {
        const output2 = { ...base, pricing: null, flags: costs.value.flags };
        return ok(output2);
      }
      const pricing = calculatePricing(request, costs.value);
      if (!pricing.ok) return pricing;
      const output = {
        ...base,
        pricing: pricing.value.pricing,
        flags: [...costs.value.flags, ...pricing.value.flags]
      };
      return ok(output);
    }
  };
}
var ENGINE_V1 = engineWith(CALCULATION_V1, (request) => calculateCost(request));
var ENGINE_V2 = engineWith(CALCULATION_V2, calculateCostV2);
function createQuoteCalculator(engines = [ENGINE_V1, ENGINE_V2]) {
  const registry = /* @__PURE__ */ new Map();
  for (const engine of engines) {
    if (registry.has(engine.version)) throw new Error(`Versi\xF3n de c\xE1lculo duplicada en el registro: ${engine.version}`);
    registry.set(engine.version, engine);
  }
  const versions = [...registry.keys()];
  return {
    calculate(request) {
      const engine = registry.get(request.calculationVersion);
      if (engine === void 0) return err({ code: "UNKNOWN_CALCULATION_VERSION", version: request.calculationVersion });
      return engine.calculate(request);
    },
    supportedVersions: () => versions
  };
}
function calculateFromRaw(calculator2, raw) {
  const request = validateCalculationRequest(raw);
  if (!request.ok) {
    const error = { code: "INVALID_INPUT", issues: request.error };
    return err(error);
  }
  return calculator2.calculate(request.value);
}

// node_modules/zod/v3/external.js
var external_exports = {};
__export(external_exports, {
  BRAND: () => BRAND,
  DIRTY: () => DIRTY,
  EMPTY_PATH: () => EMPTY_PATH,
  INVALID: () => INVALID,
  NEVER: () => NEVER,
  OK: () => OK,
  ParseStatus: () => ParseStatus,
  Schema: () => ZodType,
  ZodAny: () => ZodAny,
  ZodArray: () => ZodArray,
  ZodBigInt: () => ZodBigInt,
  ZodBoolean: () => ZodBoolean,
  ZodBranded: () => ZodBranded,
  ZodCatch: () => ZodCatch,
  ZodDate: () => ZodDate,
  ZodDefault: () => ZodDefault,
  ZodDiscriminatedUnion: () => ZodDiscriminatedUnion,
  ZodEffects: () => ZodEffects,
  ZodEnum: () => ZodEnum,
  ZodError: () => ZodError,
  ZodFirstPartyTypeKind: () => ZodFirstPartyTypeKind,
  ZodFunction: () => ZodFunction,
  ZodIntersection: () => ZodIntersection,
  ZodIssueCode: () => ZodIssueCode,
  ZodLazy: () => ZodLazy,
  ZodLiteral: () => ZodLiteral,
  ZodMap: () => ZodMap,
  ZodNaN: () => ZodNaN,
  ZodNativeEnum: () => ZodNativeEnum,
  ZodNever: () => ZodNever,
  ZodNull: () => ZodNull,
  ZodNullable: () => ZodNullable,
  ZodNumber: () => ZodNumber,
  ZodObject: () => ZodObject,
  ZodOptional: () => ZodOptional,
  ZodParsedType: () => ZodParsedType,
  ZodPipeline: () => ZodPipeline,
  ZodPromise: () => ZodPromise,
  ZodReadonly: () => ZodReadonly,
  ZodRecord: () => ZodRecord,
  ZodSchema: () => ZodType,
  ZodSet: () => ZodSet,
  ZodString: () => ZodString,
  ZodSymbol: () => ZodSymbol,
  ZodTransformer: () => ZodEffects,
  ZodTuple: () => ZodTuple,
  ZodType: () => ZodType,
  ZodUndefined: () => ZodUndefined,
  ZodUnion: () => ZodUnion,
  ZodUnknown: () => ZodUnknown,
  ZodVoid: () => ZodVoid,
  addIssueToContext: () => addIssueToContext,
  any: () => anyType,
  array: () => arrayType,
  bigint: () => bigIntType,
  boolean: () => booleanType,
  coerce: () => coerce,
  custom: () => custom,
  date: () => dateType,
  datetimeRegex: () => datetimeRegex,
  defaultErrorMap: () => en_default,
  discriminatedUnion: () => discriminatedUnionType,
  effect: () => effectsType,
  enum: () => enumType,
  function: () => functionType,
  getErrorMap: () => getErrorMap,
  getParsedType: () => getParsedType,
  instanceof: () => instanceOfType,
  intersection: () => intersectionType,
  isAborted: () => isAborted,
  isAsync: () => isAsync,
  isDirty: () => isDirty,
  isValid: () => isValid,
  late: () => late,
  lazy: () => lazyType,
  literal: () => literalType,
  makeIssue: () => makeIssue,
  map: () => mapType,
  nan: () => nanType,
  nativeEnum: () => nativeEnumType,
  never: () => neverType,
  null: () => nullType,
  nullable: () => nullableType,
  number: () => numberType,
  object: () => objectType,
  objectUtil: () => objectUtil,
  oboolean: () => oboolean,
  onumber: () => onumber,
  optional: () => optionalType,
  ostring: () => ostring,
  pipeline: () => pipelineType,
  preprocess: () => preprocessType,
  promise: () => promiseType,
  quotelessJson: () => quotelessJson,
  record: () => recordType,
  set: () => setType,
  setErrorMap: () => setErrorMap,
  strictObject: () => strictObjectType,
  string: () => stringType,
  symbol: () => symbolType,
  transformer: () => effectsType,
  tuple: () => tupleType,
  undefined: () => undefinedType,
  union: () => unionType,
  unknown: () => unknownType,
  util: () => util,
  void: () => voidType
});

// node_modules/zod/v3/helpers/util.js
var util;
(function(util2) {
  util2.assertEqual = (_) => {
  };
  function assertIs(_arg) {
  }
  util2.assertIs = assertIs;
  function assertNever(_x) {
    throw new Error();
  }
  util2.assertNever = assertNever;
  util2.arrayToEnum = (items) => {
    const obj = {};
    for (const item of items) {
      obj[item] = item;
    }
    return obj;
  };
  util2.getValidEnumValues = (obj) => {
    const validKeys = util2.objectKeys(obj).filter((k) => typeof obj[obj[k]] !== "number");
    const filtered = {};
    for (const k of validKeys) {
      filtered[k] = obj[k];
    }
    return util2.objectValues(filtered);
  };
  util2.objectValues = (obj) => {
    return util2.objectKeys(obj).map(function(e) {
      return obj[e];
    });
  };
  util2.objectKeys = typeof Object.keys === "function" ? (obj) => Object.keys(obj) : (object) => {
    const keys = [];
    for (const key in object) {
      if (Object.prototype.hasOwnProperty.call(object, key)) {
        keys.push(key);
      }
    }
    return keys;
  };
  util2.find = (arr, checker) => {
    for (const item of arr) {
      if (checker(item))
        return item;
    }
    return void 0;
  };
  util2.isInteger = typeof Number.isInteger === "function" ? (val) => Number.isInteger(val) : (val) => typeof val === "number" && Number.isFinite(val) && Math.floor(val) === val;
  function joinValues(array, separator = " | ") {
    return array.map((val) => typeof val === "string" ? `'${val}'` : val).join(separator);
  }
  util2.joinValues = joinValues;
  util2.jsonStringifyReplacer = (_, value) => {
    if (typeof value === "bigint") {
      return value.toString();
    }
    return value;
  };
})(util || (util = {}));
var objectUtil;
(function(objectUtil2) {
  objectUtil2.mergeShapes = (first, second) => {
    return {
      ...first,
      ...second
      // second overwrites first
    };
  };
})(objectUtil || (objectUtil = {}));
var ZodParsedType = util.arrayToEnum([
  "string",
  "nan",
  "number",
  "integer",
  "float",
  "boolean",
  "date",
  "bigint",
  "symbol",
  "function",
  "undefined",
  "null",
  "array",
  "object",
  "unknown",
  "promise",
  "void",
  "never",
  "map",
  "set"
]);
var getParsedType = (data) => {
  const t = typeof data;
  switch (t) {
    case "undefined":
      return ZodParsedType.undefined;
    case "string":
      return ZodParsedType.string;
    case "number":
      return Number.isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;
    case "boolean":
      return ZodParsedType.boolean;
    case "function":
      return ZodParsedType.function;
    case "bigint":
      return ZodParsedType.bigint;
    case "symbol":
      return ZodParsedType.symbol;
    case "object":
      if (Array.isArray(data)) {
        return ZodParsedType.array;
      }
      if (data === null) {
        return ZodParsedType.null;
      }
      if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
        return ZodParsedType.promise;
      }
      if (typeof Map !== "undefined" && data instanceof Map) {
        return ZodParsedType.map;
      }
      if (typeof Set !== "undefined" && data instanceof Set) {
        return ZodParsedType.set;
      }
      if (typeof Date !== "undefined" && data instanceof Date) {
        return ZodParsedType.date;
      }
      return ZodParsedType.object;
    default:
      return ZodParsedType.unknown;
  }
};

// node_modules/zod/v3/ZodError.js
var ZodIssueCode = util.arrayToEnum([
  "invalid_type",
  "invalid_literal",
  "custom",
  "invalid_union",
  "invalid_union_discriminator",
  "invalid_enum_value",
  "unrecognized_keys",
  "invalid_arguments",
  "invalid_return_type",
  "invalid_date",
  "invalid_string",
  "too_small",
  "too_big",
  "invalid_intersection_types",
  "not_multiple_of",
  "not_finite"
]);
var quotelessJson = (obj) => {
  const json = JSON.stringify(obj, null, 2);
  return json.replace(/"([^"]+)":/g, "$1:");
};
var ZodError = class _ZodError extends Error {
  get errors() {
    return this.issues;
  }
  constructor(issues) {
    super();
    this.issues = [];
    this.addIssue = (sub) => {
      this.issues = [...this.issues, sub];
    };
    this.addIssues = (subs = []) => {
      this.issues = [...this.issues, ...subs];
    };
    const actualProto = new.target.prototype;
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto);
    } else {
      this.__proto__ = actualProto;
    }
    this.name = "ZodError";
    this.issues = issues;
  }
  format(_mapper) {
    const mapper = _mapper || function(issue2) {
      return issue2.message;
    };
    const fieldErrors = { _errors: [] };
    const processError = (error) => {
      for (const issue2 of error.issues) {
        if (issue2.code === "invalid_union") {
          issue2.unionErrors.map(processError);
        } else if (issue2.code === "invalid_return_type") {
          processError(issue2.returnTypeError);
        } else if (issue2.code === "invalid_arguments") {
          processError(issue2.argumentsError);
        } else if (issue2.path.length === 0) {
          fieldErrors._errors.push(mapper(issue2));
        } else {
          let curr = fieldErrors;
          let i = 0;
          while (i < issue2.path.length) {
            const el = issue2.path[i];
            const terminal = i === issue2.path.length - 1;
            if (!terminal) {
              curr[el] = curr[el] || { _errors: [] };
            } else {
              curr[el] = curr[el] || { _errors: [] };
              curr[el]._errors.push(mapper(issue2));
            }
            curr = curr[el];
            i++;
          }
        }
      }
    };
    processError(this);
    return fieldErrors;
  }
  static assert(value) {
    if (!(value instanceof _ZodError)) {
      throw new Error(`Not a ZodError: ${value}`);
    }
  }
  toString() {
    return this.message;
  }
  get message() {
    return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2);
  }
  get isEmpty() {
    return this.issues.length === 0;
  }
  flatten(mapper = (issue2) => issue2.message) {
    const fieldErrors = {};
    const formErrors = [];
    for (const sub of this.issues) {
      if (sub.path.length > 0) {
        const firstEl = sub.path[0];
        fieldErrors[firstEl] = fieldErrors[firstEl] || [];
        fieldErrors[firstEl].push(mapper(sub));
      } else {
        formErrors.push(mapper(sub));
      }
    }
    return { formErrors, fieldErrors };
  }
  get formErrors() {
    return this.flatten();
  }
};
ZodError.create = (issues) => {
  const error = new ZodError(issues);
  return error;
};

// node_modules/zod/v3/locales/en.js
var errorMap = (issue2, _ctx) => {
  let message;
  switch (issue2.code) {
    case ZodIssueCode.invalid_type:
      if (issue2.received === ZodParsedType.undefined) {
        message = "Required";
      } else {
        message = `Expected ${issue2.expected}, received ${issue2.received}`;
      }
      break;
    case ZodIssueCode.invalid_literal:
      message = `Invalid literal value, expected ${JSON.stringify(issue2.expected, util.jsonStringifyReplacer)}`;
      break;
    case ZodIssueCode.unrecognized_keys:
      message = `Unrecognized key(s) in object: ${util.joinValues(issue2.keys, ", ")}`;
      break;
    case ZodIssueCode.invalid_union:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_union_discriminator:
      message = `Invalid discriminator value. Expected ${util.joinValues(issue2.options)}`;
      break;
    case ZodIssueCode.invalid_enum_value:
      message = `Invalid enum value. Expected ${util.joinValues(issue2.options)}, received '${issue2.received}'`;
      break;
    case ZodIssueCode.invalid_arguments:
      message = `Invalid function arguments`;
      break;
    case ZodIssueCode.invalid_return_type:
      message = `Invalid function return type`;
      break;
    case ZodIssueCode.invalid_date:
      message = `Invalid date`;
      break;
    case ZodIssueCode.invalid_string:
      if (typeof issue2.validation === "object") {
        if ("includes" in issue2.validation) {
          message = `Invalid input: must include "${issue2.validation.includes}"`;
          if (typeof issue2.validation.position === "number") {
            message = `${message} at one or more positions greater than or equal to ${issue2.validation.position}`;
          }
        } else if ("startsWith" in issue2.validation) {
          message = `Invalid input: must start with "${issue2.validation.startsWith}"`;
        } else if ("endsWith" in issue2.validation) {
          message = `Invalid input: must end with "${issue2.validation.endsWith}"`;
        } else {
          util.assertNever(issue2.validation);
        }
      } else if (issue2.validation !== "regex") {
        message = `Invalid ${issue2.validation}`;
      } else {
        message = "Invalid";
      }
      break;
    case ZodIssueCode.too_small:
      if (issue2.type === "array")
        message = `Array must contain ${issue2.exact ? "exactly" : issue2.inclusive ? `at least` : `more than`} ${issue2.minimum} element(s)`;
      else if (issue2.type === "string")
        message = `String must contain ${issue2.exact ? "exactly" : issue2.inclusive ? `at least` : `over`} ${issue2.minimum} character(s)`;
      else if (issue2.type === "number")
        message = `Number must be ${issue2.exact ? `exactly equal to ` : issue2.inclusive ? `greater than or equal to ` : `greater than `}${issue2.minimum}`;
      else if (issue2.type === "bigint")
        message = `Number must be ${issue2.exact ? `exactly equal to ` : issue2.inclusive ? `greater than or equal to ` : `greater than `}${issue2.minimum}`;
      else if (issue2.type === "date")
        message = `Date must be ${issue2.exact ? `exactly equal to ` : issue2.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue2.minimum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.too_big:
      if (issue2.type === "array")
        message = `Array must contain ${issue2.exact ? `exactly` : issue2.inclusive ? `at most` : `less than`} ${issue2.maximum} element(s)`;
      else if (issue2.type === "string")
        message = `String must contain ${issue2.exact ? `exactly` : issue2.inclusive ? `at most` : `under`} ${issue2.maximum} character(s)`;
      else if (issue2.type === "number")
        message = `Number must be ${issue2.exact ? `exactly` : issue2.inclusive ? `less than or equal to` : `less than`} ${issue2.maximum}`;
      else if (issue2.type === "bigint")
        message = `BigInt must be ${issue2.exact ? `exactly` : issue2.inclusive ? `less than or equal to` : `less than`} ${issue2.maximum}`;
      else if (issue2.type === "date")
        message = `Date must be ${issue2.exact ? `exactly` : issue2.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue2.maximum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.custom:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_intersection_types:
      message = `Intersection results could not be merged`;
      break;
    case ZodIssueCode.not_multiple_of:
      message = `Number must be a multiple of ${issue2.multipleOf}`;
      break;
    case ZodIssueCode.not_finite:
      message = "Number must be finite";
      break;
    default:
      message = _ctx.defaultError;
      util.assertNever(issue2);
  }
  return { message };
};
var en_default = errorMap;

// node_modules/zod/v3/errors.js
var overrideErrorMap = en_default;
function setErrorMap(map2) {
  overrideErrorMap = map2;
}
function getErrorMap() {
  return overrideErrorMap;
}

// node_modules/zod/v3/helpers/parseUtil.js
var makeIssue = (params) => {
  const { data, path, errorMaps, issueData } = params;
  const fullPath = [...path, ...issueData.path || []];
  const fullIssue = {
    ...issueData,
    path: fullPath
  };
  if (issueData.message !== void 0) {
    return {
      ...issueData,
      path: fullPath,
      message: issueData.message
    };
  }
  let errorMessage = "";
  const maps = errorMaps.filter((m) => !!m).slice().reverse();
  for (const map2 of maps) {
    errorMessage = map2(fullIssue, { data, defaultError: errorMessage }).message;
  }
  return {
    ...issueData,
    path: fullPath,
    message: errorMessage
  };
};
var EMPTY_PATH = [];
function addIssueToContext(ctx, issueData) {
  const overrideMap = getErrorMap();
  const issue2 = makeIssue({
    issueData,
    data: ctx.data,
    path: ctx.path,
    errorMaps: [
      ctx.common.contextualErrorMap,
      // contextual error map is first priority
      ctx.schemaErrorMap,
      // then schema-bound map if available
      overrideMap,
      // then global override map
      overrideMap === en_default ? void 0 : en_default
      // then global default map
    ].filter((x) => !!x)
  });
  ctx.common.issues.push(issue2);
}
var ParseStatus = class _ParseStatus {
  constructor() {
    this.value = "valid";
  }
  dirty() {
    if (this.value === "valid")
      this.value = "dirty";
  }
  abort() {
    if (this.value !== "aborted")
      this.value = "aborted";
  }
  static mergeArray(status, results) {
    const arrayValue = [];
    for (const s of results) {
      if (s.status === "aborted")
        return INVALID;
      if (s.status === "dirty")
        status.dirty();
      arrayValue.push(s.value);
    }
    return { status: status.value, value: arrayValue };
  }
  static async mergeObjectAsync(status, pairs) {
    const syncPairs = [];
    for (const pair of pairs) {
      const key = await pair.key;
      const value = await pair.value;
      syncPairs.push({
        key,
        value
      });
    }
    return _ParseStatus.mergeObjectSync(status, syncPairs);
  }
  static mergeObjectSync(status, pairs) {
    const finalObject = {};
    for (const pair of pairs) {
      const { key, value } = pair;
      if (key.status === "aborted")
        return INVALID;
      if (value.status === "aborted")
        return INVALID;
      if (key.status === "dirty")
        status.dirty();
      if (value.status === "dirty")
        status.dirty();
      if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
        finalObject[key.value] = value.value;
      }
    }
    return { status: status.value, value: finalObject };
  }
};
var INVALID = Object.freeze({
  status: "aborted"
});
var DIRTY = (value) => ({ status: "dirty", value });
var OK = (value) => ({ status: "valid", value });
var isAborted = (x) => x.status === "aborted";
var isDirty = (x) => x.status === "dirty";
var isValid = (x) => x.status === "valid";
var isAsync = (x) => typeof Promise !== "undefined" && x instanceof Promise;

// node_modules/zod/v3/helpers/errorUtil.js
var errorUtil;
(function(errorUtil2) {
  errorUtil2.errToObj = (message) => typeof message === "string" ? { message } : message || {};
  errorUtil2.toString = (message) => typeof message === "string" ? message : message?.message;
})(errorUtil || (errorUtil = {}));

// node_modules/zod/v3/types.js
var ParseInputLazyPath = class {
  constructor(parent, value, path, key) {
    this._cachedPath = [];
    this.parent = parent;
    this.data = value;
    this._path = path;
    this._key = key;
  }
  get path() {
    if (!this._cachedPath.length) {
      if (Array.isArray(this._key)) {
        this._cachedPath.push(...this._path, ...this._key);
      } else {
        this._cachedPath.push(...this._path, this._key);
      }
    }
    return this._cachedPath;
  }
};
var handleResult = (ctx, result) => {
  if (isValid(result)) {
    return { success: true, data: result.value };
  } else {
    if (!ctx.common.issues.length) {
      throw new Error("Validation failed but no issues detected.");
    }
    return {
      success: false,
      get error() {
        if (this._error)
          return this._error;
        const error = new ZodError(ctx.common.issues);
        this._error = error;
        return this._error;
      }
    };
  }
};
function processCreateParams(params) {
  if (!params)
    return {};
  const { errorMap: errorMap2, invalid_type_error, required_error, description } = params;
  if (errorMap2 && (invalid_type_error || required_error)) {
    throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  }
  if (errorMap2)
    return { errorMap: errorMap2, description };
  const customMap = (iss, ctx) => {
    const { message } = params;
    if (iss.code === "invalid_enum_value") {
      return { message: message ?? ctx.defaultError };
    }
    if (typeof ctx.data === "undefined") {
      return { message: message ?? required_error ?? ctx.defaultError };
    }
    if (iss.code !== "invalid_type")
      return { message: ctx.defaultError };
    return { message: message ?? invalid_type_error ?? ctx.defaultError };
  };
  return { errorMap: customMap, description };
}
var ZodType = class {
  get description() {
    return this._def.description;
  }
  _getType(input) {
    return getParsedType(input.data);
  }
  _getOrReturnCtx(input, ctx) {
    return ctx || {
      common: input.parent.common,
      data: input.data,
      parsedType: getParsedType(input.data),
      schemaErrorMap: this._def.errorMap,
      path: input.path,
      parent: input.parent
    };
  }
  _processInputParams(input) {
    return {
      status: new ParseStatus(),
      ctx: {
        common: input.parent.common,
        data: input.data,
        parsedType: getParsedType(input.data),
        schemaErrorMap: this._def.errorMap,
        path: input.path,
        parent: input.parent
      }
    };
  }
  _parseSync(input) {
    const result = this._parse(input);
    if (isAsync(result)) {
      throw new Error("Synchronous parse encountered promise.");
    }
    return result;
  }
  _parseAsync(input) {
    const result = this._parse(input);
    return Promise.resolve(result);
  }
  parse(data, params) {
    const result = this.safeParse(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  safeParse(data, params) {
    const ctx = {
      common: {
        issues: [],
        async: params?.async ?? false,
        contextualErrorMap: params?.errorMap
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const result = this._parseSync({ data, path: ctx.path, parent: ctx });
    return handleResult(ctx, result);
  }
  "~validate"(data) {
    const ctx = {
      common: {
        issues: [],
        async: !!this["~standard"].async
      },
      path: [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    if (!this["~standard"].async) {
      try {
        const result = this._parseSync({ data, path: [], parent: ctx });
        return isValid(result) ? {
          value: result.value
        } : {
          issues: ctx.common.issues
        };
      } catch (err2) {
        if (err2?.message?.toLowerCase()?.includes("encountered")) {
          this["~standard"].async = true;
        }
        ctx.common = {
          issues: [],
          async: true
        };
      }
    }
    return this._parseAsync({ data, path: [], parent: ctx }).then((result) => isValid(result) ? {
      value: result.value
    } : {
      issues: ctx.common.issues
    });
  }
  async parseAsync(data, params) {
    const result = await this.safeParseAsync(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  async safeParseAsync(data, params) {
    const ctx = {
      common: {
        issues: [],
        contextualErrorMap: params?.errorMap,
        async: true
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
    const result = await (isAsync(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
    return handleResult(ctx, result);
  }
  refine(check, message) {
    const getIssueProperties = (val) => {
      if (typeof message === "string" || typeof message === "undefined") {
        return { message };
      } else if (typeof message === "function") {
        return message(val);
      } else {
        return message;
      }
    };
    return this._refinement((val, ctx) => {
      const result = check(val);
      const setError = () => ctx.addIssue({
        code: ZodIssueCode.custom,
        ...getIssueProperties(val)
      });
      if (typeof Promise !== "undefined" && result instanceof Promise) {
        return result.then((data) => {
          if (!data) {
            setError();
            return false;
          } else {
            return true;
          }
        });
      }
      if (!result) {
        setError();
        return false;
      } else {
        return true;
      }
    });
  }
  refinement(check, refinementData) {
    return this._refinement((val, ctx) => {
      if (!check(val)) {
        ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
        return false;
      } else {
        return true;
      }
    });
  }
  _refinement(refinement) {
    return new ZodEffects({
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "refinement", refinement }
    });
  }
  superRefine(refinement) {
    return this._refinement(refinement);
  }
  constructor(def) {
    this.spa = this.safeParseAsync;
    this._def = def;
    this.parse = this.parse.bind(this);
    this.safeParse = this.safeParse.bind(this);
    this.parseAsync = this.parseAsync.bind(this);
    this.safeParseAsync = this.safeParseAsync.bind(this);
    this.spa = this.spa.bind(this);
    this.refine = this.refine.bind(this);
    this.refinement = this.refinement.bind(this);
    this.superRefine = this.superRefine.bind(this);
    this.optional = this.optional.bind(this);
    this.nullable = this.nullable.bind(this);
    this.nullish = this.nullish.bind(this);
    this.array = this.array.bind(this);
    this.promise = this.promise.bind(this);
    this.or = this.or.bind(this);
    this.and = this.and.bind(this);
    this.transform = this.transform.bind(this);
    this.brand = this.brand.bind(this);
    this.default = this.default.bind(this);
    this.catch = this.catch.bind(this);
    this.describe = this.describe.bind(this);
    this.pipe = this.pipe.bind(this);
    this.readonly = this.readonly.bind(this);
    this.isNullable = this.isNullable.bind(this);
    this.isOptional = this.isOptional.bind(this);
    this["~standard"] = {
      version: 1,
      vendor: "zod",
      validate: (data) => this["~validate"](data)
    };
  }
  optional() {
    return ZodOptional.create(this, this._def);
  }
  nullable() {
    return ZodNullable.create(this, this._def);
  }
  nullish() {
    return this.nullable().optional();
  }
  array() {
    return ZodArray.create(this);
  }
  promise() {
    return ZodPromise.create(this, this._def);
  }
  or(option) {
    return ZodUnion.create([this, option], this._def);
  }
  and(incoming) {
    return ZodIntersection.create(this, incoming, this._def);
  }
  transform(transform) {
    return new ZodEffects({
      ...processCreateParams(this._def),
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "transform", transform }
    });
  }
  default(def) {
    const defaultValueFunc = typeof def === "function" ? def : () => def;
    return new ZodDefault({
      ...processCreateParams(this._def),
      innerType: this,
      defaultValue: defaultValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodDefault
    });
  }
  brand() {
    return new ZodBranded({
      typeName: ZodFirstPartyTypeKind.ZodBranded,
      type: this,
      ...processCreateParams(this._def)
    });
  }
  catch(def) {
    const catchValueFunc = typeof def === "function" ? def : () => def;
    return new ZodCatch({
      ...processCreateParams(this._def),
      innerType: this,
      catchValue: catchValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodCatch
    });
  }
  describe(description) {
    const This = this.constructor;
    return new This({
      ...this._def,
      description
    });
  }
  pipe(target) {
    return ZodPipeline.create(this, target);
  }
  readonly() {
    return ZodReadonly.create(this);
  }
  isOptional() {
    return this.safeParse(void 0).success;
  }
  isNullable() {
    return this.safeParse(null).success;
  }
};
var cuidRegex = /^c[^\s-]{8,}$/i;
var cuid2Regex = /^[0-9a-z]+$/;
var ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
var uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
var nanoidRegex = /^[a-z0-9_-]{21}$/i;
var jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
var durationRegex = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
var emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
var _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
var emojiRegex;
var ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
var ipv4CidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;
var ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
var ipv6CidrRegex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
var base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
var base64urlRegex = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
var dateRegexSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
var dateRegex = new RegExp(`^${dateRegexSource}$`);
function timeRegexSource(args) {
  let secondsRegexSource = `[0-5]\\d`;
  if (args.precision) {
    secondsRegexSource = `${secondsRegexSource}\\.\\d{${args.precision}}`;
  } else if (args.precision == null) {
    secondsRegexSource = `${secondsRegexSource}(\\.\\d+)?`;
  }
  const secondsQuantifier = args.precision ? "+" : "?";
  return `([01]\\d|2[0-3]):[0-5]\\d(:${secondsRegexSource})${secondsQuantifier}`;
}
function timeRegex(args) {
  return new RegExp(`^${timeRegexSource(args)}$`);
}
function datetimeRegex(args) {
  let regex = `${dateRegexSource}T${timeRegexSource(args)}`;
  const opts = [];
  opts.push(args.local ? `Z?` : `Z`);
  if (args.offset)
    opts.push(`([+-]\\d{2}:?\\d{2})`);
  regex = `${regex}(${opts.join("|")})`;
  return new RegExp(`^${regex}$`);
}
function isValidIP(ip, version) {
  if ((version === "v4" || !version) && ipv4Regex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6Regex.test(ip)) {
    return true;
  }
  return false;
}
function isValidJWT(jwt, alg) {
  if (!jwtRegex.test(jwt))
    return false;
  try {
    const [header] = jwt.split(".");
    if (!header)
      return false;
    const base64 = header.replace(/-/g, "+").replace(/_/g, "/").padEnd(header.length + (4 - header.length % 4) % 4, "=");
    const decoded = JSON.parse(atob(base64));
    if (typeof decoded !== "object" || decoded === null)
      return false;
    if ("typ" in decoded && decoded?.typ !== "JWT")
      return false;
    if (!decoded.alg)
      return false;
    if (alg && decoded.alg !== alg)
      return false;
    return true;
  } catch {
    return false;
  }
}
function isValidCidr(ip, version) {
  if ((version === "v4" || !version) && ipv4CidrRegex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6CidrRegex.test(ip)) {
    return true;
  }
  return false;
}
var ZodString = class _ZodString extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = String(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.string) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.string,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.length < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.length > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "length") {
        const tooBig = input.data.length > check.value;
        const tooSmall = input.data.length < check.value;
        if (tooBig || tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          if (tooBig) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          } else if (tooSmall) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          }
          status.dirty();
        }
      } else if (check.kind === "email") {
        if (!emailRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "email",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "emoji") {
        if (!emojiRegex) {
          emojiRegex = new RegExp(_emojiRegex, "u");
        }
        if (!emojiRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "emoji",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "uuid") {
        if (!uuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "uuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "nanoid") {
        if (!nanoidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "nanoid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid") {
        if (!cuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid2") {
        if (!cuid2Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid2",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ulid") {
        if (!ulidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ulid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "url") {
        try {
          new URL(input.data);
        } catch {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "regex") {
        check.regex.lastIndex = 0;
        const testResult = check.regex.test(input.data);
        if (!testResult) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "regex",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "trim") {
        input.data = input.data.trim();
      } else if (check.kind === "includes") {
        if (!input.data.includes(check.value, check.position)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { includes: check.value, position: check.position },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "toLowerCase") {
        input.data = input.data.toLowerCase();
      } else if (check.kind === "toUpperCase") {
        input.data = input.data.toUpperCase();
      } else if (check.kind === "startsWith") {
        if (!input.data.startsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { startsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "endsWith") {
        if (!input.data.endsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { endsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "datetime") {
        const regex = datetimeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "datetime",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "date") {
        const regex = dateRegex;
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "date",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "time") {
        const regex = timeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "time",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "duration") {
        if (!durationRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "duration",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ip") {
        if (!isValidIP(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ip",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "jwt") {
        if (!isValidJWT(input.data, check.alg)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "jwt",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cidr") {
        if (!isValidCidr(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cidr",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64") {
        if (!base64Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64url") {
        if (!base64urlRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _regex(regex, validation, message) {
    return this.refinement((data) => regex.test(data), {
      validation,
      code: ZodIssueCode.invalid_string,
      ...errorUtil.errToObj(message)
    });
  }
  _addCheck(check) {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  email(message) {
    return this._addCheck({ kind: "email", ...errorUtil.errToObj(message) });
  }
  url(message) {
    return this._addCheck({ kind: "url", ...errorUtil.errToObj(message) });
  }
  emoji(message) {
    return this._addCheck({ kind: "emoji", ...errorUtil.errToObj(message) });
  }
  uuid(message) {
    return this._addCheck({ kind: "uuid", ...errorUtil.errToObj(message) });
  }
  nanoid(message) {
    return this._addCheck({ kind: "nanoid", ...errorUtil.errToObj(message) });
  }
  cuid(message) {
    return this._addCheck({ kind: "cuid", ...errorUtil.errToObj(message) });
  }
  cuid2(message) {
    return this._addCheck({ kind: "cuid2", ...errorUtil.errToObj(message) });
  }
  ulid(message) {
    return this._addCheck({ kind: "ulid", ...errorUtil.errToObj(message) });
  }
  base64(message) {
    return this._addCheck({ kind: "base64", ...errorUtil.errToObj(message) });
  }
  base64url(message) {
    return this._addCheck({
      kind: "base64url",
      ...errorUtil.errToObj(message)
    });
  }
  jwt(options) {
    return this._addCheck({ kind: "jwt", ...errorUtil.errToObj(options) });
  }
  ip(options) {
    return this._addCheck({ kind: "ip", ...errorUtil.errToObj(options) });
  }
  cidr(options) {
    return this._addCheck({ kind: "cidr", ...errorUtil.errToObj(options) });
  }
  datetime(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "datetime",
        precision: null,
        offset: false,
        local: false,
        message: options
      });
    }
    return this._addCheck({
      kind: "datetime",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      offset: options?.offset ?? false,
      local: options?.local ?? false,
      ...errorUtil.errToObj(options?.message)
    });
  }
  date(message) {
    return this._addCheck({ kind: "date", message });
  }
  time(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "time",
        precision: null,
        message: options
      });
    }
    return this._addCheck({
      kind: "time",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      ...errorUtil.errToObj(options?.message)
    });
  }
  duration(message) {
    return this._addCheck({ kind: "duration", ...errorUtil.errToObj(message) });
  }
  regex(regex, message) {
    return this._addCheck({
      kind: "regex",
      regex,
      ...errorUtil.errToObj(message)
    });
  }
  includes(value, options) {
    return this._addCheck({
      kind: "includes",
      value,
      position: options?.position,
      ...errorUtil.errToObj(options?.message)
    });
  }
  startsWith(value, message) {
    return this._addCheck({
      kind: "startsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  endsWith(value, message) {
    return this._addCheck({
      kind: "endsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  min(minLength, message) {
    return this._addCheck({
      kind: "min",
      value: minLength,
      ...errorUtil.errToObj(message)
    });
  }
  max(maxLength, message) {
    return this._addCheck({
      kind: "max",
      value: maxLength,
      ...errorUtil.errToObj(message)
    });
  }
  length(len, message) {
    return this._addCheck({
      kind: "length",
      value: len,
      ...errorUtil.errToObj(message)
    });
  }
  /**
   * Equivalent to `.min(1)`
   */
  nonempty(message) {
    return this.min(1, errorUtil.errToObj(message));
  }
  trim() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "trim" }]
    });
  }
  toLowerCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toLowerCase" }]
    });
  }
  toUpperCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toUpperCase" }]
    });
  }
  get isDatetime() {
    return !!this._def.checks.find((ch) => ch.kind === "datetime");
  }
  get isDate() {
    return !!this._def.checks.find((ch) => ch.kind === "date");
  }
  get isTime() {
    return !!this._def.checks.find((ch) => ch.kind === "time");
  }
  get isDuration() {
    return !!this._def.checks.find((ch) => ch.kind === "duration");
  }
  get isEmail() {
    return !!this._def.checks.find((ch) => ch.kind === "email");
  }
  get isURL() {
    return !!this._def.checks.find((ch) => ch.kind === "url");
  }
  get isEmoji() {
    return !!this._def.checks.find((ch) => ch.kind === "emoji");
  }
  get isUUID() {
    return !!this._def.checks.find((ch) => ch.kind === "uuid");
  }
  get isNANOID() {
    return !!this._def.checks.find((ch) => ch.kind === "nanoid");
  }
  get isCUID() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid");
  }
  get isCUID2() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid2");
  }
  get isULID() {
    return !!this._def.checks.find((ch) => ch.kind === "ulid");
  }
  get isIP() {
    return !!this._def.checks.find((ch) => ch.kind === "ip");
  }
  get isCIDR() {
    return !!this._def.checks.find((ch) => ch.kind === "cidr");
  }
  get isBase64() {
    return !!this._def.checks.find((ch) => ch.kind === "base64");
  }
  get isBase64url() {
    return !!this._def.checks.find((ch) => ch.kind === "base64url");
  }
  get minLength() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxLength() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodString.create = (params) => {
  return new ZodString({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodString,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
function floatSafeRemainder(val, step) {
  const valDecCount = (val.toString().split(".")[1] || "").length;
  const stepDecCount = (step.toString().split(".")[1] || "").length;
  const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
  const valInt = Number.parseInt(val.toFixed(decCount).replace(".", ""));
  const stepInt = Number.parseInt(step.toFixed(decCount).replace(".", ""));
  return valInt % stepInt / 10 ** decCount;
}
var ZodNumber = class _ZodNumber extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
    this.step = this.multipleOf;
  }
  _parse(input) {
    if (this._def.coerce) {
      input.data = Number(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.number) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.number,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "int") {
        if (!util.isInteger(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: "integer",
            received: "float",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (floatSafeRemainder(input.data, check.value) !== 0) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "finite") {
        if (!Number.isFinite(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_finite,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodNumber({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodNumber({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  int(message) {
    return this._addCheck({
      kind: "int",
      message: errorUtil.toString(message)
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  finite(message) {
    return this._addCheck({
      kind: "finite",
      message: errorUtil.toString(message)
    });
  }
  safe(message) {
    return this._addCheck({
      kind: "min",
      inclusive: true,
      value: Number.MIN_SAFE_INTEGER,
      message: errorUtil.toString(message)
    })._addCheck({
      kind: "max",
      inclusive: true,
      value: Number.MAX_SAFE_INTEGER,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
  get isInt() {
    return !!this._def.checks.find((ch) => ch.kind === "int" || ch.kind === "multipleOf" && util.isInteger(ch.value));
  }
  get isFinite() {
    let max = null;
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
        return true;
      } else if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      } else if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return Number.isFinite(min) && Number.isFinite(max);
  }
};
ZodNumber.create = (params) => {
  return new ZodNumber({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodNumber,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
var ZodBigInt = class _ZodBigInt extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
  }
  _parse(input) {
    if (this._def.coerce) {
      try {
        input.data = BigInt(input.data);
      } catch {
        return this._getInvalidInput(input);
      }
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.bigint) {
      return this._getInvalidInput(input);
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            type: "bigint",
            minimum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            type: "bigint",
            maximum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (input.data % check.value !== BigInt(0)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _getInvalidInput(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.bigint,
      received: ctx.parsedType
    });
    return INVALID;
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodBigInt({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodBigInt({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodBigInt.create = (params) => {
  return new ZodBigInt({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodBigInt,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
var ZodBoolean = class extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = Boolean(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.boolean) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.boolean,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodBoolean.create = (params) => {
  return new ZodBoolean({
    typeName: ZodFirstPartyTypeKind.ZodBoolean,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
var ZodDate = class _ZodDate extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = new Date(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.date) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.date,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    if (Number.isNaN(input.data.getTime())) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_date
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.getTime() < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            message: check.message,
            inclusive: true,
            exact: false,
            minimum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.getTime() > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            message: check.message,
            inclusive: true,
            exact: false,
            maximum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return {
      status: status.value,
      value: new Date(input.data.getTime())
    };
  }
  _addCheck(check) {
    return new _ZodDate({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  min(minDate, message) {
    return this._addCheck({
      kind: "min",
      value: minDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  max(maxDate, message) {
    return this._addCheck({
      kind: "max",
      value: maxDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  get minDate() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min != null ? new Date(min) : null;
  }
  get maxDate() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max != null ? new Date(max) : null;
  }
};
ZodDate.create = (params) => {
  return new ZodDate({
    checks: [],
    coerce: params?.coerce || false,
    typeName: ZodFirstPartyTypeKind.ZodDate,
    ...processCreateParams(params)
  });
};
var ZodSymbol = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.symbol) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.symbol,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodSymbol.create = (params) => {
  return new ZodSymbol({
    typeName: ZodFirstPartyTypeKind.ZodSymbol,
    ...processCreateParams(params)
  });
};
var ZodUndefined = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.undefined,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodUndefined.create = (params) => {
  return new ZodUndefined({
    typeName: ZodFirstPartyTypeKind.ZodUndefined,
    ...processCreateParams(params)
  });
};
var ZodNull = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.null) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.null,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodNull.create = (params) => {
  return new ZodNull({
    typeName: ZodFirstPartyTypeKind.ZodNull,
    ...processCreateParams(params)
  });
};
var ZodAny = class extends ZodType {
  constructor() {
    super(...arguments);
    this._any = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodAny.create = (params) => {
  return new ZodAny({
    typeName: ZodFirstPartyTypeKind.ZodAny,
    ...processCreateParams(params)
  });
};
var ZodUnknown = class extends ZodType {
  constructor() {
    super(...arguments);
    this._unknown = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodUnknown.create = (params) => {
  return new ZodUnknown({
    typeName: ZodFirstPartyTypeKind.ZodUnknown,
    ...processCreateParams(params)
  });
};
var ZodNever = class extends ZodType {
  _parse(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.never,
      received: ctx.parsedType
    });
    return INVALID;
  }
};
ZodNever.create = (params) => {
  return new ZodNever({
    typeName: ZodFirstPartyTypeKind.ZodNever,
    ...processCreateParams(params)
  });
};
var ZodVoid = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.void,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodVoid.create = (params) => {
  return new ZodVoid({
    typeName: ZodFirstPartyTypeKind.ZodVoid,
    ...processCreateParams(params)
  });
};
var ZodArray = class _ZodArray extends ZodType {
  _parse(input) {
    const { ctx, status } = this._processInputParams(input);
    const def = this._def;
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (def.exactLength !== null) {
      const tooBig = ctx.data.length > def.exactLength.value;
      const tooSmall = ctx.data.length < def.exactLength.value;
      if (tooBig || tooSmall) {
        addIssueToContext(ctx, {
          code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
          minimum: tooSmall ? def.exactLength.value : void 0,
          maximum: tooBig ? def.exactLength.value : void 0,
          type: "array",
          inclusive: true,
          exact: true,
          message: def.exactLength.message
        });
        status.dirty();
      }
    }
    if (def.minLength !== null) {
      if (ctx.data.length < def.minLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.minLength.message
        });
        status.dirty();
      }
    }
    if (def.maxLength !== null) {
      if (ctx.data.length > def.maxLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.maxLength.message
        });
        status.dirty();
      }
    }
    if (ctx.common.async) {
      return Promise.all([...ctx.data].map((item, i) => {
        return def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i));
      })).then((result2) => {
        return ParseStatus.mergeArray(status, result2);
      });
    }
    const result = [...ctx.data].map((item, i) => {
      return def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i));
    });
    return ParseStatus.mergeArray(status, result);
  }
  get element() {
    return this._def.type;
  }
  min(minLength, message) {
    return new _ZodArray({
      ...this._def,
      minLength: { value: minLength, message: errorUtil.toString(message) }
    });
  }
  max(maxLength, message) {
    return new _ZodArray({
      ...this._def,
      maxLength: { value: maxLength, message: errorUtil.toString(message) }
    });
  }
  length(len, message) {
    return new _ZodArray({
      ...this._def,
      exactLength: { value: len, message: errorUtil.toString(message) }
    });
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodArray.create = (schema, params) => {
  return new ZodArray({
    type: schema,
    minLength: null,
    maxLength: null,
    exactLength: null,
    typeName: ZodFirstPartyTypeKind.ZodArray,
    ...processCreateParams(params)
  });
};
function deepPartialify(schema) {
  if (schema instanceof ZodObject) {
    const newShape = {};
    for (const key in schema.shape) {
      const fieldSchema = schema.shape[key];
      newShape[key] = ZodOptional.create(deepPartialify(fieldSchema));
    }
    return new ZodObject({
      ...schema._def,
      shape: () => newShape
    });
  } else if (schema instanceof ZodArray) {
    return new ZodArray({
      ...schema._def,
      type: deepPartialify(schema.element)
    });
  } else if (schema instanceof ZodOptional) {
    return ZodOptional.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodNullable) {
    return ZodNullable.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodTuple) {
    return ZodTuple.create(schema.items.map((item) => deepPartialify(item)));
  } else {
    return schema;
  }
}
var ZodObject = class _ZodObject extends ZodType {
  constructor() {
    super(...arguments);
    this._cached = null;
    this.nonstrict = this.passthrough;
    this.augment = this.extend;
  }
  _getCached() {
    if (this._cached !== null)
      return this._cached;
    const shape = this._def.shape();
    const keys = util.objectKeys(shape);
    this._cached = { shape, keys };
    return this._cached;
  }
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.object) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const { status, ctx } = this._processInputParams(input);
    const { shape, keys: shapeKeys } = this._getCached();
    const extraKeys = [];
    if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === "strip")) {
      for (const key in ctx.data) {
        if (!shapeKeys.includes(key)) {
          extraKeys.push(key);
        }
      }
    }
    const pairs = [];
    for (const key of shapeKeys) {
      const keyValidator = shape[key];
      const value = ctx.data[key];
      pairs.push({
        key: { status: "valid", value: key },
        value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (this._def.catchall instanceof ZodNever) {
      const unknownKeys = this._def.unknownKeys;
      if (unknownKeys === "passthrough") {
        for (const key of extraKeys) {
          pairs.push({
            key: { status: "valid", value: key },
            value: { status: "valid", value: ctx.data[key] }
          });
        }
      } else if (unknownKeys === "strict") {
        if (extraKeys.length > 0) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.unrecognized_keys,
            keys: extraKeys
          });
          status.dirty();
        }
      } else if (unknownKeys === "strip") {
      } else {
        throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
      }
    } else {
      const catchall = this._def.catchall;
      for (const key of extraKeys) {
        const value = ctx.data[key];
        pairs.push({
          key: { status: "valid", value: key },
          value: catchall._parse(
            new ParseInputLazyPath(ctx, value, ctx.path, key)
            //, ctx.child(key), value, getParsedType(value)
          ),
          alwaysSet: key in ctx.data
        });
      }
    }
    if (ctx.common.async) {
      return Promise.resolve().then(async () => {
        const syncPairs = [];
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          syncPairs.push({
            key,
            value,
            alwaysSet: pair.alwaysSet
          });
        }
        return syncPairs;
      }).then((syncPairs) => {
        return ParseStatus.mergeObjectSync(status, syncPairs);
      });
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get shape() {
    return this._def.shape();
  }
  strict(message) {
    errorUtil.errToObj;
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strict",
      ...message !== void 0 ? {
        errorMap: (issue2, ctx) => {
          const defaultError = this._def.errorMap?.(issue2, ctx).message ?? ctx.defaultError;
          if (issue2.code === "unrecognized_keys")
            return {
              message: errorUtil.errToObj(message).message ?? defaultError
            };
          return {
            message: defaultError
          };
        }
      } : {}
    });
  }
  strip() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strip"
    });
  }
  passthrough() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "passthrough"
    });
  }
  // const AugmentFactory =
  //   <Def extends ZodObjectDef>(def: Def) =>
  //   <Augmentation extends ZodRawShape>(
  //     augmentation: Augmentation
  //   ): ZodObject<
  //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
  //     Def["unknownKeys"],
  //     Def["catchall"]
  //   > => {
  //     return new ZodObject({
  //       ...def,
  //       shape: () => ({
  //         ...def.shape(),
  //         ...augmentation,
  //       }),
  //     }) as any;
  //   };
  extend(augmentation) {
    return new _ZodObject({
      ...this._def,
      shape: () => ({
        ...this._def.shape(),
        ...augmentation
      })
    });
  }
  /**
   * Prior to zod@1.0.12 there was a bug in the
   * inferred type of merged objects. Please
   * upgrade if you are experiencing issues.
   */
  merge(merging) {
    const merged = new _ZodObject({
      unknownKeys: merging._def.unknownKeys,
      catchall: merging._def.catchall,
      shape: () => ({
        ...this._def.shape(),
        ...merging._def.shape()
      }),
      typeName: ZodFirstPartyTypeKind.ZodObject
    });
    return merged;
  }
  // merge<
  //   Incoming extends AnyZodObject,
  //   Augmentation extends Incoming["shape"],
  //   NewOutput extends {
  //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
  //       ? Augmentation[k]["_output"]
  //       : k extends keyof Output
  //       ? Output[k]
  //       : never;
  //   },
  //   NewInput extends {
  //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
  //       ? Augmentation[k]["_input"]
  //       : k extends keyof Input
  //       ? Input[k]
  //       : never;
  //   }
  // >(
  //   merging: Incoming
  // ): ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"],
  //   NewOutput,
  //   NewInput
  // > {
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  setKey(key, schema) {
    return this.augment({ [key]: schema });
  }
  // merge<Incoming extends AnyZodObject>(
  //   merging: Incoming
  // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
  // ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"]
  // > {
  //   // const mergedShape = objectUtil.mergeShapes(
  //   //   this._def.shape(),
  //   //   merging._def.shape()
  //   // );
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  catchall(index) {
    return new _ZodObject({
      ...this._def,
      catchall: index
    });
  }
  pick(mask) {
    const shape = {};
    for (const key of util.objectKeys(mask)) {
      if (mask[key] && this.shape[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  omit(mask) {
    const shape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (!mask[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  /**
   * @deprecated
   */
  deepPartial() {
    return deepPartialify(this);
  }
  partial(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      const fieldSchema = this.shape[key];
      if (mask && !mask[key]) {
        newShape[key] = fieldSchema;
      } else {
        newShape[key] = fieldSchema.optional();
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  required(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (mask && !mask[key]) {
        newShape[key] = this.shape[key];
      } else {
        const fieldSchema = this.shape[key];
        let newField = fieldSchema;
        while (newField instanceof ZodOptional) {
          newField = newField._def.innerType;
        }
        newShape[key] = newField;
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  keyof() {
    return createZodEnum(util.objectKeys(this.shape));
  }
};
ZodObject.create = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.strictCreate = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strict",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.lazycreate = (shape, params) => {
  return new ZodObject({
    shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
var ZodUnion = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const options = this._def.options;
    function handleResults(results) {
      for (const result of results) {
        if (result.result.status === "valid") {
          return result.result;
        }
      }
      for (const result of results) {
        if (result.result.status === "dirty") {
          ctx.common.issues.push(...result.ctx.common.issues);
          return result.result;
        }
      }
      const unionErrors = results.map((result) => new ZodError(result.ctx.common.issues));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return Promise.all(options.map(async (option) => {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        return {
          result: await option._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: childCtx
          }),
          ctx: childCtx
        };
      })).then(handleResults);
    } else {
      let dirty = void 0;
      const issues = [];
      for (const option of options) {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        const result = option._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: childCtx
        });
        if (result.status === "valid") {
          return result;
        } else if (result.status === "dirty" && !dirty) {
          dirty = { result, ctx: childCtx };
        }
        if (childCtx.common.issues.length) {
          issues.push(childCtx.common.issues);
        }
      }
      if (dirty) {
        ctx.common.issues.push(...dirty.ctx.common.issues);
        return dirty.result;
      }
      const unionErrors = issues.map((issues2) => new ZodError(issues2));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
  }
  get options() {
    return this._def.options;
  }
};
ZodUnion.create = (types, params) => {
  return new ZodUnion({
    options: types,
    typeName: ZodFirstPartyTypeKind.ZodUnion,
    ...processCreateParams(params)
  });
};
var getDiscriminator = (type) => {
  if (type instanceof ZodLazy) {
    return getDiscriminator(type.schema);
  } else if (type instanceof ZodEffects) {
    return getDiscriminator(type.innerType());
  } else if (type instanceof ZodLiteral) {
    return [type.value];
  } else if (type instanceof ZodEnum) {
    return type.options;
  } else if (type instanceof ZodNativeEnum) {
    return util.objectValues(type.enum);
  } else if (type instanceof ZodDefault) {
    return getDiscriminator(type._def.innerType);
  } else if (type instanceof ZodUndefined) {
    return [void 0];
  } else if (type instanceof ZodNull) {
    return [null];
  } else if (type instanceof ZodOptional) {
    return [void 0, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodNullable) {
    return [null, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodBranded) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodReadonly) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodCatch) {
    return getDiscriminator(type._def.innerType);
  } else {
    return [];
  }
};
var ZodDiscriminatedUnion = class _ZodDiscriminatedUnion extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const discriminator = this.discriminator;
    const discriminatorValue = ctx.data[discriminator];
    const option = this.optionsMap.get(discriminatorValue);
    if (!option) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union_discriminator,
        options: Array.from(this.optionsMap.keys()),
        path: [discriminator]
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return option._parseAsync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    } else {
      return option._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    }
  }
  get discriminator() {
    return this._def.discriminator;
  }
  get options() {
    return this._def.options;
  }
  get optionsMap() {
    return this._def.optionsMap;
  }
  /**
   * The constructor of the discriminated union schema. Its behaviour is very similar to that of the normal z.union() constructor.
   * However, it only allows a union of objects, all of which need to share a discriminator property. This property must
   * have a different value for each object in the union.
   * @param discriminator the name of the discriminator property
   * @param types an array of object schemas
   * @param params
   */
  static create(discriminator, options, params) {
    const optionsMap = /* @__PURE__ */ new Map();
    for (const type of options) {
      const discriminatorValues = getDiscriminator(type.shape[discriminator]);
      if (!discriminatorValues.length) {
        throw new Error(`A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`);
      }
      for (const value of discriminatorValues) {
        if (optionsMap.has(value)) {
          throw new Error(`Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`);
        }
        optionsMap.set(value, type);
      }
    }
    return new _ZodDiscriminatedUnion({
      typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
      discriminator,
      options,
      optionsMap,
      ...processCreateParams(params)
    });
  }
};
function mergeValues(a, b) {
  const aType = getParsedType(a);
  const bType = getParsedType(b);
  if (a === b) {
    return { valid: true, data: a };
  } else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
    const bKeys = util.objectKeys(b);
    const sharedKeys = util.objectKeys(a).filter((key) => bKeys.indexOf(key) !== -1);
    const newObj = { ...a, ...b };
    for (const key of sharedKeys) {
      const sharedValue = mergeValues(a[key], b[key]);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newObj[key] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  } else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
    if (a.length !== b.length) {
      return { valid: false };
    }
    const newArray = [];
    for (let index = 0; index < a.length; index++) {
      const itemA = a[index];
      const itemB = b[index];
      const sharedValue = mergeValues(itemA, itemB);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  } else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a === +b) {
    return { valid: true, data: a };
  } else {
    return { valid: false };
  }
}
var ZodIntersection = class extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const handleParsed = (parsedLeft, parsedRight) => {
      if (isAborted(parsedLeft) || isAborted(parsedRight)) {
        return INVALID;
      }
      const merged = mergeValues(parsedLeft.value, parsedRight.value);
      if (!merged.valid) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_intersection_types
        });
        return INVALID;
      }
      if (isDirty(parsedLeft) || isDirty(parsedRight)) {
        status.dirty();
      }
      return { status: status.value, value: merged.data };
    };
    if (ctx.common.async) {
      return Promise.all([
        this._def.left._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        }),
        this._def.right._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        })
      ]).then(([left, right]) => handleParsed(left, right));
    } else {
      return handleParsed(this._def.left._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }), this._def.right._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }));
    }
  }
};
ZodIntersection.create = (left, right, params) => {
  return new ZodIntersection({
    left,
    right,
    typeName: ZodFirstPartyTypeKind.ZodIntersection,
    ...processCreateParams(params)
  });
};
var ZodTuple = class _ZodTuple extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (ctx.data.length < this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_small,
        minimum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      return INVALID;
    }
    const rest = this._def.rest;
    if (!rest && ctx.data.length > this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_big,
        maximum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      status.dirty();
    }
    const items = [...ctx.data].map((item, itemIndex) => {
      const schema = this._def.items[itemIndex] || this._def.rest;
      if (!schema)
        return null;
      return schema._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
    }).filter((x) => !!x);
    if (ctx.common.async) {
      return Promise.all(items).then((results) => {
        return ParseStatus.mergeArray(status, results);
      });
    } else {
      return ParseStatus.mergeArray(status, items);
    }
  }
  get items() {
    return this._def.items;
  }
  rest(rest) {
    return new _ZodTuple({
      ...this._def,
      rest
    });
  }
};
ZodTuple.create = (schemas, params) => {
  if (!Array.isArray(schemas)) {
    throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
  }
  return new ZodTuple({
    items: schemas,
    typeName: ZodFirstPartyTypeKind.ZodTuple,
    rest: null,
    ...processCreateParams(params)
  });
};
var ZodRecord = class _ZodRecord extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const pairs = [];
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    for (const key in ctx.data) {
      pairs.push({
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, key)),
        value: valueType._parse(new ParseInputLazyPath(ctx, ctx.data[key], ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (ctx.common.async) {
      return ParseStatus.mergeObjectAsync(status, pairs);
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get element() {
    return this._def.valueType;
  }
  static create(first, second, third) {
    if (second instanceof ZodType) {
      return new _ZodRecord({
        keyType: first,
        valueType: second,
        typeName: ZodFirstPartyTypeKind.ZodRecord,
        ...processCreateParams(third)
      });
    }
    return new _ZodRecord({
      keyType: ZodString.create(),
      valueType: first,
      typeName: ZodFirstPartyTypeKind.ZodRecord,
      ...processCreateParams(second)
    });
  }
};
var ZodMap = class extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.map) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.map,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    const pairs = [...ctx.data.entries()].map(([key, value], index) => {
      return {
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [index, "key"])),
        value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index, "value"]))
      };
    });
    if (ctx.common.async) {
      const finalMap = /* @__PURE__ */ new Map();
      return Promise.resolve().then(async () => {
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          if (key.status === "aborted" || value.status === "aborted") {
            return INVALID;
          }
          if (key.status === "dirty" || value.status === "dirty") {
            status.dirty();
          }
          finalMap.set(key.value, value.value);
        }
        return { status: status.value, value: finalMap };
      });
    } else {
      const finalMap = /* @__PURE__ */ new Map();
      for (const pair of pairs) {
        const key = pair.key;
        const value = pair.value;
        if (key.status === "aborted" || value.status === "aborted") {
          return INVALID;
        }
        if (key.status === "dirty" || value.status === "dirty") {
          status.dirty();
        }
        finalMap.set(key.value, value.value);
      }
      return { status: status.value, value: finalMap };
    }
  }
};
ZodMap.create = (keyType, valueType, params) => {
  return new ZodMap({
    valueType,
    keyType,
    typeName: ZodFirstPartyTypeKind.ZodMap,
    ...processCreateParams(params)
  });
};
var ZodSet = class _ZodSet extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.set) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.set,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const def = this._def;
    if (def.minSize !== null) {
      if (ctx.data.size < def.minSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.minSize.message
        });
        status.dirty();
      }
    }
    if (def.maxSize !== null) {
      if (ctx.data.size > def.maxSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.maxSize.message
        });
        status.dirty();
      }
    }
    const valueType = this._def.valueType;
    function finalizeSet(elements2) {
      const parsedSet = /* @__PURE__ */ new Set();
      for (const element of elements2) {
        if (element.status === "aborted")
          return INVALID;
        if (element.status === "dirty")
          status.dirty();
        parsedSet.add(element.value);
      }
      return { status: status.value, value: parsedSet };
    }
    const elements = [...ctx.data.values()].map((item, i) => valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i)));
    if (ctx.common.async) {
      return Promise.all(elements).then((elements2) => finalizeSet(elements2));
    } else {
      return finalizeSet(elements);
    }
  }
  min(minSize, message) {
    return new _ZodSet({
      ...this._def,
      minSize: { value: minSize, message: errorUtil.toString(message) }
    });
  }
  max(maxSize, message) {
    return new _ZodSet({
      ...this._def,
      maxSize: { value: maxSize, message: errorUtil.toString(message) }
    });
  }
  size(size, message) {
    return this.min(size, message).max(size, message);
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodSet.create = (valueType, params) => {
  return new ZodSet({
    valueType,
    minSize: null,
    maxSize: null,
    typeName: ZodFirstPartyTypeKind.ZodSet,
    ...processCreateParams(params)
  });
};
var ZodFunction = class _ZodFunction extends ZodType {
  constructor() {
    super(...arguments);
    this.validate = this.implement;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.function) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.function,
        received: ctx.parsedType
      });
      return INVALID;
    }
    function makeArgsIssue(args, error) {
      return makeIssue({
        data: args,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_arguments,
          argumentsError: error
        }
      });
    }
    function makeReturnsIssue(returns, error) {
      return makeIssue({
        data: returns,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_return_type,
          returnTypeError: error
        }
      });
    }
    const params = { errorMap: ctx.common.contextualErrorMap };
    const fn = ctx.data;
    if (this._def.returns instanceof ZodPromise) {
      const me = this;
      return OK(async function(...args) {
        const error = new ZodError([]);
        const parsedArgs = await me._def.args.parseAsync(args, params).catch((e) => {
          error.addIssue(makeArgsIssue(args, e));
          throw error;
        });
        const result = await Reflect.apply(fn, this, parsedArgs);
        const parsedReturns = await me._def.returns._def.type.parseAsync(result, params).catch((e) => {
          error.addIssue(makeReturnsIssue(result, e));
          throw error;
        });
        return parsedReturns;
      });
    } else {
      const me = this;
      return OK(function(...args) {
        const parsedArgs = me._def.args.safeParse(args, params);
        if (!parsedArgs.success) {
          throw new ZodError([makeArgsIssue(args, parsedArgs.error)]);
        }
        const result = Reflect.apply(fn, this, parsedArgs.data);
        const parsedReturns = me._def.returns.safeParse(result, params);
        if (!parsedReturns.success) {
          throw new ZodError([makeReturnsIssue(result, parsedReturns.error)]);
        }
        return parsedReturns.data;
      });
    }
  }
  parameters() {
    return this._def.args;
  }
  returnType() {
    return this._def.returns;
  }
  args(...items) {
    return new _ZodFunction({
      ...this._def,
      args: ZodTuple.create(items).rest(ZodUnknown.create())
    });
  }
  returns(returnType) {
    return new _ZodFunction({
      ...this._def,
      returns: returnType
    });
  }
  implement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  strictImplement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  static create(args, returns, params) {
    return new _ZodFunction({
      args: args ? args : ZodTuple.create([]).rest(ZodUnknown.create()),
      returns: returns || ZodUnknown.create(),
      typeName: ZodFirstPartyTypeKind.ZodFunction,
      ...processCreateParams(params)
    });
  }
};
var ZodLazy = class extends ZodType {
  get schema() {
    return this._def.getter();
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const lazySchema = this._def.getter();
    return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
  }
};
ZodLazy.create = (getter, params) => {
  return new ZodLazy({
    getter,
    typeName: ZodFirstPartyTypeKind.ZodLazy,
    ...processCreateParams(params)
  });
};
var ZodLiteral = class extends ZodType {
  _parse(input) {
    if (input.data !== this._def.value) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_literal,
        expected: this._def.value
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
  get value() {
    return this._def.value;
  }
};
ZodLiteral.create = (value, params) => {
  return new ZodLiteral({
    value,
    typeName: ZodFirstPartyTypeKind.ZodLiteral,
    ...processCreateParams(params)
  });
};
function createZodEnum(values, params) {
  return new ZodEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodEnum,
    ...processCreateParams(params)
  });
}
var ZodEnum = class _ZodEnum extends ZodType {
  _parse(input) {
    if (typeof input.data !== "string") {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(this._def.values);
    }
    if (!this._cache.has(input.data)) {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get options() {
    return this._def.values;
  }
  get enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Values() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  extract(values, newDef = this._def) {
    return _ZodEnum.create(values, {
      ...this._def,
      ...newDef
    });
  }
  exclude(values, newDef = this._def) {
    return _ZodEnum.create(this.options.filter((opt) => !values.includes(opt)), {
      ...this._def,
      ...newDef
    });
  }
};
ZodEnum.create = createZodEnum;
var ZodNativeEnum = class extends ZodType {
  _parse(input) {
    const nativeEnumValues = util.getValidEnumValues(this._def.values);
    const ctx = this._getOrReturnCtx(input);
    if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(util.getValidEnumValues(this._def.values));
    }
    if (!this._cache.has(input.data)) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get enum() {
    return this._def.values;
  }
};
ZodNativeEnum.create = (values, params) => {
  return new ZodNativeEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
    ...processCreateParams(params)
  });
};
var ZodPromise = class extends ZodType {
  unwrap() {
    return this._def.type;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.promise,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const promisified = ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
    return OK(promisified.then((data) => {
      return this._def.type.parseAsync(data, {
        path: ctx.path,
        errorMap: ctx.common.contextualErrorMap
      });
    }));
  }
};
ZodPromise.create = (schema, params) => {
  return new ZodPromise({
    type: schema,
    typeName: ZodFirstPartyTypeKind.ZodPromise,
    ...processCreateParams(params)
  });
};
var ZodEffects = class extends ZodType {
  innerType() {
    return this._def.schema;
  }
  sourceType() {
    return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const effect = this._def.effect || null;
    const checkCtx = {
      addIssue: (arg) => {
        addIssueToContext(ctx, arg);
        if (arg.fatal) {
          status.abort();
        } else {
          status.dirty();
        }
      },
      get path() {
        return ctx.path;
      }
    };
    checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
    if (effect.type === "preprocess") {
      const processed = effect.transform(ctx.data, checkCtx);
      if (ctx.common.async) {
        return Promise.resolve(processed).then(async (processed2) => {
          if (status.value === "aborted")
            return INVALID;
          const result = await this._def.schema._parseAsync({
            data: processed2,
            path: ctx.path,
            parent: ctx
          });
          if (result.status === "aborted")
            return INVALID;
          if (result.status === "dirty")
            return DIRTY(result.value);
          if (status.value === "dirty")
            return DIRTY(result.value);
          return result;
        });
      } else {
        if (status.value === "aborted")
          return INVALID;
        const result = this._def.schema._parseSync({
          data: processed,
          path: ctx.path,
          parent: ctx
        });
        if (result.status === "aborted")
          return INVALID;
        if (result.status === "dirty")
          return DIRTY(result.value);
        if (status.value === "dirty")
          return DIRTY(result.value);
        return result;
      }
    }
    if (effect.type === "refinement") {
      const executeRefinement = (acc) => {
        const result = effect.refinement(acc, checkCtx);
        if (ctx.common.async) {
          return Promise.resolve(result);
        }
        if (result instanceof Promise) {
          throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
        }
        return acc;
      };
      if (ctx.common.async === false) {
        const inner = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inner.status === "aborted")
          return INVALID;
        if (inner.status === "dirty")
          status.dirty();
        executeRefinement(inner.value);
        return { status: status.value, value: inner.value };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
          if (inner.status === "aborted")
            return INVALID;
          if (inner.status === "dirty")
            status.dirty();
          return executeRefinement(inner.value).then(() => {
            return { status: status.value, value: inner.value };
          });
        });
      }
    }
    if (effect.type === "transform") {
      if (ctx.common.async === false) {
        const base = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (!isValid(base))
          return INVALID;
        const result = effect.transform(base.value, checkCtx);
        if (result instanceof Promise) {
          throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
        }
        return { status: status.value, value: result };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base) => {
          if (!isValid(base))
            return INVALID;
          return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({
            status: status.value,
            value: result
          }));
        });
      }
    }
    util.assertNever(effect);
  }
};
ZodEffects.create = (schema, effect, params) => {
  return new ZodEffects({
    schema,
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    effect,
    ...processCreateParams(params)
  });
};
ZodEffects.createWithPreprocess = (preprocess, schema, params) => {
  return new ZodEffects({
    schema,
    effect: { type: "preprocess", transform: preprocess },
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    ...processCreateParams(params)
  });
};
var ZodOptional = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.undefined) {
      return OK(void 0);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodOptional.create = (type, params) => {
  return new ZodOptional({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodOptional,
    ...processCreateParams(params)
  });
};
var ZodNullable = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.null) {
      return OK(null);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodNullable.create = (type, params) => {
  return new ZodNullable({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodNullable,
    ...processCreateParams(params)
  });
};
var ZodDefault = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    let data = ctx.data;
    if (ctx.parsedType === ZodParsedType.undefined) {
      data = this._def.defaultValue();
    }
    return this._def.innerType._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  removeDefault() {
    return this._def.innerType;
  }
};
ZodDefault.create = (type, params) => {
  return new ZodDefault({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodDefault,
    defaultValue: typeof params.default === "function" ? params.default : () => params.default,
    ...processCreateParams(params)
  });
};
var ZodCatch = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const newCtx = {
      ...ctx,
      common: {
        ...ctx.common,
        issues: []
      }
    };
    const result = this._def.innerType._parse({
      data: newCtx.data,
      path: newCtx.path,
      parent: {
        ...newCtx
      }
    });
    if (isAsync(result)) {
      return result.then((result2) => {
        return {
          status: "valid",
          value: result2.status === "valid" ? result2.value : this._def.catchValue({
            get error() {
              return new ZodError(newCtx.common.issues);
            },
            input: newCtx.data
          })
        };
      });
    } else {
      return {
        status: "valid",
        value: result.status === "valid" ? result.value : this._def.catchValue({
          get error() {
            return new ZodError(newCtx.common.issues);
          },
          input: newCtx.data
        })
      };
    }
  }
  removeCatch() {
    return this._def.innerType;
  }
};
ZodCatch.create = (type, params) => {
  return new ZodCatch({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodCatch,
    catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
    ...processCreateParams(params)
  });
};
var ZodNaN = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.nan) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.nan,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
};
ZodNaN.create = (params) => {
  return new ZodNaN({
    typeName: ZodFirstPartyTypeKind.ZodNaN,
    ...processCreateParams(params)
  });
};
var BRAND = /* @__PURE__ */ Symbol("zod_brand");
var ZodBranded = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const data = ctx.data;
    return this._def.type._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  unwrap() {
    return this._def.type;
  }
};
var ZodPipeline = class _ZodPipeline extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.common.async) {
      const handleAsync = async () => {
        const inResult = await this._def.in._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inResult.status === "aborted")
          return INVALID;
        if (inResult.status === "dirty") {
          status.dirty();
          return DIRTY(inResult.value);
        } else {
          return this._def.out._parseAsync({
            data: inResult.value,
            path: ctx.path,
            parent: ctx
          });
        }
      };
      return handleAsync();
    } else {
      const inResult = this._def.in._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
      if (inResult.status === "aborted")
        return INVALID;
      if (inResult.status === "dirty") {
        status.dirty();
        return {
          status: "dirty",
          value: inResult.value
        };
      } else {
        return this._def.out._parseSync({
          data: inResult.value,
          path: ctx.path,
          parent: ctx
        });
      }
    }
  }
  static create(a, b) {
    return new _ZodPipeline({
      in: a,
      out: b,
      typeName: ZodFirstPartyTypeKind.ZodPipeline
    });
  }
};
var ZodReadonly = class extends ZodType {
  _parse(input) {
    const result = this._def.innerType._parse(input);
    const freeze = (data) => {
      if (isValid(data)) {
        data.value = Object.freeze(data.value);
      }
      return data;
    };
    return isAsync(result) ? result.then((data) => freeze(data)) : freeze(result);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodReadonly.create = (type, params) => {
  return new ZodReadonly({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodReadonly,
    ...processCreateParams(params)
  });
};
function cleanParams(params, data) {
  const p = typeof params === "function" ? params(data) : typeof params === "string" ? { message: params } : params;
  const p2 = typeof p === "string" ? { message: p } : p;
  return p2;
}
function custom(check, _params = {}, fatal) {
  if (check)
    return ZodAny.create().superRefine((data, ctx) => {
      const r = check(data);
      if (r instanceof Promise) {
        return r.then((r2) => {
          if (!r2) {
            const params = cleanParams(_params, data);
            const _fatal = params.fatal ?? fatal ?? true;
            ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
          }
        });
      }
      if (!r) {
        const params = cleanParams(_params, data);
        const _fatal = params.fatal ?? fatal ?? true;
        ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
      }
      return;
    });
  return ZodAny.create();
}
var late = {
  object: ZodObject.lazycreate
};
var ZodFirstPartyTypeKind;
(function(ZodFirstPartyTypeKind2) {
  ZodFirstPartyTypeKind2["ZodString"] = "ZodString";
  ZodFirstPartyTypeKind2["ZodNumber"] = "ZodNumber";
  ZodFirstPartyTypeKind2["ZodNaN"] = "ZodNaN";
  ZodFirstPartyTypeKind2["ZodBigInt"] = "ZodBigInt";
  ZodFirstPartyTypeKind2["ZodBoolean"] = "ZodBoolean";
  ZodFirstPartyTypeKind2["ZodDate"] = "ZodDate";
  ZodFirstPartyTypeKind2["ZodSymbol"] = "ZodSymbol";
  ZodFirstPartyTypeKind2["ZodUndefined"] = "ZodUndefined";
  ZodFirstPartyTypeKind2["ZodNull"] = "ZodNull";
  ZodFirstPartyTypeKind2["ZodAny"] = "ZodAny";
  ZodFirstPartyTypeKind2["ZodUnknown"] = "ZodUnknown";
  ZodFirstPartyTypeKind2["ZodNever"] = "ZodNever";
  ZodFirstPartyTypeKind2["ZodVoid"] = "ZodVoid";
  ZodFirstPartyTypeKind2["ZodArray"] = "ZodArray";
  ZodFirstPartyTypeKind2["ZodObject"] = "ZodObject";
  ZodFirstPartyTypeKind2["ZodUnion"] = "ZodUnion";
  ZodFirstPartyTypeKind2["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
  ZodFirstPartyTypeKind2["ZodIntersection"] = "ZodIntersection";
  ZodFirstPartyTypeKind2["ZodTuple"] = "ZodTuple";
  ZodFirstPartyTypeKind2["ZodRecord"] = "ZodRecord";
  ZodFirstPartyTypeKind2["ZodMap"] = "ZodMap";
  ZodFirstPartyTypeKind2["ZodSet"] = "ZodSet";
  ZodFirstPartyTypeKind2["ZodFunction"] = "ZodFunction";
  ZodFirstPartyTypeKind2["ZodLazy"] = "ZodLazy";
  ZodFirstPartyTypeKind2["ZodLiteral"] = "ZodLiteral";
  ZodFirstPartyTypeKind2["ZodEnum"] = "ZodEnum";
  ZodFirstPartyTypeKind2["ZodEffects"] = "ZodEffects";
  ZodFirstPartyTypeKind2["ZodNativeEnum"] = "ZodNativeEnum";
  ZodFirstPartyTypeKind2["ZodOptional"] = "ZodOptional";
  ZodFirstPartyTypeKind2["ZodNullable"] = "ZodNullable";
  ZodFirstPartyTypeKind2["ZodDefault"] = "ZodDefault";
  ZodFirstPartyTypeKind2["ZodCatch"] = "ZodCatch";
  ZodFirstPartyTypeKind2["ZodPromise"] = "ZodPromise";
  ZodFirstPartyTypeKind2["ZodBranded"] = "ZodBranded";
  ZodFirstPartyTypeKind2["ZodPipeline"] = "ZodPipeline";
  ZodFirstPartyTypeKind2["ZodReadonly"] = "ZodReadonly";
})(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
var instanceOfType = (cls, params = {
  message: `Input not instance of ${cls.name}`
}) => custom((data) => data instanceof cls, params);
var stringType = ZodString.create;
var numberType = ZodNumber.create;
var nanType = ZodNaN.create;
var bigIntType = ZodBigInt.create;
var booleanType = ZodBoolean.create;
var dateType = ZodDate.create;
var symbolType = ZodSymbol.create;
var undefinedType = ZodUndefined.create;
var nullType = ZodNull.create;
var anyType = ZodAny.create;
var unknownType = ZodUnknown.create;
var neverType = ZodNever.create;
var voidType = ZodVoid.create;
var arrayType = ZodArray.create;
var objectType = ZodObject.create;
var strictObjectType = ZodObject.strictCreate;
var unionType = ZodUnion.create;
var discriminatedUnionType = ZodDiscriminatedUnion.create;
var intersectionType = ZodIntersection.create;
var tupleType = ZodTuple.create;
var recordType = ZodRecord.create;
var mapType = ZodMap.create;
var setType = ZodSet.create;
var functionType = ZodFunction.create;
var lazyType = ZodLazy.create;
var literalType = ZodLiteral.create;
var enumType = ZodEnum.create;
var nativeEnumType = ZodNativeEnum.create;
var promiseType = ZodPromise.create;
var effectsType = ZodEffects.create;
var optionalType = ZodOptional.create;
var nullableType = ZodNullable.create;
var preprocessType = ZodEffects.createWithPreprocess;
var pipelineType = ZodPipeline.create;
var ostring = () => stringType().optional();
var onumber = () => numberType().optional();
var oboolean = () => booleanType().optional();
var coerce = {
  string: ((arg) => ZodString.create({ ...arg, coerce: true })),
  number: ((arg) => ZodNumber.create({ ...arg, coerce: true })),
  boolean: ((arg) => ZodBoolean.create({
    ...arg,
    coerce: true
  })),
  bigint: ((arg) => ZodBigInt.create({ ...arg, coerce: true })),
  date: ((arg) => ZodDate.create({ ...arg, coerce: true }))
};
var NEVER = INVALID;

// src/modules/quoting/constants.ts
var PERCENT = 100;
var GRAMS_PER_KG = 1e3;
var CHILE_PURCHASE_VAT_RATE = 0.19;
var LIMITS = {
  quantity: 1e5,
  partsPerPlate: 1e3,
  partsPerUnit: 1e3,
  batches: 1e4,
  grams: 1e6,
  hours: 1e4,
  minutes: 1e4,
  money: 1e9,
  marginPct: 90,
  validDays: 365,
  project: 90,
  componentName: 60,
  terms: 250,
  failurePct: 99,
  supervision: 10,
  /** AMS / AMS lite: hasta 4 filamentos por placa (1 principal + 3 adicionales). */
  amsSlots: 4,
  /** Placas distintas de un mismo producto (perfiles de MakerWorld con varias placas). */
  plates: 8,
  /** Texto de trazabilidad de un archivo importado (nombre, versión del laminador, impresora). */
  importText: 120
};
var FIRST_EXTRA_SLOT = 2;
var FIRST_EXTRA_PLATE = 2;
var ROUNDING_STEPS = [0, 10, 100, 500, 1e3];
var FIRST_REVISION2 = 1;
var PROFILE_IDS = {
  cost: "cost-shop",
  pricing: "pricing-shop",
  tax: "tax-shop",
  finishing: "finishing",
  assembly: "assembly"
};
var EXTRA_CODES = { design: "design", packaging: "packaging" };
var TARGET_MARGIN_REASON = "Ajuste en el cotizador";
var DEFAULT_CHANNELS = Object.freeze([
  { id: "direct", name: "Venta directa", kind: "DIRECT", rate: 0, fixed: 0, revision: FIRST_REVISION2 },
  { id: "instagram", name: "Instagram", kind: "INSTAGRAM", rate: 0.03, fixed: 0, revision: FIRST_REVISION2 },
  { id: "web", name: "Tienda web", kind: "WEB", rate: 0.045, fixed: 100, revision: FIRST_REVISION2 },
  { id: "marketplace", name: "Marketplace", kind: "MARKETPLACE", rate: 0.12, fixed: 250, revision: FIRST_REVISION2 }
]);
var MAX_ISSUES_IN_MESSAGE = 3;
var MAX_PATHS_IN_MESSAGE = 2;

// src/modules/quoting/form.ts
var QUOTE_EXTRAS = ["multicolor", "design", "finishing", "assembly", "packing", "planning", "sales"];
var num = (min, max, label) => external_exports.preprocess(
  (value) => typeof value === "string" ? value.trim() === "" ? void 0 : Number(value) : value,
  external_exports.number({ required_error: `Ingresa ${label}.`, invalid_type_error: `Ingresa ${label}.` }).finite(`Ingresa ${label}.`).min(min, `Revisa ${label}.`).max(max, `Revisa ${label}.`)
);
var int = (min, max, label) => num(min, max, label).pipe(external_exports.number().int(`${label}: debe ser un entero.`));
var id = (label) => external_exports.string({ required_error: `Selecciona ${label}.` }).trim().min(1, `Selecciona ${label}.`);
var BaseSchema = external_exports.object({
  clientId: id("un cliente"),
  project: external_exports.string({ required_error: "Indica el nombre de la pieza." }).trim().min(1, "Indica el nombre de la pieza.").max(LIMITS.project),
  machineId: id("una impresora"),
  materialId: id("un filamento"),
  channel: id("un canal de venta"),
  quantity: int(1, LIMITS.quantity, "la cantidad"),
  partsPerPlate: int(1, LIMITS.partsPerPlate, "las piezas por placa"),
  plateWeightGr: num(0, LIMITS.grams, "los gramos de la placa").refine((grams) => grams > 0, "Los gramos de la placa deben ser mayores a 0."),
  plateHours: num(0, LIMITS.hours, "las horas de la placa").refine((hours) => hours > 0, "Las horas de la placa deben ser mayores a 0.")
});
var AMS_EXTRA_SLOTS = Array.from({ length: LIMITS.amsSlots - 1 }, (_, index) => index + FIRST_EXTRA_SLOT);
function parseAmsSlots(raw) {
  const issues = [];
  const slots = [];
  for (const slot of AMS_EXTRA_SLOTS) {
    const material = String(raw[`amsMaterial${String(slot)}`] ?? "").trim();
    const gramsText = String(raw[`amsGrams${String(slot)}`] ?? "").trim();
    if (material === "" && gramsText === "") continue;
    if (material === "") {
      issues.push({ field: `amsMaterial${String(slot)}`, message: `Color ${String(slot)}: elige el filamento.` });
      continue;
    }
    const grams = gramsText === "" ? Number.NaN : Number(gramsText);
    if (!Number.isFinite(grams) || grams <= 0 || grams > LIMITS.grams) {
      issues.push({ field: `amsGrams${String(slot)}`, message: `Color ${String(slot)}: ingresa los gramos por placa (mayor a 0).` });
      continue;
    }
    slots.push({ materialId: material, grams });
  }
  if (issues.length === 0 && slots.length === 0) issues.push({ field: "amsMaterial2", message: "Multicolor: agrega al menos un segundo filamento." });
  return issues.length > 0 ? err(issues) : ok(slots);
}
var EXTRA_PLATE_NUMBERS = Array.from({ length: LIMITS.plates - 1 }, (_, index) => index + FIRST_EXTRA_PLATE);
var FILAMENT_NUMBERS = Array.from({ length: LIMITS.amsSlots }, (_, index) => index + 1);
function parseExtraPlates(raw) {
  const issues = [];
  const plates = [];
  const text2 = (key) => String(raw[key] ?? "").trim();
  for (const n of EXTRA_PLATE_NUMBERS) {
    const key = `plate${String(n)}`;
    if (raw[`${key}Units`] === void 0) continue;
    const units = Number(text2(`${key}Units`));
    if (!Number.isInteger(units) || units < 1 || units > LIMITS.partsPerPlate) {
      issues.push({ field: `${key}Units`, message: `Placa ${String(n)}: indica cu\xE1ntas unidades salen de la placa (entero, 1 o m\xE1s).` });
    }
    const hoursText = text2(`${key}Hours`);
    const hours = hoursText === "" ? Number.NaN : Number(hoursText);
    if (!Number.isFinite(hours) || hours <= 0 || hours > LIMITS.hours) {
      issues.push({ field: `${key}Hours`, message: `Placa ${String(n)}: ingresa el tiempo de Bambu Studio (mayor a 0).` });
    }
    const filaments = [];
    for (const k of FILAMENT_NUMBERS) {
      const material = text2(`${key}Mat${String(k)}`);
      const gramsText = text2(`${key}Grams${String(k)}`);
      if (material === "" && gramsText === "") continue;
      if (material === "") {
        issues.push({ field: `${key}Mat${String(k)}`, message: `Placa ${String(n)}, color ${String(k)}: elige el filamento.` });
        continue;
      }
      const grams = gramsText === "" ? Number.NaN : Number(gramsText);
      if (!Number.isFinite(grams) || grams <= 0 || grams > LIMITS.grams) {
        issues.push({ field: `${key}Grams${String(k)}`, message: `Placa ${String(n)}, color ${String(k)}: ingresa los gramos (mayor a 0).` });
        continue;
      }
      filaments.push({ materialId: material, grams });
    }
    if (filaments.length === 0 && !issues.some((issue2) => issue2.field.startsWith(`${key}Mat`) || issue2.field.startsWith(`${key}Grams`))) {
      issues.push({ field: `${key}Grams1`, message: `Placa ${String(n)}: ingresa los gramos de al menos un filamento.` });
    }
    plates.push({ unitsPerPlate: units, printHours: hours, filaments });
  }
  return issues.length > 0 ? err(issues) : ok(plates);
}
function parseImportedFrom(raw) {
  const text2 = (key) => String(raw[key] ?? "").trim().slice(0, LIMITS.importText);
  const fileName = text2("importFile");
  return fileName === "" ? null : { fileName, slicer: text2("importSlicer"), printer: text2("importPrinter") };
}
function parseLastRun(raw, colors) {
  const text2 = (key) => String(raw[key] ?? "").trim();
  const hoursText = text2("lastRunHours");
  const gramsText = Array.from({ length: colors }, (_, index) => text2(`lastRunGrams${String(index + 1)}`));
  if (hoursText === "" && gramsText.every((value) => value === "")) return ok(null);
  const issues = [];
  const hours = Number(hoursText);
  if (hoursText === "" || !Number.isFinite(hours) || hours <= 0 || hours > LIMITS.hours) {
    issues.push({ field: "lastRunHours", message: "\xDAltima placa: ingresa el tiempo de Bambu Studio (mayor a 0)." });
  }
  const grams = gramsText.map((value, index) => {
    const parsed = value === "" ? 0 : Number(value);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > LIMITS.grams) {
      issues.push({ field: `lastRunGrams${String(index + 1)}`, message: `\xDAltima placa: revisa los gramos del color ${String(index + 1)}.` });
    }
    return parsed;
  });
  if (issues.length === 0 && !grams.some((value) => value > 0)) {
    issues.push({ field: "lastRunGrams1", message: "\xDAltima placa: ingresa los gramos de Bambu Studio." });
  }
  return issues.length > 0 ? err(issues) : ok({ printHours: hours, grams });
}
var ExtraSchemas = {
  design: external_exports.object({ oneOffDesignCost: num(0, LIMITS.money, "el costo del dise\xF1o") }),
  finishing: external_exports.object({ finishingMinutesPerUnit: num(0, LIMITS.minutes, "los minutos de acabado") }),
  assembly: external_exports.object({ assemblyMinutesPerExtraPart: num(0, LIMITS.minutes, "los minutos de ensamblaje") }),
  packing: external_exports.object({ packagingPerUnit: num(0, LIMITS.money, "el embalaje por unidad") }),
  planning: external_exports.object({
    partsPerUnit: int(1, LIMITS.partsPerUnit, "las piezas por producto"),
    batches: int(1, LIMITS.batches, "los lotes de trabajo"),
    extraGrPerPlate: num(0, LIMITS.grams, "el material no incluido")
  }),
  sales: external_exports.object({
    targetMargin: num(0, LIMITS.marginPct, "el margen objetivo"),
    validDays: int(1, LIMITS.validDays, "la validez"),
    terms: external_exports.string().trim().max(LIMITS.terms).default("")
  })
};
function parsePlateComposition(raw, plateCount) {
  const hasAny = Array.from({ length: plateCount }, (_, i) => i + 1).some(
    (n) => ["Name", "Required", "Produced"].some((suffix) => raw[`component${String(n)}${suffix}`] !== void 0)
  );
  if (!hasAny) return ok(null);
  const components = [];
  const issues = [];
  for (let n = 1; n <= plateCount; n++) {
    const prefix = `component${String(n)}`;
    const name = String(raw[`${prefix}Name`] ?? "").trim();
    const requiredText = String(raw[`${prefix}Required`] ?? "").trim();
    const producedText = String(raw[`${prefix}Produced`] ?? "").trim();
    const required2 = requiredText === "" ? Number.NaN : Number(requiredText);
    const produced = producedText === "" ? Number.NaN : Number(producedText);
    if (name.length > LIMITS.componentName) issues.push({ field: `${prefix}Name`, message: `Placa ${String(n)}: nombre demasiado largo.` });
    if (!Number.isSafeInteger(required2) || required2 < 1 || required2 > LIMITS.partsPerPlate)
      issues.push({ field: `${prefix}Required`, message: `Placa ${String(n)}: indica las piezas necesarias por producto.` });
    if (!Number.isSafeInteger(produced) || produced < 1 || produced > LIMITS.partsPerPlate * LIMITS.partsPerPlate)
      issues.push({ field: `${prefix}Produced`, message: `Placa ${String(n)}: indica las piezas impresas en una placa.` });
    if (Number.isSafeInteger(required2) && required2 > 0 && Number.isSafeInteger(produced) && produced > 0) {
      const capacity = Math.floor(produced / required2);
      const savedCapacity = Number(raw[n === 1 ? "partsPerPlate" : `plate${String(n)}Units`]);
      if (capacity < 1 || capacity > LIMITS.partsPerPlate || capacity !== savedCapacity)
        issues.push({ field: `${prefix}Produced`, message: `Placa ${String(n)}: la cantidad impresa no coincide con la capacidad de productos.` });
    }
    components.push({ name, required: required2, produced });
  }
  return issues.length ? err(issues) : ok(components);
}
var issuesOf = (error) => error.issues.map((issue2) => ({ field: issue2.path.map(String).join("."), message: issue2.message }));
function parseQuoteForm(raw, enabled) {
  const active = new Set(enabled);
  const extras = QUOTE_EXTRAS.filter((extra) => active.has(extra));
  const issues = [];
  const base = BaseSchema.safeParse(raw);
  if (!base.success) issues.push(...issuesOf(base.error));
  const parseExtra = (key) => {
    if (!active.has(key)) return null;
    const parsed = ExtraSchemas[key].safeParse(raw);
    if (!parsed.success) {
      issues.push(...issuesOf(parsed.error));
      return null;
    }
    return parsed.data;
  };
  const design = parseExtra("design");
  const finishing = parseExtra("finishing");
  const assembly = parseExtra("assembly");
  const packing = parseExtra("packing");
  const planning = parseExtra("planning");
  const sales = parseExtra("sales");
  let extraFilaments = [];
  if (active.has("multicolor")) {
    const ams = parseAmsSlots(raw);
    if (ams.ok) extraFilaments = ams.value;
    else issues.push(...ams.error);
  }
  const lastRun = parseLastRun(raw, 1 + extraFilaments.length);
  if (!lastRun.ok) issues.push(...lastRun.error);
  const extraPlates = parseExtraPlates(raw);
  if (!extraPlates.ok) issues.push(...extraPlates.error);
  const composition = parsePlateComposition(raw, 1 + (extraPlates.ok ? extraPlates.value.length : 0));
  if (!composition.ok) issues.push(...composition.error);
  if (extraPlates.ok && extraPlates.value.length > 0 && (planning?.partsPerUnit ?? 1) > 1) {
    issues.push({ field: "partsPerUnit", message: "Con varias placas, indica en cada placa cu\xE1ntas unidades salen (deja \xABPiezas por producto\xBB en 1)." });
  }
  if (!base.success || issues.length > 0 || !lastRun.ok || !extraPlates.ok) return err(issues);
  const b = base.data;
  return ok({
    clientId: b.clientId,
    project: b.project,
    machineId: b.machineId,
    materialId: b.materialId,
    channelId: b.channel,
    quantity: b.quantity,
    partsPerPlate: b.partsPerPlate,
    plateWeightGr: b.plateWeightGr,
    plateHours: b.plateHours,
    partsPerUnit: planning?.partsPerUnit ?? 1,
    batches: planning?.batches ?? 1,
    extraGrPerPlate: planning?.extraGrPerPlate ?? 0,
    oneOffDesignCost: design?.oneOffDesignCost ?? null,
    finishingMinutesPerUnit: finishing?.finishingMinutesPerUnit ?? null,
    assemblyMinutesPerExtraPart: assembly?.assemblyMinutesPerExtraPart ?? null,
    packagingPerUnit: packing?.packagingPerUnit ?? null,
    targetMarginPct: sales?.targetMargin ?? null,
    validDays: sales?.validDays ?? null,
    terms: sales === null ? null : sales.terms,
    extras,
    extraFilaments,
    lastRun: lastRun.value,
    extraPlates: extraPlates.value,
    ...composition.ok && composition.value ? { plateComposition: composition.value } : {},
    importedFrom: parseImportedFrom(raw)
  });
}
function toRawForm(state) {
  const raw = {
    clientId: state.clientId,
    project: state.project,
    machineId: state.machineId,
    materialId: state.materialId,
    channel: state.channelId,
    quantity: String(state.quantity),
    partsPerPlate: String(state.partsPerPlate),
    plateWeightGr: String(state.plateWeightGr),
    plateHours: String(state.plateHours),
    partsPerUnit: String(state.partsPerUnit),
    batches: String(state.batches),
    extraGrPerPlate: String(state.extraGrPerPlate)
  };
  const put = (key, value) => {
    if (value !== null) raw[key] = String(value);
  };
  put("oneOffDesignCost", state.oneOffDesignCost);
  put("finishingMinutesPerUnit", state.finishingMinutesPerUnit);
  put("assemblyMinutesPerExtraPart", state.assemblyMinutesPerExtraPart);
  put("packagingPerUnit", state.packagingPerUnit);
  put("targetMargin", state.targetMarginPct);
  put("validDays", state.validDays);
  put("terms", state.terms);
  (state.extraFilaments ?? []).forEach((slot, index) => {
    raw[`amsMaterial${String(index + FIRST_EXTRA_SLOT)}`] = slot.materialId;
    raw[`amsGrams${String(index + FIRST_EXTRA_SLOT)}`] = String(slot.grams);
  });
  if (state.lastRun) {
    raw.lastRunHours = String(state.lastRun.printHours);
    state.lastRun.grams.forEach((grams, index) => {
      raw[`lastRunGrams${String(index + 1)}`] = String(grams);
    });
  }
  ;
  (state.extraPlates ?? []).forEach((plate, index) => {
    const key = `plate${String(index + FIRST_EXTRA_PLATE)}`;
    raw[`${key}Units`] = String(plate.unitsPerPlate);
    raw[`${key}Hours`] = String(plate.printHours);
    plate.filaments.forEach((slot, k) => {
      raw[`${key}Mat${String(k + 1)}`] = slot.materialId;
      raw[`${key}Grams${String(k + 1)}`] = String(slot.grams);
    });
  });
  (state.plateComposition ?? []).forEach((component, index) => {
    const prefix = `component${String(index + 1)}`;
    raw[`${prefix}Name`] = component.name;
    raw[`${prefix}Required`] = String(component.required);
    raw[`${prefix}Produced`] = String(component.produced);
  });
  if (state.importedFrom) {
    raw.importFile = state.importedFrom.fileName;
    raw.importSlicer = state.importedFrom.slicer;
    raw.importPrinter = state.importedFrom.printer;
  }
  return raw;
}

// src/modules/quoting/shop-data.ts
var numeric = () => external_exports.preprocess(
  (value) => value === null ? void 0 : typeof value === "string" ? value.trim() === "" ? void 0 : Number(value) : value,
  external_exports.number({ required_error: "Valor requerido", invalid_type_error: "Debe ser un n\xFAmero" }).finite("Debe ser un n\xFAmero finito")
);
var num2 = (build = (base) => base) => external_exports.preprocess(
  (value) => value === null ? void 0 : typeof value === "string" ? value.trim() === "" ? void 0 : Number(value) : value,
  build(external_exports.number({ required_error: "Valor requerido", invalid_type_error: "Debe ser un n\xFAmero" }).finite("Debe ser un n\xFAmero finito"))
);
var nonNegative = num2((n) => n.min(0));
var revision = external_exports.preprocess((value) => value ?? FIRST_REVISION2, num2((n) => n.int().min(FIRST_REVISION2)));
var BelowMinPolicySchema = external_exports.enum(["WARN", "CAP", "BLOCK"]);
var ShopSettingsSchema = external_exports.object({
  revision,
  targetMargin: num2((n) => n.min(0).max(LIMITS.marginPct)),
  minMargin: num2((n) => n.min(0).max(LIMITS.marginPct)),
  /** D2: régimen EXPLÍCITO (no se deduce de la tasa). La tasa es la del IVA de venta en % (0 si no afecto). */
  taxRegime: external_exports.enum(["VAT_REGISTERED", "NOT_REGISTERED"], { required_error: "Indica el r\xE9gimen tributario", invalid_type_error: "R\xE9gimen tributario inv\xE1lido" }),
  taxRate: num2((n) => n.min(0).max(LIMITS.marginPct)),
  /** El propietario confirmó el régimen (p. ej. «aún no facturo» ⇒ no afecto). Sin confirmar se muestra el aviso. */
  taxRegimeConfirmed: external_exports.boolean().default(false),
  energyPerKwh: nonNegative,
  laborPerHour: nonNegative,
  supervisionFactor: num2((n) => n.min(0).max(LIMITS.supervision)),
  preparationMinutes: num2((n) => n.min(0).max(LIMITS.minutes)),
  packingPerUnit: num2((n) => n.min(0).max(LIMITS.money)),
  failureRate: num2((n) => n.min(0).max(LIMITS.failurePct)),
  priceRounding: numeric().refine((value) => ROUNDING_STEPS.includes(value), "Redondeo no soportado"),
  onBelowMin: BelowMinPolicySchema.default("WARN"),
  validDays: num2((n) => n.int().min(1).max(LIMITS.validDays)),
  terms: external_exports.string().max(LIMITS.terms)
}).refine((settings) => settings.minMargin <= settings.targetMargin, { message: "El margen m\xEDnimo no puede superar al objetivo", path: ["minMargin"] }).refine((settings) => settings.taxRegime === "VAT_REGISTERED" ? settings.taxRate > 0 : settings.taxRate === 0, {
  message: "R\xE9gimen y tasa incoherentes: afecto requiere tasa > 0 y no afecto, tasa 0",
  path: ["taxRate"]
});
var PrinterSchema = external_exports.object({
  id: external_exports.string().min(1),
  name: external_exports.string().min(1),
  technology: external_exports.literal("FDM"),
  purchasePrice: nonNegative,
  residualValue: nonNegative,
  lifeHours: num2((n) => n.positive()),
  averageWatts: nonNegative,
  maintenanceBudget: nonNegative,
  maintenanceHours: num2((n) => n.positive()),
  revision
}).refine((printer) => printer.residualValue <= printer.purchasePrice, { message: "El valor residual no puede exceder el precio", path: ["residualValue"] });
var MaterialSchema = external_exports.object({
  id: external_exports.string().min(1),
  name: external_exports.string().min(1),
  brand: external_exports.string().default(""),
  color: external_exports.string().default(""),
  priceKg: nonNegative,
  revision
});
var ChannelSchema = external_exports.object({
  id: external_exports.string().min(1),
  name: external_exports.string().min(1),
  kind: external_exports.enum(["DIRECT", "INSTAGRAM", "WEB", "MARKETPLACE", "OTHER"]),
  rate: external_exports.number().min(0).lt(1),
  fixed: nonNegative,
  revision
});

// src/modules/quoting/profiles.ts
function zodIssues(prefix, issues) {
  return issues.map((item) => ({ path: [prefix, ...item.path.map(String)].join("."), message: item.message }));
}
function resolveShopProfiles(data) {
  const issues = [];
  const settings = ShopSettingsSchema.safeParse(data.shopSettings);
  if (!settings.success) issues.push(...zodIssues("shopSettings", settings.error.issues));
  const materials = {};
  data.materials.forEach((raw, index) => {
    const parsed = MaterialSchema.safeParse(raw);
    if (!parsed.success) {
      issues.push(...zodIssues(`materials[${String(index)}]`, parsed.error.issues));
      return;
    }
    const m = parsed.data;
    materials[m.id] = { ref: { id: m.id, revision: m.revision }, name: m.name, brand: m.brand, pricePerKg: m.priceKg };
  });
  const machines = {};
  data.printers.forEach((raw, index) => {
    const parsed = PrinterSchema.safeParse(raw);
    if (!parsed.success) {
      issues.push(...zodIssues(`printers[${String(index)}]`, parsed.error.issues));
      return;
    }
    const p = parsed.data;
    machines[p.id] = {
      ref: { id: p.id, revision: p.revision },
      name: p.name,
      purchasePrice: p.purchasePrice,
      residualValue: p.residualValue,
      lifetimeHours: p.lifeHours,
      averageWatts: p.averageWatts,
      maintenanceReservePerHour: p.maintenanceBudget / p.maintenanceHours
    };
  });
  const channels = {};
  (data.channels ?? DEFAULT_CHANNELS).forEach((raw, index) => {
    const parsed = ChannelSchema.safeParse(raw);
    if (!parsed.success) {
      issues.push(...zodIssues(`channels[${String(index)}]`, parsed.error.issues));
      return;
    }
    const c = parsed.data;
    channels[c.id] = { ref: { id: c.id, revision: c.revision }, name: c.name, kind: c.kind, commission: c.rate, fixedFee: c.fixed };
  });
  if (!settings.success || issues.length > 0) return err(issues);
  const s = settings.data;
  const shopRevision = s.revision;
  const registered = s.taxRegime === "VAT_REGISTERED";
  return ok({
    cost: {
      ref: { id: PROFILE_IDS.cost, revision: shopRevision },
      laborPerHour: s.laborPerHour,
      supervisionHoursPerPrintHour: s.supervisionFactor,
      jobSetupMinutes: s.preparationMinutes,
      energyPerKwh: s.energyPerKwh,
      failureRate: s.failureRate / PERCENT,
      packingPerUnit: s.packingPerUnit,
      purchaseAmountsBasis: "GROSS"
    },
    pricing: {
      ref: { id: PROFILE_IDS.pricing, revision: shopRevision },
      targetMargin: s.targetMargin / PERCENT,
      minMargin: s.minMargin / PERCENT,
      onBelowMin: s.onBelowMin,
      roundingStep: s.priceRounding,
      discountTiers: []
    },
    tax: {
      ref: { id: PROFILE_IDS.tax, revision: shopRevision },
      regime: registered ? "VAT_REGISTERED" : "NOT_REGISTERED",
      vatRate: registered ? s.taxRate / PERCENT : 0,
      purchaseVatRate: CHILE_PURCHASE_VAT_RATE,
      customerPriceMode: "GROSS",
      regimeConfirmed: s.taxRegimeConfirmed
    },
    commercial: { validDays: s.validDays, terms: s.terms },
    materials,
    machines,
    channels
  });
}
var purchaseAmount = (amount) => ({ amount, basis: "GROSS", vatRecoverable: true });
var SYSTEM_SERVICES = {
  [PROFILE_IDS.finishing]: {
    ref: { id: PROFILE_IDS.finishing, revision: FIRST_REVISION2 },
    name: "Acabados",
    kind: "STANDARD",
    behavior: "PER_UNIT",
    component: "POSTPROCESS",
    supplyCost: purchaseAmount(0),
    laborMinutes: 0,
    laborKind: "POSTPROCESS",
    defaultRecovery: { recovery: "IN_PRICE" }
  },
  [PROFILE_IDS.assembly]: {
    ref: { id: PROFILE_IDS.assembly, revision: FIRST_REVISION2 },
    name: "Ensamblaje",
    kind: "ASSEMBLY",
    behavior: "PER_EXTRA_PART",
    component: "ASSEMBLY",
    supplyCost: purchaseAmount(0),
    laborMinutes: 0,
    laborKind: "ASSEMBLY",
    defaultRecovery: { recovery: "IN_PRICE" }
  }
};
function toParameterSnapshotRaw(profiles, selection, resolvedAt) {
  const material = profiles.materials[selection.materialId];
  const extraIds = (selection.materialIds ?? []).filter((id2) => id2 !== selection.materialId);
  const extraMaterials = extraIds.map((id2) => profiles.materials[id2]);
  const machine = profiles.machines[selection.machineId];
  const channel = profiles.channels[selection.channelId];
  const issues = [];
  if (material === void 0) issues.push({ path: "materialId", message: "El material ya no existe en el cat\xE1logo" });
  extraIds.forEach((id2, index) => {
    if (extraMaterials[index] === void 0) issues.push({ path: `amsMaterial${String(index + FIRST_EXTRA_SLOT)}`, message: `El material ${id2} ya no existe en el cat\xE1logo` });
  });
  if (machine === void 0) issues.push({ path: "machineId", message: "La impresora ya no existe en el cat\xE1logo" });
  if (channel === void 0) issues.push({ path: "channelId", message: "El canal de venta no existe" });
  if (material === void 0 || machine === void 0 || channel === void 0 || issues.length > 0) return err(issues);
  const materialEntry = (m) => ({
    ref: m.ref,
    name: m.name,
    brand: m.brand.length > 0 ? m.brand : "Sin marca",
    spool: { price: purchaseAmount(m.pricePerKg), netGrams: GRAMS_PER_KG }
  });
  const { cost, pricing, tax } = profiles;
  return ok({
    costProfile: {
      ref: cost.ref,
      labor: { ratePerHour: cost.laborPerHour },
      supervision: { hoursPerPrintHour: cost.supervisionHoursPerPrintHour },
      preparation: { jobSetupMinutes: cost.jobSetupMinutes, plateChangeoverMinutes: 0 },
      energy: { kwhPrice: purchaseAmount(cost.energyPerKwh) },
      materialWaste: { fraction: 0 },
      failure: {
        modelId: "GEOMETRIC_RETRY",
        rate: cost.failureRate,
        costFraction: 1,
        affectedComponents: ["MATERIAL", "ELECTRICITY", "WEAR", "SUPERVISION"]
      },
      auxiliaryCosts: []
    },
    pricingProfile: {
      ref: pricing.ref,
      targetMargin: pricing.targetMargin,
      minMargin: pricing.minMargin,
      onBelowMin: pricing.onBelowMin,
      discountTiers: pricing.discountTiers,
      rounding: pricing.roundingStep === 0 ? { mode: "NONE" } : { mode: "STEP", step: pricing.roundingStep, direction: "UP", target: "GROSS" }
    },
    taxProfile: {
      ref: tax.ref,
      regime: tax.regime,
      vatRate: tax.vatRate,
      purchaseVatRate: tax.purchaseVatRate,
      customerPriceMode: tax.customerPriceMode
    },
    channel: {
      ref: channel.ref,
      name: channel.name,
      kind: channel.kind,
      commission: channel.commission,
      // D6 provisional: cargo fijo y comisión sin IVA (equivalente a la Beta).
      fixedFee: { amount: channel.fixedFee, basis: "GROSS", vatRecoverable: false },
      commissionBase: "NET",
      commissionTax: { vatCharged: false, vatRecoverable: false }
    },
    materials: Object.fromEntries([material, ...extraMaterials.filter((m) => m !== void 0)].map((m) => [m.ref.id, materialEntry(m)])),
    machines: {
      [machine.ref.id]: {
        ref: machine.ref,
        name: machine.name,
        avgPowerW: machine.averageWatts,
        purchasePrice: purchaseAmount(machine.purchasePrice),
        residualValue: purchaseAmount(machine.residualValue),
        lifetimeHours: machine.lifetimeHours,
        maintenanceReservePerHour: machine.maintenanceReservePerHour
      }
    },
    services: SYSTEM_SERVICES,
    resolvedAt,
    currency: "CLP"
  });
}

// src/modules/quoting/mapper.ts
var PLATE_ID = "plate-1";
var plateIdOf = (index) => `plate-${String(index + 1)}`;
function sumByMaterial(slots) {
  const byMaterial = /* @__PURE__ */ new Map();
  for (const slot of slots) byMaterial.set(slot.materialId, (byMaterial.get(slot.materialId) ?? 0) + slot.grams);
  return [...byMaterial.entries()].map(([materialId, grams]) => ({ materialId, grams }));
}
function allMaterialIds(form) {
  const ids = plateFilaments(form).map((f) => f.materialId);
  for (const plate of form.extraPlates ?? []) for (const slot of plate.filaments) if (!ids.includes(slot.materialId)) ids.push(slot.materialId);
  return ids;
}
function remainderParts(form) {
  return form.quantity * form.partsPerUnit % form.partsPerPlate;
}
function lastRunOf(form) {
  const parts = remainderParts(form);
  if (parts === 0 || !form.lastRun) return null;
  const colors = [form.materialId, ...(form.extraFilaments ?? []).map((slot) => slot.materialId)];
  const byMaterial = /* @__PURE__ */ new Map();
  form.lastRun.grams.forEach((grams, index) => {
    const materialId = colors[index];
    if (materialId !== void 0 && grams > 0) byMaterial.set(materialId, (byMaterial.get(materialId) ?? 0) + grams);
  });
  return { parts, filaments: [...byMaterial.entries()].map(([materialId, grams]) => ({ materialId, grams })), printHours: form.lastRun.printHours };
}
function plateFilaments(form) {
  const byMaterial = /* @__PURE__ */ new Map();
  const add = (materialId, grams) => byMaterial.set(materialId, (byMaterial.get(materialId) ?? 0) + grams);
  add(form.materialId, form.plateWeightGr + form.extraGrPerPlate);
  for (const slot of form.extraFilaments ?? []) add(slot.materialId, slot.grams);
  return [...byMaterial.entries()].map(([materialId, grams]) => ({ materialId, grams }));
}
function buildCalculationRequestRaw(form, profiles, resolvedAt) {
  const params = toParameterSnapshotRaw(profiles, { ...form, materialIds: allMaterialIds(form) }, resolvedAt);
  const source = form.importedFrom ? "SLICER_IMPORT" : "MANUAL";
  const multi = (form.extraPlates ?? []).length > 0;
  if (!params.ok) return params;
  const services = [
    { serviceId: PROFILE_IDS.finishing, active: form.finishingMinutesPerUnit !== null, laborMinutes: form.finishingMinutesPerUnit ?? 0 },
    { serviceId: PROFILE_IDS.assembly, active: form.assemblyMinutesPerExtraPart !== null, laborMinutes: form.assemblyMinutesPerExtraPart ?? 0 }
  ];
  const packaging = form.packagingPerUnit ?? profiles.cost.packingPerUnit;
  const extraCosts = [
    {
      code: EXTRA_CODES.packaging,
      label: "Embalaje",
      component: "PACKAGING",
      behavior: "PER_UNIT",
      amount: purchaseAmount(packaging),
      recoveryConfig: { recovery: "IN_PRICE" }
    }
  ];
  if (form.oneOffDesignCost !== null) {
    extraCosts.push({
      code: EXTRA_CODES.design,
      label: "Dise\xF1o 3D personalizado",
      component: "DESIGN",
      behavior: "ONE_OFF",
      // Trabajo propio del taller: el monto digitado ES el costo (sin IVA que agregar ni recuperar).
      amount: { amount: form.oneOffDesignCost, basis: "GROSS", vatRecoverable: false },
      recoveryConfig: { recovery: "SEPARATE_LINE" }
    });
  }
  const overrides = form.targetMarginPct === null ? [] : [{ kind: "TARGET_MARGIN", value: form.targetMarginPct / PERCENT, reason: TARGET_MARGIN_REASON }];
  return ok({
    calculationVersion: CALCULATION_V2,
    mode: "QUOTE",
    input: {
      quantity: form.quantity,
      batches: form.batches,
      plates: [
        {
          id: PLATE_ID,
          label: multi ? "Placa 1" : "Placa principal",
          filaments: plateFilaments(form),
          machineId: form.machineId,
          printHours: form.plateHours,
          partsPerPlate: form.partsPerPlate,
          partsPerUnit: form.partsPerUnit,
          weightIncludesWaste: true,
          source,
          .../* @__PURE__ */ ((last) => last === null ? {} : { lastRun: last })(lastRunOf(form))
        },
        // Placas adicionales: «unidades por placa» = piezas de la placa con 1 pieza por unidad vendida.
        ...(form.extraPlates ?? []).map((plate, index) => ({
          id: plateIdOf(index + FIRST_EXTRA_PLATE - 1),
          label: `Placa ${String(index + FIRST_EXTRA_PLATE)}`,
          filaments: sumByMaterial(plate.filaments),
          machineId: form.machineId,
          printHours: plate.printHours,
          partsPerPlate: plate.unitsPerPlate,
          partsPerUnit: 1,
          weightIncludesWaste: true,
          source
        }))
      ],
      services,
      extraCosts,
      channelId: form.channelId
    },
    params: params.value,
    overrides
  });
}
function buildCalculationRequest(form, profiles, resolvedAt) {
  const raw = buildCalculationRequestRaw(form, profiles, resolvedAt);
  if (!raw.ok) return err({ kind: "PROFILE", issues: raw.error });
  const request = validateCalculationRequest(raw.value);
  if (!request.ok) return err({ kind: "REQUEST", issues: request.error.map((item) => ({ path: item.path, message: item.message })) });
  return ok(request.value);
}

// src/modules/quoting/internal-quote.ts
function issuanceOf(flags, hasCustomerQuote) {
  const reasons = [];
  if (flags.some((flag) => flag.severity === "BLOCKING")) reasons.push("MARGIN_POLICY_BLOCK");
  if (!hasCustomerQuote) reasons.push("MISSING_CUSTOMER_QUOTE");
  return {
    issuable: reasons.length === 0,
    blockingReasons: reasons,
    warnings: flags.filter((flag) => flag.severity !== "INFO").map((flag) => flag.code)
  };
}

// src/modules/quoting/presentation.ts
var FLAG_TEXT = {
  BELOW_TARGET: "El precio queda bajo el margen objetivo.",
  BELOW_MIN: "El margen queda bajo el m\xEDnimo permitido.",
  BLOCKED: "Pol\xEDtica de precios: no se puede emitir al cliente con este margen. Puedes guardarla como borrador.",
  DISCOUNT_CAPPED: "El descuento se limit\xF3 para respetar el margen m\xEDnimo.",
  NEGATIVE_UTILITY: "Con este precio el trabajo pierde dinero.",
  REAL_MARGIN_BELOW_MIN: "Los costos absorbidos dejan el margen real bajo el m\xEDnimo.",
  PRICING_POOL_EMPTY: "No hay costos que cobrar.",
  ASSEMBLY_WITHOUT_EXTRA_PARTS: "Ensamblaje activo, pero el producto tiene una sola pieza (activa \xABPlanificaci\xF3n especial\xBB).",
  OVERRIDE_APPLIED: "Se aplic\xF3 un ajuste particular a esta venta.",
  UNKNOWN_OVERRIDE_TARGET: "Un ajuste no encontr\xF3 a qu\xE9 aplicarse.",
  LAST_PLATE_ESTIMATED: "\xDAltima placa incompleta estimada como placa completa (estimaci\xF3n conservadora). Reb\xE1nala en Bambu Studio e ingresa sus datos para precisar."
};
function flagMessages(flags) {
  return flags.filter((flag) => flag.severity !== "INFO" || flag.code === "BELOW_TARGET").map((flag) => FLAG_TEXT[flag.code] ?? flag.code);
}
function calculationErrorMessage(error) {
  switch (error.code) {
    case "INFEASIBLE_MARGIN":
      return `No hay precio posible: la comisi\xF3n del canal (${(error.effectiveCommission * PERCENT).toFixed(1)} %) m\xE1s el margen (${(error.margin * PERCENT).toFixed(1)} %) llegan o superan el 100 %.`;
    case "NO_FEASIBLE_PRICE":
      return "No existe un precio emitible que respete el margen m\xEDnimo con este redondeo. Revisa el margen m\xEDnimo o el redondeo.";
    case "INVALID_INPUT":
      return `Revisa los datos: ${error.issues.map((item) => item.message).slice(0, MAX_ISSUES_IN_MESSAGE).join(" \xB7 ")}`;
    case "MISSING_PARAMETER":
      return `Falta un par\xE1metro de configuraci\xF3n (${error.path}).`;
    case "INCONSISTENT_SNAPSHOT":
      return `Los perfiles guardados no son coherentes: ${error.detail}`;
    case "UNKNOWN_CALCULATION_VERSION":
      return `Versi\xF3n de c\xE1lculo desconocida: ${error.version}.`;
    case "INTERNAL_INVARIANT":
      return "Error interno del motor de c\xE1lculo. No se puede cotizar con estos datos; rep\xF3rtalo.";
  }
}
var COMPONENT_GROUPS = [
  ["Material", ["MATERIAL"]],
  ["Electricidad", ["ELECTRICITY"]],
  ["Desgaste y mantenimiento de m\xE1quina", ["WEAR"]],
  ["Supervisi\xF3n y preparaci\xF3n", ["SUPERVISION", "SETUP"]],
  ["Fallas esperadas", ["FAILURE"]],
  ["Acabados y ensamblaje", ["POSTPROCESS", "ASSEMBLY"]],
  ["Embalaje", ["PACKAGING"]],
  ["Dise\xF1o \xFAnico", ["DESIGN"]],
  ["Otros", ["AUXILIARY", "SHIPPING", "OTHER"]]
];
function plateData(form, plateId) {
  if (plateId === "plate-1") {
    const grams = form.plateWeightGr + form.extraGrPerPlate + (form.extraFilaments ?? []).reduce((sum, slot) => sum + slot.grams, 0);
    return { hours: form.plateHours, grams };
  }
  const plate = (form.extraPlates ?? [])[Number(plateId.replace("plate-", "")) - FIRST_EXTRA_PLATE];
  return { hours: plate?.printHours ?? 0, grams: (plate?.filaments ?? []).reduce((sum, slot) => sum + slot.grams, 0) };
}
function internalSummary(output, form) {
  const pricing = output.pricing;
  if (pricing === null) return null;
  const items = output.breakdown.items;
  const plates = output.breakdown.platesRequired.reduce((sum, plate) => sum + plate.platesRequired, 0);
  const fullPlates = output.breakdown.platesRequired.reduce((sum, plate) => sum + (plate.fullPlates ?? plate.platesRequired), 0);
  const last = output.breakdown.platesRequired.find((plate) => plate.lastRun !== void 0)?.lastRun;
  const lastRun = last === void 0 ? null : { parts: last.parts, source: last.source };
  let totalHours = 0;
  const plateBreakdown = output.breakdown.platesRequired.map((entry) => {
    const data = plateData(form, entry.plateId);
    const full = entry.fullPlates ?? entry.platesRequired;
    const lastHours = entry.lastRun === void 0 ? 0 : entry.lastRun.source === "SLICED" && entry.plateId === "plate-1" ? form.lastRun?.printHours ?? 0 : data.hours;
    totalHours += full * data.hours + lastHours;
    const directCost = items.filter((item) => item.plateId === entry.plateId || (item.plateId ?? "").startsWith(`${entry.plateId}.`)).reduce((sum, item) => sum + item.amount, 0);
    const label = entry.plateId === "plate-1" ? (form.extraPlates ?? []).length > 0 ? "Placa 1" : "Placa principal" : `Placa ${entry.plateId.replace("plate-", "")}`;
    return { plateId: entry.plateId, label, physical: entry.platesRequired, hoursEach: data.hours, gramsEach: Math.round(data.grams * PERCENT) / PERCENT, directCost };
  });
  const breakdown = COMPONENT_GROUPS.map(([label, components]) => ({
    label,
    amount: items.filter((item) => components.includes(item.component)).reduce((sum, item) => sum + item.amount, 0)
  })).filter((group) => group.amount > 0);
  return {
    grossTotal: pricing.grossTotal,
    netTotal: pricing.netTotal,
    vatTotal: pricing.vatTotal,
    unitPrice: pricing.customerUnitPrice,
    economicCost: output.breakdown.pricingPool,
    absorbedCost: output.breakdown.absorbedCost,
    deferredCost: output.breakdown.deferredCost,
    commission: pricing.commission,
    commercialUtility: pricing.commercialUtility,
    commercialMarginPct: pricing.commercialMargin === null ? null : pricing.commercialMargin * PERCENT,
    realMarginPct: pricing.realMargin === null ? null : pricing.realMargin * PERCENT,
    plates,
    fullPlates,
    lastRun,
    totalPrintHours: Math.round(totalHours * PERCENT) / PERCENT,
    plateBreakdown,
    batches: form.batches,
    discountPct: pricing.discount.applied * PERCENT,
    breakdown,
    floorNetTotal: pricing.floorNetTotal,
    messages: flagMessages(output.flags)
  };
}

// src/core/canonical/constants.ts
var MAX_CANONICAL_DEPTH = 64;

// src/core/canonical/canonical.ts
function isPlainObject(value) {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
function write(value, path, depth, out) {
  if (depth > MAX_CANONICAL_DEPTH) return { code: "TOO_DEEP", path };
  if (value === null) {
    out.push("null");
    return void 0;
  }
  switch (typeof value) {
    case "boolean":
      out.push(value ? "true" : "false");
      return void 0;
    case "number":
      if (!Number.isFinite(value)) return { code: "NON_FINITE_NUMBER", path };
      out.push(Object.is(value, -0) ? "0" : JSON.stringify(value));
      return void 0;
    case "string":
      out.push(JSON.stringify(value));
      return void 0;
    case "object":
      break;
    default:
      return { code: "UNSUPPORTED_VALUE", path };
  }
  if (Array.isArray(value)) {
    const items = value;
    out.push("[");
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const itemPath = `${path}[${String(index)}]`;
      if (item === void 0) return { code: "UNDEFINED_IN_ARRAY", path: itemPath };
      if (index > 0) out.push(",");
      const failure = write(item, itemPath, depth + 1, out);
      if (failure !== void 0) return failure;
    }
    out.push("]");
    return void 0;
  }
  if (!isPlainObject(value)) return { code: "NON_PLAIN_OBJECT", path };
  const record = value;
  out.push("{");
  let first = true;
  for (const key of Object.keys(record).sort()) {
    const entry = record[key];
    if (entry === void 0) continue;
    if (!first) out.push(",");
    first = false;
    out.push(JSON.stringify(key), ":");
    const failure = write(entry, path === "" ? key : `${path}.${key}`, depth + 1, out);
    if (failure !== void 0) return failure;
  }
  out.push("}");
  return void 0;
}
function canonicalize(value) {
  const out = [];
  const failure = write(value, "", 0, out);
  return failure === void 0 ? ok(out.join("")) : err(failure);
}

// src/modules/customer-quote/constants.ts
var CUSTOMER_QUOTE_SCHEMA_VERSION = 1;
var THOUSANDS_GROUP = 3;
var THOUSANDS_SEPARATOR = ".";
var MAX_TEXT_LENGTH = 500;
var MAX_LINES = 50;
var MAX_VALID_DAYS = 365;
var DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
var LEGACY_DEFAULT_VALID_DAYS = 7;

// src/modules/customer-quote/customer-quote.ts
var CUSTOMER_QUOTE_KEYS = [
  "kind",
  "schemaVersion",
  "id",
  "clientName",
  "project",
  "createdAt",
  "validDays",
  "terms",
  "currency",
  "taxTreatment",
  "lines",
  "quantity",
  "unitPrice",
  "vatAmount",
  "total"
];
var isClp2 = (value) => Number.isSafeInteger(value) && value >= 0;
function text(issues, path, value, required2) {
  const trimmed = String(value).trim();
  if (required2 && trimmed.length === 0) issues.push(issue(path, "REQUIRED", "Campo requerido"));
  if (trimmed.length > MAX_TEXT_LENGTH) issues.push(issue(path, "RANGE", "Texto demasiado largo"));
  return trimmed;
}
function buildCustomerQuote(data) {
  const issues = [];
  const id2 = text(issues, "id", data.id, true);
  const clientName = text(issues, "clientName", data.clientName, true);
  const project = text(issues, "project", data.project, true);
  const terms = text(issues, "terms", data.terms, false);
  if (!DATE_PATTERN.test(data.createdAt)) issues.push(issue("createdAt", "FORMAT", "Fecha AAAA-MM-DD"));
  if (!Number.isSafeInteger(data.validDays) || data.validDays < 1 || data.validDays > MAX_VALID_DAYS) {
    issues.push(issue("validDays", "RANGE", `Entre 1 y ${String(MAX_VALID_DAYS)} d\xEDas`));
  }
  if (data.lines.length === 0 || data.lines.length > MAX_LINES) issues.push(issue("lines", "RANGE", "Debe tener entre 1 y 50 l\xEDneas"));
  const lines = data.lines.map((line, index) => {
    const path = `lines[${String(index)}]`;
    const description = text(issues, `${path}.description`, line.description, true);
    if (!Number.isSafeInteger(line.quantity) || line.quantity < 1) issues.push(issue(`${path}.quantity`, "RANGE", "Entero \u2265 1"));
    if (!isClp2(line.unitPrice) || !isClp2(line.total)) issues.push(issue(path, "TYPE", "Montos enteros CLP no negativos"));
    if (line.unitPrice * line.quantity !== line.total) issues.push(issue(path, "INCONSISTENT", "total debe ser cantidad \xD7 precio unitario"));
    return Object.freeze({ description, quantity: line.quantity, unitPrice: line.unitPrice, total: line.total });
  });
  const linesTotal = lines.reduce((sum, line) => sum + line.total, 0);
  if (!isClp2(data.total)) issues.push(issue("total", "TYPE", "Monto entero CLP no negativo"));
  if (data.taxTreatment === "VAT_ADDED") {
    if (data.vatAmount === null || !isClp2(data.vatAmount)) issues.push(issue("vatAmount", "REQUIRED", "IVA requerido cuando se suma al final"));
    else if (linesTotal + data.vatAmount !== data.total) issues.push(issue("total", "INCONSISTENT", "l\xEDneas + IVA debe ser el total"));
  } else {
    if (data.vatAmount !== null) issues.push(issue("vatAmount", "INCONSISTENT", "Solo se informa IVA cuando se suma al final"));
    if (linesTotal !== data.total) issues.push(issue("total", "INCONSISTENT", "Las l\xEDneas deben sumar el total"));
  }
  if (issues.length > 0) return err(issues);
  const main = lines[0];
  if (main === void 0) return err([issue("lines", "RANGE", "Debe tener al menos una l\xEDnea")]);
  const quote = {
    kind: "CustomerQuote",
    schemaVersion: CUSTOMER_QUOTE_SCHEMA_VERSION,
    id: id2,
    clientName,
    project,
    createdAt: data.createdAt,
    validDays: data.validDays,
    terms,
    currency: "CLP",
    taxTreatment: data.taxTreatment,
    lines: Object.freeze(lines),
    quantity: main.quantity,
    unitPrice: main.unitPrice,
    vatAmount: data.vatAmount,
    total: data.total
  };
  return ok(Object.freeze(quote));
}
function formatClp(amount) {
  const sign = amount < 0 ? "-" : "";
  const digits = String(Math.abs(Math.round(amount)));
  let grouped = "";
  for (let index = 0; index < digits.length; index += 1) {
    const fromEnd = digits.length - index;
    grouped += digits[index] ?? "";
    if (fromEnd > 1 && (fromEnd - 1) % THOUSANDS_GROUP === 0) grouped += THOUSANDS_SEPARATOR;
  }
  return `${sign}$${grouped}`;
}
function taxLabel(treatment) {
  if (treatment === "VAT_INCLUDED") return "IVA incluido";
  if (treatment === "VAT_ADDED") return "m\xE1s IVA";
  return "emisor no afecto a IVA";
}
function customerQuoteText(quote) {
  const out = [
    "FORMA STUDIO \xB7 COTIZACI\xD3N",
    `N\xB0: ${quote.id}`,
    `Cliente: ${quote.clientName}`,
    `Proyecto: ${quote.project}`,
    ""
  ];
  for (const line of quote.lines) {
    out.push(`${line.description}: ${String(line.quantity)} \xD7 ${formatClp(line.unitPrice)} = ${formatClp(line.total)}`);
  }
  if (quote.taxTreatment === "VAT_ADDED" && quote.vatAmount !== null) {
    out.push(`Subtotal neto: ${formatClp(quote.total - quote.vatAmount)}`, `IVA: ${formatClp(quote.vatAmount)}`);
  }
  out.push(
    `TOTAL: ${formatClp(quote.total)} (${taxLabel(quote.taxTreatment)})`,
    `Validez: ${String(quote.validDays)} d\xEDas desde ${quote.createdAt}`
  );
  if (quote.terms.length > 0) out.push(quote.terms);
  out.push("", "Gracias por tu inter\xE9s. Sujeto a confirmaci\xF3n antes de iniciar producci\xF3n.");
  return out.join("\n");
}

// src/modules/customer-quote/legacy.ts
function migrateLegacyCustomerQuote(raw, fallbackTerms) {
  if (raw === null || typeof raw !== "object") return err([issue("customerQuote", "TYPE", "Documento comercial ausente")]);
  const record = raw;
  const gross = Number(record.gross);
  const quantity = Number(record.quantity);
  const base = {
    id: String(record.id ?? ""),
    clientName: String(record.clientName ?? ""),
    project: String(record.project ?? ""),
    createdAt: String(record.createdAt ?? ""),
    validDays: Number(record.validDays ?? LEGACY_DEFAULT_VALID_DAYS),
    terms: String(record.terms ?? fallbackTerms),
    taxTreatment: "VAT_INCLUDED",
    vatAmount: null,
    total: gross
  };
  const legacyLines = Array.isArray(record.lines) ? record.lines : [];
  const lines = legacyLines.map((line) => {
    const l = line ?? {};
    const total = Number(l.total);
    const qty = Number(l.quantity);
    return { description: String(l.description ?? ""), quantity: qty, unitPrice: qty > 0 && Number.isSafeInteger(total / qty) ? total / qty : Number.NaN, total };
  });
  const exact = lines.length > 0 ? buildCustomerQuote({ ...base, lines }) : void 0;
  if (exact?.ok) return exact;
  const single = buildCustomerQuote({
    ...base,
    lines: [{ description: `${base.project} (${String(quantity)} unidad(es))`, quantity: 1, unitPrice: gross, total: gross }]
  });
  return single.ok ? ok(single.value) : single;
}

// src/modules/quoting/service.ts
function failureMessage(failure) {
  switch (failure.kind) {
    case "FORM":
      return failure.issues[0]?.message ?? "Revisa los datos del formulario.";
    case "PROFILE":
      return `Configuraci\xF3n del taller inv\xE1lida: ${failure.issues.map((item) => `${item.path} (${item.message})`).slice(0, MAX_PATHS_IN_MESSAGE).join(" \xB7 ")}`;
    case "REQUEST":
      return `Datos no v\xE1lidos para el motor: ${failure.issues.map((item) => `${item.path}: ${item.message}`).slice(0, MAX_PATHS_IN_MESSAGE).join(" \xB7 ")}`;
    case "CALCULATION":
      return calculationErrorMessage(failure.error);
    case "CUSTOMER":
      return "No se pudo armar el documento comercial con estos montos.";
  }
}
var PREVIEW_ID = "VISTA-PREVIA";
var TAX_REGIME_NOTICE = "R\xE9gimen tributario por confirmar: se usa el IVA configurado en el taller. No reemplaza asesor\xEDa tributaria.";
var SEPARATE_LINE_TEXT = {
  [`extra:${EXTRA_CODES.design}`]: "Dise\xF1o 3D personalizado (\xFAnico)"
};
function taxTreatmentOf(profiles) {
  if (profiles.tax.regime === "NOT_REGISTERED") return "NOT_SUBJECT";
  return profiles.tax.customerPriceMode === "GROSS" ? "VAT_INCLUDED" : "VAT_ADDED";
}
function createQuoteService(dependencies) {
  const { calculator: calculator2 } = dependencies;
  function compute(raw, extras, context, documentId) {
    const form = parseQuoteForm(raw, extras);
    if (!form.ok) return err({ kind: "FORM", issues: form.error });
    const profiles = resolveShopProfiles(context.shop);
    if (!profiles.ok) return err({ kind: "PROFILE", issues: profiles.error });
    const request = buildCalculationRequest(form.value, profiles.value, context.resolvedAt);
    if (!request.ok) return err(request.error);
    const output = calculator2.calculate(request.value);
    if (!output.ok) return err({ kind: "CALCULATION", error: output.error });
    const pricing = output.value.pricing;
    const summary = internalSummary(output.value, form.value);
    if (pricing === null || summary === null) return err({ kind: "CALCULATION", error: { code: "INTERNAL_INVARIANT", invariant: "quote.pricing" } });
    const lines = pricing.lines.map((line) => ({
      description: line.kind === "MAIN" ? form.value.project : SEPARATE_LINE_TEXT[line.code] ?? "Servicio adicional",
      quantity: line.quantity,
      unitPrice: line.customerUnitPrice,
      total: line.customerLineTotal
    }));
    const treatment = taxTreatmentOf(profiles.value);
    const customer = buildCustomerQuote({
      id: documentId,
      clientName: context.clientName,
      project: form.value.project,
      createdAt: context.today,
      validDays: form.value.validDays ?? profiles.value.commercial.validDays,
      terms: form.value.terms ?? profiles.value.commercial.terms,
      taxTreatment: treatment,
      lines,
      vatAmount: treatment === "VAT_ADDED" ? pricing.vatTotal : null,
      total: pricing.grossTotal
    });
    if (!customer.ok) return err({ kind: "CUSTOMER", issues: customer.error.map((item) => ({ path: item.path, message: item.message })) });
    const confirmed = profiles.value.tax.regimeConfirmed;
    return ok({
      form: form.value,
      profiles: profiles.value,
      request: request.value,
      output: output.value,
      summary,
      customer: customer.value,
      issuance: issuanceOf(output.value.flags, true),
      taxRegimeConfirmed: confirmed,
      notices: confirmed ? [] : [TAX_REGIME_NOTICE]
    });
  }
  return {
    preview: (raw, extras, context) => compute(raw, extras, context, PREVIEW_ID),
    createDraft(raw, extras, context, options) {
      const computed = compute(raw, extras, context, options.id);
      if (!computed.ok) return computed;
      const preview = computed.value;
      const pricing = preview.output.pricing;
      if (pricing === null) return err({ kind: "CALCULATION", error: { code: "INTERNAL_INVARIANT", invariant: "quote.pricing" } });
      const { profiles, form, request } = preview;
      const material = request.params.materials[form.materialId];
      const machine = request.params.machines[form.machineId];
      if (material === void 0 || machine === void 0) {
        return err({ kind: "CALCULATION", error: { code: "INCONSISTENT_SNAPSHOT", detail: "material o m\xE1quina fuera del snapshot" } });
      }
      const calculation = JSON.parse(JSON.stringify({ request, output: preview.output }));
      const internal = {
        kind: "InternalQuote",
        id: options.id,
        clientId: form.clientId,
        project: form.project,
        quantity: form.quantity,
        status: "Borrador",
        createdAt: context.today,
        events: [
          options.fromQuote === void 0 ? { type: "CREATED", at: context.resolvedAt } : { type: "REVISION_CREATED", at: context.resolvedAt, fromQuote: options.fromQuote }
        ],
        ...options.revisionOf === void 0 ? {} : { revisionOf: options.revisionOf },
        ...options.revision === void 0 ? {} : { revision: options.revision },
        net: pricing.netTotal,
        vat: pricing.vatTotal,
        gross: pricing.grossTotal,
        unitPrice: pricing.customerUnitPrice,
        validDays: preview.customer.validDays,
        terms: preview.customer.terms,
        calculationVersion: request.calculationVersion,
        formState: form,
        inputSnapshot: form,
        calculation,
        profileRefs: {
          cost: profiles.cost.ref,
          pricing: profiles.pricing.ref,
          tax: profiles.tax.ref,
          channel: request.params.channel.ref,
          material: material.ref,
          machine: machine.ref
        },
        taxRegimeConfirmed: preview.taxRegimeConfirmed,
        issuance: preview.issuance,
        customerQuoteId: preview.customer.id
      };
      return ok({ internal, customer: preview.customer, preview });
    },
    replay(internal) {
      const replayed = calculateFromRaw(calculator2, JSON.parse(JSON.stringify(internal.calculation.request)));
      if (!replayed.ok) return err({ kind: "CALCULATION", error: replayed.error });
      const stored = canonicalize(JSON.parse(JSON.stringify(internal.calculation.output)));
      const fresh = canonicalize(JSON.parse(JSON.stringify(replayed.value)));
      if (!stored.ok || !fresh.ok) return err({ kind: "CALCULATION", error: { code: "INTERNAL_INVARIANT", invariant: "replay.canonical" } });
      return ok({ identical: stored.value === fresh.value });
    }
  };
}

// src/app-bridge/beta-bridge.ts
var calculator = createQuoteCalculator();
var quoteService = createQuoteService({ calculator });
var supportedCalculationVersions = calculator.supportedVersions();
export {
  CUSTOMER_QUOTE_KEYS,
  DEFAULT_CHANNELS,
  FLAG_TEXT,
  PREVIEW_ID,
  QUOTE_EXTRAS,
  TAX_REGIME_NOTICE,
  customerQuoteText,
  failureMessage,
  formatClp,
  migrateLegacyCustomerQuote,
  quoteService,
  supportedCalculationVersions,
  taxLabel,
  toRawForm
};
