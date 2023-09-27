import { program } from "commander";
import * as path from "path";
import * as fs from "fs";
import { readConfig } from "./config";
import { deploy } from "./deploy";

export function runCommand() {
  const packageJSON = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, "..", "..", "package.json"),
      "utf-8",
    ),
  );

  program
    .version(`v.${packageJSON.version}`, "-v, --version")
    .usage("[options] <directory>")
    .option(
      "-c, --config <config_file>",
      "config file path [.deploment-zip.js]",
    )
    .option("-o, --output <output file>", "output zip file")
    .parse(process.argv);

  const inputDirectory = program.args[0];
  if (!inputDirectory || !fs.existsSync(inputDirectory)) {
    program.outputHelp();
    return;
  }

  const options = program.opts();

  const config = readConfig(options.config);
  if (options.output) config.output = options.output;

  deploy(inputDirectory, config)
    .then(() => {
      console.log(`\ncomplete! -> ${path.resolve(config.output)}`);
      process.exit(0);
    })
    .catch((e) => {
      console.error("ERROR!");
      console.error(e);
      process.exit(1);
    });
}
