import {UserInfo} from "../../src/lib/userType";
import "dotenv/config";

export const cronUser: UserInfo = {
	userName: 'LHD-cron',
	name: 'LHD-cron',
	userEmail: process.env.CRONJOBS_EMAIL ?? '',
	canEditAuthorizations: true,
	groups: []
};
