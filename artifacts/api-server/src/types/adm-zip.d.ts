declare module "adm-zip" {
  interface ZipEntry {
    entryName: string;
    isDirectory: boolean;
    isFile(): boolean;
    isDirectory(): boolean;
    getData(): Buffer;
  }

  class AdmZip {
    constructor(input?: string | Buffer);
    addFile(entryName: string, content: Buffer): void;
    getEntry(entryName: string): ZipEntry | null;
    getEntries(): ZipEntry[];
    toBuffer(): Buffer;
  }

  export = AdmZip;
}