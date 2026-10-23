export function splitCamelCase(str: string) {
	const label = str.replace(/([a-z])([A-Z])/g, '$1 $2') // Insert a space between lowercase and uppercase letters
	const txt = label.charAt(0).toUpperCase() + label.slice(1);
	return txt.replaceAll('_', ' ');
}

export const toDateString = (d: Date) => d.toISOString().slice(0, 10);
