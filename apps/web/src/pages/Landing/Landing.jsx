import { motion } from 'framer-motion';
import { Play, Users, Radio } from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import SyncPulse from '@/components/brand/SyncPulse';

const FEATURES = [
  { icon: Play, title: 'Watch together', desc: 'YouTube, local files, or sync your own streaming subscriptions in real time.' },
  { icon: Radio, title: 'Listen together', desc: 'Queue tracks, hand off the aux, never lose the beat between you.' },
  { icon: Users, title: 'Stay in the room', desc: 'Voice, video and chat running alongside whatever you are sharing.' },
];

export default function Landing() {
  return (
    <main className="min-h-screen overflow-hidden">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-40 left-1/4 h-96 w-96 rounded-full bg-sync-violet/20 blur-[120px]" />
        <div className="absolute top-40 right-1/4 h-96 w-96 rounded-full bg-sync-teal/20 blur-[120px]" />
      </div>

      <nav className="flex items-center justify-between px-6 py-5 md:px-12">
        <div className="flex items-center gap-2">
          <SyncPulse size={28} live />
          <span className="font-display text-lg font-bold">SyncSpace</span>
        </div>
        <div className="hidden items-center gap-8 text-sm text-ink-muted md:flex">
          <a href="#features" className="hover:text-ink">Features</a>
          <a href="#how" className="hover:text-ink">How it works</a>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm">Log in</Button>
          <Button variant="primary" size="sm">Sign up</Button>
        </div>
      </nav>

      <section className="mx-auto flex max-w-4xl flex-col items-center px-6 pt-20 text-center md:pt-32">
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="font-display text-4xl font-extrabold leading-tight md:text-6xl"
        >
          Watch together.<br />
          <span className="gradient-text">Stay together.</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mt-6 max-w-xl text-ink-muted"
        >
          Same show, same beat, different cities. SyncSpace keeps your video, music
          and chat perfectly in sync with the people who matter, wherever you are.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-8 flex gap-4"
        >
          <Button size="lg">Create a room</Button>
          <Button variant="secondary" size="lg">See how it works</Button>
        </motion.div>
      </section>

      <section id="features" className="mx-auto grid max-w-5xl gap-6 px-6 py-24 md:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, desc }) => (
          <Card key={title} className="text-left">
            <Icon className="mb-4 h-6 w-6 text-sync-teal" />
            <h3 className="font-display font-bold">{title}</h3>
            <p className="mt-2 text-sm text-ink-muted">{desc}</p>
          </Card>
        ))}
      </section>
    </main>
  );
}