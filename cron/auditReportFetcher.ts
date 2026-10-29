// Fetch email messages sent to lhd@epfl.ch containing audit reports generated
// by filemaker. When the message is valid, the PDF report will be saved in the
// corresponding folder (LHD_documents/...). Depending on the configuration,
// various confirmation/notification email will be sent. Inbox will then be
// emptied by moving the messages to three folders depending on if the message is
// * valid:
//    - addressed to the good recipient (EMAIL_RECIPIENT env var)
//    - with subject starting with the good string (EMAIL_SUBJECT env var)
//    - with complete metadata that is a body that looks like the following:
//        Date: DD/MM/YYYY
//        Unit: UNIT_NAME
//        Version: draft|signed
//        Replyto: [mailto:]ciccio.pasticcio@epfl.ch
//        Replyto: [mailto:]john.doe@epfl.ch
//    - include a pdf document attached
// * notme: a message that do not satisfy the first two cryteria above
// * invalid: a message that do not respect one of the other cryteria above
//
// execute with `npx tsx cron/auditReportFetcher.ts`

import { ImapFlow, MessageAddressObject, MailboxObject, MessageStructureObject, FetchMessageObject } from 'imapflow';
import PostalMime, { addressParser, decodeWords } from 'postal-mime';
import { config } from "./lib/mailfetch/config";
import { logger } from "./lib/mailfetch/helpers";
import EmailReport from './lib/mailfetch/email_report';
import { adminEmail, replyEmail, snowEmail } from './lib/mailfetch/mailer';
import { imapConnect, fetchMessages } from './lib/mailfetch/imap';

async function parseMessages(messages: EmailReport[]) {
  await Promise.all(messages.map((er) => er.parse()));
  if (config.DEBUG > 1) {
    logger("\n----------------------- Parsed Messages:", 2);
    for (const er of messages) {
      logger(er.to_s(), 2, 4);
    }
  }
}

async function moveTo(client: ImapFlow, uids: number[], destination: string) {
  if (uids.length == 0) return;

  if (config.DRYRUN) {
    logger(`Dry Run: Should be moving msgs ${uids.join(', ')} to ${destination}`, 1);
    return;
  }
  await client.messageMove(uids, destination, { uid: true });
}

async function fetchAndProcessMessages(client: ImapFlow) {
  const badMessages: number[] = [];
  const retryMessages: number[] = [];
  const doneMessages: number[] = [];
  const notmeMessages: number[] = [];

  const messages = (await fetchMessages(client)).filter(msg => {
    if (msg.isAddressedTo(config.EMAIL_RECIPIENT) ) {
      return true;
    } else {
      notmeMessages.push(msg.id);
      return false;
    }
  });

  if (notmeMessages.length > 0) {
    await moveTo(client, notmeMessages, config.MAILBOX_NOTME);
  }

  logger(`Number of correcly addressed messages: ${messages.length}`, 2);
  await parseMessages(messages);

  for (const message of messages) {
    logger(`Processing ${message.id}`, 2, 4);
    if (message.isValid()) {
      try {
        await message.save();
        doneMessages.push(message.id);
        logger(`Message ${message.id} - received and saved to ${message.fullpath}`, 0, 4);
      } catch (e) {
        retryMessages.push(message.id);
        logger(`Message ${message.id} - Message received was valid but could not be saved: ${e}`, 0, 4);
        await adminEmail('Message received was valid but could not be saved.\nWe will try again later.', message);
      }
    } else {
      badMessages.push(message.id);
      await snowEmail(message);
      await adminEmail('[LHD] message with invalid metadata', message);
      logger(`Message ${message.id} - INVALID: ${message.errors.join(' / ')}`, 0, 4);
    }
    message.cleanup();
  }

  await moveTo(client, doneMessages, config.MAILBOX_DONE);
  await moveTo(client, badMessages, config.MAILBOX_BAD);
}

// ------------------------------------------------------------------------ MAIN

async function main (): Promise<void> {
  const client = await imapConnect();
  let lock = await client.getMailboxLock(config.MAILBOX_INBOX);
  try {
    await fetchAndProcessMessages(client);
  } finally {
    // Always release the lock and close the connection
    lock.release();
  }
  await client.logout();
}

main().catch((e: any) => {
  logger(e, 0);
  process.exitCode = 1;
});
