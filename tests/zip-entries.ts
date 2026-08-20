import { readFile } from 'node:fs/promises';
import { inflateRawSync } from 'node:zlib';

const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const LOCAL_FILE_SIGNATURE = 0x04034b50;

export async function readZipEntries(path: string) {
  const zip = await readFile(path);
  const endOffset = findEndOfCentralDirectory(zip);
  const entryCount = zip.readUInt16LE(endOffset + 10);
  let centralOffset = zip.readUInt32LE(endOffset + 16);
  const entries = new Map<string, Buffer>();

  for (let index = 0; index < entryCount; index++) {
    if (zip.readUInt32LE(centralOffset) !== CENTRAL_DIRECTORY_SIGNATURE) {
      throw new Error('Invalid ZIP central directory');
    }

    const compressionMethod = zip.readUInt16LE(centralOffset + 10);
    const compressedSize = zip.readUInt32LE(centralOffset + 20);
    const fileNameLength = zip.readUInt16LE(centralOffset + 28);
    const extraLength = zip.readUInt16LE(centralOffset + 30);
    const commentLength = zip.readUInt16LE(centralOffset + 32);
    const localOffset = zip.readUInt32LE(centralOffset + 42);
    const fileName = zip.subarray(centralOffset + 46, centralOffset + 46 + fileNameLength).toString('utf-8');

    if (zip.readUInt32LE(localOffset) !== LOCAL_FILE_SIGNATURE) {
      throw new Error('Invalid ZIP local file header');
    }

    const localFileNameLength = zip.readUInt16LE(localOffset + 26);
    const localExtraLength = zip.readUInt16LE(localOffset + 28);
    const dataOffset = localOffset + 30 + localFileNameLength + localExtraLength;
    const compressed = zip.subarray(dataOffset, dataOffset + compressedSize);

    switch (compressionMethod) {
      case 0:
        entries.set(fileName, compressed);
        break;
      case 8:
        entries.set(fileName, inflateRawSync(compressed));
        break;
      default:
        throw new Error(`Unsupported ZIP compression method: ${compressionMethod}`);
    }

    centralOffset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function findEndOfCentralDirectory(zip: Buffer) {
  const minimumOffset = Math.max(0, zip.length - 65_557);
  for (let offset = zip.length - 22; offset >= minimumOffset; offset--) {
    if (zip.readUInt32LE(offset) === END_OF_CENTRAL_DIRECTORY_SIGNATURE) return offset;
  }
  throw new Error('ZIP end of central directory not found');
}
