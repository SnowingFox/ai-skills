interface LegalPageProps {
  title: string;
  description: string;
}

export function LegalPage({ title, description }: LegalPageProps) {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-center text-3xl font-bold tracking-tight">{title}</h1>
      <p className="text-center text-muted-foreground">{description}</p>
    </div>
  );
}
