import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import {config, optionalGetenv} from './config';
import EmailReport from './email_report';

let transporter: Transporter | null = null;

async function sendMail (to: string, subject: string, body: string, extraHeaders: string[] = []) {
	const headers: Record<string, string> = {};
	for (const h of extraHeaders) {
		const idx = h.indexOf(':');
		if (idx !== -1) {
			const key = h.slice(0, idx).trim();
			const value = h.slice(idx + 1).trim();
			headers[key] = value;
		}
	}

	const mailOptions: nodemailer.SendMailOptions = {
		from: headers.From || config.EMAIL_FROM,
		to,
		subject,
		text: body,
		headers,
	};

  if (config.DEBUG>0) {
    let lm = '---\n';
    if (config.DRYRUN) {
     	lm += `Pretending to send message to ${to}\n`;
    } else {
     	lm += `Sending message to ${to}\n`;
    }
  	lm += `subject: Re: ${subject}\n`;
  	lm += `headers:\n  ${extraHeaders.join('\n  ')}\n`;
  	lm += 'body:\n';
  	lm += indent(body, '  ');
    logger(lm, 1, 4);
	}

	if (config.DRYRUN) return;
 	getTransporter().sendMail(mailOptions);
}

// ---------------------------------------------------------- email notifiers
export async function replyEmail(h: string, m: EmailReport): Promise<void> {
	if (!config.EMAIL_CONFIRM) return;

  const id = `<${m.uid}>`;
	const su = m.subject();
	const cn = `${h}\n\n${await m.to_s()}\n`;
	const hd = [
		`From: ${config.EMAIL_FROM}`,
		`Thread-Topic: ${su}`,
		`References: ${id}`,
		`In-Reply-To: ${id}`,
	];

	for (const to of m.replyto()) {
		await sendMail(to, `Re: ${su}`, cn, hd);
	}
}

export async function adminEmail (h: string, m: EmailReport): Promise<void> {
	if (!config.EMAIL_CONFIRM) return;

  const to = (config.OP_EMAIL === null) ? config.DEV_EMAIL : config.OP_EMAIL;
	if (to === null) return;

  const id = `<${m.uid}>`;
	const su = m.subject();
	const cn = `${h}\n\n${await m.to_s()}\n`;
  const hd = [
		`From: ${config.EMAIL_FROM}`,
		`Thread-Topic: ${su}`,
		`References: ${id}`,
		`In-Reply-To: ${id}`,
	];

	await sendMail(to, `Re: ${su}`, cn, hd);
}

export async function snowEmail (m: EmailReport): Promise<void> {
	if (!config.SNOW_EMAIL || config.SNOW_EMAIL == '') return;

  const su = `Invalid Filemaker->LHD report: ${m.subject().substring(0, 50)}`;
	let cn = 'Bonjour,\n  ticket pour SE_OHS-PR. Merci.\n\n';
	cn += '---------------------------------------------\n';
	cn += `Invalid Filemaker report: ${m.subject()}\n`;
	cn += 'Message was not valid. Please see error details below.\n\n';
	cn += `${await m.to_s()}\n`;
	const hd = [`From: ${config.EMAIL_FROM}`];

	const to = config.SNOW_EMAIL;
	await sendMail(to, su, cn, hd);
}

// TODO: we should probably check if transporter will remain valid forever
function getTransporter (): Transporter {
	if (!transporter) {
		const host = config.SMTP_HOST;
		const port = config.SMTP_PORT;
    const user = config.SMTP_USER;
		const password = config.SMTP_PASSWORD;

		const opts: any = {host, port, secure: port === 465};
		if (user && password) {
			opts.auth = {user, pass: password};
		}
		transporter = nodemailer.createTransport(opts);
	}
	return transporter;
}
