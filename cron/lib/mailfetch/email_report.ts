import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';

import {FetchMessageObject, ImapFlowErrorCode} from 'imapflow';
import PostalMime, { addressParser, decodeWords, Attachment } from 'postal-mime';
import type { Email, PostalMimeOptions } from 'postal-mime';

import {config} from './config';
import {unitIdByName} from './units';
import {areFilesIdentical, logger} from './helpers';

const SUBJECT_RE = new RegExp(`^(${config.EMAIL_SUBJECT})`);

const DATE_RE = /^([0-9]{2})[-./]([0-9]{2})[-./](2[0-9]{3})$/;
const EMAIL_RE = /^(.?mailto:[^a-z]*)?([a-z]+(\.[a-z]+)?(\+[a-z]+)?@epfl\.ch)(.*)$/i;
const METADATA_LINE_RE = /^([A-Za-z]*):(.*)$/;
//                                ^-a-zàèìòùáéíóúâêîôûäëïöüA-Z0-9/:@.+)( ]#`
const METADATA_VALUE_STRIP_RE = /[^-a-z\u00e0\u00e8\u00ec\u00f2\u00f9\u00e1\u00e9\u00ed\u00f3\u00fa\u00e2\u00ea\u00ee\u00f4\u00fb\u00e4\u00eb\u00ef\u00f6\u00fcA-Z0-9/:@.+)( ]/g;
const UNIT_RE = /^[A-Za-z\u00e0\u00e1\u00e9\u00e8\u00ec\u00ed\u00ee\u00ef\u00f2\u00f3\u00f6\u00f9\u00fa\u00fc0-9\-_.+() ]*$/;
const VERSION_RE = /^([Ss]igned|[Dd]raft)$/;


export default class EmailReport {
  id: number | null = null;
  to: (string | undefined)[] | undefined;
  subject: (string | undefined) = undefined;
  email: Email;
	errors: string[] = [];
  messages: string[] = [];
  basename: string | null = null;
  savedir: string | null = null;
  fullpath: string | null = null;

  tmpFilePath: string = "";
  date: string = "";
  unit_name: string = "";
  unit_id: number | null = null;
  version: string = "";
  replyto: string[] = [];

	// ------------------------------------------------------------- Constructor
  constructor(msg: FetchMessageObject, email: Email) {
    this.id = msg.uid;
    this.to = msg.envelope?.to?.map(addr => addr.address);
    this.subject = msg.envelope?.subject
    this.email = email;
  };

  async parse() {
    await Promise.all([this.parsePDFpart(), this.parseTXTpart()]);

    if (this.isValid()) {
      this.savedir = path.join(config.DOCUMENTS_PATH, 'upload', 'report_audits', 'pdf', String(this.unit_id));
      const m = this.date.match(DATE_RE);
		  const [, day, mon, yea] = m;
		  this.basename = `Visit_report_${yea}-${mon}-${day}_${this.version}_${this.unit_name}.pdf`;
      this.fullpath = path.join(this.savedir, this.basename);
      // this might introduce new errors and hence invalidate the object
      this.validateAttachment();
    }
	}

  isCorrectlyAddressed() : boolean {
    if (this.to == undefined || this.subject == undefined) return false
    if (!SUBJECT_RE.test(this.subject)) return false;
    const tolc = config.EMAIL_RECIPIENT.toLocaleLowerCase();
    for (const a of this.to) {
      if (a == undefined) continue;
      if (a.toLowerCase() === tolc) return true;
    }
    return false;
	}

	isAddressedTo(toAddress: string): boolean {
    const tolc = toAddress.toLowerCase();
    for (const a of this.to) {
      if (a == undefined) continue;
  		if (a.toLowerCase() === tolc) return true;
    }
    return false;
  }



	// ------------------------------------------------------------------ Methods

  async validateAttachment(): Promise<bolean> {
    if (!this.fullpath) throw new Error("EmailReport::validateAttachment can be called only if fullpath is defined");
    if (!this.savedir) throw new Error("EmailReport::validateAttachment can be called only if savedir is defined");
  	if (fs.existsSync(this.fullpath)) {
  		if (areFilesIdentical(this.fullpath, this.tmpFilePath ?? '')) {
  			this.addMessage('The exact same report was already present (skipped)');
  			if (this.tmpFilePath && fs.existsSync(this.tmpFilePath)) {
  				fs.unlinkSync(this.tmpFilePath);
  			}
  			return true;
  		} else if (!config.OVERWRITE) {
  			this.addError('A different document already exist for this data. Please change the metadata and try again or ask admin to set REWRITE option to true');
  			return false;
  		}
    }
    return true;
	}

	// Extract & save the PDF attachment to a tmp file. `attachment` is a
	// postal-mime attachment object ({ content: ArrayBuffer, mimeType, ... }).
	async parsePDFpart (): Promise<boolean> {
  	// PDF attachment (there should be one ant only one)
  	const attachment = (this.email.attachments || []).find(
  		(a) => (a.mimeType || '').toLowerCase() === 'application/pdf',
    );
    if (!attachment || !attachment.content) {
      this.addError('Missing or unparseable PDF part.');
      return false;
    }

    if (config.DEBUG > 1) {
      logger("  Found attachment", 2);
      logger(`    filaneme: ${attachment.filename}`, 2);
      logger(`    type:     ${attachment.mimeType}`, 2);
      logger(`    size:     ${attachment.content.byteLength}`, 2);
    }
		this.tmpFilePath = path.join(
			os.tmpdir(),
			`email_attachment${Date.now()}_${crypto.randomBytes(5).toString('hex')}.pdf`,
		);
    try {
      const buffer = Buffer.from(attachment.content);
			fs.writeFileSync(this.tmpFilePath, buffer);
			return true;
		} catch (e) {
			this.addError('!Err: could not write temporary attachment to file');
			return false;
		}
    return true;
  }

	// Parse the PLAIN text body for `key: value` metadata lines.
  async parseTXTpart(): Promise<boolean> {
    if (typeof this.email.text !== 'string' || !(this.email.text.length > 0)) {
      this.addError('Missing TEXT metadata part.');
      return false;
    }

    let rts: string[] = [];
    if (config.OP_EMAIL !== null) {
      rts.push(config.OP_EMAIL as string)
    } else if(config.DEV_EMAIL !== null) {
      rts.push(config.DEV_EMAIL as string)
    }


    for (const line of this.email.text.split('\n')) {
      const m = line.match(METADATA_LINE_RE);
      if (m) {
        const k = m[1].trim().toLowerCase();
        const v = m[2].trim().replace(METADATA_VALUE_STRIP_RE, '');
        switch (k) {
          case "date":
            this.date = v;
            break;
          case "unit":
            this.unit_name = v;
            break;
          case "version":
            this.version = v;
            break;
          case "replyto":
            rts.push(v);
            break;
        }
      }
    }

    let ret = true;

    // validate presences
    if (this.date === '') {
      ret = false;
      this.addError('Missing date field');
    }
    if (this.unit_name === '') {
      ret = false;
      this.addError('Missing unit field');
    }
    if (this.version === '') {
      ret = false;
      this.addError('Missing version field');
    }

    // validate formats
    if (!DATE_RE.test(this.date || '')) {
      ret = false;
      this.addError(`Invalid date: '${this.date}'`);
    }

    if (!UNIT_RE.test(this.unit_name || '')) {
      ret = false;
      this.addError(`Invalid unit name: '${this.unit_name}'`);
    } else {
      this.unit_id = await unitIdByName(this.unit_name);
      if (this.unit_id == null) {
        ret = false;
        this.addError(`Invalid unit: '${this.unit_name}' was not found in the DB`);
      }
    }

    if (!VERSION_RE.test(this.version || '')) {
      ret = false;
      this.addError(`Invalid version: '${this.version}'`);
    }

    // like this.replyto = rts.filter(rt => EMAIL_RE.test(rt)); but with error messages
    for (const rt of rts) {
      if (EMAIL_RE.test(rt)) {
        this.replyto.push(rt);
      } else {
        ret = false;
        this.addError(`Invalid email address: '${rt}'`);
      }
    }

    return ret;
  }

	isValid (): boolean {
		return this.id !== null && this.errors.length === 0;
	}


  from(): string | undefined {
    return this.email.from?.address
	}

	async save (): Promise<boolean> {
    if (!this.isValid()) return false;
    if (!this.fullpath) throw new Error("EmailReport::save can be called only if fullpath is defined");
    if (!this.savedir) throw new Error("EmailReport::save can be called only if savedir is defined");
		if (!fs.existsSync(this.savedir)) {
			fs.mkdirSync(this.savedir, {recursive: true, mode: 0o775});
		}
		if (!(fs.existsSync(this.savedir) && fs.statSync(this.savedir).isDirectory())) return false;

		if (config.DRYRUN && config.DOCUMENTS_PATH.indexOf('/tmp') !== 0) {
			logger(`Dry Run: Should move ${this.tmpFilePath} to ${this.fullpath} Will be deleted instead`, 1);
			this.cleanup();
			return true;
		}

		// fs.renameSync(this.tmpFilePath as string, this.fullpath);
    fs.copyFileSync(this.tmpFilePath as string, this.fullpath);
		fs.unlinkSync(this.tmpFilePath);

		return true;
	}

  to_s(): string {
		let out = '';
		if (config.DEBUG > 1) {
      out += `to:       ${(this.to || []).join(', ')}\n`;
      out += `tmpfile:  ${this.tmpFilePath}\n`;
			out += `outidr:   ${this.savedir}\n`;
			out += `path:     ${this.fullpath}\n`;
			out += `replyto:  ${(this.replyto || []).join(', ')}\n`;
			out += `subject:  ${this.email.subject}\n`;
		}
		out += `status:   ${this.isValid() ? 'VALID' : 'NOT VALID'}\n`;
		out += `date:     ${this.date}\n`;
		out += `unit:     ${this.unit_name} (id: ${this.unit_id || 'undefined'})\n`;
		out += `version:  ${this.version}\n`;
		out += `filename: ${this.basename}\n`;
    out += `id:       ${this.id}\n`;
		if (this.errors.length > 0) {
			out += `Errors:\n  - ${this.errors.join('\n  - ')}\n`;
		}
		if (this.messages.length > 0) {
			out += `Messages:\n  - ${this.messages.join('\n  - ')}\n`;
		}
		return out;
	}

	// remove temp file if needed
	cleanup (): void {
		if (this.tmpFilePath && fs.existsSync(this.tmpFilePath)) {
			fs.unlinkSync(this.tmpFilePath);
		}
	}

	addError (message: string): void {
		this.errors.push(message);
		logger(`${this.id}: error ${message}`, 2);
	}

	addMessage (message: string): void {
		this.messages.push(message);
		logger(`${this.id}: msg ${message}`, 2);
	}
}
