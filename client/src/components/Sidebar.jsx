import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { ShieldAlert, Activity, Network, ListTree, Settings, LogOut, Home } from 'lucide-react';

export default function Sidebar() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const menuItems = [
    { name: 'Dashboard', icon: Home, path: '/' },
    { name: 'Live Feed', icon: Activity, path: '/logs' },
    { name: 'Network Graph', icon: Network, path: '/graph' },
    { name: 'Incidents', icon: ShieldAlert, path: '/incidents' },
    { name: 'Analytics', icon: ListTree, path: '/analytics' },
  ];

  return (
    <div className="w-64 h-screen bg-base-900 border-r border-base-700 flex flex-col fixed left-0 top-0">
      <div className="p-6 flex items-center space-x-3 mb-6">
        <div className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.5)]">
          <ShieldAlert className="text-white w-5 h-5" />
        </div>
        <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary-400 to-accent-400">
          AiWatch
        </span>
      </div>

      <nav className="flex-1 px-4 space-y-2">
        {menuItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'bg-primary-500/10 text-primary-400 border border-primary-500/20 shadow-[inset_0_0_10px_rgba(59,130,246,0.1)]'
                  : 'text-gray-400 hover:text-gray-100 hover:bg-base-700/50'
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            <span className="font-medium">{item.name}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-base-700">
        <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 mb-2 ${
                isActive
                  ? 'bg-primary-500/10 text-primary-400 border border-primary-500/20'
                  : 'text-gray-400 hover:text-gray-100 hover:bg-base-700/50'
              }`
            }
        >
          <Settings className="w-5 h-5" />
          <span className="font-medium">Settings</span>
        </NavLink>
        
        <button
          onClick={handleLogout}
          className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-gray-400 hover:text-danger-400 hover:bg-danger-500/10 transition-all duration-200"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </div>
  );
}
