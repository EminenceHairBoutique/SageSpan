import { ButtonLink, Card } from "@/ui/primitives";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto max-w-lg px-4 py-20">
      <Card title="Not found" subtitle="The page or record does not exist, or belongs to another organisation.">
        <div className="flex gap-3">
          <ButtonLink href="/">Home</ButtonLink>
          <ButtonLink href="/demo/app/reviews" variant="secondary">
            Review queue
          </ButtonLink>
        </div>
      </Card>
    </main>
  );
}
