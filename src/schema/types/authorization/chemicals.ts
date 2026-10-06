import {builder} from "../../builder";
import {OptimisticLock} from "../../../lib/optimisticLock";
import {AuthChem} from "../../../../generated/prisma";

const AuthChemRef = builder.prismaObject('AuthChem', {
	name: 'AuthChem',
	fields: (t: any) => ({
		casAuthChem: t.exposeString('casAuthChem'),
		authChemEn: t.exposeString('authChemEn'),
		authChemFr: t.exposeString('authChemFr'),
		flagAuthChem: t.exposeBoolean('flagAuthChem'),
		fastway: t.exposeBoolean('fastway'),
		authCode: t.exposeString('authCode'),

		opLock: t.field({
			type: 'String',
			resolve: async (parent: any, _: any, context: any) => {
				return OptimisticLock.createOpLock(parent.idAuthChem, getChemicalToString(parent));
			},
		})
	}),
});

function getChemicalToString(parent: AuthChem) {
	return {
		id: parent.id_auth_chem,
		cas_auth_chem: parent.casAuthChem,
		auth_chem_en: parent.authChemEn,
		auth_chem_fr: parent.authChemFr,
		flag_auth_chem: parent.flagAuthChem,
		fastway: parent.fastway,
		auth_code: parent.auth_code
	};
}

export async function getChemicalOriginalObject (tx: any, opLock: string, name: string) {
	return await OptimisticLock.ensureDBObjectIsTheSame(opLock, 'AuthChem', 'idAuthChem', tx, name, getChemicalToString);
}
