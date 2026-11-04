import clsx from 'clsx';

export default function Card({ as: Tag = 'div', interactive = false, className, children, ...props }) {
  return (
    <Tag
      className={clsx(
        'surface rounded-xl2 p-6',
        interactive && 'transition-transform duration-200 hover:-translate-y-0.5 cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}