import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionMock, signOutMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  signOutMock: vi.fn(),
}));

vi.mock("next-auth/react", () => ({
  getSession: getSessionMock,
  signOut: signOutMock,
}));

import { api } from "./api";
import { useAuthStore } from "@/store/auth-store";

const validSession = {
  user: {
    id: "user-1",
    name: "Ada",
    email: "ada@example.com",
    image: null,
  },
  expires: "2099-01-01T00:00:00.000Z",
};

describe("authenticated API recovery", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    getSessionMock.mockReset();
    signOutMock.mockReset();
    signOutMock.mockResolvedValue({ url: "/login" });
    useAuthStore.setState({
      status: "loading",
      user: null,
      lastSyncedAt: null,
    });
  });

  it("refreshes the Auth.js session and retries once after a 401", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ error: "Unauthorized" }, { status: 401 }),
      )
      .mockResolvedValueOnce(Response.json({ name: "Ada" }));
    vi.stubGlobal("fetch", fetchMock);
    getSessionMock.mockResolvedValue(validSession);

    await expect(api<{ name: string }>("/api/account")).resolves.toEqual({
      name: "Ada",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getSessionMock).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState()).toMatchObject({
      status: "authenticated",
      user: validSession.user,
    });
    expect(signOutMock).not.toHaveBeenCalled();
  });

  it("logs out when the API rejects the refreshed session too", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ error: "Unauthorized" }, { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    getSessionMock.mockResolvedValue(validSession);

    await expect(api("/api/account")).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(useAuthStore.getState()).toMatchObject({
      status: "unauthenticated",
      user: null,
    });
    expect(signOutMock).toHaveBeenCalledWith({
      redirect: false,
      redirectTo: expect.stringContaining("/login?reason=session_expired"),
    });
  });
});
