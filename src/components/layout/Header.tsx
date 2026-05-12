
import React from 'react';
import { Button } from '@/components/ui/button';
import { Car, Users, LogOut } from 'lucide-react';
import { useAppContext } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

export const Header: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const { user, isVendor, isAdmin, signOut } = useAuth();
  const canBeVendor = isVendor || isAdmin;

  const toggleViewMode = () => {
    const newMode = state.viewMode === 'customer' ? 'vendor' : 'customer';
    if (newMode === 'vendor' && !canBeVendor) {
      toast.error('Your account is not registered as a vendor.');
      return;
    }
    dispatch({ type: 'SET_VIEW_MODE', payload: newMode });
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-secondary-200 glass backdrop-blur-xl">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center">
            <Car className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gradient">ShuttleBook</h1>
            <p className="text-xs text-secondary-600 -mt-1">Professional Transport</p>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center space-x-4">
          {canBeVendor && (
          <div className="flex items-center space-x-3 bg-secondary-100 rounded-full p-1">
            <Button
              variant={state.viewMode === 'customer' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => state.viewMode !== 'customer' && toggleViewMode()}
              className={`px-4 py-2 rounded-full transition-all duration-300 ${
                state.viewMode === 'customer'
                  ? 'gradient-primary text-white shadow-elevation'
                  : 'text-secondary-600 hover:text-secondary-800'
              }`}
            >
              <Users className="w-4 h-4 mr-2" />
              Customer
            </Button>
            <Button
              variant={state.viewMode === 'vendor' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => state.viewMode !== 'vendor' && toggleViewMode()}
              className={`px-4 py-2 rounded-full transition-all duration-300 ${
                state.viewMode === 'vendor'
                  ? 'gradient-primary text-white shadow-elevation'
                  : 'text-secondary-600 hover:text-secondary-800'
              }`}
            >
              <Car className="w-4 h-4 mr-2" />
              Vendor
            </Button>
          </div>
          )}

          {user && (
            <>
              <span className="text-sm text-secondary-600 hidden sm:inline">{user.email}</span>
              <Button variant="ghost" size="sm" onClick={() => signOut()}>
                <LogOut className="w-4 h-4 mr-2" /> Sign out
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
