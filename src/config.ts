import * as fs from "fs";
import * as path from "path";

const DEFAULT_PATH = ".deployment-zip.js";
const DEFAULT_CONFIG = {
  ignore: [],
  output: "output.zip",
  outputLog: true
};

export interface Config {
  ignore: string[];
  output: string;
  outputLog: boolean;
}

export function readConfig(configPath: string): Config {
  if (!configPath) configPath = DEFAULT_PATH;
  configPath = path.resolve(process.cwd(), DEFAULT_PATH);

  if (!fs.existsSync(configPath)) return Object.assign({}, DEFAULT_CONFIG);
  return Object.assign({}, DEFAULT_CONFIG, require(configPath));
}
