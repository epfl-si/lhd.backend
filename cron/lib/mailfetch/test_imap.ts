// Connect to IMAP server and fetch all messages from the INBOX

import { ImapFlow, MessageAddressObject, MailboxObject, MessageStructureObject, FetchMessageObject } from 'imapflow';
import { config } from "./config";
import { logger } from "./helpers";
import EmailReport from './email_report';
import { imapConnect, fetchMessages } from './imap';

// ------------------------------------------------------------------------ MAIN
const client = await imapConnect();
console.log(`INBOX is ${config.MAILBOX_INBOX}`);
let lock = await client.getMailboxLock(config.MAILBOX_INBOX);
try {
  const messages = (await fetchMessages(client));
  await Promise.all(messages.map((er) => er.parse()));
  for (const er of messages) {
    console.log(er.to_s());
  }
} finally {
  // Always release the lock and close the connection
  lock.release();
}
await client.logout();
