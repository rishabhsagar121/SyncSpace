export default function EmptyState({ title, hint, action }) {
  return (
    <div className="py-10 text-center">
      <p className="font-medium">{title}</p>
      {hint && <p className="mt-1 text-sm opacity-70">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}