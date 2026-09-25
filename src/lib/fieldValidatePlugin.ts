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
