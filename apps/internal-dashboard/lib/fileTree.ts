import type { FileRow } from "./hackatimeFiles";

// The review page's file browser: the repository's paths as a directory tree,
// with each file's tracked seconds rolled up into its parent directories. Same
// shape as Ari's fileTree.ts, so the two dashboards read the same way.

export interface FileTreeLeaf {
  name: string;
  row: FileRow;
}

export interface FileTreeDirectory {
  name: string;
  path: string;
  directories: FileTreeDirectory[];
  files: FileTreeLeaf[];
  seconds: number;
}

const emptyDirectory = (name: string, path: string): FileTreeDirectory => ({
  name,
  path,
  directories: [],
  files: [],
  seconds: 0,
});

export function buildFileTree(rows: readonly FileRow[]): FileTreeDirectory {
  const root = emptyDirectory("", "");
  // A map, so a directory called "constructor" cannot collide with an object key.
  const byPath = new Map<string, FileTreeDirectory>([["", root]]);
  const directoryFor = (path: string): FileTreeDirectory => {
    const known = byPath.get(path);
    if (known) return known;
    const cut = path.lastIndexOf("/");
    const parent = directoryFor(cut >= 0 ? path.slice(0, cut) : "");
    const node = emptyDirectory(path.slice(cut + 1), path);
    parent.directories.push(node);
    byPath.set(path, node);
    return node;
  };

  for (const row of rows) {
    const cut = row.path.lastIndexOf("/");
    directoryFor(cut >= 0 ? row.path.slice(0, cut) : "").files.push({
      name: row.path.slice(cut + 1),
      row,
    });
  }

  const total = (node: FileTreeDirectory): number => {
    node.directories.sort((first, second) => first.name.localeCompare(second.name));
    node.files.sort((first, second) => first.name.localeCompare(second.name));
    node.seconds =
      node.files.reduce((sum, file) => sum + file.row.seconds, 0) +
      node.directories.reduce((sum, directory) => sum + total(directory), 0);
    return node.seconds;
  };
  total(root);

  // A chain of directories with one child each reads as one row: "src/lib"
  // instead of two levels of a lone folder.
  const compact = (node: FileTreeDirectory) => {
    node.directories = node.directories.map((directory) => {
      let folded = directory;
      while (folded.directories.length === 1 && folded.files.length === 0) {
        const only = folded.directories[0]!;
        only.name = `${folded.name}/${only.name}`;
        folded = only;
      }
      compact(folded);
      return folded;
    });
  };
  compact(root);
  return root;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${bytes} B`;
}
