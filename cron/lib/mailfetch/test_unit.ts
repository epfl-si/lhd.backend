import { unitIdByName } from "./units";
const unit_name = "GHI-GE";
const id = await unitIdByName(unit_name);
console.log(`${unit_name} => ${id}`);
