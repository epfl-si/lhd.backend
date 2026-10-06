import express from "express";
import {ApolloServer} from "@apollo/server";
import {schema} from "./schema/schema";
import {expressMiddleware} from "@as-integrations/express5";
import {authenticateFromBearerToken} from "./lib/authentication";
import { Request } from "express-serve-static-core";
import { ParsedQs } from "qs";
import cors from 'cors';
import {getPrismaForUser} from "./lib/auditablePrisma";
import {getFormattedError} from "./lib/errors";
import {UserInfo} from "./lib/userType";
import {makeRESTFilesAPI} from "../file/files";
import {makeRESTHealthAPI} from "../api/monitoring";
import {redirectToLIL} from "../api/lil";
import fs from "fs/promises";

export async function makeServer() {
  const app = express();

  const server = new ApolloServer({
    schema,
    formatError(formattedError, error: any) {
      console.error('Server error:', error, error.originalError);
      const {errorCode, errorMessage} = getFormattedError(error, formattedError);
      return {extensions: {code: errorCode}, message: errorMessage};
    }
  });
  await server.start();

  app.use(express.json({ limit: '50mb' }));
  app.use(cors());
  app.use('/graphql',
    expressMiddleware(server, {
      context: async ({req}) => {
        const user: UserInfo = await authenticate(req);
        const prisma = getPrismaForUser(user);
        return {prisma, user};
      }
    }));

  app.get('/graphiql', async (req, res) => {
    let html =  await fs.readFile('developer/graphiql.html', 'utf8')
    html = html.replace("@@OIDC_BASE_URL@@", process.env.OIDC_BASE_URL!)
    html = html.replace("@@OIDC_CLIENT_ID@@", process.env.OIDC_CLIENT_ID!)
    res.send(html)
  })

  app.use("/files", makeRESTFilesAPI());
  app.use("/health", makeRESTHealthAPI());
  app.use("/lhd_cosecs/barcodes", redirectToLIL());

  async function authenticate(req: Request<{}, any, any, ParsedQs, Record<string, any>>) {
    return await authenticateFromBearerToken(req);
  }

  return app;
}
