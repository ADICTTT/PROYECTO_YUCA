export interface PersonaReserva {
  perfilId: number;
  nombreComercial?: string;
  instagram?: string;
}

export interface ReservaExport {
  estado: string;
  stand: { codigo: string };
  titular?: PersonaReserva;
  companero?: PersonaReserva;
}

const limpiar = (t: string) => t.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();
const celda = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const extension = (u: string) =>
  u.split('?')[0].match(/\.(jpe?g|png|webp)$/i)?.[1].toLowerCase() ?? 'jpg';

/**
 * Exporta SOLO reservas pagadas (CONFIRMADA): una fila por mesa.
 * @param fotosPorPerfil Map<perfilId, foto_url>
 * @param carpetaLocal   carpeta de tu PC donde dejarás las fotos, ej: 'D:/yuca/fotos/'
 * @param origenArchivos origen del backend para fotos antiguas (/uploads/...)
 * @returns personas cuya foto falta o no se pudo descargar
 */
export async function exportarCredenciales(
  reservas: ReservaExport[],
  fotosPorPerfil: Map<number, string>,
  carpetaLocal: string,
  origenArchivos: string,
): Promise<string[]> {
  const { default: JSZip } = await import('jszip');
  const base = carpetaLocal.replace(/\\/g, '/').replace(/\/?$/, '/');
  const urlAbsoluta = (u: string) => (u.startsWith('http') ? u : origenArchivos + u);

  const zip = new JSZip();
  const carpeta = zip.folder('fotos')!;
  const faltantes: string[] = [];
  const hechas = new Map<number, string>();

  async function foto(p?: PersonaReserva): Promise<string> {
    if (!p) return '';
    if (hechas.has(p.perfilId)) return base + hechas.get(p.perfilId)!;

    const url = fotosPorPerfil.get(p.perfilId);
    if (!url) {
      faltantes.push(`${p.nombreComercial} (sin foto)`);
      return '';
    }
    try {
      const resp = await fetch(urlAbsoluta(url));
      if (!resp.ok) throw new Error(String(resp.status));
      const archivo = `${p.perfilId}_${limpiar(p.nombreComercial ?? 'perfil')}.${extension(url)}`;
      carpeta.file(archivo, await resp.blob());
      hechas.set(p.perfilId, archivo);
      return base + archivo;
    } catch {
      faltantes.push(`${p.nombreComercial} (foto perdida o no descargable)`);
      return '';
    }
  }

  const pagadas = reservas
    .filter((r) => r.estado === 'CONFIRMADA' && r.titular)
    .sort((a, b) => a.stand.codigo.localeCompare(b.stand.codigo, 'es', { numeric: true }));

  const encabezados = ['Mesa', 'Nombre', 'Nombre1', 'Instagram1', 'Nombre2', 'Instagram2', '@Foto1', '@Foto2'];
  const filas: string[][] = [];

  for (const r of pagadas) {
    const t = r.titular!;
    const c = r.companero;
    filas.push([
      r.stand.codigo,
      [t.nombreComercial, c?.nombreComercial].filter(Boolean).join(' / '),
      t.nombreComercial ?? '',
      t.instagram ?? '',
      c?.nombreComercial ?? '',
      c?.instagram ?? '',
      await foto(t),
      await foto(c),
    ]);
  }

  const csv = [encabezados, ...filas].map((f) => f.map(celda).join(',')).join('\r\n');
  zip.file('credenciales.csv', '\uFEFF' + csv);
  if (faltantes.length) zip.file('faltan-fotos.txt', faltantes.join('\r\n'));

  const blob = await zip.generateAsync({ type: 'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'credenciales-yuca.zip';
  a.click();
  URL.revokeObjectURL(a.href);

  return faltantes;
}