// test script calling all functions

import { config } from "./config";
import * as helper from "./helpers";

export function check(message: string, valid: boolean): null {
  if (!valid) {
    console.log(`FAILED    ${message}`);
  } else {
    console.log(`OK        ${message}`);
	}
}

const today = helper.todayStamp();
console.log(`Test starts ${today}`);

// "test" config
const r1 = helper.randomHex(10);
const r2 = helper.randomHex(8);
const r3 = helper.randomHex(8);
console.log(`Three random hex ${r1} (${r1.length}) ${r2} ${r3}`);
check("randomHex r1 should be 10 hex (20 char) long", r1.length == 20);
check("randomHex r2 should be 8 hex (16 char) long", r2.length == 16);
check("randomHex r2 and r3 are expected to be different", r2 != r3);


const host = config.SMTP_HOST;
const port = config.SMTP_PORT;
check("host is set to mail.epfl.ch", host == "mail.epfl.ch");
check("port is set to 587", port == 587);

const msg = `this is a message
various lines
long`;
const imsg = helper.indent(msg, 4);
check("all imsg lines should start with 4 spaces", imsg.split('\n').every( l => l.startsWith("    ")))

check("aaa1 should be identical to aaa2", helper.areFilesIdentical("aaa1", "aaa2"))
check("aaa1 and bbb should be different", !helper.areFilesIdentical("aaa1", "bbb"))

let a = [1, 2, 3];
check("first element of [1, 2, 3] should be 1", helper.firstOrNull([1, 2, 3]) == 1);
check("first element of [] should be null", helper.firstOrNull([]) == null);
check("first element of null should be null", helper.firstOrNull(null) == null);

const esubj = "=?UTF-8?B?QXVkaXQgUmVwb3J0IDogU1YtSU4gKFByw6lwYXJhdGlvbiBkZSBzb2x1dGlvbnMpICgyMC8wOC8yMDI2KQ==?="
const csubj = helper.decodeMaybeBase64Subject(esubj);
const tsubj = "Audit Report : SV-IN (Préparation de solutions) (20/08/2026)";
check("decoded base64 string matches", csubj == tsubj);
check("clear text possibly base64 matches", helper.decodeMaybeBase64Subject("ciccio") == "ciccio");


helper.logger("This should appear only if config.DEBUG<=0", 0);
helper.logger("This should appear only if config.DEBUG<=1", 1);
helper.logger("This should appear only if config.DEBUG<=2", 2);
