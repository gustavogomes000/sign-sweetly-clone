import { Outlet } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { AnimatedBackground } from './AnimatedBackground';

export function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-background relative">
      <AnimatedBackground />
      <AppSidebar />
      <main className="flex-1 flex flex-col overflow-hidden relative z-10">
        <Outlet />
      </main>
    </div>
  );
}
