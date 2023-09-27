import * as fs from "fs";
import * as path from "path";
import { glob } from "glob";
import * as colors from "colors/safe";
import * as ignore from "ignore";
import * as archiver from "archiver";
import { Config } from "./config";

export function deploy(directoryPath: string, config: Config) {
  return new Promise((resolve, reject) => {
    directoryPath = path.resolve(directoryPath);

    const ig = (ignore as any)().add(config.ignore);

    const archive = archiver("zip", {
      zlib: { level: 9 },
    });
    const outputStream = fs.createWriteStream(config.output);
    outputStream.on("close", () => resolve(archive.pointer()));
    outputStream.on("error", reject);
    archive.pipe(outputStream);

    glob(path.join(directoryPath, "**", "*"), async (err, matches) => {
      if (err) {
        reject(err);
        return;
      }

      await Promise.all(
        matches.map(async (filePath) => {
          const ret = await fs.promises.stat(filePath);
          if (ret.isDirectory()) return;

          const relativePath = path.relative(directoryPath, filePath);

          if (ig.ignores(relativePath)) {
            if (config.outputLog)
              console.log(colors.gray(`skip ${relativePath}`));
          } else {
            if (config.outputLog)
              console.log(colors.green(`add  ${relativePath}`));
            archive.append(fs.createReadStream(filePath), {
              name: relativePath,
            });
          }
        }),
      );

      archive.finalize();
    });
  });
}
