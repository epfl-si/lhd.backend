import {decrypt, encrypt, generateSalt, getSHA256} from "./hashingTools";

export class Data {
	id: number;
	obj: { [key: string]: any };
}

export type OpLock = {
	salt: string,
	eph_id: string
}

export type submission = {
	opLock: OpLock,
	submission: { data: object },
	formName?: string,
	children?: submission[]
}

export class OptimisticLock {

	static obfuscate (data: Data) {
		const salt = generateSalt();
		const eph_id = this.generateId(data.id, JSON.stringify(data.obj), salt);
		return { salt: salt, eph_id: eph_id };
	}

	static generateId (id: number, parentString: string, salt: string) {
		return encrypt(salt + ':' + id) + '-' + getSHA256(parentString, salt);
	}

	static checkOpLock (opLock: { salt: any; eph_id: any; } | undefined) {
		if (opLock == undefined || opLock.eph_id == undefined || opLock.eph_id == '' || opLock.salt == undefined || opLock.salt == '') {
			throw new Error(`Not allowed to update`);
		}
	}

	static checkSalt (s: OpLock) {
		const salt = s.salt;
		const firstPart = s.eph_id.substring(0,s.eph_id.indexOf('-'));
		const decrypted = decrypt(firstPart);
		const decryptedSalt = decrypted.substring(0,decrypted.indexOf(':'));
		if (salt != decryptedSalt) {
			throw new Error(`Bad descrypted request`);
		}
	}

	static deobfuscateId (opLock: OpLock) {
		const firstPart = opLock.eph_id.substring(0,opLock.eph_id.indexOf('-'));
		const decrypted = decrypt(firstPart);
		return parseInt(decrypted.substring(decrypted.indexOf(':')+1));
	}

	static getDataSHA256 (s: OpLock) {
		return s.eph_id.substring(s.eph_id.indexOf('-')+1);
	}

	static getOpLock (opLock: string | undefined) {
		if (!opLock) {
			throw new Error(`Not allowed to update`);
		}
		return JSON.parse(opLock);
	}

	static getIdDeobfuscated (opLock: OpLock) {
		OptimisticLock.checkOpLock(opLock);
		OptimisticLock.checkSalt(opLock);
		return OptimisticLock.deobfuscateId(opLock);
	}

	static async ensureDBObjectIsTheSame (argOpLock: string | undefined,
																				modelName: string,
																				idName: string,
																				tx: any,
																				objectName: string,
																				convertObjectToString: (obj: any) => any
	) {
		const opLock = this.getOpLock(argOpLock);
		OptimisticLock.checkOpLock(opLock);
		return await this.getObjectByObfuscatedId(opLock, modelName, idName, tx, objectName, convertObjectToString);
	}

	static async getObjectByObfuscatedId (opLock: OpLock,
																			 modelName: string,
																			 idName: string,
																			 tx: any,
																			 objectName: string,
																			 convertObjectToString: (obj: any) => any) {
		OptimisticLock.checkSalt(opLock);
		const idDeobfuscated = OptimisticLock.deobfuscateId(opLock);
		const obj = await tx[modelName].findUnique({where: {[idName]: idDeobfuscated}});
		if (! obj) {
			throw new Error(`${objectName} not found.`);
		}
		const object =  getSHA256(JSON.stringify(convertObjectToString(obj)), opLock.salt);
		if (OptimisticLock.getDataSHA256(opLock) !== object) {
			throw new Error(`${objectName} has been changed from another user. Please reload the page to make modifications`);
		}
		return obj;
	}

	static async createOpLock (parentId: number, obj: { [key: string]: any }) {
		const encryptedID = OptimisticLock.obfuscate({id: parentId, obj: obj});
		return JSON.stringify(encryptedID);
	}
}

