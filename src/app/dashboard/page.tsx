"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Laden...</p>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-blue-700">AbiOrga</h1>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">{session.user.name}</p>
              <p className="text-xs text-gray-500">{session.user.role}</p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
            >
              Abmelden
            </button>
          </div>
        </div>
      </header>

      {/* Hauptbereich */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">
            Willkommen, {session.user.name?.split(" ")[0]}! 👋
          </h2>
          <p className="text-gray-500 mt-1">
            Deine Rolle: <span className="font-medium text-blue-600">{session.user.role}</span>
          </p>
        </div>

        {/* Platzhalter-Karten für die Module */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <ModuleCard
            title="Aufgaben"
            description="Aufgaben verwalten und Mülldienst-Rotation"
            icon="📋"
            comingSoon={true}
          />
          <ModuleCard
            title="Finanzen"
            description="Kassenbuch und Transaktionen"
            icon="💰"
            comingSoon={true}
          />
          <ModuleCard
            title="Benachrichtigungen"
            description="Pinnwand und Announcements"
            icon="🔔"
            comingSoon={true}
          />
          <ModuleCard
            title="Teams"
            description="Teams organisieren und chatten"
            icon="👥"
            comingSoon={true}
          />
          <ModuleCard
            title="Stories"
            description="Fortschritt teilen"
            icon="📸"
            comingSoon={true}
          />
        </div>
      </main>
    </div>
  );
}

function ModuleCard({
  title,
  description,
  icon,
  comingSoon,
}: {
  title: string;
  description: string;
  icon: string;
  comingSoon?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border p-6 hover:shadow-md transition relative">
      {comingSoon && (
        <span className="absolute top-3 right-3 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
          Bald verfügbar
        </span>
      )}
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="font-semibold text-gray-900">{title}</h3>
      <p className="text-sm text-gray-500 mt-1">{description}</p>
    </div>
  );
}