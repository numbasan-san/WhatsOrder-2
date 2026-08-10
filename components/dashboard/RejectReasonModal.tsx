'use client';

import { useState } from 'react';
import Modal from './Modal';
import { RAZONES_RECHAZO } from '@/lib/utils/constants';

interface RejectReasonModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (motivo: string) => void;
  customerName: string;
}

export default function RejectReasonModal({ open, onClose, onConfirm, customerName }: RejectReasonModalProps) {
  const [motivo, setMotivo] = useState(RAZONES_RECHAZO[0]);
  const [otro, setOtro] = useState('');
  const usaOtro = motivo === '__otro__';

  const handleConfirm = () => {
    const razonFinal = usaOtro ? otro.trim() : motivo;
    if (!razonFinal) return;
    onConfirm(razonFinal);
    setOtro('');
    setMotivo(RAZONES_RECHAZO[0]);
  };

  return (
    <Modal open={open} onClose={onClose} title="Rechazar pedido" maxWidth="max-w-md">
      <p className="mb-4 text-sm text-slate-500">
        Indica el motivo de rechazo para <span className="font-medium text-slate-700">{customerName}</span>. El
        cliente verá esta razón en la conversación de WhatsApp.
      </p>

      <div className="space-y-2">
        {RAZONES_RECHAZO.map((r) => (
          <label
            key={r}
            className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition ${
              motivo === r ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <input
              type="radio"
              name="motivo"
              className="h-3.5 w-3.5 accent-rose-500"
              checked={motivo === r}
              onChange={() => setMotivo(r)}
            />
            {r}
          </label>
        ))}
        <label
          className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition ${
            usaOtro ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <input
            type="radio"
            name="motivo"
            className="h-3.5 w-3.5 accent-rose-500"
            checked={usaOtro}
            onChange={() => setMotivo('__otro__')}
          />
          Otro motivo
        </label>
        {usaOtro && (
          <input
            type="text"
            autoFocus
            value={otro}
            onChange={(e) => setOtro(e.target.value)}
            placeholder="Escribe el motivo…"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
          />
        )}
      </div>

      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={usaOtro && !otro.trim()}
          className="flex-1 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Confirmar rechazo
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-200"
        >
          Cancelar
        </button>
      </div>
    </Modal>
  );
}