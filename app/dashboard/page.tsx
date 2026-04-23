'use client';

import { useAccount } from 'wagmi';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PlusCircle } from 'lucide-react';

import { Dashboard } from '@/components/dashboard';
import DashboardCard from '@/components/DashboardCard';
import DashboardSkeleton from '@/components/dashboard-skeleton';
import { NoUserAjosEmpty } from '@/components/ui/empty-states';
import { Button } from '@/components/ui/button';

interface UserAjo {
  id: string;
  name: string;
  contractAddress: string;
  contributionAmt: string;
  cycleDuration: number;
  maxMembers: number;
  status: string;
  createdAt: Date;
}

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const [userAjos, setUserAjos] = useState<UserAjo[]>([]);
  const [ajosLoading, setAjosLoading] = useState(false);

  useEffect(() => {
    if (!address || !isConnected) {
      setUserAjos([]);
      return;
    }

    setAjosLoading(true);
    fetch(`/api/user-ajos?address=${address}`)
      .then((response) => response.json())
      .then((data) => {
        setUserAjos(Array.isArray(data) ? data : []);
      })
      .catch((error) => {
        console.error('Error fetching user ajos:', error);
      })
      .finally(() => {
        setAjosLoading(false);
      });
  }, [address, isConnected]);

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-background">
        <div className="text-center max-w-md">
          <h1 className="text-3xl font-bold mb-6 text-foreground">Connect your Wallet to enter.</h1>
          <Button size="lg" className="w-full max-w-sm mx-auto">Connect Wallet</Button>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <Dashboard activeGroups={[]} loading={false} />

      <div className="container mx-auto px-4 py-10 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-foreground">My Ajos</h1>
          <Button asChild>
            <Link href="/circles/create">
              <PlusCircle className="mr-2 h-4 w-4" />
              Create Ajo
            </Link>
          </Button>
        </div>

        {ajosLoading ? (
          <DashboardSkeleton />
        ) : userAjos.length === 0 ? (
          <NoUserAjosEmpty />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {userAjos.map((ajo) => (
              <DashboardCard key={ajo.id} ajo={ajo} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
