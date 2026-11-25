import type { PublicUser } from "@repo/shared";

export class AuthAdapter {
  private readonly users = new Map<string, PublicUser>([
    [
      "dev-alice",
      {
        id: "alice",
        username: "alice",
        displayName: "Alice",
        avatarUrl: null,
      },
    ],
    [
      "dev-bob",
      {
        id: "bob",
        username: "bob",
        displayName: "Bob",
        avatarUrl: null,
      },
    ],
    [
      "dev-charlie",
      {
        id: "charlie",
        username: "charlie",
        displayName: "Charlie",
        avatarUrl: null,
      },
    ],
  ]);

  public async authenticate(
    token: string
  ): Promise<PublicUser | null> {
    return this.users.get(token) ?? null;
  }
}

