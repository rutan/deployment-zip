import * as fs from "fs";
import * as path from "path";
import * as glob from "glob";
import * as colors from "colors/safe";
import * as ignore from "ignore";
import * as archiver from "archiver";
import { Config } from "./config";

export function deploy(directoryPath: string, config: Config) {
  return new Promise((resolve, reject) => {
    directoryPath = path.resolve(directoryPath);

    const ig = (ignore as any)().add(config.ignore);

    const archive = archiver("zip", {
      zlib: { level: 9 }
    });
    const outputStream = fs.createWriteStream(config.output);
    outputStream.on("close", () => resolve(archive.pointer()));
    outputStream.on("error", reject);
    archive.pipe(outputStream);

    glob.sync(path.join(directoryPath, "**", "*")).forEach(filePath => {
      if (fs.statSync(filePath).isDirectory()) return;
      const relativePath = path.relative(directoryPath, filePath);

      if (ig.ignores(relativePath)) {
        if (config.outputLog) console.log(colors.gray(`skip ${relativePath}`));
      } else {
        if (config.outputLog) console.log(colors.green(`add  ${relativePath}`));
        archive.append(fs.createReadStream(filePath), { name: relativePath });
      }
    });

    archive.finalize();
  });
}
