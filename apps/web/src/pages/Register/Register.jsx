import { motion } from 'framer-motion';
import Card from '@/components/ui/Card';
import SyncPulse from '@/components/brand/SyncPulse';
import RegisterForm from '@/features/auth/components/RegisterForm';

export default function Register() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-stage px-6 py-12">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-96 w-96 rounded-full bg-ember/10 blur-[120px]" />
        <div className="absolute top-40 right-1/4 h-96 w-96 rounded-full bg-pulse-violet/10 blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm"
      >
        <div className="mb-8 flex flex-col items-center gap-2">
          <SyncPulse size={36} live />
          <h1 className="font-display text-2xl font-bold">Create your account</h1>
          <p className="text-sm text-paper-muted">Start a room in under a minute.</p>
        </div>

        <Card>
          <RegisterForm />
        </Card>
      </motion.div>
    </main>
  );
}