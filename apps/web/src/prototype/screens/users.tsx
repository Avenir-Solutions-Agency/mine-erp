"use client";

import type { MenuAccess, UserDto } from "@mine-erp/contracts";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pill } from "@/components/ui/pill";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/toast";
import { hu } from "@/i18n/hu";
import { useCanWrite, useMe } from "@/prototype/access";
import { api } from "@/prototype/api";
import { NAV } from "@/prototype/nav";
import {
  Alert,
  Btn,
  Field,
  Grid,
  Head,
  Inp,
  Panel,
  Row,
  Sel,
  Small,
} from "@/prototype/ui";

// Felhasználók: ERP accounts and their per-menu access (read or write). The API decides; this
// screen only edits.

const t = hu.users;

/** Reads the per-menu selects ("access.<menu>") of a form into a MenuAccess. */
function accessFrom(form: FormData): MenuAccess {
  const access: Record<string, "read" | "write"> = {};
  for (const [key, value] of form.entries()) {
    if (!key.startsWith("access.")) continue;
    if (value === "read" || value === "write") access[key.slice(7)] = value;
  }
  return access as MenuAccess;
}

function MenuPicker({ access }: { access?: MenuAccess }) {
  const box = useRef<HTMLDivElement>(null);
  // The selects are uncontrolled (read through FormData on submit), so set them directly.
  const setAll = (level: "" | "read" | "write") =>
    box.current
      ?.querySelectorAll<HTMLSelectElement>('select[name^="access."]')
      .forEach((s) => (s.value = level));
  return (
    <div ref={box} className="flex flex-col gap-3">
      <Row>
        <Small>{t.setAll}</Small>
        <Btn sm onClick={() => setAll("")}>
          {t.level.none}
        </Btn>
        <Btn sm onClick={() => setAll("read")}>
          {t.allRead}
        </Btn>
        <Btn sm onClick={() => setAll("write")}>
          {t.allWrite}
        </Btn>
      </Row>
      {NAV.map(({ group, items }) => (
        <fieldset key={group} className="flex flex-col gap-1.5">
          <legend className="mb-1 text-label tracking-widest text-muted-foreground uppercase">
            {hu.nav.groups[group]}
          </legend>
          <Grid cols={2}>
            {items.map(({ id }) => (
              <Field key={id} label={hu.nav.routes[id]}>
                <Sel name={`access.${id}`} defaultValue={access?.[id] ?? ""}>
                  <option value="">{t.level.none}</option>
                  <option value="read">{t.level.read}</option>
                  <option value="write">{t.level.write}</option>
                </Sel>
              </Field>
            ))}
          </Grid>
        </fieldset>
      ))}
    </div>
  );
}

async function send(path: string, method: "POST" | "PATCH", body: object) {
  try {
    await api(path, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return true;
  } catch (e) {
    toast((e as Error).message);
    return false;
  }
}

export function UsersScreen() {
  const [rows, setRows] = useState<UserDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<UserDto | null>(null);
  const [busy, setBusy] = useState(false);
  const canWrite = useCanWrite("users");
  const me = useMe();

  const load = useCallback(async () => {
    try {
      setRows(await api<UserDto[]>("users"));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    let live = true;
    api<UserDto[]>("users")
      .then((r) => live && setRows(r))
      .catch((e: unknown) => live && setError((e as Error).message));
    return () => {
      live = false;
    };
  }, []);

  const run = async (ok: Promise<boolean>, done: string) => {
    setBusy(true);
    const success = await ok;
    setBusy(false);
    if (success) {
      toast(done);
      await load();
    }
    return success;
  };

  return (
    <>
      <Head
        title={t.title}
        sub={t.sub}
        right={
          canWrite ? (
            <Btn kind="pri" onClick={() => setAdding(true)}>
              {t.add}
            </Btn>
          ) : null
        }
      />
      {!canWrite ? <Alert lvl="warn">{t.readOnly}</Alert> : null}
      {error ? (
        <Alert lvl="bad">{error}</Alert>
      ) : rows === null ? (
        <p className="text-sm text-muted-foreground">{hu.loading}</p>
      ) : (
        <Panel className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.name}</TableHead>
                <TableHead>{t.email}</TableHead>
                <TableHead>{t.menus}</TableHead>
                <TableHead>{t.status}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length ? (
                rows.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      {u.name} {u.id === me?.id ? <Small>{t.you}</Small> : null}
                    </TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      {t.count(Object.keys(u.access).length)}
                    </TableCell>
                    <TableCell>
                      {u.active ? (
                        <Pill tone="success">{t.active}</Pill>
                      ) : (
                        <Pill tone="neutral">{t.inactive}</Pill>
                      )}
                    </TableCell>
                    <TableCell>
                      {canWrite ? (
                        <Row className="flex-nowrap">
                          <Btn sm onClick={() => setEditing(u)}>
                            {t.edit}
                          </Btn>
                          {u.id !== me?.id ? (
                            <Btn
                              sm
                              disabled={busy}
                              onClick={() =>
                                void run(
                                  send(`users/${u.id}`, "PATCH", {
                                    active: !u.active,
                                  }),
                                  t.saved,
                                )
                              }
                            >
                              {u.active ? t.disable : t.enable}
                            </Btn>
                          ) : null}
                        </Row>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    {t.empty}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Panel>
      )}

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t.add}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const ok = await run(
                send("users", "POST", {
                  name: String(f.get("name") ?? "").trim(),
                  email: String(f.get("email") ?? "").trim(),
                  password: String(f.get("password") ?? ""),
                  access: accessFrom(f),
                }),
                t.created,
              );
              if (ok) setAdding(false);
            }}
          >
            <Grid cols={2} className="mb-3">
              <Field label={t.name}>
                <Inp name="name" required maxLength={120} autoComplete="off" />
              </Field>
              <Field label={t.email}>
                <Inp name="email" type="email" required autoComplete="off" />
              </Field>
              <Field label={t.password} className="col-span-full">
                <Inp
                  name="password"
                  type="password"
                  required
                  minLength={10}
                  maxLength={72}
                  autoComplete="new-password"
                />
              </Field>
            </Grid>
            <Small className="mb-3">{t.passwordHint}</Small>
            <MenuPicker />
            <DialogFooter className="mt-3">
              <Btn onClick={() => setAdding(false)}>{t.cancel}</Btn>
              <Btn kind="pri" type="submit" disabled={busy}>
                {t.create}
              </Btn>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editing != null}
        onOpenChange={(o) => !o && setEditing(null)}
      >
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {t.edit}: {editing?.email}
            </DialogTitle>
          </DialogHeader>
          {editing ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const ok = await run(
                  send(`users/${editing.id}`, "PATCH", {
                    name: String(f.get("name") ?? "").trim(),
                    access: accessFrom(f),
                  }),
                  t.saved,
                );
                if (ok) setEditing(null);
              }}
            >
              <Field label={t.name} className="mb-3">
                <Inp
                  name="name"
                  required
                  maxLength={120}
                  defaultValue={editing.name}
                  autoComplete="off"
                />
              </Field>
              <MenuPicker access={editing.access} />
              <DialogFooter className="mt-3">
                <Btn onClick={() => setEditing(null)}>{t.cancel}</Btn>
                <Btn kind="pri" type="submit" disabled={busy}>
                  {t.save}
                </Btn>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
