import React from "react";
import { X, QrCode } from "lucide-react";

interface QrCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  qrModalEvent: any;
}

export default function QrCodeModal({ isOpen, onClose, qrModalEvent }: QrCodeModalProps) {
  if (!isOpen || !qrModalEvent) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800/80 rounded-3xl p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-white cursor-pointer transition-colors"
        >
          <X className="w-4.5 h-4.5" />
        </button>

        <h3 className="text-xl font-black text-white mb-6 flex items-center gap-2.5">
          <QrCode className="w-5.5 h-5.5 text-rose-500" />
          QR Code de l'Événement
        </h3>

        <div className="flex flex-col items-center justify-center py-6 bg-slate-950 rounded-2xl border border-slate-900">
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
              qrModalEvent.code
            )}&color=0-0-0&bgcolor=255-255-255`}
            alt={`QR Code for ${qrModalEvent.code}`}
            className="w-48 h-48 rounded-xl border-4 border-white mb-2"
          />
          <span className="mt-3 font-mono text-sm font-bold text-white tracking-widest uppercase">
            {qrModalEvent.code}
          </span>
          <span className="text-xs text-slate-500 mt-1 font-bold">{qrModalEvent.name}</span>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-800/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-800 text-sm font-bold text-slate-300 hover:text-white transition-all cursor-pointer bg-transparent"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
