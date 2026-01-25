import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Package,
  Calendar,
  Wrench,
  LogOut,
  Shield,
  Boxes,
  UserCheck,
  Building2,
  MapPin,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Leads', href: '/leads', icon: Users },
  { name: 'Clientes', href: '/customers', icon: UserCheck },
  { name: 'Distribuidores', href: '/distributors', icon: Building2 },
  { name: 'Productos', href: '/products', icon: Package },
  { name: 'Instalaciones', href: '/installations', icon: Calendar },
  { name: 'Inventario', href: '/inventory', icon: Boxes },
  { name: 'Técnicos', href: '/technicians', icon: Wrench },
  { name: 'Rastreo GPS', href: '/tech-tracking', icon: MapPin },
];

export default function Sidebar() {
  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  return (
    <div className="flex flex-col w-64 bg-gray-900 text-white">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-800">
        <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-cyan-600 rounded-xl flex items-center justify-center">
          <Shield className="w-6 h-6 text-gray-900" />
        </div>
        <div>
          <span className="font-bold text-lg">ZAFE</span>
          <span className="font-bold text-lg text-cyan-400">SYS</span>
          <p className="text-xs text-gray-500">Suite</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-cyan-500/10 text-cyan-400'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            {item.name}
          </NavLink>
        ))}
      </nav>

      {/* User / Logout */}
      <div className="px-3 py-4 border-t border-gray-800">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
