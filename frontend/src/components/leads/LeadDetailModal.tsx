import { useEffect, useState } from 'react';
import {
  X,
  Phone,
  Mail,
  MapPin,
  MessageSquare,
  Package,
  Calendar,
  User,
  Mic,
} from 'lucide-react';
import { leadsApi } from '../../services/api';
import type { Lead, LeadStatus } from '../../types';

interface LeadDetailModalProps {
  leadId: number;
  onClose: () => void;
  onStatusChange?: (id: number, status: LeadStatus) => void;
}

const statusLabels: Record<LeadStatus, { label: string; color: string }> = {
  nuevo: { label: 'Nuevo', color: 'bg-blue-100 text-blue-700' },
  en_conversacion: { label: 'En conversación', color: 'bg-yellow-100 text-yellow-700' },
  potencial: { label: 'Potencial', color: 'bg-purple-100 text-purple-700' },
  venta_cerrada: { label: 'Venta cerrada', color: 'bg-green-100 text-green-700' },
  perdido: { label: 'Perdido', color: 'bg-red-100 text-red-700' },
};

const sourceLabels: Record<string, string> = {
  website: 'Sitio Web',
  whatsapp: 'WhatsApp',
  elevenlabs: 'Ana (Voz)',
  referido: 'Referido',
  otro: 'Otro',
};

export default function LeadDetailModal({ leadId, onClose, onStatusChange }: LeadDetailModalProps) {
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLead = async () => {
      try {
        const data = await leadsApi.getById(leadId);
        setLead(data);
      } catch (error) {
        console.error('Error fetching lead:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchLead();
  }, [leadId]);

  const handleStatusChange = async (newStatus: LeadStatus) => {
    if (!lead) return;
    try {
      await leadsApi.updateStatus(lead.id, newStatus);
      setLead({ ...lead, status: newStatus });
      onStatusChange?.(lead.id, newStatus);
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8">
          <div className="animate-spin w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  if (!lead) {
    return null;
  }

  const statusInfo = statusLabels[lead.status];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{lead.name}</h2>
            <p className="text-sm text-gray-500">Lead #{lead.id}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Status */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Estado</label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(statusLabels) as LeadStatus[]).map((status) => (
                <button
                  key={status}
                  onClick={() => handleStatusChange(status)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    lead.status === status
                      ? statusLabels[status].color
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {statusLabels[status].label}
                </button>
              ))}
            </div>
          </div>

          {/* Contact info */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Phone className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-xs text-gray-500">Teléfono</p>
                <a href={`tel:${lead.phone}`} className="text-sm font-medium text-cyan-600 hover:underline">
                  {lead.phone}
                </a>
              </div>
            </div>

            {lead.email && (
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Mail className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Email</p>
                  <a href={`mailto:${lead.email}`} className="text-sm font-medium text-cyan-600 hover:underline">
                    {lead.email}
                  </a>
                </div>
              </div>
            )}

            {lead.address && (
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg col-span-2">
                <MapPin className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Dirección</p>
                  <p className="text-sm font-medium">{lead.address}</p>
                  {lead.city && <p className="text-xs text-gray-500">{lead.city}</p>}
                </div>
              </div>
            )}
          </div>

          {/* Product interest */}
          {lead.product_interest && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <Package className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">Producto de interés</span>
              </div>
              <span className="inline-block bg-cyan-50 text-cyan-700 px-3 py-1 rounded-lg text-sm">
                {lead.product_interest}
              </span>
            </div>
          )}

          {/* Source & dates */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <User className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">Origen</span>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${
                lead.source === 'elevenlabs' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'
              }`}>
                {lead.source === 'elevenlabs' && <Mic className="w-3 h-3" />}
                {sourceLabels[lead.source]}
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">Creado</span>
              </div>
              <p className="text-sm text-gray-600">
                {new Date(lead.created_at).toLocaleDateString('es-CO', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>

          {/* Notes */}
          {lead.notes && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">Notas</span>
              </div>
              <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg whitespace-pre-wrap">
                {lead.notes}
              </p>
            </div>
          )}

          {/* Conversation transcript */}
          {lead.conversation_transcript && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Mic className="w-4 h-4 text-purple-500" />
                <span className="text-sm font-medium text-gray-700">Transcripción de Ana</span>
              </div>
              <div className="bg-purple-50 border border-purple-100 rounded-lg p-4 max-h-60 overflow-y-auto">
                <p className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                  {lead.conversation_transcript}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
          <a
            href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
            WhatsApp
          </a>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
