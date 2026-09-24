const wellKnowsErrors: Record<string, string> = {
  GRAPHQL_PARSE_FAILED:         "The operation string contains a syntax error",
  GRAPHQL_VALIDATION_FAILED:    "The operation is not valid against the server’s schema",
  BAD_USER_INPUT:               "The operation includes an invalid value for a field argument",
  BAD_REQUEST:                  "The operation includes invalid variables",
  P2003:                        'Is not possible to perform this action because of some relationship',
  P2002:                        'An element with this name appears to already exist',
  P2025:                        'No record was found for a delete',
  FNP:                          'Filename not permitted'
}

/**
 * Format error results for Nexus
 * @param formattedError passed to the Apollo formatError callback: https://www.apollographql.com/docs/apollo-server/data/errors#for-client-responses
 * @param error The original exception
 */
export function formatPrismaError(formattedError: any, error: { originalError: { code: any; }; message: any; httpCode: number; }) {
  const errorCode: string = (error?.originalError?.code || formattedError?.extensions?.code || formattedError?.code) as string;
  const errorMessage = errorCode in wellKnowsErrors ? wellKnowsErrors[errorCode] : (error.message || 'Internal Server Error');
  const httpCode = error.httpCode ?? (errorMessage === 'Unauthorized' || errorMessage.indexOf('Not authorized to resolve') > -1 ? 403 : 500);
  return {errorCode, errorMessage, httpCode};
}
