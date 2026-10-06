import {OptimisticLock} from "./optimisticLock";
import {z} from "zod";
import {ValidationError} from "../../api/lib/checkedAPICalls";

export const fileNameRegexp = new RegExp(/^[\p{L}\p{N}, _\-\(\)\.]+\.[A-Za-z0-9]+$/u);
export const organismRegexp = new RegExp("^[a-zA-Z0-9-.,'/_°* ]*$");
export const unitNameRegexp = new RegExp("^[A-Za-z0-9éàèôû *()+_.-]*$");
export const personNameRegexp = new RegExp(/^[\p{L}\p{M} -]+$/u);
export const pathRegexp = new RegExp(/^[\p{L}\p{N}, _\-\(\)\/\.]+\.[A-Za-z0-9]+$/u);

export const saltRegexp = new RegExp("[a-f0-9]+");
export const ephIdRegexp = new RegExp("[a-zA-Z0-9/+=]+");
export const obfuscatedIdValidators = {eph_id: validateEphId, salt: saltRegexp};

export function validateOpLock (i: string) {
	const id = OptimisticLock.getOpLock(i);
	OptimisticLock.checkOpLock(id);
	OptimisticLock.checkSalt(id);
	return i;
}

export function validateEphId (p: any) {
	const decodedEphId = decodeURIComponent(p);
	if (!ephIdRegexp.test(decodedEphId))
		throw new ValidationError(`Failed Regex match`);
	return decodedEphId;
}

export const opLockValidator = z.string().refine((value) => validateOpLock(value))
