'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api-client';
import { registerUser } from './api';
import { registerSchema, type RegisterInput } from './schema';

export function RegisterForm() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: '',
      email: '',
      password: '',
      displayName: '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await registerUser({
        ...values,
        displayName: values.displayName?.trim() || undefined,
      });
      router.replace('/login');
    } catch (error) {
      setSubmitError(
        error instanceof ApiError
          ? error.message
          : 'Unable to create account. Try again.',
      );
    }
  });

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        void onSubmit(event);
      }}
    >
      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-200" htmlFor="username">
          Username
        </label>
        <Input
          id="username"
          autoComplete="username"
          placeholder="john.dev"
          aria-invalid={Boolean(errors.username)}
          {...register('username')}
        />
        {errors.username ? (
          <p className="text-sm text-red-400">{errors.username.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-200" htmlFor="displayName">
          Display name <span className="font-normal text-zinc-600">(optional)</span>
        </label>
        <Input
          id="displayName"
          autoComplete="name"
          placeholder="John"
          aria-invalid={Boolean(errors.displayName)}
          {...register('displayName')}
        />
        {errors.displayName ? (
          <p className="text-sm text-red-400">{errors.displayName.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-200" htmlFor="email">
          Email
        </label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          aria-invalid={Boolean(errors.email)}
          {...register('email')}
        />
        {errors.email ? (
          <p className="text-sm text-red-400">{errors.email.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-200" htmlFor="password">
          Password
        </label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(errors.password)}
          {...register('password')}
        />
        <p className="text-xs text-zinc-600">Use 8 to 128 characters.</p>
        {errors.password ? (
          <p className="text-sm text-red-400">{errors.password.message}</p>
        ) : null}
      </div>

      {submitError ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {submitError}
        </div>
      ) : null}

      <Button className="w-full" disabled={isSubmitting} type="submit">
        {isSubmitting ? 'Creating account…' : 'Create account'}
      </Button>
    </form>
  );
}
