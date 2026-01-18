import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import LeadCard from './LeadCard';
import type { LeadKanban, LeadStatus } from '../../types';

interface KanbanColumnProps {
  id: LeadStatus;
  title: string;
  leads: LeadKanban[];
  color: string;
  onLeadClick: (lead: LeadKanban) => void;
}

export default function KanbanColumn({ id, title, leads, color, onLeadClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div className="flex flex-col w-72 flex-shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${color}`} />
          <h3 className="font-semibold text-gray-700 text-sm">{title}</h3>
        </div>
        <span className="bg-gray-200 text-gray-600 text-xs font-medium px-2 py-0.5 rounded-full">
          {leads.length}
        </span>
      </div>

      {/* Cards container */}
      <div
        ref={setNodeRef}
        className={`kanban-column flex-1 overflow-y-auto transition-colors ${
          isOver ? 'bg-cyan-50 border-2 border-dashed border-cyan-300' : ''
        }`}
      >
        <SortableContext items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
          {leads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onClick={() => onLeadClick(lead)}
            />
          ))}
        </SortableContext>

        {leads.length === 0 && (
          <div className="flex items-center justify-center h-24 text-gray-400 text-sm">
            Sin leads
          </div>
        )}
      </div>
    </div>
  );
}
