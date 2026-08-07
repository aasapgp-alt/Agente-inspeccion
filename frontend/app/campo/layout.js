import './campo.css';

export const metadata = {
  title: 'Inspector PGP - Modo Campo',
  description: 'PWA Móvil de Campo para Inspección Técnica Industrial'
};

export default function CampoLayout({ children }) {
  return (
    <div className="campo-wrapper bg-slate-950 text-slate-100 min-h-screen">
      {children}
    </div>
  );
}
