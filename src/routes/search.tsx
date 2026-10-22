import {createFileRoute} from '@tanstack/react-router';
import {RadarPage} from '@/components/radar';
export const Route=createFileRoute('/search')({component:()=> <RadarPage view="search"/>});
