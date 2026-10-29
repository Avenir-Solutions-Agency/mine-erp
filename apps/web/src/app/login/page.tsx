import { Card } from "@/components/ui/card";
import { hu } from "@/i18n/hu";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm p-6">
        <p className="text-label tracking-widest text-muted-foreground uppercase">
          {hu.brand.name}
        </p>
        <h1 className="mt-1 mb-4">{hu.login.title}</h1>
        <LoginForm />
      </Card>
    </main>
  );
}
