library(DBI)
library(RMariaDB)
library(RPostgres)
library(dplyr)

environment <- "test" # local | test | prod

if (environment == 'local') {
  con <- dbConnect(
    RPostgres::Postgres(),
    host = "127.0.0.1",
    port = 45432,
    user = "root",
    password = "ROOT",
    dbname = "lhd"
  )
} else {
  db_conf <- yaml::read_yaml(paste0("/keybase/team/epfl_lhd/secrets_", environment, ".yml"))

  # Postgres
  con <- dbConnect(
    RPostgres::Postgres(),
    host = "127.0.0.1", # connect on oc; oc port-forward service/lhd-postgres-rw 15432:5432
    dbname = 'lhd',
    user = 'lhd',
    password = db_conf$postgresql_oc$password,
    port = 15432
  )
}

result_prof <- tbl(con, "subunpro") %>%
  collect() %>%
  mutate(
    role = 'Professor',
  ) %>%
  select('id_unit', 'id_person', 'role')

dbAppendTable(con, 'unit_has_profile', result_prof)

result_cosec <- tbl(con, "unit_has_cosec") %>%
  collect() %>%
  mutate(
    role = 'Cosec',
  ) %>%
  select('id_unit', 'id_person', 'role')

dbAppendTable(con, 'unit_has_profile', result_cosec)

dbDisconnect(con)
