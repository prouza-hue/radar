export type LibrarySortMode = "added" | "alpha";

type LibrarySortRow = {
  title: {name: string};
  titleKey?: string;
  addedAt?: number;
  _creationTime?: number;
};

const collator = new Intl.Collator("cs-CZ", {
  sensitivity: "base",
  numeric: true,
});

const added = (row: LibrarySortRow) => row.addedAt ?? row._creationTime ?? 0;

export function sortLibraryRows<T extends LibrarySortRow>(rows: T[], mode: LibrarySortMode): T[] {
  return [...rows].sort((a, b) => {
    if (mode === "alpha") {
      return collator.compare(a.title.name, b.title.name)
        || added(b) - added(a)
        || (a.titleKey || "").localeCompare(b.titleKey || "");
    }
    return added(b) - added(a)
      || collator.compare(a.title.name, b.title.name)
      || (a.titleKey || "").localeCompare(b.titleKey || "");
  });
}
