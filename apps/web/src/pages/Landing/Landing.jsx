import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Play, Users, Radio, MonitorPlay } from 'lucide-react';
import Button from '@/components/ui/Button';
import SyncPulse from '@/components/brand/SyncPulse';

const FEATURES = [
  { icon: MonitorPlay, title: 'Watch together', desc: 'YouTube, local files, or your own streaming tab — frame-perfect sync, every time.' },
  { icon: Radio, title: 'Listen together', desc: 'Queue tracks, hand off the aux, never lose the beat between you.' },
  { icon: Users, title: 'Stay in the room', desc: 'Voice, video and chat running right alongside whatever you\'re sharing.' },
];

// Deterministic gradient tiles standing in for a poster wall — no stock art needed.
const POSTER_ART = [
  'from-[#FF4D4D] to-[#7C3AED]',
  'from-[#F97316] to-[#EC4899]',
  'from-[#7C3AED] to-[#22D3EE]',
  'from-[#EC4899] to-[#FF8A3D]',
  'from-[#0EA5E9] to-[#7C3AED]',
  'from-[#F59E0B] to-[#FF4D4D]',
  'from-[#22D3EE] to-[#7C3AED]',
  'from-[#FF4D4D] to-[#F59E0B]',
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <main className="min-h-screen overflow-hidden bg-stage">
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 md:px-12">
        <div className="flex items-center gap-2">
          <SyncPulse size={28} live />
          <span className="font-display text-lg font-bold">SyncSpace</span>
        </div>
        <div className="hidden items-center gap-8 text-sm text-paper-muted md:flex">
          <a href="#features" className="hover:text-paper">Features</a>
          <a href="#how" className="hover:text-paper">How it works</a>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>
            Log in
          </Button>
          <Button variant="primary" size="sm" onClick={() => navigate('/register')}>
            Sign up free
          </Button>
        </div>
      </nav>

      <section className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 grid grid-cols-4 gap-2 px-2 opacity-40 sm:grid-cols-8">
          {POSTER_ART.map((g, i) => (
            <div
              key={i}
              className={`aspect-[2/3] rounded-poster bg-gradient-to-br ${g}`}
              style={{ marginTop: i % 3 === 0 ? '0' : i % 3 === 1 ? '2rem' : '1rem' }}
            />
          ))}
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-stage/40 via-stage/85 to-stage" />

        <div className="relative mx-auto flex max-w-4xl flex-col items-center px-6 pt-28 text-center md:pt-40">
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="font-display text-4xl font-extrabold leading-[1.05] md:text-6xl"
          >
            Same show.<br />
            <span className="ember-text">Different couches.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mt-6 max-w-xl text-paper-muted"
          >
            SyncSpace keeps your video, music and chat perfectly in sync with the
            people who matter — wherever they're watching from.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-8 flex flex-wrap justify-center gap-4"
          >
            <Button size="lg" onClick={() => navigate('/register')}>
              <Play className="h-4 w-4 fill-current" /> Create a room
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => {
                const el = document.getElementById('how');
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth' });
                } else {
                  window.location.hash = '#how';
                }
              }}
            >
              See how it works
            </Button>
          </motion.div>
        </div>
      </section>

      <section id="features" className="mx-auto grid max-w-5xl gap-6 px-6 py-20 md:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="surface rounded-xl2 p-6 text-left">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-ember-gradient">
              <Icon className="h-5 w-5 text-white" />
            </div>
            <h3 className="font-display font-bold">{title}</h3>
            <p className="mt-2 text-sm text-paper-muted">{desc}</p>
          </div>
        ))}
      </section>

      <section id="how" className="mx-auto max-w-5xl px-6 pb-28 pt-8">
        <div className="mb-12 text-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-ember">Simple & Fast</span>
          <h2 className="mt-2 font-display text-3xl font-extrabold md:text-4xl">How it works</h2>
          <p className="mt-3 text-paper-muted">Get your watch party running in less than 30 seconds.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="surface rounded-xl2 p-6">
            <span className="font-mono text-2xl font-bold text-ember">01</span>
            <h3 className="mt-3 font-display text-lg font-bold">Start a room</h3>
            <p className="mt-2 text-sm text-paper-muted">
              Choose YouTube, music, or streaming tab. Set your room to public, private, or password-protected.
            </p>
          </div>

          <div className="surface rounded-xl2 p-6">
            <span className="font-mono text-2xl font-bold text-ember">02</span>
            <h3 className="mt-3 font-display text-lg font-bold">Share the code</h3>
            <p className="mt-2 text-sm text-paper-muted">
              Copy your room code or invite friends directly from your friends list with one click.
            </p>
          </div>

          <div className="surface rounded-xl2 p-6">
            <span className="font-mono text-2xl font-bold text-ember">03</span>
            <h3 className="mt-3 font-display text-lg font-bold">Enjoy in sync</h3>
            <p className="mt-2 text-sm text-paper-muted">
              Play, pause, seek, chat, and talk over voice in real time — perfectly synchronized for everyone.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}