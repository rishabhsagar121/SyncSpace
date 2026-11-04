import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';

import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { registerSchema } from '../schemas';
import { useRegister } from '../hooks/useAuth';

export default function RegisterForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(registerSchema) });

  const registerUser = useRegister();

  const onSubmit = ({ confirmPassword, ...values }) => {
    registerUser.mutate(values);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <Input
        label="Username"
        placeholder="janedoe"
        error={errors.username?.message}
        {...register('username')}
      />
      <Input
        label="Email"
        type="email"
        placeholder="you@example.com"
        error={errors.email?.message}
        {...register('email')}
      />
      <Input
        label="Password"
        type="password"
        placeholder="••••••••"
        error={errors.password?.message}
        {...register('password')}
      />
      <Input
        label="Confirm password"
        type="password"
        placeholder="••••••••"
        error={errors.confirmPassword?.message}
        {...register('confirmPassword')}
      />

      {registerUser.isError && (
        <p className="text-sm text-ember-hot">
          {registerUser.error?.response?.data?.message || 'Something went wrong. Please try again.'}
        </p>
      )}

      <Button type="submit" size="lg" isLoading={registerUser.isPending} className="mt-2">
        Create account
      </Button>

      <p className="text-center text-sm text-paper-muted">
        Already have an account?{' '}
        <Link to="/login" className="text-ember-hot hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}