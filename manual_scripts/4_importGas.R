library(RMariaDB)
library(DBI)
library(dplyr)
library(dbplyr)
library(readxl)

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
print(con)

# get all hazards to migrate from excel
file_path <- "/home/rmaggi/dev/lhd3-dev/backend_v2/manual_scripts/gas_updated_corrected_states.xlsx"

data <- read_excel(file_path)
lab_local <- tbl(con, "lab") %>%
  collect()

allDatas <- data %>%
  rename(lab_display = Room) %>%
  left_join(lab_local, by = 'lab_display') %>%
  select('gas', 'hazard', 'state', 'utilisationPressure', 'cylinderVolume', 'numberOfCylinders', 'inCabinet', 'cabinetTag', 'ventilatedCabinet', 'inCorridor', 'lab_display', 'id_lab') %>%
  mutate(
    id_hazard_form_history = 198,
    submission = paste0('{"data":{"gas":{"gas":"',gas,'","hazard":"',hazard,'","state":"',state,'"},"hazard":"',hazard,'","state":"',state,'","cylinderVolume":"',(ifelse(is.na(cylinderVolume), "", cylinderVolume)),'"',(ifelse(is.na(numberOfCylinders), "", paste0(',"numberOfCylinders":',numberOfCylinders))),',"utilisationPressure":"',utilisationPressure,'","inCabinet":"',inCabinet,'","delete":false,',(ifelse(is.na(ventilatedCabinet), "", paste0('"ventilatedCabinet":"',ventilatedCabinet,'",'))),(ifelse(is.na(inCorridor), "", paste0('"inCorridor":"',inCorridor,'",'))),(ifelse(is.na(cabinetTag), "", paste0('"cabinetTag":',cabinetTag,','))),'"status":"Default"}}')
  ) %>%
  select('lab_display', 'id_lab', 'id_hazard_form_history', 'submission')

dataToBeMigrated <- allDatas %>%
  filter(!is.na(id_lab)) %>%
  select('id_lab', 'id_hazard_form_history', 'submission')

dataWithNoRoom <- allDatas %>%
  filter(is.na(id_lab))

dbWithTransaction(con, {
  dbAppendTable(con, 'lab_has_hazards', dataToBeMigrated)
})

# Disconnect from the database
dbDisconnect(con)
