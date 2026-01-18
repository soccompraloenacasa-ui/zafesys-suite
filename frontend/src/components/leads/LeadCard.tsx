import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Phone, MessageCircle, Globe, Mic, User } from 'lucide-react';
import type { LeadKanban, LeadSource } from '../../types';

interface LeadCardProps {
  lead: LeadKanban;
  onClick: () => void;
}

const sourceIcons: Record<LeadSource, typeof Phone> = {
  website: Globe,
  whatsapp: MessageCircle,
  elevenlabs: Mic,
  ana_voice: Mic,
  referido: User,
  otro: User,
};

const sourceColors: Record<LeadSource, string> = {
  website: 'bg-blue-100 text-blue-600',
  whatsapp: 'bg-green-100 text-green-600',
  elevenlabs: 'bg-purple-100 text-purple-600',
  ana_voice: 'bg-purple-100 text-purple-600',
  referido: 'bg-orange-100 text-orange-600',
  otro: 'bg-gray-100 text-gray-600',
};

export default function LeadCard({ lead, onClick }: LeadCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const SourceIcon = sourceIcons[lead.source];
  const timeAgo = getTimeAgo(lead.created_at);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`kanban-card ${isDragging ? 'dragging' : ''}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-medium text-gray-900 text-sm truncate flex-1">
          {lead.name}
        </h4>
        <span className={`ml-2 p-1 rounded ${sourceColors[lead.source]}`}>
          <SourceIcon className="w-3 h-3" />
        </span>
      </div>

      {/* Phone */}
      <div className="flex items-center gap-1.5 text-gray-500 text-xs mb-2">
        <Phone className="w-3 h-3" />
        <span>{lead.phone}</span>
      </div>

      {/* Product interest */}
      {lead.product_interest && (
        <div className="mb-2">
          <span className="inline-block bg-cyan-50 text-cyan-700 text-xs px-2 py-0.5 rounded">
            {lead.product_interest}
          </span>
        </div>
      )}

      {/* Time */}
      <div className="text-xs text-gray-400">
        {timeAgo}
      </div>
    </div>
  );
}

function getTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) return `Hace ${diffMins} min`;
  if (diffHours < 24) return `Hace ${diffHours}h`;
  if (diffDays < 7) return `Hace ${diffDays}d`;
  return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}
