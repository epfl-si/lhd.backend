import "dotenv/config";

// Configuration / environment handling for the audit-report mail fetcher.

// Required environment variables (mandatory):
//   DOCUMENTS_PATH
//   MBOX_USER      imap server user
//   MBOX_PASSWORD  imap server password

// Optional env  vars for email server configuration
//   MBOX_HOST [ewa.epfl.ch]     imap server hostname
//   MBOX_PORT [993]             imap server port
//   MBOX_TRASH [Deleted Items]  trash mailbox name in the imap server
//   SMTP_HOST [localhost]
//   SMTP_PASSWORD [null => no authentication]
//   SMTP_PORT [25]
//   SMTP_USER [null => no auth, only if EMAIL_FROM == 'noreply@epfl.ch']

// Optional env vars for script configuration (with defaults):
//   ENVIRONMENT     ["dev": string]
//   BATCH_SIZE      [0 (no limit) ] : how many messages to fetch per batch
//   DEBUG           [0] console log messages verbosity (0=only important, 1=debug messages, 2=even more debug messages)
//   DEV_EMAIL       [null]          : default recipient for cc messages
//   DRYRUN          ["no" => false] : if operations are just logged instead of done
//   EMAIL_CONFIRM   ["yes" => true] : enable confirmation msg to EMAIL_RECIPIENT foreach processed report
//   EMAIL_FROM      ["noreply@epfl.ch"]
//   EMAIL_RECIPIENT ["lhd+{ar,test}@epfl.ch"]
//   EMAIL_SUBJECT   ["Audit Report|Rapport de visite"]
//   MAILBOX_BAD     ["Invalid"] : imap folder name where invalid messages will be moved
//   MAILBOX_DONE    ["Done"] : imap folder name where valid and treated messages will be moved
//   MAILBOX_INBOX   ["INBOX"] : inbox folder in the imap server
//   MAILBOX_NOTME   ["NotMe"] : imap folder name where messages with wrong to or subject field are moved
//   OP_EMAIL        [DEV_EMAIL] : recipient for cc messages
//   OVERWRITE       ["no" => false] : overwrite report files with the same metadata
//   SNOW_EMAIL      [null] : recipient email for service now ticket creation
// boolean-like variables are considered true if and only if VAR === "yes"

export function mandatoryGetenv(name: string): string {
  const v = process.env[name];
  if (v === undefined || v === '') {
    throw new Error(`Mandatory env variable ${name} not set`);
  }
  return v;
}

export function optionalGetenv(name: string, defaultValue: string): string;
export function optionalGetenv(name: string, defaultValue: null): string | null;
export function optionalGetenv(name: string, defaultValue: string | null): string | null {
  const v = process.env[name];
  return (v === undefined) ? defaultValue : v;
}

const ENVIRONMENT = optionalGetenv('ENVIRONMENT', process.env.ENVIRONMENT ?? 'dev') ?? 'dev';

export interface MailFetchConfig {
  // IMAP server
  MBOX_HOST: string;
  MBOX_PASSWORD: string;
  MBOX_PORT: number;
  MBOX_TRASH: string;
  MBOX_USER: string;

  // SMTP server
  SMTP_HOST: string;
  SMTP_PORT: number;
  SMTP_USER: string | null;
  SMTP_PASSWORD: string | null;

  // script configuration
  BATCH_SIZE: number;
  DEBUG: number;
  DEV_EMAIL: string | null;
  DOCUMENTS_PATH: string;
  DRYRUN: boolean;
  EMAIL_CONFIRM: boolean;
  EMAIL_FROM: string;
  EMAIL_RECIPIENT: string;
  EMAIL_SUBJECT: string;

  MAILBOX_BAD: string;
  MAILBOX_DONE: string;
  MAILBOX_INBOX: string;
  MAILBOX_NOTME: string;

  OP_EMAIL: string | null;
  OVERWRITE: boolean;
  SNOW_EMAIL: string | null;
}

export const config: MailFetchConfig = {
  // IMAP server
  MBOX_HOST: optionalGetenv('MBOX_HOST', 'ewa.epfl.ch'),
  MBOX_PASSWORD: mandatoryGetenv('MBOX_PASSWORD'),
  MBOX_PORT: parseInt(optionalGetenv('MBOX_PORT', '993'), 10),
  MBOX_TRASH: optionalGetenv('MBOX_TRASH', 'Deleted Items'),
  MBOX_USER: mandatoryGetenv('MBOX_USER'),

  // SMTP server
  SMTP_HOST: optionalGetenv('SMTP_HOST', 'localhost'),
  SMTP_PASSWORD: optionalGetenv('SMTP_PASSWORD', null),
  SMTP_PORT: parseInt(optionalGetenv('SMTP_PORT', '25'), 10),
  SMTP_USER: optionalGetenv('SMTP_USER', null),

  // BATCH_SIZE == 0 means no limit
  BATCH_SIZE: parseInt(optionalGetenv('BATCH_SIZE', '0'), 10),
  DEBUG: parseInt(optionalGetenv('DEBUG', '0'), 10),
  DEV_EMAIL: optionalGetenv('DEV_EMAIL', null),
  DOCUMENTS_PATH: mandatoryGetenv('DOCUMENTS_PATH'),
  DRYRUN: optionalGetenv('DRYRUN', 'no') === 'yes',

  EMAIL_CONFIRM: optionalGetenv('EMAIL_CONFIRM', 'yes') === 'yes',
  EMAIL_FROM: optionalGetenv('EMAIL_FROM', 'noreply@epfl.ch'),
  EMAIL_RECIPIENT: optionalGetenv('EMAIL_RECIPIENT', (ENVIRONMENT === 'prod') ? 'lhd+ar@epfl.ch' : 'lhd+test@epfl.ch') ?? '',
  EMAIL_SUBJECT: optionalGetenv('EMAIL_SUBJECT', 'Audit Report|Rapport de visite'),

  MAILBOX_BAD: optionalGetenv('MAILBOX_BAD', 'Invalid'),
  MAILBOX_DONE: optionalGetenv('MAILBOX_DONE', 'Done'),
  MAILBOX_INBOX: optionalGetenv('MAILBOX_INBOX', 'INBOX'),
  MAILBOX_NOTME: optionalGetenv('MAILBOX_NOTME', 'NotMe'),

  OP_EMAIL: optionalGetenv('OP_EMAIL', null),
  OVERWRITE: optionalGetenv('OVERWRITE', 'no') === 'yes',
  SNOW_EMAIL: optionalGetenv('SNOW_EMAIL', null),
};
