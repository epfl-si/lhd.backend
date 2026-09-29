library(DBI)
library(RMariaDB)
library(RPostgres)
library(dplyr)

environment <- "local" # local | test | prod

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
    host = db_conf$postgresql$host,
    dbname = db_conf$postgresql$name,
    user = db_conf$postgresql$user,
    password = db_conf$postgresql$password,
    port = db_conf$postgresql$port
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
