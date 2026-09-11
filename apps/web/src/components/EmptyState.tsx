import type { JSX } from 'react';
export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps): JSX.Element {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-10 text-center">
      <h2 className="text-lg font-medium">{title}</h2>
      {description ? <p className="text-muted">{description}</p> : null}
      {action}
    </div>
  );
}
