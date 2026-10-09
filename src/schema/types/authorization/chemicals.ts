import {builder} from "../../builder";
import {OptimisticLock} from "../../../lib/optimisticLock";
import {AuthChem} from "../../../../generated/prisma";

export const AuthChemRef = builder.prismaObject('AuthChem', {
	name: 'AuthChem',
	fields: (t: any) => ({
		casAuthChem: t.exposeString('casAuthChem'),
		authChemEn: t.exposeString('authChemEn'),
		authChemFr: t.exposeString('authChemFr'),
		flagAuthChem: t.exposeBoolean('flagAuthChem'),
		fastway: t.exposeBoolean('fastway'),
		authCode: t.exposeString('authCode'),
		opLock: t.string({
			resolve: async (parent: any, _: any, context: any) => {
				return OptimisticLock.createOpLock(parent.idAuthChem, getChemicalToString(parent));
			},
		})
	}),
});

function getChemicalToString(parent: AuthChem) {
	return {
		id: parent.idAuthChem,
		casAuthChem: parent.casAuthChem,
		authChemEn: parent.authChemEn,
		authChemFr: parent.authChemFr,
		flagAuthChem: parent.flagAuthChem,
		fastway: parent.fastway,
		authCode: parent.authCode
	};
}

export async function getChemicalOriginalObject (tx: any, opLock: string, name: string) {
	return await OptimisticLock.ensureDBObjectIsTheSame(opLock, 'AuthChem', 'idAuthChem', tx, name, getChemicalToString);
}
