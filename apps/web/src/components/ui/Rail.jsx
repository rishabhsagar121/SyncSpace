export default function Rail({ title, action, children }) {
  return (
    <section className="mb-10">
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between px-1">
          {title && <h2 className="font-display text-lg font-bold text-paper">{title}</h2>}
          {action}
        </div>
      )}
      <div className="rail-scroll flex gap-4 overflow-x-auto pb-2">
        {children}
      </div>
    </section>
  );
}