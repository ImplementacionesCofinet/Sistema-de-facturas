// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useActionState, useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(cleanup);

/**
 * El jefe de area aprueba o rechaza con dos botones del mismo formulario, y el
 * servidor necesita saber cual se pulso. Apoyarse en el name/value del boton
 * fallo en produccion: la accion recibia el formulario sin ese dato y respondia
 * "Debe indicar si aprueba o rechaza" aunque la persona si hubiera pulsado.
 *
 * Ahora la decision va en un campo propio que el clic escribe antes de enviar.
 * Estas pruebas cubren ese contrato.
 */
function Formulario({ alEnviar }: { alEnviar: (f: FormData) => void }) {
  const [, accion, enviando] = useActionState(
    async (_previo: { ok: boolean }, formulario: FormData) => {
      await new Promise((r) => setTimeout(r, 10));
      alEnviar(formulario);
      return { ok: true };
    },
    { ok: false },
  );

  const decisionRef = useRef<HTMLInputElement>(null);
  const marcarDecision = (valor: 'APROBADA' | 'RECHAZADA') => {
    if (decisionRef.current) decisionRef.current.value = valor;
  };

  return (
    <form action={accion}>
      <input type="hidden" name="id" value="factura-1" />
      <input type="hidden" name="decision" ref={decisionRef} defaultValue="" />
      <textarea name="observaciones" defaultValue="" />
      {/* El formulario real lleva un adjunto: obliga a codificar en multipart. */}
      <input type="file" name="soporte" />
      <button type="submit" onClick={() => marcarDecision('APROBADA')} disabled={enviando}>
        {enviando ? 'Guardando…' : 'Aprobar'}
      </button>
      <button type="submit" onClick={() => marcarDecision('RECHAZADA')} disabled={enviando}>
        Rechazar
      </button>
    </form>
  );
}

async function enviarPulsando(texto: string): Promise<FormData> {
  const alEnviar = vi.fn();
  render(<Formulario alEnviar={alEnviar} />);
  fireEvent.click(screen.getByText(texto));
  await waitFor(() => expect(alEnviar).toHaveBeenCalled());
  return alEnviar.mock.calls[0][0] as FormData;
}

describe('decision del jefe de area', () => {
  it('manda APROBADA al pulsar Aprobar', async () => {
    const formulario = await enviarPulsando('Aprobar');
    expect(formulario.get('decision')).toBe('APROBADA');
    expect(formulario.get('id')).toBe('factura-1');
  });

  it('manda RECHAZADA al pulsar Rechazar', async () => {
    expect((await enviarPulsando('Rechazar')).get('decision')).toBe('RECHAZADA');
  });

  it('la decision va en un campo propio, no en el boton', () => {
    render(<Formulario alEnviar={vi.fn()} />);

    // Si alguien devolviera el name/value a los botones, el formulario tendria
    // dos campos "decision" y cual gana dependeria del orden.
    const botones = screen.getAllByRole('button');
    for (const boton of botones) {
      expect(boton.getAttribute('name')).toBeNull();
    }
    expect(document.querySelector('input[type="hidden"][name="decision"]')).not.toBeNull();
  });

  it('el campo empieza vacio: sin pulsar no hay decision', () => {
    render(<Formulario alEnviar={vi.fn()} />);
    const campo = document.querySelector<HTMLInputElement>('input[name="decision"]');
    expect(campo?.value).toBe('');
  });
});
