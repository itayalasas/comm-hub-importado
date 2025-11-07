import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileText, Settings, BarChart3, Book, Menu, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { TrialBanner } from './TrialBanner';
import { UserMenu } from './UserMenu';

interface LayoutProps {
  children: ReactNode;
  currentPage: string;
}

export const Layout = ({ children, currentPage }: LayoutProps) => {
  const { hasMenuAccess } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navigation = [
    { name: 'Dashboard', icon: LayoutDashboard, page: 'dashboard', route: 'dashboard', permissionKey: 'dashboard' },
    { name: 'Templates', icon: FileText, page: 'templates', route: 'templates', permissionKey: 'templates' },
    { name: 'Estadísticas', icon: BarChart3, page: 'statistics', route: 'statistics', permissionKey: 'statistics' },
    { name: 'Documentación', icon: Book, page: 'documentation', route: 'documentation', permissionKey: 'documentation' },
    { name: 'Configuración', icon: Settings, page: 'settings', route: 'settings', permissionKey: 'settings' },
  ].filter(item => hasMenuAccess(item.permissionKey));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <nav className="sticky top-0 z-40 border-b border-slate-700 bg-slate-900/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden p-2 rounded-lg hover:bg-slate-800/50 transition-colors"
                aria-label="Toggle menu"
              >
                {isMobileMenuOpen ? (
                  <X className="w-6 h-6 text-slate-400" />
                ) : (
                  <Menu className="w-6 h-6 text-slate-400" />
                )}
              </button>
              <img src="/logo.svg" alt="CommHub" className="h-8" />
            </div>
            <UserMenu />
          </div>
        </div>
      </nav>

      <TrialBanner />

      <div className="flex relative">
        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        <aside className={`
          fixed lg:static inset-y-0 left-0 z-40
          w-64 min-h-[calc(100vh-4rem)] border-r border-slate-700 bg-slate-900/95 backdrop-blur-sm
          transform transition-transform duration-300 ease-in-out lg:transform-none
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          <nav className="p-4 space-y-2 mt-16 lg:mt-0">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === `/${item.route}` || currentPage === item.page;
              return (
                <Link
                  key={item.name}
                  to={`/${item.route}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-cyan-500/10 text-cyan-400'
                      : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 w-full lg:w-auto">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
};
