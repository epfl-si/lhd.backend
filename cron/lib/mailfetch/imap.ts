import {ImapFlow, MessageAddressObject, MailboxObject, MessageStructureObject, FetchMessageObject} from 'imapflow';
import PostalMime, { addressParser, decodeWords } from 'postal-mime';
import { config } from "./config";
import EmailReport from './email_report';
import { logger } from "./helpers";

export async function fetchMessages(client: ImapFlow): Promise<EmailReport[]> {
  const mailbox = client.mailbox;
  if (!mailbox) return[];
  const nmsg = mailbox.exists;
  if (nmsg == 0) {
    logger(`No messages`, 1);
    return [];
  }
	const bs = (config.BATCH_SIZE > 0) ? Math.min(nmsg, config.BATCH_SIZE) : nmsg;
  logger(`Total messages in the INBOX: ${nmsg} (treating ${bs} of them)`, 0);
  if (bs <= 0) return[];

  let result = [];
  for (let imsg = 1; imsg <= bs; imsg++) {
		const msg = await client.fetchOne(String(imsg), {
      envelope: true,
      // bodyStructure: true,
			source: true,
			uid: true,
		}, {uid: false});

		if (!msg) continue;
    // would be nicer to build email with EmailReport but I cannot use await
    // within a constructors (at least this is what I could figure out)
    const email = await PostalMime.parse(msg.source);
    const er = new EmailReport(msg, email);
    result.push(er);
  }
  return result;
}

export async function imapConnect(): ImapFlow {

  const client = new ImapFlow({
    host: config.MBOX_HOST,
    port: config.MBOX_PORT,
    secure: true,
    auth: {
      user: config.MBOX_USER,
      pass: config.MBOX_PASSWORD,
    },
    logger: false,
  });
  // will throw error if cannot connect
  await client.connect();

  if (config.DEBUG) {
    client.on('close', () => {
      logger('Connection to IMAP server closed', 1);
    });
    logger('Connected successfully', 1);
  }
  return client;
}
