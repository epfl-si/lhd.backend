import {Request} from "express";
import {getPrismaForUser} from "../../src/lib/auditablePrisma";
import {getNow} from "../../src/lib/date";

export function auditAPI (req: any, res: any, next: any) {
	console.log(`API CALL - [${getNow()}] - ${req.method} - ${req.protocol}://${req.hostname}${req.originalUrl}`);

	next();
}

/**
 * Express middleware that attaches a user-scoped Prisma client to the request.
 *
 * This middleware creates a Prisma client using the currently authenticated
 * user (`req.user`) and stores it on `req.prisma`, making it available to all
 * downstream route handlers and middleware.
 *
 * The Prisma client is configured using environment-based backend config and
 * includes any user-specific behavior such as mutation auditing.
 *
 * @param req - Express request object; must contain an authenticated `user`.
 * @param _res - Express response object (unused).
 * @param next - Callback to pass control to the next middleware.
 */
export function setReqPrismaMiddleware (req: Request, _res: any, next: any) {
	req.prisma = getPrismaForUser(req.user);

	next();
}
