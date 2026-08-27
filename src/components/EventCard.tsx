import { Calendar, MapPin, Ticket } from 'lucide-react';
import React from 'react';
import { Event } from '../types';

interface EventCardProps {
  event: Event & { ticket_types?: any[] };
  onClick: (slug: string) => void;
}

export const EventCard: React.FC<EventCardProps> = ({ event, onClick }) => {
  const minPriceKobo = event.ticket_types && event.ticket_types.length > 0
    ? Math.min(...event.ticket_types.map((tt) => tt.price_kobo))
    : 0;

  const formattedPrice = minPriceKobo === 0 ? 'Free' : `₦${(minPriceKobo / 100).toLocaleString()}`;

  const eventDate = new Date(event.start_date).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div
      onClick={() => onClick(event.slug)}
      className="bg-white border border-zinc-100 rounded-lg overflow-hidden shadow-sm hover:border-zinc-200 hover:shadow-sm hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col group"
    >
      {/* Cover Image Banner */}
      <div className="relative h-48 w-full overflow-hidden bg-zinc-50">
        <img
          src={event.cover_image}
          alt={event.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />

        {/* Category Badge */}
        <span className="absolute top-3 left-3 bg-zinc-950/45  text-teal-700 font-semibold text-[11px] px-3 py-1 rounded-full border border-teal-600/20">
          {event.category}
        </span>

        {/* Price Tag */}
        <div className="absolute bottom-3 right-3 bg-teal-700 text-white font-bold text-sm px-3.5 py-1 rounded-md border border-teal-800">
          {formattedPrice}
        </div>
      </div>

      {/* Content */}
      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div className="space-y-2">
          <h3 className="font-bold text-lg text-zinc-950 group-hover:text-teal-700 transition-colors line-clamp-1">
            {event.title}
          </h3>
          <p className="text-xs text-zinc-600 line-clamp-2 leading-relaxed">
            {event.description}
          </p>
        </div>

        {/* Metadata Details */}
        <div className="space-y-2 pt-2 border-t border-zinc-100/80 text-xs text-zinc-600">
          <div className="flex items-center space-x-2">
            <Calendar className="w-3.5 h-3.5 text-teal-700 flex-shrink-0" />
            <span>{eventDate}</span>
          </div>

          <div className="flex items-center space-x-2">
            <MapPin className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
            <span className="truncate">{event.venue}, {event.city}</span>
          </div>
        </div>

        <div className="pt-2 flex items-center justify-between">
          <span className="text-[11px] font-medium text-zinc-500">By {event.organizer_name}</span>
          <button className="text-xs font-semibold text-teal-700 hover:text-teal-600 flex items-center space-x-1 group-hover:translate-x-1 transition-transform">
            <span>Get Tickets</span>
            <Ticket className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
