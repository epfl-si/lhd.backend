import * as fs from 'fs';
import * as crypto from 'crypto';
import { config } from "./config";

export function decodeMaybeBase64Subject (subject: string): string {
	if (typeof subject === 'string' && subject.substring(0, 10) === '=?UTF-8?B?') {
		try {
			return Buffer.from(subject.substring(10), 'base64').toString('utf8');
		} catch (e) {
			return subject;
		}
	}
	return subject;
}

export function firstOrNull<T>(a: T[] | null | undefined): T | null {
	return (!a || a.length === 0) ? null : a[0];
}

export function indent(message: string, indent_spaces: number, extra_prefix=''): string {
  if (indent_spaces == 0 && extra_prefix == '') return message;
  const prefix = Array(indent_spaces + 1).join(' ') + extra_prefix;
	return message.split('\n').map((l) => prefix + l).join('\n');
}

export function logger(message: any, level: number, indent_spaces = 0) {
  const msg = (typeof (message) === 'string') ? message : JSON.stringify(message);
  if (level <= config.DEBUG) console.log(indent(message, indent_spaces));
}

// Compares two files by size + content
export function areFilesIdentical(f1: string, f2: string): boolean {
	try {
		const s1 = fs.statSync(f1).size;
		const s2 = fs.statSync(f2).size;
		if (s1 !== s2) return false;

		const hash = (f: string) => crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex');
		if (hash(f1) !== hash(f2)) return false;

		return true;
	} catch (e) {
		return false;
	}
}

export function randomHex(nbytes: number): string {
	return crypto.randomBytes(nbytes).toString('hex');
}

export function todayStamp (): string {
	// mirrors PHP's date("Y-m-d-hm")
	const d = new Date();
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}
