import type { Stats } from 'node:fs';
import path from 'node:path';
import * as tar from 'tar';
import { PwaNavError } from '../core/errors.js';

export type ArchiveFilter = (path: string, stat: Stats) => boolean;

/**
 * Creates a gzip-compressed tar archive from a directory.
 * @param dir Source directory to pack.
 * @param file Destination tar.gz archive file.
 * @param filter Optional predicate to filter files (returning false excludes entry).
 */
export async function packDir(
  dir: string,
  file: string,
  filter?: ArchiveFilter,
): Promise<void> {
  const cwd = path.resolve(dir);
  await tar.create(
    {
      gzip: true,
      file,
      cwd,
      filter: filter
        ? (p: string, entry: Stats | tar.ReadEntry) => {
            return filter(p, entry as Stats);
          }
        : undefined,
    },
    ['.'],
  );
}

/**
 * Safely extracts a gzip-compressed tar archive into a destination directory.
 * Inspects archive first to reject symlink and hardlink entries for security.
 * @param file Archive to extract.
 * @param dir Target directory.
 */
export async function unpackFile(file: string, dir: string): Promise<void> {
  const cwd = path.resolve(dir);
  const filePath = path.resolve(file);

  const foundLinks: { path: string; type: string }[] = [];
  await tar.list({
    file: filePath,
    onentry: (entry: tar.ReadEntry) => {
      const type = entry.type;
      if (
        type === 'SymbolicLink' ||
        type === 'Link' ||
        (type as unknown as string) === '1' ||
        (type as unknown as string) === '2'
      ) {
        foundLinks.push({ path: entry.path, type });
      }
    },
  });

  const firstLink = foundLinks[0];
  if (firstLink !== undefined) {
    throw new PwaNavError(
      'invalid_args',
      `Archive contains forbidden link entry: ${firstLink.path} (type: ${firstLink.type})`,
      { hint: 'Tar archive cannot contain symlinks or hardlinks.' },
    );
  }

  await tar.extract({
    file: filePath,
    cwd,
  });
}
