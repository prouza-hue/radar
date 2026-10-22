import {readFile,writeFile} from 'node:fs/promises';
const path='src/components/personal-radar.tsx';
let source=await readFile(path,'utf8');
if(source.includes('data-testid="library-media-filter"')){console.log('Moje media filter already applied.');process.exit(0);}
function replace(oldText,newText){if(source.split(oldText).length!==2)throw new Error('Unexpected original source: '+oldText.slice(0,70));source=source.replace(oldText,newText);}
replace('import {sortLibraryRows, type LibrarySortMode} from "@/lib/librarySort";', 'import {sortLibraryRows, type LibrarySortMode} from "@/lib/librarySort";\nimport {filterLibraryRows, parseLibraryMedia, LIBRARY_MEDIA_STORAGE_KEY, type LibraryMediaFilter} from "@/lib/libraryFilter";');
replace('  const [syncError, setSyncError] = useState(false), [retry, setRetry] = useState(0);','  const [mediaFilter, setMediaFilter] = useState<LibraryMediaFilter>("all");\n  const [syncError, setSyncError] = useState(false), [retry, setRetry] = useState(0);');
replace('      if (savedSort === "alpha" || savedSort === "added") setSortMode(savedSort);','      if (savedSort === "alpha" || savedSort === "added") setSortMode(savedSort);\n      setMediaFilter(parseLibraryMedia(localStorage.getItem(LIBRARY_MEDIA_STORAGE_KEY)));');
replace('  const filteredLibraryRows = rows.filter(r => filter === "all" || r.progress.status === filter);','  const filteredLibraryRows = filterLibraryRows(rows, filter, mediaFilter);');
replace('      : <><div className="library-toolbar">',`      : <><div className="filter-row library-media" role="group" aria-label="Typ titulů v Mých" data-testid="library-media-filter">
        {([["all", "Vše"], ["tv", "Seriály"], ["movie", "Filmy"]] as const).map(([key,label]) =>
          <button type="button" key={key} className={\`filter \${mediaFilter === key ? "selected" : ""}\`} aria-pressed={mediaFilter === key}
            onClick={() => {setMediaFilter(key); try {localStorage.setItem(LIBRARY_MEDIA_STORAGE_KEY, key);} catch {}}}>{label}</button>)}
      </div><div className="library-toolbar">`);
await writeFile(path,source);console.log('Applied only Moje media state, control and combined filter.');
