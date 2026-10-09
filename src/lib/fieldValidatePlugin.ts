export function sanitizeBase64DataUrl(value: string) {
	const prefixMatch = value.match(/^data:[^;]+;base64,/);
	if (!prefixMatch)
		return false;

	const b64 = value.slice(prefixMatch[0].length);

	// length must be a multiple of 4
	if (b64.length === 0 || b64.length % 4 !== 0)
		return false;

	// no backtracking risk: single linear scan, no nested/alternating quantifiers
	if (!/^[A-Za-z0-9+/]*={0,2}$/.test(b64))
		return false;

	// '=' only allowed as the last 1-2 characters
	const firstEq = b64.indexOf('=');
	if (firstEq !== -1 && firstEq < b64.length - 2)
		return false;

	return true;
}

export function sanitizeObject (obj: any, spec: {[k: string]: {	rename ?: string,
		validate?: RegExp | ((value: string) => any) | {enum: string[]},
		optional?: boolean
	}}) {
	const ret: any = {};
	const errors: any[] = [];

	const objKeys = Object.keys(obj);
	objKeys.forEach(key => {
		if (! spec[key]) return;  // key is now trusted

		const validator = spec[key].validate;
		const renamedKey = spec[key].rename ?? key;
		if (validator) {
			if (spec[key].optional && !obj[key]) return;  // No error, the field is undefined as it's optional

			if (validator instanceof RegExp) {
				const matched = obj[key].match(validator)
				if (matched) {
					ret[renamedKey] = matched[0];
				} else {
					errors.push(key);
				}
			} else if (validator instanceof Function) {
				try {
					ret[renamedKey] = validator(obj[key]);
				} catch (e) {
					errors.push(key);
				}
			} else if (isCustomEnumerator(validator)) {
				try {
					ret[renamedKey] = acceptEnum(obj[key], validator.enum);
				} catch (e) {
					errors.push(key);
				}
			}
		}
	})
	if (errors.length) throw new Error(errors.join(', '));

	return ret;
}

export const acceptEnum = (i: string, availableItems: string[]) => {
	if (!availableItems.includes(i)) throw new Error(`Not in ${availableItems.join(', ')}`);
	return i;
}

const isCustomEnumerator = (value: any) => {
	return (
		typeof value === "object" &&
		value !== null &&
		"enum" in value &&
		Array.isArray((value as any).enum)
	)
}

export const acceptNumberFromString = (i: string) => {
	if (!i || isNaN(parseFloat(i))) throw new Error(`Bad type: ${typeof(i)}, expected number`);
	return parseFloat(i);
}
