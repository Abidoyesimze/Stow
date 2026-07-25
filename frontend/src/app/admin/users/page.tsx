"use client";

import { useMemo, useState } from "react";

interface AdminUser {
  id: string;
  wallet: string;
  reputation: number;
  predictions: number;
  status: "Active" | "Banned";
}

const initialUsers: AdminUser[] = [
  {
    id: "USR-001",
    wallet: "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37",
    reputation: 97,
    predictions: 152,
    status: "Active",
  },
  {
    id: "USR-002",
    wallet: "GBXPHQAK66K2CSLZQLIX4B4MJVNQH4K3HYQ6N4HB63XOF6A6ZDIK3ZB5",
    reputation: 81,
    predictions: 118,
    status: "Active",
  },
  {
    id: "USR-003",
    wallet: "GAQ6YEVV7D44CT5P6YAXQ7KNS6OBVUTW7R4OTIR4PPSI6N3ZEU7QWHEV",
    reputation: 42,
    predictions: 34,
    status: "Banned",
  },
];

export default function AdminUsersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<AdminUser[]>(initialUsers);

  const filteredUsers = useMemo(
    () =>
      users.filter((user) =>
        user.wallet.toLowerCase().includes(searchQuery.trim().toLowerCase()),
      ),
    [searchQuery, users],
  );

  const toggleBan = (userId: string) => {
    setUsers((current) =>
      current.map((user) =>
        user.id === userId
          ? {
              ...user,
              status: user.status === "Banned" ? "Active" : "Banned",
            }
          : user,
      ),
    );
  };

  return (
    <section className="space-y-8">
      <header className="rounded-3xl border border-white/10 bg-slate-950/90 p-8 shadow-xl">
        <p className="text-sm uppercase tracking-[0.3em] text-orange-400/90">User management</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Search and moderate users</h1>
        <p className="mt-3 max-w-2xl text-sm text-gray-400">
          Lookup wallet addresses, check reputation, and ban or unban users from the platform.
        </p>
      </header>

      <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Wallet search</h2>
            <p className="mt-2 text-sm text-gray-400">
              Filter user records by wallet address or partial hash.
            </p>
          </div>
          <div className="w-full max-w-md">
            <label htmlFor="user-search" className="sr-only">
              Search wallet address
            </label>
            <input
              id="user-search"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by wallet address"
              className="w-full rounded-3xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20"
            />
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">Reputation stats</h2>
            <p className="mt-2 text-sm text-gray-400">Track top users and manage account status quickly.</p>
          </div>
          <span className="rounded-full bg-white/5 px-3 py-1 text-sm text-gray-300">
            {filteredUsers.length} records shown
          </span>
        </div>

        <div className="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-slate-950/90">
          <table className="min-w-full text-left text-sm text-gray-200">
            <thead className="bg-slate-950/90 text-gray-400">
              <tr>
                <th className="px-4 py-4">Wallet</th>
                <th className="px-4 py-4">Reputation</th>
                <th className="px-4 py-4">Predictions</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-4 py-4">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id} className="border-t border-white/5 hover:bg-white/5">
                  <td className="px-4 py-4 break-all text-white">{user.wallet}</td>
                  <td className="px-4 py-4 text-gray-300">{user.reputation}%</td>
                  <td className="px-4 py-4 text-gray-300">{user.predictions}</td>
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                        user.status === "Active"
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-rose-500/15 text-rose-300"
                      }`}
                    >
                      {user.status}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <button
                      type="button"
                      onClick={() => toggleBan(user.id)}
                      className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                        user.status === "Banned"
                          ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                          : "bg-rose-500 text-white hover:bg-rose-400"
                      }`}
                    >
                      {user.status === "Banned" ? "Unban" : "Ban"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
