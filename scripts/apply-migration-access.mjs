import {readFile,writeFile} from 'node:fs/promises';
const path='src/components/auth-dialog.tsx';let s=await readFile(path,'utf8');
if(!s.includes('MigrationSignInDialog')){
 s='import {MigrationSignInDialog} from "./migration-sign-in";\n'+s;
 const marker=' return <Dialog open={open}';if(s.split(marker).length!==2)throw Error('Unexpected auth dialog baseline');
 s=s.replace(marker,' if(import.meta.env.VITE_MIGRATION_MODE === "true")return <MigrationSignInDialog open={open} onClose={onClose}/>;\n return <Dialog open={open}');await writeFile(path,s);
}
console.log('Transitional account access adapter present; original auth implementation retained.');
