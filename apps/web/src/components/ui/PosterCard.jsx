import { motion } from 'framer-motion';
import { Play, Users, Lock, Globe, KeyRound } from 'lucide-react';
import clsx from 'clsx';

const ART = [
  'from-[#FF4D4D] to-[#7C3AED]',
  'from-[#F97316] to-[#EC4899]',
  'from-[#7C3AED] to-[#22D3EE]',
  'from-[#EC4899] to-[#FF8A3D]',
  'from-[#0EA5E9] to-[#7C3AED]',
  'from-[#F59E0B] to-[#FF4D4D]',
];

function artFor(id = '') {
  const sum = [...id].reduce((n, c) => n + c.charCodeAt(0), 0);
  return ART[sum % ART.length];
}

const VISIBILITY_ICON = {
  PUBLIC: Globe,
  PRIVATE: Lock,
  PASSWORD_PROTECTED: KeyRound,
};

export default function PosterCard({ room, onClick }) {
  const VisIcon = VISIBILITY_ICON[room.visibility] || Lock;
  const memberCount = room.memberCount ?? room.members?.length ?? 0;

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -6 }}
      whileTap={{ scale: 0.98 }}
      className="group w-full shrink-0 text-left"
    >
      <div
        className={clsx(
          'relative aspect-video overflow-hidden rounded-poster bg-gradient-to-br shadow-card transition-shadow duration-300 group-hover:shadow-card-hover',
          artFor(room.id || room.code || room.name)
        )}
      >
        <div className="absolute inset-0 bg-black/10 transition-colors duration-300 group-hover:bg-black/0" />

        <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-ember-hot" />
          {room.mode?.replace('_', ' ') || 'Room'}
        </div>

        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-stage">
            <Play className="h-5 w-5 fill-current" />
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 bg-stage-fade p-3 pt-8">
          <p className="truncate font-display text-sm font-bold text-white">{room.name}</p>
          <div className="mt-1 flex items-center gap-3 text-xs text-white/70">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" /> {memberCount}
            </span>
            <span className="flex items-center gap-1">
              <VisIcon className="h-3 w-3" /> {room.visibility?.toLowerCase().replace('_', ' ')}
            </span>
          </div>
        </div>
      </div>
    </motion.button>
  );
}