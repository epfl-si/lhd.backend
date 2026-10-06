import express from "express";
import {Request} from "express";
import {OpLock} from "../src/lib/optimisticLock";
import {getBioOrgOriginalObject} from "../src/schema/types/bioOrg";
import {authenticateFromBearerToken} from "../src/lib/authentication";
import {checkAPICall} from "../api/lib/checkedAPICalls";
import {sendFileResponse} from "../src/lib/fileUtilities";
import {errorHandler} from "../api/lib/errorHandler";
import {setReqPrismaMiddleware} from "../api/lib/rest";
import {obfuscatedIdValidators} from "../src/lib/lhdValidators";

const obfuscatedIdParams = {
	eph_id (req: any) { return req.params.eph_id },
	salt (req: any) { return req.query.salt }
};

export function makeRESTFilesAPI() {
	const app = express();

	app.use(restFilesAuthenticate);
	app.use(setReqPrismaMiddleware);

	type GetFile = {salt: string, eph_id: string, fileName?: string};

	app.get("/organism/:eph_id",
		checkAPICall(
			{
				authorize: (req) => req.user.canListOrganisms,
				required: {
					...obfuscatedIdParams,
				},
				validate: {
					...obfuscatedIdValidators,
				}
			}),
		async (req: Request<GetFile>, res) => {
			const opLock: OpLock = {salt: req.params.salt, eph_id: req.params.eph_id};
			const org = await getBioOrgOriginalObject(req.prisma, JSON.stringify(opLock), 'organism');
			sendFileResponse(org.filePath, res);
		});

	app.use(errorHandler);

	return app;
}

async function restFilesAuthenticate(req: Request, res: any, next: any) {
	req.user = await authenticateFromBearerToken(req);

	next();
}
