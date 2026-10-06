import * as fs from "fs";
import * as dotenv from "dotenv";
import {stat} from "fs/promises";
import {getUnitToString} from "../schema/types/unit";
import {OptimisticLock} from "./optimisticLock";
import path from "node:path";

dotenv.config();
const DOCUMENTS_PATH = process.env.DOCUMENTS_PATH;

export function saveBase64File(base64Data: string, filePath: string, fileName: string): string {
	// Remove the data URL part if present
	const base64Content = base64Data.split(';base64,').pop() || base64Data;
	// Decode base64 string to buffer
	const fileBuffer = Buffer.from(base64Content, 'base64');
	fs.mkdirSync(DOCUMENTS_PATH + "/" + filePath, {recursive: true});
	// Write the buffer to a file
	fs.writeFileSync(DOCUMENTS_PATH + "/" + filePath + fileName, fileBuffer);
	return filePath + fileName;
}

export async function isDirectory(path: string) {
	try {
		return (await stat(path)).isDirectory();
	} catch (e: any) {
		if (e.code === 'ENOENT') { // No such file or directory
			return false;
		} else {
			throw e;
		}
	}
}

export async function getReportFilesByUnit (unit: any) {
	const encryptedID = OptimisticLock.obfuscate({id: unit.id, obj: getUnitToString(unit)});
	const reportFolder = "report_audits/pdf/" + unit.id + "/";
	const folderPath = process.env.DOCUMENTS_PATH + "/" + reportFolder;
	if (await isDirectory(folderPath)) {
		const files = fs.readdirSync(folderPath);
		const pdfFiles = files.filter(file => path.extname(file).toLowerCase() === '.pdf');
		return pdfFiles.map(file =>
		{
			return {
				id: JSON.stringify(encryptedID),
				name: path.basename(file),
				path: reportFolder + file,
				unitName: unit.name
			};
		});
	} else {
		return [];
	}
}

export function sendFileResponse (filePath: string, res: any) {
	const fileName = path.basename(filePath);
	const fullFilePath = path.join(process.env.DOCUMENTS_PATH ?? '', filePath);
	res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
	res.sendFile(fullFilePath, (err: any) => {
		if ( err ) {
			console.error('Error sending file:', err);
			res.status(500).send(err.message);
		} else {
			console.log('Getting file success', fullFilePath);
		}
	});
}
