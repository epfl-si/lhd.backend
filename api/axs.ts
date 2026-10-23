import express, {Request} from "express";
import {auditAPI, setReqPrismaMiddleware} from "./lib/rest";
import {checkAPICall} from "./lib/checkedAPICalls";
import {roomNameRegexp} from "../src/lib/lhdValidators";
import {getRoomByNameForAxs} from "../src/model/rooms";
import {getHazardLevel} from "../src/lib/hazardsParser";
import {errorHandler} from "./lib/errorHandler";
import {getGroupMembersFromApi} from "../src/lib/callAPI";
import {getBearerToken} from "../src/lib/authentication";
import {Role} from "../generated/prisma";

export function makeRESTAxsAPI() {
	const app = express();

	app.use(restAxsAuthenticate);
	app.use(setReqPrismaMiddleware);
	app.use(auditAPI);

	type GetAXSParams = {room: string};
	app.get("/",
		checkAPICall(
			{
				authorize: (req) => req.user.canListRooms,
				validate: {
					room: roomNameRegexp
				},
				required: {
					room (req) { return req.query.room; },
				}
			}),
		async (req: Request<GetAXSParams>, res) => {
			const roomResult = await getRoomByNameForAxs(req.prisma, req.params.room);

			if (!roomResult) {
				res.json({ lhd_room: null, error: "This room is not in the LHD database" });
				return;
			}

			const exceptions = roomResult.labHasHazardsAdditionalInfo.filter((info: any) => info.hazardsAdditionalInfoHasTag.filter((tags: any) => tags.tag.tagName === 'Exception AxS').length > 0);
			const bioException = exceptions.filter((info: any) => info.hazardCategory.hazardCategoryName === 'Biological').length > 0;
			const laserException = exceptions.filter((info: any) => info.hazardCategory.hazardCategoryName === 'Laser').length > 0;

			const bioLevel = getHazardLevel(roomResult.labHasHazards, 'Biological');
			const laserLevel = getHazardLevel(roomResult.labHasHazards, 'Laser');

			const bioScipers = await getAxsBioRecipients(bioLevel.bio);

			res.json({ lhd_room: {
					room: roomResult.name,
					sciper_prof: [
						...new Set(roomResult.unitHasRoom.flatMap((uhr: any) => uhr.unit.unitHasProfiles.filter((uhp: any) => uhp.role === Role.HeadOfUnit).map((uhp: any) => uhp.person.sciper)))
					],
					sciper_cosec: [
						...new Set(roomResult.unitHasRoom.flatMap((uhr: any) => uhr.unit.unitHasProfiles.filter((uhp: any) => uhp.role === Role.Cosec).map((uhp: any) => uhp.person.sciper)))
					],
					hazard: {
						bio: bioLevel.bio.length > 0 && !bioException,
						nano: false,
						laser: laserLevel.laser.length > 0 && !laserException,
						irad: false,
						chem: false,
						cryo: false,
						elec: false,
						mag: false,
						noise: false,
						gas: false
					},
					training: {
						bio: bioLevel.bio.length > 0 && !bioException,
						nano: false,
						laser: laserLevel.laser.length > 0 && !laserException,
						irad: false,
						chem: false,
						cryo: false,
						elec: false,
						mag: false,
						noise: false,
						gas: false
					},
					med_check:{
						bio: bioLevel.bio.length > 0 && !bioException,
						nano: false,
						laser: false,
						irad: false,
						chem: false,
						cryo: false,
						elec: false,
						mag: false,
						noise: false,
						gas: false
					},
					dsps_signature: {
						bio: bioScipers.length > 0 && !bioException ? bioScipers : false,
						nano: false,
						laser: false,
						irad: false,
						chem: false,
						cryo: false,
						elec: false,
						mag: false,
						noise: false,
						gas: false
					}
				}
			});
		});

	app.use(errorHandler);

	return app;
}

async function getAxsBioRecipients (bio: any[]) {
	if (!bio.length) return [];

	const members = await getGroupMembersFromApi(process.env.AXP_BIO_SIGNATURES_GROUP ?? '');
	return members.members.map((m: { id: any; }) => m.id);
}

function restAxsAuthenticate(req: Request, res: { status: (arg0: number) => void; send: (arg0: string) => void; }, next: () => void) {
	const token = getBearerToken(req);

	if (token === process.env.AXS_TOKEN) {
		req.user = {
			username: 'AXS',
			canListRooms: true
		};
		next();
	} else {
		res.status(403);
		res.send(`Unauthorized`);
		return;
	}
}
