import fs from 'fs';
import { execSync } from 'child_process';

const config = JSON.parse(fs.readFileSync('scenario.json', 'utf8'));

let managerSrc = fs.readFileSync('src/scenarioManager.ts', 'utf8');

const startStr = 'const defaultScenario: ScenarioConfig = ';
const startIndex = managerSrc.indexOf(startStr);

if (startIndex === -1) {
  console.log("Could not find defaultScenario in src/scenarioManager.ts");
  process.exit(1);
}

const endClassStr = 'export class ScenarioManager {';
const endClassIndex = managerSrc.indexOf(endClassStr);

if (endClassIndex === -1) {
  console.log("Could not find class ScenarioManager");
  process.exit(1);
}

const before = managerSrc.substring(0, startIndex);
const after = managerSrc.substring(endClassIndex);

const newDefault = startStr + JSON.stringify(config, null, 2) + ";\n\n";

fs.writeFileSync('src/scenarioManager.ts', before + newDefault + after);
console.log("Successfully updated src/scenarioManager.ts!");
