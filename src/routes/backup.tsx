import {createFileRoute} from '@tanstack/react-router';
import {Shell,PageHeading} from '@/components/radar';
import {PersonalBackup} from '@/components/personal-backup';
export const Route=createFileRoute('/backup')({component:()=> <Shell><PageHeading title="Záloha Radaru" subtitle="Tvoje označení patří tobě."/><PersonalBackup/></Shell>});
