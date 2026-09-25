import {prisma} from "../schema/prisma";
import {getUserString} from "./userType";
import {UserInfo} from "./userType";

/**
 * Create and return a Prisma client instance scoped to a specific user,
 * with optional query logging and automatic mutation auditing.
 *
 * This function wraps the base Prisma client using `$extends` to intercept
 * all Prisma operations. For write operations (`create`, `update`, `delete`,
 * `deleteMany`), it automatically records an audit entry in the
 * `mutation_logs` table, capturing:
 *  - the user who performed the action
 *  - the affected table and record ID
 *  - the action type
 *  - the old and new values (when applicable)
 *
 * Query logging can be enabled in two ways:
 *  - Via `inject.onQuery`, which emits Prisma query events (useful for tests)
 *  - Via the `debug` namespace `prisma:query`
 *
 * The database connection URL is taken from the provided backend config,
 * allowing per-environment configuration.
 *
 * @param user - The currently authenticated user; used for audit logging.
 *
 * @returns A Prisma client instance configured for the given user, with
 *          auditing and optional query logging enabled.
 */
export function getPrismaForUser(user: UserInfo) {
  return prisma.$extends({
    query: {
      async $allOperations({ model, operation, args, query }) {
        if (args.where) {
          args.where = addInsensitiveMode(args.where);
        }

        const writeOps = ['create', 'update', 'delete', 'deleteMany'];
        if (!model || !writeOps.includes(operation)) {
          return query(args);
        }

        let oldValue = null;
        // Capture old value for updates/deletes
        if (operation !== 'create' && args?.where) {
          oldValue = await prisma[model].findMany({
            where: args.where,
          });
        }

        const newValue = await query(args);

        try {
          const source = operation === 'create' ? newValue : oldValue?.[0];
          const idKey = source
            ? Object.keys(source).find((k) => k.startsWith('id'))
            : undefined;
          const id = idKey ? source[idKey] : null;
          await prisma.mutationLogs.create({
            data: {
              modifiedBy: getUserString(user),
              modifiedOn: new Date(),
              tableName: model,
              tableId: id,
              columnName: '',
              oldValue: oldValue ? JSON.stringify(oldValue) : '',
              newValue: operation === 'delete' || operation === 'deleteMany'
                  ? '' : JSON.stringify(newValue),
              action: operation.toUpperCase(),
            },
          });
        } catch (e: any) {
          console.warn('Logging failed:', e.message);
        }
        return newValue;
      },
    },
  });
}
