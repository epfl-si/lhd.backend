import SchemaBuilder from "@pothos/core";
import PrismaPlugin from "@pothos/plugin-prisma";
import PrismaTypes, {getDatamodel} from "../../generated/pothos-prisma-types";
import {prisma} from "./prisma";
import ValidationPlugin from '@pothos/plugin-validation';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import {DateTimeResolver} from "graphql-scalars";

type BooleanKeys<T> = {
  [K in keyof T]-?: NonNullable<T[K]> extends boolean ? K : never
}[keyof T];

export const builder = new SchemaBuilder<{
  PrismaTypes: PrismaTypes; // This gives the builder all the type information about your prisma schema
  AuthScopes: {
    needPermission: BooleanKeys<UserInfo>;
  };
  Scalars: {
    DateTime: {
      Input: Date;
      Output: Date;
    };
  };
}>({
  plugins: [PrismaPlugin, ValidationPlugin, ScopeAuthPlugin],
  prisma: {
    client: prisma,
    // This give pothos information about your tables, relations, and indexes to help it generate optimal queries at runtime.
    // This used to be attached to the prisma client, but has been removed in most runtimes/modes to reduce bundle size.
    dmmf: getDatamodel(),
    // warn when not using a query parameter correctly
    onUnusedQuery: process.env.NODE_ENV === 'production' ? null : 'warn',
  },
  scopeAuth: {
    // Recommended when using subscriptions
    // when this is not set, auth checks are run when event is resolved rather than when the subscription is created
    authorizeOnSubscribe: true,
    // scope initializer, create the scopes and scope loaders for each request
    authScopes: async (context: any) => ({
      needPermission: (perm) => context.user[perm],
    }),
  },
});

builder.addScalarType('DateTime', DateTimeResolver, {});
