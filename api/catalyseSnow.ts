import express, {Request} from "express";
import {auditAPI, setReqPrismaMiddleware} from "./lib/rest";
import {checkAPICall} from "./lib/checkedAPICalls";
import {
	reqRegexp,
	reqRenewRegexp, roomNameRegexp,
	unitNameRegexp,
	validateCASList,
	validateCommaSeparatedNumbers
} from "../src/lib/lhdValidators";
import {todayDate} from "../src/lib/date";
import {
	createAuthorization,
	getAuthorizations,
	getTheAuthorization, setAuthorizationRelations,
	updateAuthorization
} from "../src/model/authorization";
import {getBearerToken} from "../src/lib/authentication";
import {errorHandler} from "./lib/errorHandler";
import {getChemicals} from "../src/model/chemicals";
import {AuthChem} from "../generated/prisma";
import {getRooms} from "../src/model/rooms";
import {getUnitByName} from "../src/model/units";
import {Role} from "../generated/prisma";
import {ensurePerson} from "../src/model/persons";

export function makeRESTAPI() {
	const app = express();

	app.use(restAuthenticateBearer);
	app.use(setReqPrismaMiddleware);
	app.use(auditAPI);

	type AuthReqParams = {id_unit: number, req: string, date: Date, scipers: number[], cas: string[], room_ids: number[]};
	app.post<AuthReqParams>("/auth_req",
		checkAPICall(
			{
				authorize: (req) => req.user.canEditAuthorizations,
				required: {
					req (req) { return req.query.req; },
					date (req) { return req.query.date; },
					id_unit (req) { return req.query.id_unit; },
					room_ids (req) { return req.query.room_ids },
					scipers (req) { return req.query.scipers },
					cas (req) { return req.query.cas },
				},
				validate: {
					req: reqRegexp,
					date: Date,
					id_unit: Number,
					room_ids: validateCommaSeparatedNumbers,
					scipers: validateCommaSeparatedNumbers,
					cas: validateCASList
				}
			}),
		async (req, res) => {
			const exp = new Date(req.params.date);
			exp.setHours(12, 0, 0, 0);
			const changes = {
				cas: req.params.cas.map(c => {
					return {name: c, status: "New"};
				}),
				holders: req.params.scipers.map(sc => {
					return {sciper: sc, status: "New"};
				}),
				rooms: req.params.room_ids.map(r => {
					return {id: r, status: "New"};
				}),
			}
			await ensurePerson(req.prisma, changes.holders);
			await req.prisma.$transaction(async (tx: any) => {
				const authorization = await createAuthorization (tx, req.params.req, "Active", todayDate(), exp, "Chemical", req.params.id_unit);
				await setAuthorizationRelations(tx, Number(authorization.idAuthorization), changes);
			});
			res.json({Message: "Ok"});
		}
	);

	app.post<{req: string, date: Date}>("/auth_renew",
		checkAPICall(
			{
				authorize: (req) => req.user.canEditAuthorizations,
				required: {
					req (req) { return req.query.req; },
					date (req) { return req.query.date; }
				},
				validate: {
					req: reqRenewRegexp,
					date: Date
				}
			}),
		async (req, res) => {
			const reqParts = req.params.req.split("-");
			const requestNumber = `${reqParts[0]}-${reqParts[1]}`;
			const auth = await getTheAuthorization(req.prisma, requestNumber, "Chemical");
			const exp = new Date(req.params.date);
			exp.setHours(12, 0, 0, 0);
			const argsUpdate = {
				expirationDate: exp,
				status: "Active",
				renewals: parseInt(reqParts[2])
			};
			await updateAuthorization(req.prisma, argsUpdate, auth)
			res.json({Message: "Ok"});
		}
	);

	app.get<{cas?: string[]}>("/get_chem",
		checkAPICall(
			{
				authorize: (req) => req.user.canListChemicals,
				validate: {
					cas: validateCASList
				},
				optional: {
					cas (req) { return req.query.cas; },
				}
			}),
		async (req, res) => {
			const resultNew = await getChemicals(req.prisma);
			const all = resultNew.chemicals.map((chem: AuthChem) => {
				return {
					cas_auth_chem: chem.casAuthChem,
					auth_chem_en: chem.authChemEn,
					flag_auth_chem: chem.flagAuthChem,
					auth_code: chem.authCode,
					fastway: chem.fastway
				}
			});
			if ( req.params.cas ) {
				const data = all.filter((chem: { cas_auth_chem: string; }) => req.params.cas!.includes(chem.cas_auth_chem));
				res.json({Message: "Ok", Data: data});
			} else {
				res.json({Message: "Ok", Data: all});
			}
		});

	app.get<{cas: string[], sciper: Number}>("/auth_check",
		checkAPICall(
			{
				authorize: (req) => req.user.canListAuthorizations,
				required: {
					sciper (req) { return req.query.sciper },
					cas (req) { return req.query.cas },
				},
				validate: {
					sciper: Number,
					cas: validateCASList
				}
			}),
		async (req, res) => {
			const result = await getAuthorizations(req.prisma, "Chemical", {holder: `${req.params.sciper}`});
			const casResult = result.authorizations
				.filter((auth: { expirationDate: Date; }) => auth.expirationDate > new Date())
				.flatMap((auth: { authorizationHasChemical: any; }) => auth.authorizationHasChemical)
				.flatMap((auth: { chemical: AuthChem; }) => auth.chemical)
				.filter((chem: { flagAuthChem: number; }) => chem.flagAuthChem == 1)
				.flatMap((cas: { casAuthChem: string; }) => cas.casAuthChem);
			const casAuth: Record<string, number> = {};
			req.params.cas.forEach(c => {
				if ( casResult.includes(c) ) {
					casAuth[c] = 1;
				} else {
					casAuth[c] = 0;
				}
			})
			res.json({Message: "Ok", Data: [casAuth]});
		});

	app.get<{unit?: string, room?: string}>("/get_labs_and_units",
		checkAPICall(
			{
				authorize: (req) => req.user.canListRooms,
				validate: {
					unit: unitNameRegexp,
					room: roomNameRegexp
				},
				optional: {
					unit (req) { return req.query.unit; },
					room (req) { return req.query.room; },
				}
			}),
		async (req, res) => {
			const resultNew = await getRooms(req.prisma, {unit: req.params.unit, room: req.params.room});

			const all = resultNew.rooms.map((r: { id: any; unitHasRoom: any[]; name: any; }) => {
				return {
					idLab: r.id,
					units: req.params.unit ? r.unitHasRoom.filter(uhr =>  uhr.unit.name === req.params.unit).map(uhr => uhr.idUnit) : r.unitHasRoom.map(uhr => uhr.idUnit),
					labDisplay: r.name
				}
			});
			const flattened = all.flatMap((item: { units: any[]; idLab: any; labDisplay: any; }) =>
				item.units.map(unit => ({
					id_lab: item.idLab,
					id_unit: unit,
					lab_display: item.labDisplay
				}))
			);
			res.json({Message: "Ok", Data: flattened});
		});

	app.get<{unit?: string}>("/get_profs_and_cosecs",
		checkAPICall(
			{
				authorize: (req) => req.user.canListUnits,
				validate: {
					unit: unitNameRegexp,
				},
				optional: {
					unit (req) { return req.query.unit; },
				}
			}),
		async (req, res) => {
			const resultNew = await getUnitByName(req.prisma, req.params.unit ? `${req.params.unit}*` : '');
			const list = resultNew.map((unit: { unitHasProfiles: any[]; unitHasRoom: { idLab: number; }[]; institute: { school: { name: string; }; name: string; }; name: string; id: number; }) => {
				const cosecs = unit.unitHasProfiles.filter((prof: { role: string; }) => prof.role === Role.Cosec).map((uhc: { person: { sciper: number; }; }) => uhc.person.sciper);
				const profs = unit.unitHasProfiles.filter((prof: { role: string; }) => prof.role === Role.HeadOfUnit).map((uhc: { person: { sciper: number; }; }) => uhc.person.sciper);
				const rooms = unit.unitHasRoom.map((uhr: { idLab: any; }) => uhr.idLab);
				return {
					sciper_cosec: cosecs,
					sciper: profs,
					unit: `${unit.institute.school.name} ${unit.institute.name} ${unit.name}`,
					id_unit: unit.id,
					rooms: rooms
				};
			});
			const result = list.filter((val: { rooms: any[]; }) => val.rooms.length > 0).map((value: { unit: string; id_unit: number; sciper: string[]; sciper_cosec: string[]; }) => {
				return {unit: value.unit, id_unit: value.id_unit, sciper: value.sciper.join(','), sciper_cosec: value.sciper_cosec.join(',')}
			});
			res.json({Message: "Ok", Data: result});
		});

	app.use(errorHandler);

	return app;
}

const snowApiUser = {
	username: 'SNOW',
	canListRooms: true,
	canListUnits: true,
	canListChemicals: true,
	canEditChemicals: true,
	canEditAuthorizations: true
}

const catalyseApiUser = {
	username: 'CATALYSE',
	canListAuthorizations: true
}

function restAuthenticateBearer(req: Request, res: { status: (arg0: number) => void; send: (arg0: string) => void; }, next: () => void) {
	const token = getBearerToken(req);

	if (token === process.env.SNOW_TOKEN) {
		req.user = snowApiUser;
		next();
	} else if (token === process.env.CATALYSE_TOKEN) {
		req.user = catalyseApiUser;
		next();
	} else {
		res.status(403);
		res.send(`Unauthorized`);
		return;
	}
}
