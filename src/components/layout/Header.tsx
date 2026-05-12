
import React from 'react';
import { Button } from '@/components/ui/button';
import { Car, Users, ToggleLeft, ToggleRight } from 'lucide-react';
import { useAppContext } from '@/context/AppContext';

export const Header: React.FC = () => {
  const { state, dispatch } = useAppContext();

  const toggleViewMode = () => {
    const newMode = state.viewMode === 'customer' ? 'vendor' : 'customer';
    dispatch({ type: 'SET_VIEW_MODE', payload: newMode });
    console.log('Switched to', newMode, 'view');
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

        {/* View Mode Toggle */}
        <div className="flex items-center space-x-4">
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

          {/* Toggle Icon */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleViewMode}
            className="p-2 hover:bg-secondary-100 transition-colors"
          >
            {state.viewMode === 'customer' ? (
              <ToggleLeft className="w-5 h-5 text-secondary-600" />
            ) : (
              <ToggleRight className="w-5 h-5 text-primary-600" />
            )}
          </Button>
        </div>
      </div>
    </header>
  );
};
