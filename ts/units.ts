/**
 * Lightweight unit conversion module for distance units.
 * Replaces the math.js dependency with only the functionality used by trackTS.
 */

/** Conversion factors to meters for all supported distance units. */
const UNIT_TO_METERS: Record<string, number> = {
	// Base SI
	m: 1,
	meter: 1,
	meters: 1,
	// SI prefixes
	Ym: 1e24,
	Zm: 1e21,
	Em: 1e18,
	Pm: 1e15,
	Tm: 1e12,
	Gm: 1e9,
	Mm: 1e6,
	km: 1e3,
	hm: 1e2,
	dam: 1e1,
	dm: 1e-1,
	cm: 1e-2,
	mm: 1e-3,
	um: 1e-6,
	nm: 1e-9,
	pm: 1e-12,
	fm: 1e-15,
	am: 1e-18,
	zm: 1e-21,
	ym: 1e-24,
	// Word-form SI prefixes
	yottameter: 1e24,
	zettameter: 1e21,
	exameter: 1e18,
	petameter: 1e15,
	terameter: 1e12,
	gigameter: 1e9,
	megameter: 1e6,
	kilometer: 1e3,
	hectometer: 1e2,
	decameter: 1e1,
	decimeter: 1e-1,
	centimeter: 1e-2,
	millimeter: 1e-3,
	micrometer: 1e-6,
	nanometer: 1e-9,
	picometer: 1e-12,
	femtometer: 1e-15,
	attometer: 1e-18,
	zeptometer: 1e-21,
	yoctometer: 1e-24,
	// Imperial / US customary
	in: 0.0254,
	inch: 0.0254,
	inches: 0.0254,
	ft: 0.3048,
	foot: 0.3048,
	feet: 0.3048,
	yd: 0.9144,
	yard: 0.9144,
	yards: 0.9144,
	mi: 1609.344,
	mile: 1609.344,
	miles: 1609.344,
	// Survey units
	li: 0.201168,
	link: 0.201168,
	links: 0.201168,
	rd: 5.0292,
	rod: 5.0292,
	rods: 5.0292,
	ch: 20.1168,
	chain: 20.1168,
	chains: 20.1168,
	// Other
	angstrom: 1e-10,
	mil: 2.54e-5,
};

/** Canonical abbreviation for display, keyed by normalized unit name. */
const CANONICAL_ABBR: Record<string, string> = {
	m: 'm',
	meter: 'm',
	meters: 'm',
	km: 'km',
	kilometer: 'km',
	cm: 'cm',
	centimeter: 'cm',
	mm: 'mm',
	millimeter: 'mm',
	um: 'um',
	micrometer: 'um',
	nm: 'nm',
	nanometer: 'nm',
	pm: 'pm',
	picometer: 'pm',
	dm: 'dm',
	decimeter: 'dm',
	dam: 'dam',
	decameter: 'dam',
	hm: 'hm',
	hectometer: 'hm',
	Mm: 'Mm',
	megameter: 'Mm',
	Gm: 'Gm',
	gigameter: 'Gm',
	Tm: 'Tm',
	terameter: 'Tm',
	Pm: 'Pm',
	petameter: 'Pm',
	Em: 'Em',
	exameter: 'Em',
	Zm: 'Zm',
	zettameter: 'Zm',
	Ym: 'Ym',
	yottameter: 'Ym',
	fm: 'fm',
	femtometer: 'fm',
	am: 'am',
	attometer: 'am',
	zm: 'zm',
	zeptometer: 'zm',
	ym: 'ym',
	yoctometer: 'ym',
	in: 'in',
	inch: 'in',
	inches: 'in',
	ft: 'ft',
	foot: 'ft',
	feet: 'ft',
	yd: 'yd',
	yard: 'yd',
	yards: 'yd',
	mi: 'mi',
	mile: 'mi',
	miles: 'mi',
	li: 'li',
	link: 'li',
	links: 'li',
	rd: 'rd',
	rod: 'rd',
	rods: 'rd',
	ch: 'ch',
	chain: 'ch',
	chains: 'ch',
	angstrom: 'angstrom',
	mil: 'mil',
};

function resolveUnit(name: string): { factor: number; canonical: string } {
	const trimmed = name.trim();
	const factor = UNIT_TO_METERS[trimmed];
	if (factor !== undefined) {
		return { factor, canonical: CANONICAL_ABBR[trimmed] || trimmed };
	}
	throw new Error(`Unknown unit: ${trimmed}`);
}

export class PhysicsUnit {
	readonly value: number | null;
	readonly units: Array<{ unit: { name: string } }>;
	private readonly _unitName: string;
	private readonly _factor: number;

	constructor(value: number | null, unitName: string) {
		const resolved = resolveUnit(unitName);
		this.value = value;
		this._unitName = resolved.canonical;
		this._factor = resolved.factor;
		this.units = [{ unit: { name: this._unitName } }];
	}

	/** Convert to a different unit. */
	to(targetUnit: string): PhysicsUnit {
		if (this.value === null) {
			return new PhysicsUnit(null, targetUnit);
		}
		const target = resolveUnit(targetUnit);
		const meters = this.value * this._factor;
		const converted = meters / target.factor;
		return new PhysicsUnit(converted, targetUnit);
	}

	/** Get the numeric value in a specific unit. */
	toNumber(targetUnit: string): number {
		const converted = this.to(targetUnit);
		return converted.value ?? 0;
	}

	toString(): string {
		if (this.value === null) return this._unitName;
		return `${this.value} ${this._unitName}`;
	}
}

/**
 * Parse a string like "5 m", "2.3ft", "100 cm" into a PhysicsUnit.
 * Also handles bare unit names like "m" (value = 1).
 */
export function unit(expression: string): PhysicsUnit {
	const trimmed = expression.trim();

	// Try parsing as "number unit" (e.g., "5 m", "2.3ft", "1e-3 km")
	const match = trimmed.match(/^([+-]?\d+\.?\d*(?:[eE][+-]?\d+)?)\s*(.+)$/);
	if (match) {
		const value = parseFloat(match[1]);
		const unitName = match[2].trim();
		if (Number.isNaN(value)) throw new Error(`Invalid value in expression: ${expression}`);
		resolveUnit(unitName); // validate
		return new PhysicsUnit(value, unitName);
	}

	// Try as bare unit name (implicit value of 1)
	resolveUnit(trimmed); // validate
	return new PhysicsUnit(1, trimmed);
}

/** Multiply a number by a PhysicsUnit (scales the value). */
export function multiply(a: number, b: PhysicsUnit | number): PhysicsUnit | number {
	if (typeof b === 'number') return a * b;
	return new PhysicsUnit((b.value ?? 0) * a, b.units[0].unit.name);
}

/** Divide a PhysicsUnit or number by a number. */
export function divide(a: PhysicsUnit | number, b: number): PhysicsUnit | number {
	if (typeof a === 'number') return a / b;
	return new PhysicsUnit((a.value ?? 0) / b, a.units[0].unit.name);
}

/** Format a PhysicsUnit to a display string, optionally with precision control. */
export function format(value: PhysicsUnit, options?: { notation?: string; precision?: number }): string {
	if (value.value === null) return value.toString();
	const precision = options?.precision ?? 14;
	const num = parseFloat(value.value.toPrecision(precision));
	return `${num} ${value.units[0].unit.name}`;
}
