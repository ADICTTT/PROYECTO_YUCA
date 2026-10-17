import { Component, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, debounceTime, distinctUntilChanged, of, switchMap, tap } from 'rxjs';
import { CompaneroBusqueda, ReservasService } from '../../services/reserva.service';

let contador = 0;

@Component({
  selector: 'app-companero-selector',
  standalone: true,
  templateUrl: './companero-selector.component.html',
})
export class CompaneroSelectorComponent {
  private readonly reservas = inject(ReservasService);

  // El padre guarda la elección; este componente solo la muestra y la emite
  readonly seleccionado = input<CompaneroBusqueda | null>(null);
  readonly elegir = output<CompaneroBusqueda | null>();

  readonly uid = `companero-${contador++}`;
  readonly texto = signal('');
  readonly resultados = signal<CompaneroBusqueda[]>([]);
  readonly buscando = signal(false);
  readonly abierto = signal(false);
  readonly activo = signal(-1);
  readonly fallo = signal('');

  private readonly consulta$ = new Subject<string>();

  constructor() {
    this.consulta$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        tap((q) => {
          if (q.length >= 2) this.buscando.set(true);
        }),
        switchMap((q) =>
          q.length < 2
            ? of<CompaneroBusqueda[]>([])
            : this.reservas.buscarCompaneros(q).pipe(
                catchError((e) => {
                  this.fallo.set(
                    e?.status === 429
                      ? 'Hiciste muchas búsquedas. Espera un minuto.'
                      : 'No se pudo buscar. Intenta de nuevo.',
                  );
                  return of<CompaneroBusqueda[]>([]);
                }),
              ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((lista) => {
        this.resultados.set(lista);
        this.buscando.set(false);
        this.activo.set(lista.length > 0 ? 0 : -1);
        this.abierto.set(true);
      });
  }

  escribir(valor: string): void {
    this.texto.set(valor);
    this.fallo.set('');
    const q = valor.trim();
    if (q.length < 2) {
      this.resultados.set([]);
      this.buscando.set(false);
      this.activo.set(-1);
    }
    this.consulta$.next(q);
  }

  abrir(): void {
    if (this.texto().trim().length >= 2) this.abierto.set(true);
  }

  cerrar(): void {
    this.abierto.set(false);
  }

  teclado(e: KeyboardEvent): void {
    const lista = this.resultados();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.abierto.set(true);
      if (lista.length) this.activo.update((i) => (i + 1) % lista.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (lista.length) this.activo.update((i) => (i <= 0 ? lista.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      const i = this.activo();
      if (this.abierto() && i >= 0 && lista[i]) {
        e.preventDefault();
        this.elegirItem(lista[i]);
      }
    } else if (e.key === 'Escape') {
      this.cerrar();
    }
  }

  elegirItem(c: CompaneroBusqueda): void {
    this.texto.set('');
    this.resultados.set([]);
    this.activo.set(-1);
    this.abierto.set(false);
    this.consulta$.next('');
    this.elegir.emit(c);
  }

  quitar(): void {
    this.elegir.emit(null);
  }
}