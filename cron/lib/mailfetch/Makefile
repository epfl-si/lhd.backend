.PHONY: clean imap test

clean:
	rm .env aaa1 aaa2 bbb

helpers: .env aaa1 aaa2 bbb
	npx tsx test_helpers.ts

imap: .env
	npx tsx test_imap.ts

unit: .env
	npx tsx test_unit.ts

# ------------------------------------------------------------------------------

.env:
	cp ../../../.env ./

aaa1 aaa2:
	@echo "sto testando helper/areFilesIdentical" > $@

bbb:
	@echo "pure io ma voglio essere diverso" > $@
