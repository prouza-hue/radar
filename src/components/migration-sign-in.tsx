import {Link} from '@tanstack/react-router';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
export function MigrationSignInDialog({open,onClose}:{open:boolean;onClose:()=>void}){
 return <Dialog open={open} onOpenChange={value=>{if(!value)onClose()}}><DialogContent className="auth-dialog"><DialogHeader><DialogTitle>Tvůj původní účet.</DialogTitle><DialogDescription>Nový web připojíme k tvému existujícímu Radaru jednorázovým kódem. Nevznikne prázdná kopie účtu.</DialogDescription></DialogHeader><Link to="/connect" className="primary wide" onClick={onClose}>Připojit původní účet</Link><p className="migration-login-note">Přechodné řešení při přesunu hostingu. Připojení potvrdíš na původním Radaru; seznam a označení zůstávají ve stejné databázi.</p></DialogContent></Dialog>;
}
