export default function Avatar({ user, size = 36 }) {
  const name = user?.displayName || user?.username || '?';
  const initials = name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  const style = { width: size, height: size, fontSize: size * 0.38 };
  if (user?.avatarUrl)
    return <img src={user.avatarUrl} alt="" style={style} className="rounded-full object-cover shrink-0" />;
  return (
    <span
      style={style}
      className="inline-flex items-center justify-center rounded-full shrink-0 font-semibold bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-100"
    >
      {initials}
    </span>
  );
}