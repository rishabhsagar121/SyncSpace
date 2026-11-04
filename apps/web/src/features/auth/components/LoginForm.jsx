import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';

import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { loginSchema } from '../schemas';
import { useLogin } from '../hooks/useAuth';

export default function LoginForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(loginSchema) });

  const login = useLogin();

  const onSubmit = (values) => {
    login.mutate(values);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <Input
        label="Email or username"
        placeholder="you@example.com"
        error={errors.identifier?.message}
        {...register('identifier')}
      />
      <Input
        label="Password"
        type="password"
        placeholder="••••••••"
        error={errors.password?.message}
        {...register('password')}
      />

      {login.isError && (
        <p className="text-sm text-ember-hot">
          {login.error?.response?.data?.message || 'Invalid credentials. Please try again.'}
        </p>
      )}

      <Button type="submit" size="lg" isLoading={login.isPending} className="mt-2">
        Log in
      </Button>

      <p className="text-center text-sm text-paper-muted">
        Don't have an account?{' '}
        <Link to="/register" className="text-ember-hot hover:underline">
          Sign up
        </Link>
      </p>
    </form>
  );
}