import * as fs from "fs";
import * as path from "path";
import { glob } from "glob";
import { gray, green } from "colors/safe";
import ignore from "ignore";
import archiver from "archiver";
import { Config } from "./config";

export function deploy(directoryPath: string, config: Config): Promise<number> {
  return new Promise((resolve, reject) => {
    directoryPath = path.resolve(directoryPath);

    const ig = ignore().add(config.ignore);

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
            if (config.outputLog) console.log(gray(`skip ${relativePath}`));
          } else {
            if (config.outputLog) console.log(green(`add  ${relativePath}`));
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
